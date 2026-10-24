-- 025_user_language.sql
-- Preferred language for notifications (and e-mail/SMS built from them).
-- Supported: en, hi. The list lives in api/src/utils/i18n.js; keep both in step.

ALTER TABLE users
    ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en',
    ADD CONSTRAINT ck_users_preferred_language CHECK (preferred_language IN ('en', 'hi'));
