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
// LMO/GATC -> assigned instruments
// INSTRUMENT_OWNER -> own instruments
router.get(
  '/',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN, ROLES.LMO, ROLES.GATC),
  controller.getInstruments
);

// Get one instrument
// Instrument types (reference data). ADMIN can change validity/active flag.
router.get(
  '/types',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN, ROLES.LMO, ROLES.GATC),
  controller.listInstrumentTypes
);

router.patch(
  '/types/:id',
  authorize(ROLES.ADMIN),
  controller.updateInstrumentType
);

// Re-verification due dates. Declared before '/:id' so 'due' is not read as an id.
router.get(
  '/due',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN, ROLES.LMO, ROLES.GATC),
  controller.getVerificationStatus
);

router.get(
  '/:id',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN, ROLES.LMO, ROLES.GATC),
  controller.getInstrumentById
);

module.exports = router;