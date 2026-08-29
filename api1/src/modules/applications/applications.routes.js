const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./applications.controller');
const { createApplicationRules } = require('./applications.validation');

const router = express.Router();

// PUBLIC UNAUTHENTICATED TRACKING ROUTE
router.get('/track/:applicationNumber', controller.trackApplicationPublic);

// All subsequent application routes require authentication
router.use(authenticate);

// Create and submit a verification application
router.post(
  '/',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  validateBody(createApplicationRules),
  controller.createApplication
);

// Get applications (Owner, Admin, GATC, LMO)
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

// Officer Action: Request Document or Clarification
router.post(
  '/:id/request-info',
  authorize(ROLES.ADMIN, ROLES.GATC, ROLES.LMO),
  controller.requestInfo
);

// Owner Action: Respond to Document/Clarification Request
router.post(
  '/:id/respond-info',
  authorize(ROLES.INSTRUMENT_OWNER),
  controller.respondInfo
);

// Officer Action: Return Application for Correction
router.post(
  '/:id/return-correction',
  authorize(ROLES.ADMIN, ROLES.GATC, ROLES.LMO),
  controller.returnForCorrection
);

// Owner Action: Resubmit SAME Application
router.put(
  '/:id/resubmit',
  authorize(ROLES.INSTRUMENT_OWNER),
  controller.resubmitApplication
);

// Officer Action: Reject Application
router.post(
  '/:id/reject',
  authorize(ROLES.ADMIN, ROLES.GATC, ROLES.LMO),
  controller.rejectApplication
);

module.exports = router;