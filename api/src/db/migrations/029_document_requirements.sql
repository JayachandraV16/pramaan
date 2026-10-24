-- 029_document_requirements.sql
-- Required supporting documents. An admin defines which documents an application
-- needs (optionally depending on application type, instrument origin and the
-- applicant's category); uploads are tagged with a document_type and a checklist
-- shows what is still missing. No requirements are seeded: they depend on the
-- State's rules, so with none defined nothing changes.

ALTER TABLE attachments
    ADD COLUMN document_type TEXT,
    ADD CONSTRAINT ck_attachments_document_type
        CHECK (document_type IS NULL OR document_type ~ '^[A-Z][A-Z0-9_]{1,49}$');

CREATE INDEX idx_attachments_application_document_type
    ON attachments (application_id, document_type) WHERE document_type IS NOT NULL;

CREATE TABLE document_requirements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type     TEXT NOT NULL,
    label             TEXT NOT NULL,
    label_hi          TEXT,
    -- NULL = applies to every value
    application_type  application_type,
    instrument_origin instrument_origin,
    applicant_type    applicant_type,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_document_requirements_type CHECK (document_type ~ '^[A-Z][A-Z0-9_]{1,49}$'),
    CONSTRAINT ck_document_requirements_label CHECK (length(trim(label)) > 0)
);

-- One requirement per document type and scope. NULL means "any", so the scope is
-- turned into a text key (enum output never changes, hence IMMUTABLE is safe here).
CREATE FUNCTION document_requirement_scope(a application_type, b instrument_origin, c applicant_type)
RETURNS TEXT AS $$
    SELECT COALESCE(a::text, '') || '|' || COALESCE(b::text, '') || '|' || COALESCE(c::text, '');
$$ LANGUAGE sql IMMUTABLE;

CREATE UNIQUE INDEX uq_document_requirements_scope
    ON document_requirements (document_type, document_requirement_scope(application_type, instrument_origin, applicant_type));

CREATE TRIGGER trg_document_requirements_set_updated_at
    BEFORE UPDATE ON document_requirements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
