-- =============================================================================
-- Migration 004: Instrument Types (master/reference table)
-- =============================================================================

CREATE TABLE instrument_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    default_unit TEXT,          -- e.g. 'kg', 'g', 'litre' — informational default for readings
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_instrument_types_name UNIQUE (name)
);

COMMENT ON TABLE instrument_types IS 'Master list of instrument categories (Weighing Scale, Electronic Balance, etc.).';

CREATE INDEX idx_instrument_types_active ON instrument_types (is_active);