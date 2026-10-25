const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./applications.controller');
const { createApplicationRules } = require('./applications.validation');

const router = express.Router();

// All application routes require authentication
router.use(authenticate);

// Create and submit a verification application
router.post(
  '/',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  validateBody(createApplicationRules),
  controller.createApplication
);

// Get applications
// INSTRUMENT_OWNER -> own applications
// ADMIN / GATC / LMO -> all applications
router.get(
  '/',
  authorize(
    ROLES.INSTRUMENT_OWNER,
    ROLES.ADMIN,
    ROLES.GATC,
    ROLES.LMO
  ),
  controller.getApplications
);

// Get one application
router.get(
  '/:id',
  authorize(
    ROLES.INSTRUMENT_OWNER,
    ROLES.ADMIN,
    ROLES.GATC,
    ROLES.LMO
  ),
  controller.getApplicationById
);

// Status timeline of one application (who changed it, when, why)
router.get(
  '/:id/history',
  authorize(
    ROLES.INSTRUMENT_OWNER,
    ROLES.ADMIN,
    ROLES.GATC,
    ROLES.LMO
  ),
  controller.getApplicationHistory
);

// Withdraw an application that has not started (applicant or ADMIN); body: { reason? }
router.post(
  '/:id/cancel',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  controller.cancelApplication
);

// Confirm the GRAS challan payment (ADMIN)
router.post(
  '/:id/payment-verified',
  authorize(ROLES.ADMIN),
  controller.verifyPayment
);

// Refuse an application (ADMIN); body: { reason } (min 10 characters)
router.post(
  '/:id/reject',
  authorize(ROLES.ADMIN),
  controller.rejectApplication
);

module.exports = router;