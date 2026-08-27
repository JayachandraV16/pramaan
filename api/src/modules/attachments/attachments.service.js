const ApiError = require('../../utils/ApiError');
const repo = require('./attachments.repository');

const {
  isValidAttachmentCategory,
} = require('./attachments.validation');

const { ROLES } = require('../../config/roles');
async function ensureApplicationAccess(user, applicationId) {
  // ADMIN has full access
  if (user.role === ROLES.ADMIN) {
    return;
  }

  // Instrument owner can access their own application
  const isOwner = await repo.isApplicationOwner(
    applicationId,
    user.id
  );

  if (isOwner) {
    return;
  }

  // Assigned LMO/GATC can access the application
  const isAssigned = await repo.isAssignedToApplication(
    applicationId,
    user.id
  );

  if (isAssigned) {
    return;
  }

  throw ApiError.forbidden(
    'You do not have permission to access attachments for this application'
  );
}
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

    await ensureApplicationAccess(
      user,
      applicationId
    );
  }

  if (verificationId) {
    const verification =
      await repo.findVerificationById(verificationId);

    if (!verification) {
      throw ApiError.notFound('Verification not found');
    }

    await ensureApplicationAccess(
      user,
      verification.application_id
    );
  } 

  if (certificateId) {
    const certificate =
      await repo.findCertificateById(certificateId);

    if (!certificate) {
      throw ApiError.notFound('Certificate not found');
    }

    const applicationId =
      await repo.findApplicationIdByCertificateId(
        certificateId
      );

    if (!applicationId) {
      throw ApiError.forbidden(
        'Unable to determine certificate ownership'
      );
    }

    await ensureApplicationAccess(
      user,
      applicationId
    );
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

  let applicationId = attachment.application_id;

  // Attachment belongs to a verification
  if (!applicationId && attachment.verification_id) {
    applicationId =
      await repo.findApplicationIdByVerificationId(
        attachment.verification_id
      );
  }

  // Attachment belongs to a certificate
  if (!applicationId && attachment.certificate_id) {
    applicationId =
      await repo.findApplicationIdByCertificateId(
        attachment.certificate_id
      );
  }

  if (!applicationId) {
    throw ApiError.forbidden(
      'Unable to determine attachment ownership'
    );
  }

  await ensureApplicationAccess(user, applicationId);

  return attachment;
}

// Get application attachments
async function getApplicationAttachments(user, applicationId) {
  const application =
    await repo.findApplicationById(applicationId);

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  await ensureApplicationAccess(user, applicationId);

  return repo.findAttachmentsByApplicationId(applicationId);
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

  await ensureApplicationAccess(
    user,
    verification.application_id
  );

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

  const applicationId =
    await repo.findApplicationIdByCertificateId(
      certificateId
    );

  if (!applicationId) {
    throw ApiError.forbidden(
      'Unable to determine certificate ownership'
    );
  }

  await ensureApplicationAccess(
    user,
    applicationId
  );

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