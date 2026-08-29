const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const upload = require('../../middleware/upload');

const controller = require('./attachments.controller');

const router = express.Router();

// Create attachment with actual file upload
router.post(
  '/',
  authenticate,
  upload.single('file'),
  controller.createAttachment
);

// Get attachment by ID
router.get(
  '/:id',
  authenticate,
  controller.getAttachmentById
);

// Get application attachments
router.get(
  '/application/:applicationId',
  authenticate,
  controller.getApplicationAttachments
);

// Get verification attachments
router.get(
  '/verification/:verificationId',
  authenticate,
  controller.getVerificationAttachments
);

// Get certificate attachments
router.get(
  '/certificate/:certificateId',
  authenticate,
  controller.getCertificateAttachments
);

// Delete attachment
router.delete(
  '/:id',
  authenticate,
  controller.deleteAttachment
);

module.exports = router;