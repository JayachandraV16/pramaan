-- 026_notification_delivery.sql
-- E-mail / SMS delivery of notifications through an outbox. A row is queued in
-- the same transaction that creates the notification; a background job sends
-- it with retries. Users can switch either channel off.

ALTER TABLE users
    ADD COLUMN notify_email BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN notify_sms   BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TYPE delivery_channel AS ENUM ('EMAIL', 'SMS');
CREATE TYPE delivery_status  AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel         delivery_channel NOT NULL,
    destination     TEXT NOT NULL,            -- e-mail address or E.164 phone number at queue time
    status          delivery_status NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    provider_ref    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_deliveries_notification_channel UNIQUE (notification_id, channel),
    CONSTRAINT ck_notification_deliveries_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_notification_deliveries_due
    ON notification_deliveries (next_attempt_at) WHERE status = 'PENDING';

CREATE TRIGGER trg_notification_deliveries_set_updated_at
    BEFORE UPDATE ON notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
