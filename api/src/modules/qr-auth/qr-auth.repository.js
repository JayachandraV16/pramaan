const pool = require('../../pool');

// One query serves every public lookup. Only columns needed to judge
// authenticity and to show the public result page are selected.
const PUBLIC_CERTIFICATE_SELECT = `
  SELECT
    vc.id, vc.certificate_number, vc.verification_id, vc.instrument_id,
    vc.issue_date, vc.valid_from, vc.valid_until, vc.status,
    vc.qr_token, vc.record_sha256, vc.pdf_sha256,
    vc.pdf_signed, vc.signature_subject, vc.signed_at,
    vc.revoked_at, vc.revocation_reason,
    i.instrument_name, i.manufacturer, i.model, i.serial_number,
    i.capacity, i.capacity_unit, i.accuracy_class, i.location_address,
    COALESCE(owner.full_name, applicant.full_name) AS owner_name,
    COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
    performer.full_name AS officer_name,
    vr.result_date AS verification_date
  FROM verification_certificates vc
  JOIN instruments i ON i.id = vc.instrument_id
  JOIN verifications v ON v.id = vc.verification_id
  JOIN verification_applications app ON app.id = v.application_id
  LEFT JOIN verification_results vr ON vr.verification_id = v.id
  LEFT JOIN users owner ON owner.id = i.owner_id
  LEFT JOIN users applicant ON applicant.id = app.applicant_id
  LEFT JOIN users performer ON performer.id = v.performed_by_id`;

async function findCertificateByQrToken(qrToken) {
  const { rows } = await pool.query(`${PUBLIC_CERTIFICATE_SELECT} WHERE vc.qr_token = $1`, [qrToken]);
  return rows[0] || null;
}

async function findCertificateByNumber(certificateNumber) {
  const { rows } = await pool.query(
    `${PUBLIC_CERTIFICATE_SELECT} WHERE upper(vc.certificate_number) = upper($1)`,
    [certificateNumber]
  );
  return rows[0] || null;
}

async function findCertificateByPdfSha256(pdfSha256) {
  const { rows } = await pool.query(`${PUBLIC_CERTIFICATE_SELECT} WHERE vc.pdf_sha256 = $1`, [pdfSha256]);
  return rows[0] || null;
}

// Log every public authentication attempt for a known certificate
async function createQrAuthentication({
  certificateId,
  result,
  accessSource,
  ipAddress,
  userAgent,
}) {
  const { rows } = await pool.query(
    `INSERT INTO qr_authentications (
      certificate_id,
      result,
      access_source,
      ip_address,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      certificateId,
      result,
      accessSource || null,
      ipAddress || null,
      userAgent || null,
    ]
  );

  return rows[0];
}

module.exports = {
  findCertificateByQrToken,
  findCertificateByNumber,
  findCertificateByPdfSha256,
  createQrAuthentication,
};
