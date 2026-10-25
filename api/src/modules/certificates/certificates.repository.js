const certificateId = require('../../utils/certificateId');
const pool = require('../../pool');

// Find verification with its application and result
async function findVerificationById(id) {
  const { rows } = await pool.query(
    `SELECT v.*,
            vr.decision,
            vr.id AS result_id
     FROM verifications v
     LEFT JOIN verification_results vr
       ON vr.verification_id = v.id
     WHERE v.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Check whether an instrument exists
async function findInstrumentById(id) {
  const { rows } = await pool.query(
    `SELECT *
     FROM instruments
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Check if certificate already exists for verification
async function findCertificateByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM verification_certificates
     WHERE verification_id = $1`,
    [verificationId]
  );

  return rows[0] || null;
}

// Generate certificate number
async function getNextCertificateNumber() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM verification_certificates`
  );

  const nextNumber = rows[0].count + 1;

  return `CERT-${new Date().getFullYear()}-${String(
    nextNumber
  ).padStart(6, '0')}`;
}

// Create certificate
async function createCertificate({
  verificationId,
  instrumentId,
  certificateNumber,
  validFrom,
  validUntil,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_certificates (
      verification_id,
      instrument_id,
      certificate_number,
      valid_from,
      valid_until
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      verificationId,
      instrumentId,
      certificateNumber,
      validFrom,
      validUntil,
    ]
  );

  return rows[0];
}

// ADMIN: get all certificates
async function findAllCertificates() {
  const { rows } = await pool.query(
    `SELECT vc.*,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number AS instrument_serial,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            app.application_number,
            vr.decision,
            u.full_name AS performed_by_name
     FROM verification_certificates vc
     JOIN instruments i
       ON i.id = vc.instrument_id
     JOIN verifications v
       ON v.id = vc.verification_id
     JOIN verification_applications app
       ON app.id = v.application_id
     LEFT JOIN verification_results vr
       ON vr.verification_id = v.id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     LEFT JOIN users u
       ON u.id = v.performed_by_id
     ORDER BY vc.created_at DESC`
  );

  return rows;
}
// Get certificate by ID
async function findCertificateById(id) {
  const { rows } = await pool.query(
    `SELECT vc.*,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number AS instrument_serial,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            app.application_number,
            vr.decision,
            u.full_name AS performed_by_name
     FROM verification_certificates vc
     JOIN instruments i
       ON i.id = vc.instrument_id
     JOIN verifications v
       ON v.id = vc.verification_id
     JOIN verification_applications app
       ON app.id = v.application_id
     LEFT JOIN verification_results vr
       ON vr.verification_id = v.id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     LEFT JOIN users u
       ON u.id = v.performed_by_id
     WHERE vc.id = $1`,
    [id]
  );

  return rows[0] || null;
}
// Public QR verification
async function findCertificateByQrToken(qrToken) {
  const { rows } = await pool.query(
    `SELECT vc.*,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number AS instrument_serial,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            app.application_number,
            vr.decision,
            u.full_name AS performed_by_name
     FROM verification_certificates vc
     JOIN instruments i
       ON i.id = vc.instrument_id
     JOIN verifications v
       ON v.id = vc.verification_id
     JOIN verification_applications app
       ON app.id = v.application_id
     LEFT JOIN verification_results vr
       ON vr.verification_id = v.id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     LEFT JOIN users u
       ON u.id = v.performed_by_id
     WHERE vc.qr_token = $1`,
    [qrToken]
  );

  return rows[0] || null;
}
// Update certificate status
async function updateCertificateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE verification_certificates
     SET status = $2
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );

  return rows[0] || null;
}
async function updateCertificateFileUrl(id, fileUrl) {
  const { rows } = await pool.query(
    `UPDATE verification_certificates
     SET certificate_file_url = $2
     WHERE id = $1
     RETURNING *`,
    [id, fileUrl]
  );

  return rows[0] || null;
}

// Owner: get certificates for owned instruments
async function findCertificatesByOwnerId(ownerId) {
  const { rows } = await pool.query(
    `SELECT vc.*,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number AS instrument_serial,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            app.application_number,
            vr.decision,
            u.full_name AS performed_by_name
     FROM verification_certificates vc
     JOIN instruments i
       ON i.id = vc.instrument_id
     JOIN verifications v
       ON v.id = vc.verification_id
     JOIN verification_applications app
       ON app.id = v.application_id
     LEFT JOIN verification_results vr
       ON vr.verification_id = v.id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     LEFT JOIN users u
       ON u.id = v.performed_by_id
     WHERE i.owner_id = $1
     ORDER BY vc.created_at DESC`,
    [ownerId]
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Transactional issuance / lifecycle helpers (all take the caller's client)
// ---------------------------------------------------------------------------

// Verification + its application + instrument, for issuance rules.
async function findIssuanceContext(verificationId, client = pool) {
  const { rows } = await client.query(
    `SELECT v.id AS verification_id, v.status AS verification_status,
            vr.decision,
            app.id AS application_id, app.applicant_id, app.instrument_id,
            i.owner_id, i.serial_number, i.instrument_name, i.manufacturer, i.model,
            it.default_validity_months
     FROM verifications v
     JOIN verification_applications app ON app.id = v.application_id
     JOIN instruments i ON i.id = app.instrument_id
     JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN verification_results vr ON vr.verification_id = v.id
     WHERE v.id = $1`,
    [verificationId]
  );
  return rows[0] || null;
}

// Race-free next number under the configured scheme (legacy CERT-{year}-{000001} or PRM-...);
// call inside the issuing transaction. See utils/certificateId.js.
const nextCertificateNumber = (client, year, options) => certificateId.nextCertificateNumber(client, year, options);

async function insertCertificate(client, { verificationId, instrumentId, certificateNumber, validFrom, validUntil }) {
  const { rows } = await client.query(
    `INSERT INTO verification_certificates (
       verification_id, instrument_id, certificate_number, valid_from, valid_until
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [verificationId, instrumentId, certificateNumber, validFrom, validUntil]
  );
  return rows[0];
}

async function setIntegrityFields(client, { id, fileUrl, pdfSha256, recordSha256, signature = null }) {
  const { rows } = await client.query(
    `UPDATE verification_certificates
     SET certificate_file_url = $2, pdf_sha256 = $3, record_sha256 = $4,
         pdf_signed = $5, signature_subject = $6, signature_fingerprint = $7, signed_at = $8
     WHERE id = $1
     RETURNING *`,
    [id, fileUrl, pdfSha256, recordSha256, !!signature, signature ? signature.subject : null, signature ? signature.fingerprint : null, signature ? signature.signedAt : null]
  );
  return rows[0];
}

async function markRevoked(client, { id, revokedById, reason }) {
  const { rows } = await client.query(
    `UPDATE verification_certificates
     SET status = 'REVOKED', revoked_at = now(), revoked_by_id = $2, revocation_reason = $3
     WHERE id = $1
     RETURNING *`,
    [id, revokedById, reason]
  );
  return rows[0];
}

// Is the certificate's instrument owned by (or its application filed by) this user?
async function isCertificateOwnedBy(certificateId, userId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM verification_certificates vc
     JOIN instruments i ON i.id = vc.instrument_id
     JOIN verifications v ON v.id = vc.verification_id
     JOIN verification_applications app ON app.id = v.application_id
     WHERE vc.id = $1 AND (i.owner_id = $2 OR app.applicant_id = $2)`,
    [certificateId, userId]
  );
  return rows.length > 0;
}

// Recipient of certificate notifications (the applicant of the application).
async function findCertificateRecipients(client, certificateId) {
  const { rows } = await client.query(
    `SELECT app.id AS application_id, app.applicant_id, i.owner_id
     FROM verification_certificates vc
     JOIN verifications v ON v.id = vc.verification_id
     JOIN verification_applications app ON app.id = v.application_id
     JOIN instruments i ON i.id = vc.instrument_id
     WHERE vc.id = $1`,
    [certificateId]
  );
  return rows[0] || null;
}

module.exports = {
  findIssuanceContext,
  nextCertificateNumber,
  insertCertificate,
  setIntegrityFields,
  markRevoked,
  isCertificateOwnedBy,
  findCertificateRecipients,
  findVerificationById,
  findInstrumentById,
  findCertificateByVerificationId,
  getNextCertificateNumber,
  createCertificate,
  findAllCertificates,
  findCertificatesByOwnerId,
  findCertificateById,
  findCertificateByQrToken,
  updateCertificateStatus,
  updateCertificateFileUrl,
};