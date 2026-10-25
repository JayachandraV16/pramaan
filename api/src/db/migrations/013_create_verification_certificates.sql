-- =============================================================================
-- Migration 013: Verification Certificates
-- =============================================================================
-- The official digital verification certificate. One-to-one with
-- verifications, enforced via UNIQUE(verification_id).
--
-- QR data is stored directly on the certificate (qr_token) per scope rules —
-- no separate QR_Code table. Certificate validity is derived from
-- (valid_from, valid_until, status); no separate Validity_Period table.
-- =============================================================================

CREATE TABLE verification_certificates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    verification_id      UUID NOT NULL REFERENCES verifications(id) ON DELETE RESTRICT,
    instrument_id          UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,

    certificate_number      TEXT NOT NULL,

    issue_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_from                 DATE NOT NULL,
    valid_until                 DATE NOT NULL,

    status                       certificate_status NOT NULL DEFAULT 'ACTIVE',

    -- Reference to the generated certificate file (PDF), stored on disk/S3
    -- etc. — the DB stores metadata/reference, not the binary itself.
    certificate_file_url         TEXT,

    -- Opaque, unguessable token embedded in the certificate's QR code and
    -- used for public authentication lookups (see qr_authentications).
    qr_token                      TEXT NOT NULL DEFAULT replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),

    generated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_verification_certificates_verification_id UNIQUE (verification_id),
    CONSTRAINT uq_verification_certificates_number UNIQUE (certificate_number),
    CONSTRAINT uq_verification_certificates_qr_token UNIQUE (qr_token),
    CONSTRAINT ck_verification_certificates_validity_order CHECK (valid_until >= valid_from)
);

COMMENT ON TABLE verification_certificates IS 'Digital verification certificate issued after a PASS decision. QR token and validity period live on this table (no separate QR/validity tables).';
COMMENT ON COLUMN verification_certificates.qr_token IS 'Opaque unique token embedded in the certificate QR code, used for public authentication lookups.';
COMMENT ON COLUMN verification_certificates.certificate_file_url IS 'Reference/path to the generated certificate file (PDF) in object storage; the DB does not store the binary.';

CREATE UNIQUE INDEX idx_verification_certificates_number ON verification_certificates (certificate_number);
CREATE UNIQUE INDEX idx_verification_certificates_qr_token ON verification_certificates (qr_token);
CREATE INDEX idx_verification_certificates_instrument_id ON verification_certificates (instrument_id);
CREATE INDEX idx_verification_certificates_status ON verification_certificates (status);
-- Supports "expiring soon" / "expired" / "active" queries efficiently.
CREATE INDEX idx_verification_certificates_valid_until ON verification_certificates (valid_until);
CREATE INDEX idx_verification_certificates_status_valid_until ON verification_certificates (status, valid_until);

CREATE TRIGGER trg_verification_certificates_set_updated_at
    BEFORE UPDATE ON verification_certificates
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Business rule: a certificate may only be created for a verification whose
-- verification_results.decision = 'PASS'. This is a cross-table rule that a
-- plain CHECK constraint cannot express, so it is enforced with a trigger —
-- consistent with how the assignee-role rule is enforced in migration 007.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_certificate_requires_pass()
RETURNS TRIGGER AS $$
DECLARE
    v_decision verification_decision;
BEGIN
    SELECT decision INTO v_decision
    FROM verification_results
    WHERE verification_id = NEW.verification_id;

    IF v_decision IS NULL THEN
        RAISE EXCEPTION 'Cannot issue certificate: verification % has no recorded result yet', NEW.verification_id;
    ELSIF v_decision <> 'PASS' THEN
        RAISE EXCEPTION 'Cannot issue certificate: verification % result is %, not PASS', NEW.verification_id, v_decision;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_certificate_requires_pass
    BEFORE INSERT ON verification_certificates
    FOR EACH ROW
    EXECUTE FUNCTION check_certificate_requires_pass();

-- ---------------------------------------------------------------------------
-- Convenience view: certificates that are currently valid (ACTIVE status AND
-- today's date within [valid_from, valid_until]). This avoids repeating the
-- same date-range logic in every backend query and directly supports the
-- "active certificates" retrieval requirement.
-- ---------------------------------------------------------------------------
CREATE VIEW active_certificates AS
SELECT c.*
FROM verification_certificates c
WHERE c.status = 'ACTIVE'
  AND CURRENT_DATE BETWEEN c.valid_from AND c.valid_until;

COMMENT ON VIEW active_certificates IS 'Certificates that are ACTIVE and within their validity window as of today.';