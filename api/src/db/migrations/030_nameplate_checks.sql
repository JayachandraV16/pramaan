-- 030_nameplate_checks.sql
-- OCR-assisted nameplate check. A photo of an instrument's nameplate is read by a
-- local OCR engine and compared with the registered data. The machine output is a
-- SUGGESTION: it is stored immutably as evidence, and only a person (who is not the
-- uploader) can record a decision. Nothing here changes the instrument, its
-- certificates or enforcement cases.

CREATE TYPE nameplate_check_status AS ENUM (
    'PENDING_REVIEW',
    'CONFIRMED_MATCH',
    'CONFIRMED_MISMATCH',
    'UNREADABLE'
);

CREATE TABLE nameplate_checks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id       UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    uploaded_by_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- the photograph
    file_url            TEXT NOT NULL,
    file_sha256         TEXT NOT NULL,
    mime_type           TEXT,

    -- machine output (immutable)
    engine              TEXT NOT NULL,
    ocr_confidence      NUMERIC(5, 2),
    raw_text            TEXT NOT NULL,
    extracted           JSONB NOT NULL,
    registered_snapshot JSONB NOT NULL,   -- the registered values it was compared with
    comparison          JSONB NOT NULL,
    advisory            TEXT NOT NULL,    -- ALL_MATCH | NEEDS_REVIEW | LIKELY_MISMATCH | UNREADABLE
    advisory_summary    TEXT NOT NULL,

    -- the human decision
    status              nameplate_check_status NOT NULL DEFAULT 'PENDING_REVIEW',
    reviewed_by_id      UUID REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at         TIMESTAMPTZ,
    review_note         TEXT,
    reviewer_values     JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_nameplate_checks_advisory CHECK (advisory IN ('ALL_MATCH', 'NEEDS_REVIEW', 'LIKELY_MISMATCH', 'UNREADABLE')),
    CONSTRAINT ck_nameplate_checks_review_complete CHECK (
        (status = 'PENDING_REVIEW' AND reviewed_by_id IS NULL AND reviewed_at IS NULL)
        OR (status <> 'PENDING_REVIEW' AND reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT ck_nameplate_checks_reviewer_not_uploader CHECK (reviewed_by_id IS NULL OR reviewed_by_id <> uploaded_by_id)
);

CREATE INDEX idx_nameplate_checks_instrument ON nameplate_checks (instrument_id, created_at DESC);
CREATE INDEX idx_nameplate_checks_pending ON nameplate_checks (created_at) WHERE status = 'PENDING_REVIEW';

-- Evidence cannot be rewritten; a check is decided once; nothing is deleted.
CREATE OR REPLACE FUNCTION protect_nameplate_check()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Nameplate checks cannot be deleted';
    END IF;
    IF NEW.instrument_id IS DISTINCT FROM OLD.instrument_id
       OR NEW.uploaded_by_id IS DISTINCT FROM OLD.uploaded_by_id
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
       OR NEW.engine IS DISTINCT FROM OLD.engine
       OR NEW.ocr_confidence IS DISTINCT FROM OLD.ocr_confidence
       OR NEW.raw_text IS DISTINCT FROM OLD.raw_text
       OR NEW.extracted IS DISTINCT FROM OLD.extracted
       OR NEW.registered_snapshot IS DISTINCT FROM OLD.registered_snapshot
       OR NEW.comparison IS DISTINCT FROM OLD.comparison
       OR NEW.advisory IS DISTINCT FROM OLD.advisory
       OR NEW.advisory_summary IS DISTINCT FROM OLD.advisory_summary THEN
        RAISE EXCEPTION 'The machine output of a nameplate check is evidence and cannot be changed';
    END IF;
    IF OLD.status <> 'PENDING_REVIEW' THEN
        RAISE EXCEPTION 'This nameplate check has already been decided';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nameplate_checks_protect
    BEFORE UPDATE OR DELETE ON nameplate_checks
    FOR EACH ROW
    EXECUTE FUNCTION protect_nameplate_check();
