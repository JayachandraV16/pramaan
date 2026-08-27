const pool = require('../../pool');

// Find application
async function findApplicationById(id) {
  const { rows } = await pool.query(
    `SELECT *
     FROM verification_applications
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Find verification
async function findVerificationById(id) {
  const { rows } = await pool.query(
    `SELECT *
     FROM verifications
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Find certificate
async function findCertificateById(id) {
  const { rows } = await pool.query(
    `SELECT *
     FROM verification_certificates
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Create attachment
async function createAttachment({
  applicationId,
  verificationId,
  certificateId,
  uploadedById,
  category,
  fileName,
  fileUrl,
  mimeType,
  fileSizeBytes,
  description,
}) {
  const { rows } = await pool.query(
    `INSERT INTO attachments (
      application_id,
      verification_id,
      certificate_id,
      uploaded_by_id,
      category,
      file_name,
      file_url,
      mime_type,
      file_size_bytes,
      description
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      applicationId || null,
      verificationId || null,
      certificateId || null,
      uploadedById,
      category,
      fileName,
      fileUrl,
      mimeType || null,
      fileSizeBytes ?? null,
      description || null,
    ]
  );

  return rows[0];
}

// Find attachment by ID
async function findAttachmentById(id) {
  const { rows } = await pool.query(
    `SELECT a.*,
            u.full_name AS uploaded_by_name
     FROM attachments a
     JOIN users u ON u.id = a.uploaded_by_id
     WHERE a.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Get application attachments
async function findAttachmentsByApplicationId(applicationId) {
  const { rows } = await pool.query(
    `SELECT a.*,
            u.full_name AS uploaded_by_name
     FROM attachments a
     JOIN users u ON u.id = a.uploaded_by_id
     WHERE a.application_id = $1
     ORDER BY a.uploaded_at DESC`,
    [applicationId]
  );

  return rows;
}

// Get verification attachments
async function findAttachmentsByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `SELECT a.*,
            u.full_name AS uploaded_by_name
     FROM attachments a
     JOIN users u ON u.id = a.uploaded_by_id
     WHERE a.verification_id = $1
     ORDER BY a.uploaded_at DESC`,
    [verificationId]
  );

  return rows;
}

// Get certificate attachments
async function findAttachmentsByCertificateId(certificateId) {
  const { rows } = await pool.query(
    `SELECT a.*,
            u.full_name AS uploaded_by_name
     FROM attachments a
     JOIN users u ON u.id = a.uploaded_by_id
     WHERE a.certificate_id = $1
     ORDER BY a.uploaded_at DESC`,
    [certificateId]
  );

  return rows;
}

// Delete attachment
async function deleteAttachment(id) {
  const { rows } = await pool.query(
    `DELETE FROM attachments
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return rows[0] || null;
}
// Check whether a user owns an application

async function isApplicationOwner(applicationId, userId) {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM verification_applications
      WHERE id = $1
        AND applicant_id = $2
    `,
    [applicationId, userId]
  );

  return rows.length > 0;
}

// Check whether an LMO/GATC is assigned to an application

async function isAssignedToApplication(applicationId, userId) {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM verification_assignments
      WHERE application_id = $1
        AND assigned_to_id = $2
    `,
    [applicationId, userId]
  );

  return rows.length > 0;
}

// Get the application connected to a verification

async function findApplicationIdByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `
      SELECT application_id
      FROM verifications
      WHERE id = $1
    `,
    [verificationId]
  );

  return rows[0]?.application_id || null;
}

// Get the application connected to a certificate

async function findApplicationIdByCertificateId(certificateId) {
  const { rows } = await pool.query(
    `
      SELECT application_id
      FROM verification_certificates
      WHERE id = $1
    `,
    [certificateId]
  );

  return rows[0]?.application_id || null;
}
module.exports = {
  findApplicationById,
  findVerificationById,
  findCertificateById,

  createAttachment,

  findAttachmentById,

  findAttachmentsByApplicationId,
  findAttachmentsByVerificationId,
  findAttachmentsByCertificateId,

  isApplicationOwner,
  isAssignedToApplication,

  findApplicationIdByVerificationId,
  findApplicationIdByCertificateId,

  deleteAttachment,
};