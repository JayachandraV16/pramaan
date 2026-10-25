// api/src/modules/enforcement/enforcement.routes.js
//
// Mounted at /api/enforcement.
//   POST   /                  ADMIN, LMO, GATC   register a case (spot check, complaint, routine inspection)
//   GET    /                  all roles          cases you may see (?status=&offence_type=&source=&search=&page=)
//   GET    /offenders         ADMIN, LMO, GATC   repeat offenders (?flag=REPEAT|HABITUAL|FIRST or ?all=true)
//   GET    /summary           ADMIN              enforcement dashboard figures
//   GET    /:id               all roles          one case with its timeline (owners only see their own)
//   PATCH  /:id/status        ADMIN              { status, note?, penaltyAmount?, penaltyReference? }

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { applyListQuery } = require('../../utils/listQuery');
const { ROLES } = require('../../config/roles');
const service = require('./enforcement.service');

const router = express.Router();
router.use(authenticate);

const officers = authorize(ROLES.ADMIN, ROLES.LMO, ROLES.GATC);

router.post(
  '/',
  officers,
  validateBody({
    source: { required: true, type: 'string' },
    offenceType: { required: true, type: 'string' },
    description: { required: true, type: 'string' },
    subjectName: { required: false, type: 'string' },
    latitude: { required: false, type: 'number' },
    longitude: { required: false, type: 'number' },
  }),
  asyncHandler(async (req, res) => {
    new ApiResponse(201, await service.createCase(req.user, req.body), 'Enforcement case registered').send(res);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = applyListQuery(await service.listCases(req.user), req.query, {
      searchFields: ['case_number', 'subject_name', 'subject_organization', 'description', 'serial_number'],
      filters: { status: 'status', offence_type: 'offence_type', source: 'source', flag: 'offender_flag' },
      sortFields: ['created_at', 'detected_on', 'case_number', 'status'],
    });
    new ApiResponse(200, rows).send(res);
  })
);

router.get(
  '/offenders',
  officers,
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.listOffenders(req.query)).send(res);
  })
);

router.get(
  '/summary',
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.summary()).send(res);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getCase(req.user, req.params.id)).send(res);
  })
);

router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN),
  validateBody({ status: { required: true, type: 'string' } }),
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.updateStatus(req.user, req.params.id, req.body), 'Case updated').send(res);
  })
);

module.exports = router;
