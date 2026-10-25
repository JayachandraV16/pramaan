// api/src/modules/documents/documents.routes.js
//
// Mounted at /api/documents.
//   GET   /requirements            ADMIN   all requirements
//   POST  /requirements            ADMIN   { documentType, label, labelHi?, applicationType?, instrumentOrigin?, applicantType? }
//   PATCH /requirements/:id        ADMIN   { label?, labelHi?, isActive? }   (never deleted: deactivate instead)
//   GET   /checklist/:applicationId  owner, assigned officer, ADMIN   what the application needs vs. has

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./documents.service');

const router = express.Router();
router.use(authenticate);

router.get('/requirements', authorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
  new ApiResponse(200, await service.listRequirements()).send(res);
}));

router.post('/requirements', authorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
  new ApiResponse(201, await service.createRequirement(req.user, req.body || {}), 'Requirement created').send(res);
}));

router.patch('/requirements/:id', authorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
  new ApiResponse(200, await service.updateRequirement(req.user, req.params.id, req.body || {}), 'Requirement updated').send(res);
}));

router.get(
  '/checklist/:applicationId',
  authorize(ROLES.ADMIN, ROLES.INSTRUMENT_OWNER, ROLES.LMO, ROLES.GATC),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getChecklist(req.user, req.params.applicationId)).send(res);
  })
);

module.exports = router;
