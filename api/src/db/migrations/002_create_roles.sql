-- =============================================================================
-- Migration 002: Helper Trigger Function + Role Table
-- =============================================================================
-- A single reusable trigger function maintains `updated_at` automatically on
-- every table that has one. This is a tiny, defensible piece of database
-- logic (not a full audit subsystem) that prevents application code from
-- forgetting to stamp updates.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Table: roles
-- Represents system access roles. One row per role in role_name enum.
-- =============================================================================
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        role_name NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_roles_name UNIQUE (name)
);

COMMENT ON TABLE roles IS 'System access roles (INSTRUMENT_OWNER, LMO, GATC, ADMIN, PUBLIC_USER).';