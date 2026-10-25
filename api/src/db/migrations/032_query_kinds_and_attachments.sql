-- Migration 032: document requests inside query threads, and files on replies.
--   * application_queries.kind: an ordinary clarification, or a request from the department for
--     specific documents (requested_items lists what is wanted).
--   * attachments.query_message_id: a file sent with a reply. The file still belongs to the
--     application (application_id), so the existing access rules and the application's document
--     list keep working.
CREATE TYPE query_kind AS ENUM ('CLARIFICATION', 'DOCUMENT_REQUEST');

ALTER TABLE application_queries
    ADD COLUMN kind query_kind NOT NULL DEFAULT 'CLARIFICATION',
    ADD COLUMN requested_items TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE application_queries
    ADD CONSTRAINT ck_application_queries_requested_items CHECK (
        (kind = 'CLARIFICATION' AND cardinality(requested_items) = 0)
        OR (kind = 'DOCUMENT_REQUEST' AND cardinality(requested_items) BETWEEN 1 AND 10)
    );

CREATE INDEX idx_application_queries_kind_status ON application_queries (kind, status);

ALTER TABLE attachments
    ADD COLUMN query_message_id UUID REFERENCES application_query_messages(id) ON DELETE SET NULL;

ALTER TABLE attachments
    ADD CONSTRAINT ck_attachments_query_message_needs_application CHECK (query_message_id IS NULL OR application_id IS NOT NULL);

CREATE INDEX idx_attachments_query_message ON attachments (query_message_id) WHERE query_message_id IS NOT NULL;
