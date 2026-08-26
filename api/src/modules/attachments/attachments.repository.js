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

module.exports = {
  findApplicationById,
  findVerificationById,
  findCertificateById,
  createAttachment,
  findAttachmentById,
  findAttachmentsByApplicationId,
  findAttachmentsByVerificationId,
  findAttachmentsByCertificateId,
  deleteAttachment,
};