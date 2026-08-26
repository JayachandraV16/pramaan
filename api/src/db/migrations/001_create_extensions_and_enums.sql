-- =============================================================================
-- Migration 001: Extensions and Enum Types
-- =============================================================================
-- Pramaan — Unified Digital Platform for Legal Metrology Verification & Certification
--
-- This migration sets up:
--   1. The pgcrypto extension (used for gen_random_uuid() to generate UUID PKs)
--   2. All PostgreSQL ENUM types used across the schema
--
-- DESIGN DECISION — UUID primary keys:
--   All tables use UUID primary keys generated with gen_random_uuid().
--   Rationale: certificate numbers, application numbers, and QR tokens are
--   externally exposed (QR codes, public certificate lookup, mobile app sync).
--   UUIDs avoid leaking sequential/guessable IDs for legal documents, and they
--   allow the mobile app to generate records offline (e.g. during field
--   verification with poor connectivity) without needing a DB round-trip to
--   obtain a sequential ID before syncing.
--
-- DESIGN DECISION — ENUM types vs. separate lookup tables:
--   The problem statement explicitly forbids separate tables for status/type
--   values (ApplicationStatus, VerificationStatus, PASS/FAIL, etc.). Native
--   PostgreSQL ENUM types are used instead of CHECK-constrained TEXT because:
--     - They are self-documenting in \d output and are enforced identically
--       to CHECK constraints.
--     - They are cheaper on storage (4 bytes) than TEXT.
--     - Postgres supports ALTER TYPE ... ADD VALUE for future extension
--       (e.g. adding a new application status later), which is sufficient
--       for a hackathon-scoped project.
--   CHECK constraints are still used for numeric/date-range/business-rule
--   validation where an enum would not apply.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- citext gives case-insensitive TEXT comparison/uniqueness, used for
-- user email so 'A@x.com' and 'a@x.com' are treated as the same account.
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Role names (Role.name) — fixed, small set of system roles.
-- ---------------------------------------------------------------------------
CREATE TYPE role_name AS ENUM (
    'INSTRUMENT_OWNER',
    'LMO',
    'GATC',
    'ADMIN',
    'PUBLIC_USER'
);

-- ---------------------------------------------------------------------------
-- User account status.
-- ---------------------------------------------------------------------------
CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

-- ---------------------------------------------------------------------------
-- Instrument lifecycle status.
-- ---------------------------------------------------------------------------
CREATE TYPE instrument_status AS ENUM (
    'REGISTERED',
    'ACTIVE',
    'INACTIVE',
    'DECOMMISSIONED'
);

-- ---------------------------------------------------------------------------
-- Verification Application type: fresh verification vs re-verification.
-- ---------------------------------------------------------------------------
CREATE TYPE application_type AS ENUM (
    'VERIFICATION',
    'RE_VERIFICATION'
);

-- ---------------------------------------------------------------------------
-- Verification Application status (request lifecycle).
-- ---------------------------------------------------------------------------
CREATE TYPE application_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'SCHEDULED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Verification Assignment status (allocation to an LMO/GATC user).
-- ---------------------------------------------------------------------------
CREATE TYPE assignment_status AS ENUM (
    'ASSIGNED',
    'ACCEPTED',
    'DECLINED',
    'REASSIGNED',
    'COMPLETED'
);

-- ---------------------------------------------------------------------------
-- Verification Schedule status.
-- ---------------------------------------------------------------------------
CREATE TYPE schedule_status AS ENUM (
    'SCHEDULED',
    'RESCHEDULED',
    'COMPLETED',
    'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Verification (field activity) status.
-- ---------------------------------------------------------------------------
CREATE TYPE verification_status AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'ABORTED'
);

-- ---------------------------------------------------------------------------
-- Verification Reading result — per-reading PASS/FAIL against tolerance.
-- ---------------------------------------------------------------------------
CREATE TYPE reading_result AS ENUM (
    'PASS',
    'FAIL'
);

-- ---------------------------------------------------------------------------
-- Verification Result — final decision for the verification as a whole.
-- ---------------------------------------------------------------------------
CREATE TYPE verification_decision AS ENUM (
    'PASS',
    'FAIL'
);

-- ---------------------------------------------------------------------------
-- Verification Certificate status.
-- ---------------------------------------------------------------------------
CREATE TYPE certificate_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'REVOKED'
);

-- ---------------------------------------------------------------------------
-- Attachment category — kept generic per scope rules (no separate
-- Photo/Document/Evidence tables), but a category value is still useful
-- for filtering in the UI.
-- ---------------------------------------------------------------------------
CREATE TYPE attachment_category AS ENUM (
    'PHOTOGRAPH',
    'DOCUMENT',
    'INSPECTION_EVIDENCE',
    'OTHER'
);

-- ---------------------------------------------------------------------------
-- QR Authentication result — outcome of a public certificate QR scan.
-- ---------------------------------------------------------------------------
CREATE TYPE qr_auth_result AS ENUM (
    'VALID',
    'INVALID',
    'EXPIRED',
    'REVOKED'
);

-- ---------------------------------------------------------------------------
-- Notification type.
-- ---------------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
    'CERTIFICATE_EXPIRING',
    'CERTIFICATE_EXPIRED',
    'VERIFICATION_SCHEDULED',
    'APPLICATION_UPDATE',
    'CERTIFICATE_ISSUED'
);

-- ---------------------------------------------------------------------------
-- Notification delivery status.
-- ---------------------------------------------------------------------------
CREATE TYPE notification_status AS ENUM (
    'PENDING',
    'SENT',
    'READ',
    'FAILED'
);