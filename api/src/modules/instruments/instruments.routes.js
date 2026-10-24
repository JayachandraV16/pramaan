const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./instruments.controller');
const lifecycle = require('./instruments.lifecycle');
const applicationsService = require('../applications/applications.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
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

// Can this instrument be verified now, and as what (initial verification or renewal)?
router.get(
  '/:id/renewal',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await applicationsService.getRenewalForInstrument(req.user, req.params.id)).send(res);
  })
);

// Edit and take out of service (owner of the instrument, or ADMIN; see instruments.lifecycle.js)
const manage = authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN);

router.patch(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await lifecycle.updateInstrument(req.user, req.params.id, req.body || {}), 'Instrument updated').send(res);
  })
);

for (const action of ['deactivate', 'reactivate', 'decommission']) {
  router.post(
    `/:id/${action}`,
    manage,
    asyncHandler(async (req, res) => {
      new ApiResponse(200, await lifecycle.changeStatus(req.user, req.params.id, action, req.body || {}), `Instrument ${action}d`).send(res);
    })
  );
}

module.exports = router;