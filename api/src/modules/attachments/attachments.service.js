const ApiError = require('../../utils/ApiError');
const repo = require('./attachments.repository');

const {
  isValidAttachmentCategory,
} = require('./attachments.validation');

const { ROLES } = require('../../config/roles');

// Create attachment
async function createAttachment(user, data) {
  const {
    applicationId,
    verificationId,
    certificateId,
    category,
    fileName,
    fileUrl,
    mimeType,
    fileSizeBytes,
    description,
  } = data;

  // Exactly one owner must be provided
  const ownerCount =
    Number(Boolean(applicationId)) +
    Number(Boolean(verificationId)) +
    Number(Boolean(certificateId));

  if (ownerCount !== 1) {
    throw ApiError.badRequest(
      'Exactly one of applicationId, verificationId, or certificateId must be provided'
    );
  }

  // Validate category
  if (!isValidAttachmentCategory(category)) {
    throw ApiError.badRequest(
      `Invalid attachment category: ${category}`
    );
  }

  // Validate required file fields
  if (!fileName || !fileUrl) {
    throw ApiError.badRequest(
      'fileName and fileUrl are required'
    );
  }

  // Validate file size
  if (
    fileSizeBytes !== undefined &&
    fileSizeBytes !== null &&
    (!Number.isFinite(Number(fileSizeBytes)) ||
      Number(fileSizeBytes) < 0)
  ) {
    throw ApiError.badRequest(
      'fileSizeBytes must be a non-negative number'
    );
  }

  // Check owner exists
  if (applicationId) {
    const application =
      await repo.findApplicationById(applicationId);

    if (!application) {
      throw ApiError.notFound('Application not found');
    }
  }

  if (verificationId) {
    const verification =
      await repo.findVerificationById(verificationId);

    if (!verification) {
      throw ApiError.notFound('Verification not found');
    }
  }

  if (certificateId) {
    const certificate =
      await repo.findCertificateById(certificateId);

    if (!certificate) {
      throw ApiError.notFound('Certificate not found');
    }
  }

  return repo.createAttachment({
    applicationId,
    verificationId,
    certificateId,
    uploadedById: user.id,
    category,
    fileName,
    fileUrl,
    mimeType,
    fileSizeBytes,
    description,
  });
}

// Get attachment by ID
async function getAttachmentById(user, attachmentId) {
  const attachment =
    await repo.findAttachmentById(attachmentId);

  if (!attachment) {
    throw ApiError.notFound('Attachment not found');
  }

  return attachment;
}

// Get application attachments
async function getApplicationAttachments(
  user,
  applicationId
) {
  const application =
    await repo.findApplicationById(applicationId);

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  return repo.findAttachmentsByApplicationId(
    applicationId
  );
}

// Get verification attachments
async function getVerificationAttachments(
  user,
  verificationId
) {
  const verification =
    await repo.findVerificationById(verificationId);

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  return repo.findAttachmentsByVerificationId(
    verificationId
  );
}

// Get certificate attachments
async function getCertificateAttachments(
  user,
  certificateId
) {
  const certificate =
    await repo.findCertificateById(certificateId);

  if (!certificate) {
    throw ApiError.notFound('Certificate not found');
  }

  return repo.findAttachmentsByCertificateId(
    certificateId
  );
}

// Delete attachment
async function deleteAttachment(
  user,
  attachmentId
) {
  const attachment =
    await repo.findAttachmentById(attachmentId);

  if (!attachment) {
    throw ApiError.notFound('Attachment not found');
  }

  // ADMIN can delete any attachment
  // Other users can only delete their own uploads
  if (
    user.role !== ROLES.ADMIN &&
    attachment.uploaded_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only delete attachments uploaded by you'
    );
  }

  return repo.deleteAttachment(attachmentId);
}

module.exports = {
  createAttachment,
  getAttachmentById,
  getApplicationAttachments,
  getVerificationAttachments,
  getCertificateAttachments,
  deleteAttachment,
};