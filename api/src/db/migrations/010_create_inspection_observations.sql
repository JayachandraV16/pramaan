-- =============================================================================
-- Migration 010: Inspection Observations
-- =============================================================================
-- Qualitative observations recorded during a verification. One verification
-- has many observations (e.g. physical condition, seal condition, display).
-- =============================================================================

CREATE TABLE inspection_observations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    verification_id         UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,

    observation_type        TEXT NOT NULL,   -- e.g. 'Physical condition', 'Seal condition'
    observation_description TEXT,
    observed_value           TEXT,            -- e.g. 'Good', 'Intact', 'Normal'
    remarks                  TEXT,

    observed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_inspection_observations_type_not_blank CHECK (length(trim(observation_type)) > 0)
);

COMMENT ON TABLE inspection_observations IS 'Qualitative observations recorded during a field verification (e.g. seal condition, physical condition). Many rows per verification.';
COMMENT ON COLUMN inspection_observations.verification_id IS 'ON DELETE CASCADE: observations are child detail rows of a verification with no independent legal standing; deleting a (non-completed/draft) verification removes its observations. Completed verifications are protected from deletion at the application layer.';

CREATE INDEX idx_inspection_observations_verification_id ON inspection_observations (verification_id);