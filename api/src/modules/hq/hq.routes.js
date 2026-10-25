// api/src/modules/hq/hq.routes.js
//
// Command HQ, mounted at /api/hq. ADMIN only (every route).
//   GET /overview                           tiles, trends, divisions, workload, attention lists, metric catalogue
//   GET /map?state=                         instruments with coordinates (coloured by verification state) and open enforcement cases
//   GET /drill/:metric?division=&limit=&offset=   the records behind a number (each row links to its page)
//   GET /evidence/certificates/:id          evidence pack: IDs, fingerprints, readings, photos, officers, audit trail
//   GET /evidence/enforcement/:id           the same for an enforcement case
//   GET /evidence/certificates.csv?status=&from=&to=   evidence report, one row per certificate

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./hq.service');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/overview', asyncHandler(async (req, res) => new ApiResponse(200, await service.overview(req.user)).send(res)));
router.get('/map', asyncHandler(async (req, res) => new ApiResponse(200, await service.map(req.user, req.query)).send(res)));
router.get('/drill/:metric', asyncHandler(async (req, res) => new ApiResponse(200, await service.drill(req.user, req.params.metric, req.query)).send(res)));

router.get(
  '/evidence/certificates.csv',
  asyncHandler(async (req, res) => {
    const { filename, csv, truncated } = await service.evidenceCsv(req.user, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (truncated) res.setHeader('X-Report-Truncated', 'true');
    res.status(200).send(csv);
  })
);
router.get('/evidence/certificates/:id', asyncHandler(async (req, res) => new ApiResponse(200, await service.certificateEvidence(req.user, req.params.id)).send(res)));
router.get('/evidence/enforcement/:id', asyncHandler(async (req, res) => new ApiResponse(200, await service.caseEvidence(req.user, req.params.id)).send(res)));

module.exports = router;
