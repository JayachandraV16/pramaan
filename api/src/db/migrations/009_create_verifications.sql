-- =============================================================================
-- Migration 009: Verifications
-- =============================================================================
-- The actual field verification/inspection activity, as distinct from the
-- Verification Application (request) and Verification Schedule (plan).
-- =============================================================================

CREATE TABLE verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id      UUID NOT NULL REFERENCES verification_applications(id) ON DELETE RESTRICT,
    assignment_id       UUID NOT NULL REFERENCES verification_assignments(id) ON DELETE RESTRICT,
    schedule_id         UUID REFERENCES verification_schedules(id) ON DELETE SET NULL,

    performed_by_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    verification_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    location             TEXT,

    status              verification_status NOT NULL DEFAULT 'IN_PROGRESS',
    remarks             TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_verifications_time_order CHECK (
        start_time IS NULL OR end_time IS NULL OR end_time >= start_time
    )
);

COMMENT ON TABLE verifications IS 'Actual field verification/inspection activity carried out for an application.';

CREATE INDEX idx_verifications_application_id ON verifications (application_id);
CREATE INDEX idx_verifications_assignment_id ON verifications (assignment_id);
CREATE INDEX idx_verifications_performed_by_id ON verifications (performed_by_id);
CREATE INDEX idx_verifications_date ON verifications (verification_date);
CREATE INDEX idx_verifications_status ON verifications (status);

CREATE TRIGGER trg_verifications_set_updated_at
    BEFORE UPDATE ON verifications
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();