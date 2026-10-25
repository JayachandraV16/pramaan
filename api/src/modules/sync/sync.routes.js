// api/src/modules/sync/sync.routes.js
//
// Offline sync for the officer app (mounted at /api/sync).
//   POST /push   upload inspections recorded offline (idempotent via clientId)
//   GET  /pull   ?since=<ISO time>  assignments + inspections changed since the last sync

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./sync.service');

const router = express.Router();
router.use(authenticate, authorize(ROLES.LMO, ROLES.GATC, ROLES.ADMIN));

router.post(
  '/push',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.push(req.user, req.body)).send(res);
  })
);

router.get(
  '/pull',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.pull(req.user, req.query.since)).send(res);
  })
);

module.exports = router;
