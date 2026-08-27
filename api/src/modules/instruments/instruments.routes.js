const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./instruments.controller');
const { createInstrumentRules } = require('./instruments.validation');

const router = express.Router();

// All instrument routes require authentication
router.use(authenticate);

// Create an instrument
router.post(
  '/',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  validateBody(createInstrumentRules),
  controller.createInstrument
);

// Get instruments
// ADMIN -> all instruments
// INSTRUMENT_OWNER -> own instruments
router.get(
  '/',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  controller.getInstruments
);

// Get one instrument
router.get(
  '/:id',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  controller.getInstrumentById
);

module.exports = router;