-- Migration 031: what an inspection photo shows.
-- Officers upload photos of readings, test weights, seals and the instrument's condition as
-- verification evidence. The kind is optional so earlier evidence stays valid.
ALTER TABLE attachments ADD COLUMN evidence_kind VARCHAR(20);
ALTER TABLE attachments ADD CONSTRAINT ck_attachments_evidence_kind
    CHECK (evidence_kind IS NULL OR evidence_kind IN ('READING', 'TEST_WEIGHT', 'SEAL', 'CONDITION', 'OTHER'));
ALTER TABLE attachments ADD CONSTRAINT ck_attachments_evidence_kind_owner
    CHECK (evidence_kind IS NULL OR verification_id IS NOT NULL);
CREATE INDEX idx_attachments_evidence_kind ON attachments (verification_id, evidence_kind) WHERE evidence_kind IS NOT NULL;
COMMENT ON COLUMN attachments.evidence_kind IS 'What an inspection photo shows: READING, TEST_WEIGHT, SEAL, CONDITION or OTHER. Only on verification evidence.';
