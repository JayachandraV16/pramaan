-- =============================================================================
-- Migration 005: Instruments
-- =============================================================================

CREATE TABLE instruments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id                UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    instrument_type_id      UUID NOT NULL REFERENCES instrument_types(id) ON DELETE RESTRICT,

    instrument_name         TEXT NOT NULL,
    manufacturer            TEXT,
    model                   TEXT,
    serial_number           TEXT NOT NULL,

    -- Identification/registration number issued by the department upon
    -- registration. Nullable because it may be assigned only after the
    -- registration workflow completes, not necessarily at creation time.
    registration_number     TEXT,

    capacity                NUMERIC(12,3),      -- max measurable capacity
    capacity_unit           TEXT,                -- e.g. 'kg', 'litre'
    accuracy_class          TEXT,                -- e.g. 'Class III'

    location_address        TEXT,
    location_lat            NUMERIC(9,6),
    location_lng            NUMERIC(9,6),

    registration_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    status                  instrument_status NOT NULL DEFAULT 'REGISTERED',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_instruments_serial_number UNIQUE (serial_number),
    CONSTRAINT uq_instruments_registration_number UNIQUE (registration_number),
    CONSTRAINT ck_instruments_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT ck_instruments_lat_range CHECK (location_lat IS NULL OR (location_lat BETWEEN -90 AND 90)),
    CONSTRAINT ck_instruments_lng_range CHECK (location_lng IS NULL OR (location_lng BETWEEN -180 AND 180))
);

COMMENT ON TABLE instruments IS 'Individual weighing/measuring instruments registered by owners.';
COMMENT ON COLUMN instruments.registration_number IS 'Official identification/registration number; unique when assigned, NULL before assignment.';

CREATE INDEX idx_instruments_owner_id ON instruments (owner_id);
CREATE INDEX idx_instruments_type_id ON instruments (instrument_type_id);
CREATE INDEX idx_instruments_serial_number ON instruments (serial_number);
CREATE INDEX idx_instruments_status ON instruments (status);

CREATE TRIGGER trg_instruments_set_updated_at
    BEFORE UPDATE ON instruments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();