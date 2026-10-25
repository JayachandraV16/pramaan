-- Migration 035: indexes for the Command HQ map and lists.
-- The map reads only instruments that have coordinates; a partial index keeps that scan small as the
-- register grows. The "waiting for the department" and "stuck application" lists order by age.
CREATE INDEX idx_instruments_on_map ON instruments (id) WHERE location_lat IS NOT NULL AND status NOT IN ('INACTIVE', 'DECOMMISSIONED');
CREATE INDEX idx_enforcement_cases_open_on_map ON enforcement_cases (detected_on DESC) WHERE latitude IS NOT NULL AND status IN ('OPEN', 'NOTICE_ISSUED');
CREATE INDEX idx_applications_open_submitted ON verification_applications (submitted_at) WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED');
CREATE INDEX idx_verification_results_fail_recent ON verification_results (result_date DESC) WHERE decision = 'FAIL';
