-- =============================================================================
-- Migration 008: Verification Schedules
-- =============================================================================
-- When/where the verification is scheduled. Linked to both the application
-- and the assignment (an assignment may be rescheduled multiple times,
-- producing multiple schedule rows for the same assignment).
-- =============================================================================

CREATE TABLE verification_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id      UUID NOT NULL REFERENCES verification_applications(id) ON DELETE RESTRICT,
    assignment_id       UUID NOT NULL REFERENCES verification_assignments(id) ON DELETE RESTRICT,

    scheduled_date      DATE NOT NULL,
    scheduled_time      TIME,
    verification_location TEXT,

    status              schedule_status NOT NULL DEFAULT 'SCHEDULED',
    remarks             TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification_schedules IS 'Date/time/location plan for a field verification tied to an assignment.';

CREATE INDEX idx_verification_schedules_application_id ON verification_schedules (application_id);
CREATE INDEX idx_verification_schedules_assignment_id ON verification_schedules (assignment_id);
CREATE INDEX idx_verification_schedules_scheduled_date ON verification_schedules (scheduled_date);
CREATE INDEX idx_verification_schedules_status ON verification_schedules (status);
-- Common dashboard query: "verifications scheduled today"
CREATE INDEX idx_verification_schedules_date_status
    ON verification_schedules (scheduled_date, status);

CREATE TRIGGER trg_verification_schedules_set_updated_at
    BEFORE UPDATE ON verification_schedules
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();