-- =============================================================================
-- Migration 011: Verification Readings
-- =============================================================================
-- Actual measurements/readings taken during a verification. One
-- verification has many readings (e.g. multiple load points).
-- =============================================================================

CREATE TABLE verification_readings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    verification_id     UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,

    reading_type        TEXT NOT NULL,          -- e.g. 'Load point 1', 'Zero check'
    expected_value       NUMERIC(14,4),
    observed_value        NUMERIC(14,4) NOT NULL,
    unit                 TEXT NOT NULL,           -- e.g. 'kg'
    tolerance             NUMERIC(14,4),           -- absolute tolerance, e.g. 0.02
    result                reading_result NOT NULL,
    remarks               TEXT,

    recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_verification_readings_type_not_blank CHECK (length(trim(reading_type)) > 0),
    CONSTRAINT ck_verification_readings_tolerance_non_negative CHECK (tolerance IS NULL OR tolerance >= 0)
);

COMMENT ON TABLE verification_readings IS 'Quantitative measurement readings taken during a verification, each with its own PASS/FAIL result against tolerance. Many rows per verification.';
COMMENT ON COLUMN verification_readings.verification_id IS 'ON DELETE CASCADE: readings are child detail rows with no independent legal standing; deletion protection for completed verifications is enforced at the application layer.';

CREATE INDEX idx_verification_readings_verification_id ON verification_readings (verification_id);
CREATE INDEX idx_verification_readings_result ON verification_readings (result);