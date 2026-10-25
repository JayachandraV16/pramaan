-- Migration 034: what the database knows about every uploaded file.
-- The bytes live in object storage (local folder or an S3-compatible bucket); this table keeps the facts
-- that must not depend on where the bytes are: size, SHA-256, kind, picture size and camera orientation,
-- who uploaded it and when. It is written by the upload middleware and read by the storage tools
-- (npm run storage:audit / storage:cleanup / storage:migrate). Files uploaded before this migration have
-- no row until `storage:audit --backfill` adds one.
CREATE TABLE stored_files (
    key               TEXT PRIMARY KEY,
    kind              VARCHAR(10) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    size_bytes        BIGINT NOT NULL,
    sha256            CHAR(64) NOT NULL,
    width             INTEGER,
    height            INTEGER,
    exif_orientation  SMALLINT,
    driver            VARCHAR(10) NOT NULL DEFAULT 'local',
    uploaded_by_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_stored_files_kind CHECK (kind IN ('IMAGE', 'PDF')),
    CONSTRAINT ck_stored_files_size CHECK (size_bytes >= 0),
    CONSTRAINT ck_stored_files_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_stored_files_orientation CHECK (exif_orientation IS NULL OR exif_orientation BETWEEN 1 AND 8),
    CONSTRAINT ck_stored_files_dimensions CHECK ((width IS NULL) = (height IS NULL) AND (width IS NULL OR (width > 0 AND height > 0)))
);
CREATE INDEX idx_stored_files_created_at ON stored_files (created_at);
CREATE INDEX idx_stored_files_uploaded_by ON stored_files (uploaded_by_id);
COMMENT ON TABLE stored_files IS 'Metadata for every uploaded file (bytes are in object storage). Written by the upload middleware.';
