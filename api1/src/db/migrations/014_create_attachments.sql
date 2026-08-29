-- =============================================================================
-- Migration 014: Attachments
-- =============================================================================
-- Generic attachment/evidence entity, per scope rules (no separate
-- Photo/Document/Evidence tables).
--
-- DESIGN DECISION — how attachments relate to their owner:
--   An attachment may belong to a Verification Application, a Verification,
--   or a Certificate. PostgreSQL cannot enforce a true polymorphic foreign
--   key (a single "entity_type + entity_id" pair referencing different
--   tables), so two options were considered:
--     (a) generic entity_type/entity_id columns with NO foreign key, leaving
--         referential integrity entirely to the application layer;
--     (b) three nullable, real foreign key columns
--         (application_id, verification_id, certificate_id) with a CHECK
--         constraint requiring exactly one to be non-null.
--   Option (b) was chosen: it keeps genuine FK integrity (Postgres will
--   reject an attachment pointing at a non-existent row) at the small cost
--   of two always-NULL columns per row, which is a well-known and accepted
--   trade-off for a hackathon-scoped relational schema. This directly
--   satisfies the requirement to "avoid unnecessary polymorphic-FK problems
--   where possible."
-- =============================================================================

CREATE TABLE attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id       UUID REFERENCES verification_applications(id) ON DELETE CASCADE,
    verification_id        UUID REFERENCES verifications(id) ON DELETE CASCADE,
    certificate_id           UUID REFERENCES verification_certificates(id) ON DELETE CASCADE,

    uploaded_by_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    category                     attachment_category NOT NULL DEFAULT 'OTHER',
    file_name                     TEXT NOT NULL,
    file_url                       TEXT NOT NULL,     -- reference/path in object storage
    mime_type                       TEXT,
    file_size_bytes                   BIGINT,
    description                        TEXT,

    uploaded_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_attachments_exactly_one_owner CHECK (
        (CASE WHEN application_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN verification_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN certificate_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),
    CONSTRAINT ck_attachments_file_size_non_negative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

COMMENT ON TABLE attachments IS 'Generic file metadata/reference for photographs and documents attached to an application, verification, or certificate. Exactly one owner FK is set per row (see ck_attachments_exactly_one_owner). Binary files live in object storage; only metadata/reference is stored here.';

CREATE INDEX idx_attachments_application_id ON attachments (application_id) WHERE application_id IS NOT NULL;
CREATE INDEX idx_attachments_verification_id ON attachments (verification_id) WHERE verification_id IS NOT NULL;
CREATE INDEX idx_attachments_certificate_id ON attachments (certificate_id) WHERE certificate_id IS NOT NULL;
CREATE INDEX idx_attachments_uploaded_by_id ON attachments (uploaded_by_id);