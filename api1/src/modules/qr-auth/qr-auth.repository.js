const pool = require('../../pool');

// Find certificate using QR token
async function findCertificateByQrToken(qrToken) {
  const { rows } = await pool.query(
    `SELECT
        vc.id,
        vc.certificate_number,
        vc.instrument_id,
        vc.verification_id,
        vc.issue_date,
        vc.valid_from,
        vc.valid_until,
        vc.status,
        vc.qr_token,

        i.instrument_name,
        i.manufacturer,
        i.model,
        i.serial_number

     FROM verification_certificates vc

     JOIN instruments i
       ON i.id = vc.instrument_id

     WHERE vc.qr_token = $1`,
    [qrToken]
  );

  return rows[0] || null;
}

// Log successful/expired/revoked QR authentication
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
  createQrAuthentication,
};