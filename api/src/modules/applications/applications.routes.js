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
// ADMIN / GATC -> all applications
router.get(
  '/',
  authorize(
    ROLES.INSTRUMENT_OWNER,
    ROLES.ADMIN,
    ROLES.GATC
  ),
  controller.getApplications
);

// Get one application
router.get(
  '/:id',
  authorize(
    ROLES.INSTRUMENT_OWNER,
    ROLES.ADMIN,
    ROLES.GATC
  ),
  controller.getApplicationById
);

module.exports = router;