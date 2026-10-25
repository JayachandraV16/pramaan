-- =============================================================================
-- Migration 021: Workflow integrity and inspection evidence
-- =============================================================================
-- 1. application_status_history: who moved an application to which status,
--    when and why (written by the state machine in utils/applicationStatus.js).
-- 2. verification_results.result_sha256: seal over the readings, observations
--    and decision at the moment the result is submitted.
-- 3. A verification's readings, observations and result become immutable once
--    the verification is no longer IN_PROGRESS.
-- 4. Evidence metadata: GPS + device capture time on attachments and GPS at
--    the start of a verification.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Application status history
-- ---------------------------------------------------------------------------
CREATE TABLE application_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
    from_status     application_status,
    to_status       application_status NOT NULL,
    changed_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    reason          TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE application_status_history IS 'One row per application status change (including the initial status). Complements audit_log with a queryable per-application timeline.';

CREATE INDEX idx_application_status_history_application
    ON application_status_history (application_id, changed_at);

-- Backfill: one row describing the current status of every existing application.
INSERT INTO application_status_history (application_id, from_status, to_status, changed_by_id, reason, changed_at)
SELECT id, NULL, status, applicant_id, 'Backfilled at migration 021', COALESCE(updated_at, created_at)
FROM verification_applications;

-- ---------------------------------------------------------------------------
-- 2. Result seal
-- ---------------------------------------------------------------------------
ALTER TABLE verification_results
    ADD COLUMN result_sha256 TEXT;

COMMENT ON COLUMN verification_results.result_sha256 IS 'SHA-256 (hex) over the verification id, decision, all readings and all observations at submission time.';

-- ---------------------------------------------------------------------------
-- 3. Immutability once a verification is finished
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_finished_verification_children()
RETURNS TRIGGER AS $$
DECLARE
    parent_id     UUID;
    parent_status verification_status;
BEGIN
    parent_id := COALESCE(NEW.verification_id, OLD.verification_id);
    SELECT status INTO parent_status FROM verifications WHERE id = parent_id;

    -- parent already gone (cascade delete of a draft verification): allow
    IF parent_status IS NULL OR parent_status = 'IN_PROGRESS' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    RAISE EXCEPTION '% cannot be changed: verification % is %', TG_TABLE_NAME, parent_id, parent_status;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_readings_protect_finished
    BEFORE INSERT OR UPDATE OR DELETE ON verification_readings
    FOR EACH ROW EXECUTE FUNCTION protect_finished_verification_children();

CREATE TRIGGER trg_observations_protect_finished
    BEFORE INSERT OR UPDATE OR DELETE ON inspection_observations
    FOR EACH ROW EXECUTE FUNCTION protect_finished_verification_children();

CREATE OR REPLACE FUNCTION protect_verification_result()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'verification_results are legal records and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verification_results_immutable
    BEFORE UPDATE OR DELETE ON verification_results
    FOR EACH ROW EXECUTE FUNCTION protect_verification_result();

-- ---------------------------------------------------------------------------
-- 4. Evidence metadata
-- ---------------------------------------------------------------------------
ALTER TABLE attachments
    ADD COLUMN captured_at TIMESTAMPTZ,
    ADD COLUMN latitude    NUMERIC(9,6),
    ADD COLUMN longitude   NUMERIC(9,6),
    ADD CONSTRAINT ck_attachments_gps_pair
        CHECK ((latitude IS NULL) = (longitude IS NULL)),
    ADD CONSTRAINT ck_attachments_lat_range
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT ck_attachments_lng_range
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

COMMENT ON COLUMN attachments.captured_at IS 'When the photo/document was captured on the device (client-reported); uploaded_at is the server time.';
COMMENT ON COLUMN attachments.latitude IS 'GPS latitude where the evidence was captured (client-reported).';

ALTER TABLE verifications
    ADD COLUMN start_latitude  NUMERIC(9,6),
    ADD COLUMN start_longitude NUMERIC(9,6),
    ADD CONSTRAINT ck_verifications_gps_pair
        CHECK ((start_latitude IS NULL) = (start_longitude IS NULL)),
    ADD CONSTRAINT ck_verifications_lat_range
        CHECK (start_latitude IS NULL OR start_latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT ck_verifications_lng_range
        CHECK (start_longitude IS NULL OR start_longitude BETWEEN -180 AND 180);

COMMENT ON COLUMN verifications.start_latitude IS 'GPS position of the officer when the inspection was started (client-reported).';
