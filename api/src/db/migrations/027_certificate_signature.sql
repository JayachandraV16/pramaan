-- 027_certificate_signature.sql
-- Records whether the issued PDF carries a digital signature and by whom.
-- Like pdf_sha256 these fields are write-once (the PDF itself never changes).

ALTER TABLE verification_certificates
    ADD COLUMN pdf_signed            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN signature_subject     TEXT,
    ADD COLUMN signature_fingerprint TEXT,
    ADD COLUMN signed_at             TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION protect_issued_certificate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.certificate_number IS DISTINCT FROM OLD.certificate_number
       OR NEW.qr_token        IS DISTINCT FROM OLD.qr_token
       OR NEW.verification_id IS DISTINCT FROM OLD.verification_id
       OR NEW.instrument_id   IS DISTINCT FROM OLD.instrument_id
       OR NEW.issue_date      IS DISTINCT FROM OLD.issue_date
       OR NEW.valid_from      IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until     IS DISTINCT FROM OLD.valid_until THEN
        RAISE EXCEPTION 'Issued certificate % cannot be modified (identity and validity are immutable)', OLD.certificate_number;
    END IF;

    IF OLD.pdf_sha256 IS NOT NULL AND NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 THEN
        RAISE EXCEPTION 'pdf_sha256 of certificate % is write-once', OLD.certificate_number;
    END IF;
    IF OLD.record_sha256 IS NOT NULL AND NEW.record_sha256 IS DISTINCT FROM OLD.record_sha256 THEN
        RAISE EXCEPTION 'record_sha256 of certificate % is write-once', OLD.certificate_number;
    END IF;
    IF OLD.certificate_file_url IS NOT NULL AND NEW.certificate_file_url IS DISTINCT FROM OLD.certificate_file_url THEN
        RAISE EXCEPTION 'certificate_file_url of certificate % is write-once', OLD.certificate_number;
    END IF;
    IF OLD.pdf_sha256 IS NOT NULL AND (
           NEW.pdf_signed            IS DISTINCT FROM OLD.pdf_signed
        OR NEW.signature_subject     IS DISTINCT FROM OLD.signature_subject
        OR NEW.signature_fingerprint IS DISTINCT FROM OLD.signature_fingerprint
        OR NEW.signed_at             IS DISTINCT FROM OLD.signed_at) THEN
        RAISE EXCEPTION 'The signature details of certificate % are write-once', OLD.certificate_number;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'REVOKED' THEN
            RAISE EXCEPTION 'Certificate % is REVOKED and cannot change status', OLD.certificate_number;
        END IF;
        IF OLD.status = 'EXPIRED' AND NEW.status = 'ACTIVE' THEN
            RAISE EXCEPTION 'Certificate % is EXPIRED and cannot be reactivated; issue a new one via re-verification', OLD.certificate_number;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
