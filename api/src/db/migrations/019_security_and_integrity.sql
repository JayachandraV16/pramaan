-- =============================================================================
-- Migration 019: Security and integrity foundations
-- =============================================================================
-- 1. users.status gets PENDING_APPROVAL: LMO/GATC accounts may self-register
--    (problem statement: online registration of stakeholders) but cannot log
--    in until an ADMIN approves them.
-- 2. verification_certificates: SHA-256 of the issued PDF and of the
--    canonical certificate record (tamper detection), plus structured
--    revocation fields. Core fields become immutable after issue and a
--    REVOKED certificate can no longer be reactivated.
-- 3. attachments.file_sha256: server-side hash of every uploaded file.
-- 4. audit_log: append-only, hash-chained history of sensitive actions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pending approval for staff self-registration
-- ---------------------------------------------------------------------------
-- (Added value is not used elsewhere in this migration; PostgreSQL requires a
-- new enum value to be committed before use.)
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- ---------------------------------------------------------------------------
-- 2. Certificate integrity + revocation
-- ---------------------------------------------------------------------------
ALTER TABLE verification_certificates
    ADD COLUMN pdf_sha256         TEXT,
    ADD COLUMN record_sha256      TEXT,
    ADD COLUMN revoked_at         TIMESTAMPTZ,
    ADD COLUMN revoked_by_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN revocation_reason  TEXT;

COMMENT ON COLUMN verification_certificates.pdf_sha256 IS 'SHA-256 (hex) of the issued certificate PDF bytes. Lets a printed/emailed copy be checked against the registry.';
COMMENT ON COLUMN verification_certificates.record_sha256 IS 'SHA-256 (hex) of the canonical certificate record (number, instrument, verification, dates, qr_token). Recomputed on every public verification to detect direct database edits.';

ALTER TABLE verification_certificates
    ADD CONSTRAINT ck_verification_certificates_revocation_consistency
        CHECK (status <> 'REVOKED' OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL))
        NOT VALID;

-- Issued certificates are legal records:
--   * identity/validity columns cannot be changed after insert
--   * pdf_sha256 / record_sha256 / certificate_file_url may be set once
--     (they are filled in right after the PDF is generated)
--   * a REVOKED certificate can never be reactivated
--   * EXPIRED can only be reached from ACTIVE, REVOKED only from ACTIVE/EXPIRED
CREATE OR REPLACE FUNCTION protect_issued_certificate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.certificate_number IS DISTINCT FROM OLD.certificate_number
       OR NEW.qr_token        IS DISTINCT FROM OLD.qr_token
       OR NEW.verification_id IS DISTINCT FROM OLD.verification_id
       OR NEW.instrument_id   IS DISTINCT FROM OLD.instrument_id
       OR NEW.issue_date      IS DISTINCT FROM OLD.issue_date
       OR NEW.valid_from      IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until     IS DISTINCT FROM OLD.valid_until THEN
        RAISE EXCEPTION 'Issued certificate % cannot be modified (identity and validity are immutable)', OLD.certificate_number;
    END IF;

    IF OLD.pdf_sha256 IS NOT NULL AND NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 THEN
        RAISE EXCEPTION 'pdf_sha256 of certificate % is write-once', OLD.certificate_number;
    END IF;
    IF OLD.record_sha256 IS NOT NULL AND NEW.record_sha256 IS DISTINCT FROM OLD.record_sha256 THEN
        RAISE EXCEPTION 'record_sha256 of certificate % is write-once', OLD.certificate_number;
    END IF;
    IF OLD.certificate_file_url IS NOT NULL AND NEW.certificate_file_url IS DISTINCT FROM OLD.certificate_file_url THEN
        RAISE EXCEPTION 'certificate_file_url of certificate % is write-once', OLD.certificate_number;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'REVOKED' THEN
            RAISE EXCEPTION 'Certificate % is REVOKED and cannot change status', OLD.certificate_number;
        END IF;
        IF OLD.status = 'EXPIRED' AND NEW.status = 'ACTIVE' THEN
            RAISE EXCEPTION 'Certificate % is EXPIRED and cannot be reactivated; issue a new one via re-verification', OLD.certificate_number;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_issued_certificate
    BEFORE UPDATE ON verification_certificates
    FOR EACH ROW
    EXECUTE FUNCTION protect_issued_certificate();

-- ---------------------------------------------------------------------------
-- 3. Attachment content hash
-- ---------------------------------------------------------------------------
ALTER TABLE attachments
    ADD COLUMN file_sha256 TEXT;

COMMENT ON COLUMN attachments.file_sha256 IS 'SHA-256 (hex) of the uploaded file computed by the server at upload time.';

-- ---------------------------------------------------------------------------
-- 4. Tamper-evident audit log (hash chain)
-- ---------------------------------------------------------------------------
-- Each row stores hash = SHA-256(prev_hash || canonical row). Rows are
-- appended inside a transaction holding an advisory lock (see
-- src/utils/audit.js), so the chain is linear. UPDATE/DELETE are blocked.
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id     UUID REFERENCES users(id) ON DELETE RESTRICT,
    action       TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    TEXT,
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash    TEXT,
    hash         TEXT NOT NULL,

    CONSTRAINT ck_audit_log_action_not_blank CHECK (length(trim(action)) > 0)
);

COMMENT ON TABLE audit_log IS 'Append-only, hash-chained history of sensitive actions (issue, revoke, role/status changes, results).';

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log (actor_id);
CREATE INDEX idx_audit_log_occurred_at ON audit_log (occurred_at);

CREATE OR REPLACE FUNCTION audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_append_only();
