const service = require('./attachments.service');
const ApiResponse = require('../../utils/ApiResponse');

// Create attachment with actual file upload
async function createAttachment(req, res, next) {
  try {
    if (!req.file) {
      return next(
        new Error('A file is required')
      );
    }

    const attachment = await service.createAttachment(
      req.user,
      {
        ...req.body,

        fileName: req.file.originalname,

        fileUrl: `/uploads/${req.file.filename}`,

        mimeType: req.file.mimetype,

        fileSizeBytes: req.file.size,
      }
    );

    new ApiResponse(
      201,
      attachment,
      'Attachment uploaded successfully'
    ).send(res);

  } catch (error) {
    next(error);
  }
}
// Get attachment by ID
async function getAttachmentById(req, res, next) {
  try {
    const attachment =
      await service.getAttachmentById(
        req.user,
        req.params.id
      );

    new ApiResponse(
      200,
      attachment,
      'Attachment retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Get application attachments
async function getApplicationAttachments(
  req,
  res,
  next
) {
  try {
    const attachments =
      await service.getApplicationAttachments(
        req.user,
        req.params.applicationId
      );

    new ApiResponse(
      200,
      attachments,
      'Application attachments retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Get verification attachments
async function getVerificationAttachments(
  req,
  res,
  next
) {
  try {
    const attachments =
      await service.getVerificationAttachments(
        req.user,
        req.params.verificationId
      );

    new ApiResponse(
      200,
      attachments,
      'Verification attachments retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Get certificate attachments
async function getCertificateAttachments(
  req,
  res,
  next
) {
  try {
    const attachments =
      await service.getCertificateAttachments(
        req.user,
        req.params.certificateId
      );

    new ApiResponse(
      200,
      attachments,
      'Certificate attachments retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Delete attachment
async function deleteAttachment(req, res, next) {
  try {
    const attachment =
      await service.deleteAttachment(
        req.user,
        req.params.id
      );

    new ApiResponse(
      200,
      attachment,
      'Attachment deleted successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAttachment,
  getAttachmentById,
  getApplicationAttachments,
  getVerificationAttachments,
  getCertificateAttachments,
  deleteAttachment,
};