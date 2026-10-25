-- =============================================================================
-- Migration 015: QR Authentications
-- =============================================================================
-- Log of public verification/authentication events when a certificate's QR
-- code is scanned. No separate QR_Code table — the QR token lives on
-- verification_certificates.qr_token (migration 013); this table only
-- records scan/authentication attempts against that token.
-- =============================================================================

CREATE TABLE qr_authentications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    certificate_id        UUID NOT NULL REFERENCES verification_certificates(id) ON DELETE CASCADE,

    result                   qr_auth_result NOT NULL,
    access_source              TEXT,          -- e.g. 'WEB', 'MOBILE_APP', 'PUBLIC_PORTAL'
    ip_address                    INET,
    user_agent                     TEXT,

    authenticated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE qr_authentications IS 'Public authentication log for certificate QR-code scans. Many rows per certificate.';
COMMENT ON COLUMN qr_authentications.certificate_id IS 'ON DELETE CASCADE: authentication log entries are only meaningful in the context of their certificate.';

CREATE INDEX idx_qr_authentications_certificate_id ON qr_authentications (certificate_id);
CREATE INDEX idx_qr_authentications_authenticated_at ON qr_authentications (authenticated_at);
CREATE INDEX idx_qr_authentications_result ON qr_authentications (result);