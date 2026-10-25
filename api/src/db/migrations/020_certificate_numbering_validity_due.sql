-- =============================================================================
-- Migration 020: Certificate numbering, default validity, re-verification due
-- =============================================================================
-- 1. certificate_number_counters: race-free CERT-{year}-{seq} numbers
--    (replaces COUNT(*)+1 in application code).
-- 2. instrument_types.default_validity_months: configurable validity period
--    used when an admin does not type explicit dates at issue time.
-- 3. notification_type gets CERTIFICATE_REVOKED.
-- 4. instrument_verification_status view: the next re-verification due date
--    per instrument, derived from its most recent usable certificate.
-- =============================================================================

CREATE TABLE certificate_number_counters (
    year          INTEGER PRIMARY KEY,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT ck_certificate_number_counters_sequence_non_negative CHECK (last_sequence >= 0)
);

COMMENT ON TABLE certificate_number_counters IS 'Per-year counter backing certificate_number (CERT-{year}-{6-digit sequence}). Incremented atomically via INSERT ... ON CONFLICT DO UPDATE inside the issuing transaction.';

-- Seed the counter from existing certificates so numbering continues without
-- clashing with certificates issued by the old COUNT(*)+1 scheme.
INSERT INTO certificate_number_counters (year, last_sequence)
SELECT substring(certificate_number FROM 'CERT-(\d{4})-')::int AS year,
       MAX(substring(certificate_number FROM 'CERT-\d{4}-(\d+)')::int) AS last_sequence
FROM verification_certificates
WHERE certificate_number ~ '^CERT-\d{4}-\d+$'
GROUP BY 1
ON CONFLICT (year) DO NOTHING;

ALTER TABLE instrument_types
    ADD COLUMN default_validity_months INTEGER NOT NULL DEFAULT 12,
    ADD CONSTRAINT ck_instrument_types_validity_positive
        CHECK (default_validity_months > 0 AND default_validity_months <= 120);

COMMENT ON COLUMN instrument_types.default_validity_months IS 'Default certificate validity (months) for this instrument type. ADMIN may still override at issue time.';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CERTIFICATE_REVOKED';

CREATE VIEW instrument_verification_status AS
SELECT
    i.id                  AS instrument_id,
    i.owner_id,
    i.instrument_name,
    i.serial_number,
    i.status              AS instrument_status,
    c.id                  AS certificate_id,
    c.certificate_number,
    c.status              AS certificate_status,
    c.valid_until         AS next_due_date,
    (c.valid_until - CURRENT_DATE) AS days_until_due,
    CASE
        WHEN c.id IS NULL                              THEN 'NEVER_VERIFIED'
        WHEN c.status = 'REVOKED'                      THEN 'REVOKED'
        WHEN c.valid_until < CURRENT_DATE              THEN 'OVERDUE'
        WHEN c.valid_until <= CURRENT_DATE + 30        THEN 'DUE_SOON'
        ELSE 'VALID'
    END                   AS verification_state
FROM instruments i
LEFT JOIN LATERAL (
    SELECT vc.*
    FROM verification_certificates vc
    WHERE vc.instrument_id = i.id
    ORDER BY (vc.status = 'REVOKED') ASC, vc.valid_until DESC, vc.created_at DESC
    LIMIT 1
) c ON TRUE
WHERE i.status <> 'DECOMMISSIONED';

COMMENT ON VIEW instrument_verification_status IS 'Per instrument: latest usable certificate, next re-verification due date, days until due and a state (NEVER_VERIFIED, VALID, DUE_SOON within 30 days, OVERDUE, REVOKED).';
