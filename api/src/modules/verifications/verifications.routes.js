const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');

const { ROLES } = require('../../config/roles');
const controller = require('./verifications.controller');

const {
  createVerificationRules,
  createObservationRules,
  createReadingRules,
  createResultRules,
} = require('./verifications.validation');

const router = express.Router();

// All verification routes require authentication
router.use(authenticate);

// Start a field verification
router.post(
  '/',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(createVerificationRules),
  controller.createVerification
);

// Get all accessible verifications
router.get(
  '/',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getVerifications
);

// Get one verification result
router.get(
  '/:id/result',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getVerificationResult
);

// Get one verification
router.get(
  '/:id',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getVerificationById
);

// Add qualitative observation
router.post(
  '/:id/observations',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(createObservationRules),
  controller.addObservation
);

// Add measurement reading
router.post(
  '/:id/readings',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(createReadingRules),
  controller.addReading
);

// Submit final PASS/FAIL result
router.post(
  '/:id/result',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(createResultRules),
  controller.submitResult
);

module.exports = router;