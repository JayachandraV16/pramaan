-- =============================================================================
-- Migration 017: Expiry Alert Support Views
-- =============================================================================
-- Thin, read-only views that make the common expiry/dashboard queries called
-- out in the problem statement trivial to write from the backend, without
-- adding any new tables or a scheduler inside PostgreSQL. Backed entirely by
-- the indexes created in earlier migrations
-- (idx_verification_certificates_status_valid_until,
--  idx_verification_applications_pending,
--  idx_verification_schedules_date_status).
-- =============================================================================

-- Certificates expiring within the next 30 days (still ACTIVE today).
CREATE VIEW certificates_expiring_soon AS
SELECT c.*
FROM verification_certificates c
WHERE c.status = 'ACTIVE'
  AND c.valid_until >= CURRENT_DATE
  AND c.valid_until <= CURRENT_DATE + INTERVAL '30 days';

COMMENT ON VIEW certificates_expiring_soon IS 'ACTIVE certificates whose valid_until falls within the next 30 days.';

-- Certificates that have already passed their valid_until date but have not
-- yet been marked EXPIRED by the (application-layer or cron) status sweep.
CREATE VIEW certificates_past_due AS
SELECT c.*
FROM verification_certificates c
WHERE c.status = 'ACTIVE'
  AND c.valid_until < CURRENT_DATE;

COMMENT ON VIEW certificates_past_due IS 'Certificates past their valid_until date but still flagged ACTIVE (candidates for a status sweep to EXPIRED).';

-- Applications not yet completed/rejected/cancelled.
CREATE VIEW pending_applications AS
SELECT a.*
FROM verification_applications a
WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED');

COMMENT ON VIEW pending_applications IS 'Applications still in-flight (submitted, under review, or scheduled).';

-- Verifications scheduled for today.
CREATE VIEW schedules_today AS
SELECT s.*
FROM verification_schedules s
WHERE s.scheduled_date = CURRENT_DATE
  AND s.status IN ('SCHEDULED', 'RESCHEDULED');

COMMENT ON VIEW schedules_today IS 'Verification schedules for the current date that are still active (not completed/cancelled).';