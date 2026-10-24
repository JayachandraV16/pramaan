-- =============================================================================
-- Migration 022: Expiry reminders, configurable fees, payment check, queries
-- =============================================================================
-- 1. reminder_log: which expiry reminder (30/15/7/1 days) was sent for which
--    certificate, so the daily job never sends the same one twice.
-- 2. fee_rules: configurable fees (verification, conveyance, quarter-jump) by
--    instrument type, application type and capacity band, with validity dates.
--    No amounts are seeded: fee schedules are set by each State's notification.
-- 3. verification_applications: computed fee columns and payment verification.
-- 4. application_queries / application_query_messages: clarification threads
--    between the applicant and the department.
-- =============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'QUERY_MESSAGE';

-- ---------------------------------------------------------------------------
-- 1. Reminder log
-- ---------------------------------------------------------------------------
CREATE TABLE reminder_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id  UUID NOT NULL REFERENCES verification_certificates(id) ON DELETE CASCADE,
    threshold_days  INTEGER NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_reminder_log_certificate_threshold UNIQUE (certificate_id, threshold_days),
    CONSTRAINT ck_reminder_log_threshold_positive CHECK (threshold_days > 0)
);

COMMENT ON TABLE reminder_log IS 'One row per (certificate, threshold) expiry reminder already sent; the UNIQUE constraint makes the reminder job idempotent.';

-- ---------------------------------------------------------------------------
-- 2. Fee rules
-- ---------------------------------------------------------------------------
CREATE TYPE fee_kind AS ENUM ('VERIFICATION', 'CONVEYANCE', 'QUARTER_JUMP');

CREATE TABLE fee_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_kind            fee_kind NOT NULL,
    instrument_type_id  UUID REFERENCES instrument_types(id) ON DELETE RESTRICT,   -- NULL = any type
    application_type    application_type,                                           -- NULL = any
    min_capacity        NUMERIC(12,3),                                              -- NULL = no lower bound
    max_capacity        NUMERIC(12,3),                                              -- NULL = no upper bound
    amount              NUMERIC(10,2) NOT NULL,
    description         TEXT,
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_fee_rules_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT ck_fee_rules_capacity_order CHECK (
        min_capacity IS NULL OR max_capacity IS NULL OR min_capacity <= max_capacity
    ),
    CONSTRAINT ck_fee_rules_effective_order CHECK (
        effective_to IS NULL OR effective_to >= effective_from
    )
);

COMMENT ON TABLE fee_rules IS 'Configurable fee schedule. For one application the most specific active rule per fee_kind applies (instrument type > application type > capacity band).';

CREATE INDEX idx_fee_rules_kind_active ON fee_rules (fee_kind, is_active);

CREATE TRIGGER trg_fee_rules_set_updated_at
    BEFORE UPDATE ON fee_rules
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Computed fees and payment verification on applications
-- ---------------------------------------------------------------------------
ALTER TABLE verification_applications
    ADD COLUMN verification_fee      NUMERIC(10,2),
    ADD COLUMN total_fee             NUMERIC(10,2),
    ADD COLUMN payment_verified_at   TIMESTAMPTZ,
    ADD COLUMN payment_verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT ck_verification_applications_fees_non_negative
        CHECK ((verification_fee IS NULL OR verification_fee >= 0) AND (total_fee IS NULL OR total_fee >= 0));

COMMENT ON COLUMN verification_applications.verification_fee IS 'Fee computed by the server from fee_rules when the application was filed.';
COMMENT ON COLUMN verification_applications.total_fee IS 'verification_fee + conveyance_fee + quarter_jump_fee at filing time.';
COMMENT ON COLUMN verification_applications.payment_verified_at IS 'When an ADMIN confirmed the GRAS challan against the fee due.';

-- ---------------------------------------------------------------------------
-- 4. Query threads
-- ---------------------------------------------------------------------------
CREATE TYPE query_status AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE application_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
    raised_by_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subject         TEXT NOT NULL,
    status          query_status NOT NULL DEFAULT 'OPEN',
    closed_at       TIMESTAMPTZ,
    closed_by_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_application_queries_subject_not_blank CHECK (length(trim(subject)) > 0),
    CONSTRAINT ck_application_queries_closed_consistency CHECK (
        (status = 'OPEN' AND closed_at IS NULL) OR (status = 'CLOSED' AND closed_at IS NOT NULL)
    )
);

CREATE INDEX idx_application_queries_application ON application_queries (application_id, created_at);
CREATE INDEX idx_application_queries_status ON application_queries (status);

CREATE TRIGGER trg_application_queries_set_updated_at
    BEFORE UPDATE ON application_queries
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE application_query_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id    UUID NOT NULL REFERENCES application_queries(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_application_query_messages_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE INDEX idx_application_query_messages_query ON application_query_messages (query_id, created_at);

COMMENT ON TABLE application_queries IS 'A clarification thread about one application between the applicant and department staff.';
