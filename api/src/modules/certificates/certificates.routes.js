const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');

const { ROLES } = require('../../config/roles');

const controller = require('./certificates.controller');

const {
  createCertificateRules,
  updateCertificateStatusRules,
} = require('./certificates.validation');

const router = express.Router();

// ============================================
// PUBLIC QR VERIFICATION
// No authentication required
// ============================================
router.get(
  '/verify/:qrToken',
  controller.verifyCertificate
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
router.use(authenticate);

// Issue certificate
router.post(
  '/',
  authorize(ROLES.ADMIN),
  validateBody(createCertificateRules),
  controller.createCertificate
);

// Get all certificates
router.get(
  '/',
  authorize(ROLES.ADMIN),
  controller.getCertificates
);

// Get certificate by ID
router.get(
  '/:id',
  authorize(ROLES.ADMIN),
  controller.getCertificateById
);

// Update certificate status
router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN),
  validateBody(updateCertificateStatusRules),
  controller.updateCertificateStatus
);

module.exports = router;