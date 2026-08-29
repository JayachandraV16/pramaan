-- =============================================================================
-- Migration 006: Verification Applications
-- =============================================================================
-- Represents the REQUEST for verification/re-verification. Distinct from the
-- actual field Verification activity (see migration 009).
-- =============================================================================

CREATE TABLE verification_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_number  TEXT NOT NULL,

    applicant_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    instrument_id       UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,

    application_type    application_type NOT NULL,
    status              application_status NOT NULL DEFAULT 'DRAFT',

    purpose             TEXT,
    remarks             TEXT,

    submitted_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_verification_applications_number UNIQUE (application_number),

    -- A DRAFT application has not been submitted yet; anything past DRAFT
    -- must carry a submission timestamp.
    CONSTRAINT ck_verification_applications_submitted_consistency CHECK (
        (status = 'DRAFT' AND submitted_at IS NULL) OR
        (status <> 'DRAFT' AND submitted_at IS NOT NULL)
    )
);

COMMENT ON TABLE verification_applications IS 'A stakeholder request for verification or re-verification of an instrument (the "request" side of the workflow).';

CREATE INDEX idx_verification_applications_number ON verification_applications (application_number);
CREATE INDEX idx_verification_applications_status ON verification_applications (status);
CREATE INDEX idx_verification_applications_instrument_id ON verification_applications (instrument_id);
CREATE INDEX idx_verification_applications_applicant_id ON verification_applications (applicant_id);
-- Common dashboard query: "applications pending" (SUBMITTED/UNDER_REVIEW/SCHEDULED)
CREATE INDEX idx_verification_applications_pending
    ON verification_applications (status, submitted_at)
    WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED');

CREATE TRIGGER trg_verification_applications_set_updated_at
    BEFORE UPDATE ON verification_applications
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();