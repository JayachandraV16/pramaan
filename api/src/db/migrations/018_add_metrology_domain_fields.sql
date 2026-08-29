-- =============================================================================
-- Migration 018: Legal Metrology Domain Fields
-- =============================================================================
-- Additive only. Does not modify, drop, or rename anything from migrations
-- 001-017. Adds the Legal Metrology vocabulary required by PS 26036 that
-- was missing from the original schema: LCR Number, Applicant Type,
-- Division/Submission Office, Instrument Origin, GRAS Challan, Conveyance
-- Fee, Quarter Jump Fee, and a Renewal -> previous-certificate link.
--
-- New columns are NULLABLE even where the application layer treats them
-- as required going forward, so this migration is safe to run against a
-- database that already has seed/demo rows in `users` and
-- `verification_applications`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New enum: applicant_type
-- Follows the existing convention of enum type name == column name
-- (see application_type / application_status, migrations 001/006).
-- ---------------------------------------------------------------------------
CREATE TYPE applicant_type AS ENUM (
    'MANUFACTURER',
    'DEALER',
    'USER',
    'HAWKER'
);

-- ---------------------------------------------------------------------------
-- New enum: instrument_origin
-- Stored on verification_applications (not instruments) — see rationale
-- above applications.instrument_origin column comment below.
-- ---------------------------------------------------------------------------
CREATE TYPE instrument_origin AS ENUM (
    'LOCAL',
    'IMPORTED'
);

-- ---------------------------------------------------------------------------
-- users: LCR Number + Applicant Type
-- ---------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN lcr_number     TEXT,
    ADD COLUMN applicant_type applicant_type;

COMMENT ON COLUMN users.lcr_number IS 'Legal Metrology Consumer Registration Number. NULL until the owner has an LCR (e.g. before first-time LCR registration completes).';
COMMENT ON COLUMN users.applicant_type IS 'Applicant category (Manufacturer/Dealer/User/Hawker) — drives conditional document requirements on verification_applications.';

-- LCR numbers are unique when assigned; many users legitimately have none
-- yet. Partial unique index makes that intent explicit.
CREATE UNIQUE INDEX uq_users_lcr_number ON users (lcr_number) WHERE lcr_number IS NOT NULL;
CREATE INDEX idx_users_applicant_type ON users (applicant_type);

-- ---------------------------------------------------------------------------
-- verification_applications: Division, Office, Origin, Fees, Renewal link
-- ---------------------------------------------------------------------------
ALTER TABLE verification_applications
    ADD COLUMN division            TEXT,
    ADD COLUMN submission_office   TEXT,
    ADD COLUMN instrument_origin   instrument_origin,
    ADD COLUMN gras_challan_number TEXT,
    ADD COLUMN gras_challan_date   DATE,
    ADD COLUMN conveyance_fee      NUMERIC(10,2),
    ADD COLUMN quarter_jump_fee    NUMERIC(10,2),
    ADD COLUMN last_certificate_id UUID REFERENCES verification_certificates(id) ON DELETE SET NULL;

COMMENT ON COLUMN verification_applications.division IS 'Legal Metrology division the application is filed under. Also used, uppercased, as the {division} segment of application_number (LM/{year}/{division}/{sequence}).';
COMMENT ON COLUMN verification_applications.submission_office IS 'Human-readable submission office name (e.g. "Pune Legal Metrology Office"). Distinct from `division`, which is the short code used in the application number.';
COMMENT ON COLUMN verification_applications.instrument_origin IS 'LOCAL or IMPORTED, as declared on THIS application. Kept here rather than on instruments: it is captured as declared at filing time, keeps conditional-document logic scoped to this table without a join, and preserves what was declared on a given application even if instrument master data changes later.';
COMMENT ON COLUMN verification_applications.gras_challan_number IS 'GRAS (Government Receipt Accounting System) challan number for the application fee payment.';
COMMENT ON COLUMN verification_applications.gras_challan_date IS 'Date on the GRAS challan.';
COMMENT ON COLUMN verification_applications.conveyance_fee IS 'Conveyance fee for officer travel to inspect the instrument, where applicable.';
COMMENT ON COLUMN verification_applications.quarter_jump_fee IS 'Additional fee for out-of-cycle/expedited verification, where applicable.';
COMMENT ON COLUMN verification_applications.last_certificate_id IS 'Previous verification certificate being renewed. Required at the application layer for RE_VERIFICATION applications; NULL for fresh VERIFICATION applications.';

ALTER TABLE verification_applications
    ADD CONSTRAINT ck_verification_applications_conveyance_fee_non_negative
        CHECK (conveyance_fee IS NULL OR conveyance_fee >= 0),
    ADD CONSTRAINT ck_verification_applications_quarter_jump_fee_non_negative
        CHECK (quarter_jump_fee IS NULL OR quarter_jump_fee >= 0);

CREATE INDEX idx_verification_applications_division ON verification_applications (division);
CREATE INDEX idx_verification_applications_last_certificate_id
    ON verification_applications (last_certificate_id)
    WHERE last_certificate_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- application_number_counters
-- Backs the LM/{year}/{division}/{sequence} format with a transaction-safe,
-- per-(division, year) sequence. A native Postgres SEQUENCE can't be
-- parameterised by division at request time without dynamic DDL from
-- application code, which is unnecessary complexity here. A single counter
-- table with an atomic UPSERT (INSERT ... ON CONFLICT DO UPDATE ...
-- RETURNING) gives the same concurrency-safety without dynamic DDL, and is
-- called from applications.repository.js inside the same transaction as
-- the verification_applications INSERT (so a rollback also rolls back the
-- counter increment — no wasted/skipped numbers on a failed insert).
-- ---------------------------------------------------------------------------
CREATE TABLE application_number_counters (
    division      TEXT NOT NULL,
    year          INTEGER NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (division, year),
    CONSTRAINT ck_application_number_counters_sequence_non_negative CHECK (last_sequence >= 0)
);

COMMENT ON TABLE application_number_counters IS 'Per (division, year) counter backing the LM/{year}/{division}/{sequence} application_number format. Incremented atomically via INSERT ... ON CONFLICT DO UPDATE.';