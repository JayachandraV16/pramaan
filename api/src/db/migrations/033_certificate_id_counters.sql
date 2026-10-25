-- Migration 033: serial counters for the structured certificate number (PRM-YY-OOO-NNNNNNN-C-TTTT).
-- One counter per year and issuing office. Legacy CERT-{year}-{serial} numbers keep their own
-- counter (certificate_number_counters) and stay valid; which scheme is used for NEW certificates
-- is decided by the CERT_ID_SCHEME setting (default legacy).
CREATE TABLE certificate_id_counters (
    year           INTEGER NOT NULL,
    office_code    CHAR(3) NOT NULL,
    last_sequence  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT pk_certificate_id_counters PRIMARY KEY (year, office_code),
    CONSTRAINT ck_certificate_id_counters_sequence CHECK (last_sequence >= 0 AND last_sequence <= 9999999),
    CONSTRAINT ck_certificate_id_counters_office CHECK (office_code ~ '^[A-Z]{3}$')
);
COMMENT ON TABLE certificate_id_counters IS 'Per-year, per-office serial behind PRM-YY-OOO-NNNNNNN-C-TTTT certificate numbers; incremented atomically inside the issuing transaction.';
