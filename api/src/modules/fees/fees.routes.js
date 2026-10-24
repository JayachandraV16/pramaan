// api/src/modules/fees/fees.routes.js
//
// Mounted at /api/fees.
//   GET   /quote?instrumentId=&applicationType=&conveyance=&quarterJump=   OWNER, ADMIN
//   GET   /rules                 ADMIN   (?feeKind=&instrumentTypeId=&active=true)
//   POST  /rules                 ADMIN
//   PATCH /rules/:id             ADMIN   (amount, description, effectiveTo, isActive)
// Rules are never deleted: set isActive=false or an effectiveTo date so past
// applications keep a traceable basis.

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./fees.service');
const { createFeeRuleRules, updateFeeRuleRules } = require('./fees.validation');

const router = express.Router();
router.use(authenticate);

router.get(
  '/quote',
  authorize(ROLES.INSTRUMENT_OWNER, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.quote(req.user, req.query)).send(res);
  })
);

router.get(
  '/rules',
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.listRules(req.query)).send(res);
  })
);

router.post(
  '/rules',
  authorize(ROLES.ADMIN),
  validateBody(createFeeRuleRules),
  asyncHandler(async (req, res) => {
    new ApiResponse(201, await service.createRule(req.user, req.body), 'Fee rule created').send(res);
  })
);

router.patch(
  '/rules/:id',
  authorize(ROLES.ADMIN),
  validateBody(updateFeeRuleRules),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.updateRule(req.user, req.params.id, req.body), 'Fee rule updated').send(res);
  })
);

module.exports = router;
