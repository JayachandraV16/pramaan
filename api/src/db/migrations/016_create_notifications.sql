-- =============================================================================
-- Migration 016: Notifications
-- =============================================================================
-- System alerts/reminders (certificate expiring/expired, verification
-- scheduled, application update, certificate issued).
-- =============================================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type                      notification_type NOT NULL,
    title                       TEXT NOT NULL,
    message                       TEXT NOT NULL,
    status                          notification_status NOT NULL DEFAULT 'PENDING',

    -- Optional loose references so the frontend can deep-link a
    -- notification to the record it concerns, without forcing every
    -- notification type to populate every FK.
    related_application_id            UUID REFERENCES verification_applications(id) ON DELETE CASCADE,
    related_certificate_id               UUID REFERENCES verification_certificates(id) ON DELETE CASCADE,

    created_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at                                  TIMESTAMPTZ,
    read_at                                   TIMESTAMPTZ,

    CONSTRAINT ck_notifications_sent_after_created CHECK (sent_at IS NULL OR sent_at >= created_at),
    CONSTRAINT ck_notifications_read_after_sent CHECK (read_at IS NULL OR sent_at IS NULL OR read_at >= sent_at)
);

COMMENT ON TABLE notifications IS 'System alerts/reminders for a recipient user (certificate expiry, verification scheduled, application updates, certificate issued).';

CREATE INDEX idx_notifications_recipient_id ON notifications (recipient_id);
CREATE INDEX idx_notifications_status ON notifications (status);
-- Common query: "unread/pending notifications for a user"
CREATE INDEX idx_notifications_recipient_status ON notifications (recipient_id, status);
CREATE INDEX idx_notifications_type ON notifications (type);