-- =============================================================================
-- Migration 007: Verification Assignments
-- =============================================================================
-- Allocation of a verification activity (for a given application) to an
-- LMO or GATC user. Kept separate from Verification Schedule per scope
-- rules — assignment answers "who", schedule answers "when/where".
-- =============================================================================

CREATE TABLE verification_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id  UUID NOT NULL REFERENCES verification_applications(id) ON DELETE RESTRICT,
    assigned_to_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,

    assignment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          assignment_status NOT NULL DEFAULT 'ASSIGNED',
    remarks         TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification_assignments IS 'Allocation of a verification application to an LMO/GATC user for field execution.';
COMMENT ON COLUMN verification_assignments.assigned_to_id IS 'Must reference a user whose role is LMO or GATC; enforced by trg_check_assignee_role trigger, not a FK (role lives on users.role_id).';

CREATE INDEX idx_verification_assignments_application_id ON verification_assignments (application_id);
CREATE INDEX idx_verification_assignments_assigned_to_id ON verification_assignments (assigned_to_id);
CREATE INDEX idx_verification_assignments_status ON verification_assignments (status);

CREATE TRIGGER trg_verification_assignments_set_updated_at
    BEFORE UPDATE ON verification_assignments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Business rule: the assigned user must have role LMO or GATC.
-- A plain FK cannot express "FK to users WHERE role IN (...)", so this is
-- enforced with a small trigger function, per the requirement:
--   "Application-level business rules should prevent assigning
--    inappropriate roles where practical."
-- This keeps the rule at the database level (defense in depth) without
-- introducing a redundant role-scoped table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_assignee_role()
RETURNS TRIGGER AS $$
DECLARE
    assignee_role role_name;
BEGIN
    SELECT r.name INTO assignee_role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = NEW.assigned_to_id;

    IF assignee_role IS NULL OR assignee_role NOT IN ('LMO', 'GATC') THEN
        RAISE EXCEPTION 'verification_assignments.assigned_to_id (%) must be a user with role LMO or GATC, found role %',
            NEW.assigned_to_id, assignee_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_assignee_role
    BEFORE INSERT OR UPDATE OF assigned_to_id ON verification_assignments
    FOR EACH ROW
    EXECUTE FUNCTION check_assignee_role();