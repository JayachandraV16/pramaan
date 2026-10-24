-- 024_enforcement.sql
-- Enforcement: offence cases found by officers (spot checks, complaints,
-- routine inspections), their handling (notice, penalty, resolution) and a
-- repeat-offender view. The facts of a case are immutable; only its handling
-- status can change, and every change is recorded in enforcement_case_events.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ENFORCEMENT_ACTION';

CREATE TYPE enforcement_source AS ENUM ('SPOT_CHECK', 'COMPLAINT', 'ROUTINE_INSPECTION');

CREATE TYPE offence_type AS ENUM (
    'NONE',                      -- a spot check that found no offence
    'UNVERIFIED_INSTRUMENT',
    'EXPIRED_CERTIFICATE',
    'UNSTAMPED_INSTRUMENT',
    'SEAL_TAMPERING',
    'FALSE_WEIGHT_OR_MEASURE',
    'OTHER'
);

CREATE TYPE enforcement_status AS ENUM ('OPEN', 'NOTICE_ISSUED', 'PENALTY_IMPOSED', 'RESOLVED', 'DISMISSED');

CREATE TABLE enforcement_case_counters (
    year          INTEGER PRIMARY KEY,
    last_sequence INTEGER NOT NULL
);

CREATE TABLE enforcement_cases (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number          TEXT NOT NULL,

    source               enforcement_source NOT NULL,
    offence_type         offence_type NOT NULL,
    status               enforcement_status NOT NULL DEFAULT 'OPEN',

    -- Who the case is about. offender_key groups cases of the same person: the
    -- registered owner's id, or a normalised name (+ phone) for unregistered traders.
    offender_key         TEXT NOT NULL,
    subject_user_id      UUID REFERENCES users(id) ON DELETE RESTRICT,
    subject_name         TEXT NOT NULL,
    subject_organization TEXT,
    subject_phone        TEXT,

    instrument_id        UUID REFERENCES instruments(id) ON DELETE RESTRICT,
    certificate_id       UUID REFERENCES verification_certificates(id) ON DELETE RESTRICT,

    description          TEXT NOT NULL,
    location             TEXT,
    latitude             NUMERIC(9, 6),
    longitude            NUMERIC(9, 6),
    detected_on          DATE NOT NULL DEFAULT CURRENT_DATE,
    detected_by_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- nth counted offence of this offender at the time of registration (0 for NONE)
    offence_number       INTEGER NOT NULL DEFAULT 0,

    penalty_amount       NUMERIC(12, 2),
    penalty_reference    TEXT,
    resolution_note      TEXT,
    resolved_at          TIMESTAMPTZ,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_enforcement_cases_case_number UNIQUE (case_number),
    CONSTRAINT ck_enforcement_cases_penalty_nonnegative CHECK (penalty_amount IS NULL OR penalty_amount >= 0),
    CONSTRAINT ck_enforcement_cases_gps_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
    CONSTRAINT ck_enforcement_cases_gps_range CHECK (
        (latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)
    )
);

CREATE INDEX idx_enforcement_cases_offender_key ON enforcement_cases (offender_key);
CREATE INDEX idx_enforcement_cases_status ON enforcement_cases (status);
CREATE INDEX idx_enforcement_cases_detected_on ON enforcement_cases (detected_on);
CREATE INDEX idx_enforcement_cases_detected_by ON enforcement_cases (detected_by_id);
CREATE INDEX idx_enforcement_cases_subject_user ON enforcement_cases (subject_user_id);

CREATE TRIGGER trg_enforcement_cases_set_updated_at
    BEFORE UPDATE ON enforcement_cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The facts of a case cannot be edited afterwards, and cases are never deleted.
CREATE FUNCTION protect_enforcement_case() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Enforcement cases cannot be deleted';
    END IF;
    IF NEW.case_number IS DISTINCT FROM OLD.case_number
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.offence_type IS DISTINCT FROM OLD.offence_type
       OR NEW.offender_key IS DISTINCT FROM OLD.offender_key
       OR NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id
       OR NEW.subject_name IS DISTINCT FROM OLD.subject_name
       OR NEW.instrument_id IS DISTINCT FROM OLD.instrument_id
       OR NEW.certificate_id IS DISTINCT FROM OLD.certificate_id
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.detected_on IS DISTINCT FROM OLD.detected_on
       OR NEW.detected_by_id IS DISTINCT FROM OLD.detected_by_id
       OR NEW.offence_number IS DISTINCT FROM OLD.offence_number THEN
        RAISE EXCEPTION 'The recorded facts of an enforcement case cannot be changed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforcement_cases_protect
    BEFORE UPDATE OR DELETE ON enforcement_cases
    FOR EACH ROW EXECUTE FUNCTION protect_enforcement_case();

CREATE TABLE enforcement_case_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES enforcement_cases(id) ON DELETE RESTRICT,
    from_status enforcement_status,
    to_status   enforcement_status NOT NULL,
    note        TEXT,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enforcement_case_events_case ON enforcement_case_events (case_id, created_at);

-- Repeat-offender tracking. Counted offences exclude spot checks with no
-- offence and dismissed cases. FIRST = 0-1 offence in the last 12 months,
-- REPEAT = 2, HABITUAL = 3 or more.
CREATE VIEW repeat_offenders AS
SELECT
    c.offender_key,
    (array_agg(c.subject_name ORDER BY c.created_at DESC))[1]                         AS subject_name,
    (array_agg(c.subject_organization ORDER BY c.created_at DESC))[1]                 AS subject_organization,
    (array_agg(c.subject_user_id) FILTER (WHERE c.subject_user_id IS NOT NULL))[1]    AS subject_user_id,
    COUNT(*) FILTER (WHERE c.offence_type <> 'NONE' AND c.status <> 'DISMISSED')::int AS offences_total,
    COUNT(*) FILTER (WHERE c.offence_type <> 'NONE' AND c.status <> 'DISMISSED'
                       AND c.detected_on >= CURRENT_DATE - INTERVAL '365 days')::int  AS offences_12m,
    MAX(c.detected_on) FILTER (WHERE c.offence_type <> 'NONE' AND c.status <> 'DISMISSED') AS last_offence_on,
    COALESCE(SUM(c.penalty_amount) FILTER (WHERE c.status IN ('PENALTY_IMPOSED', 'RESOLVED')), 0)::numeric(12, 2) AS penalties_total,
    CASE
        WHEN COUNT(*) FILTER (WHERE c.offence_type <> 'NONE' AND c.status <> 'DISMISSED'
                                AND c.detected_on >= CURRENT_DATE - INTERVAL '365 days') >= 3 THEN 'HABITUAL'
        WHEN COUNT(*) FILTER (WHERE c.offence_type <> 'NONE' AND c.status <> 'DISMISSED'
                                AND c.detected_on >= CURRENT_DATE - INTERVAL '365 days') = 2 THEN 'REPEAT'
        ELSE 'FIRST'
    END AS flag
FROM enforcement_cases c
GROUP BY c.offender_key;
