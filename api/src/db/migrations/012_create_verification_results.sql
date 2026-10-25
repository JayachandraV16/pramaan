-- =============================================================================
-- Migration 012: Verification Results
-- =============================================================================
-- The final PASS/FAIL decision for a verification. Exactly one result per
-- verification, enforced via UNIQUE(verification_id) rather than making
-- verification_id the primary key, so the table still has its own
-- surrogate id consistent with the rest of the schema.
--
-- Deliberately NOT split into separate PASS / FAIL tables per scope rules;
-- PASS/FAIL is a value in the `decision` column (verification_decision enum).
-- =============================================================================

CREATE TABLE verification_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    verification_id      UUID NOT NULL REFERENCES verifications(id) ON DELETE RESTRICT,
    decision              verification_decision NOT NULL,
    decided_by_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    result_date            TIMESTAMPTZ NOT NULL DEFAULT now(),
    remarks                TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_verification_results_verification_id UNIQUE (verification_id)
);

COMMENT ON TABLE verification_results IS 'Final PASS/FAIL decision for a verification. One-to-one with verifications (enforced by unique verification_id). A certificate may only be issued for a PASS result.';
COMMENT ON COLUMN verification_results.verification_id IS 'ON DELETE RESTRICT: a legal PASS/FAIL decision must not be silently orphaned by deleting its verification.';

CREATE INDEX idx_verification_results_verification_id ON verification_results (verification_id);
CREATE INDEX idx_verification_results_decision ON verification_results (decision);
