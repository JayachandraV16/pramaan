// api/src/modules/queries/queries.routes.js
//
// Clarification threads between applicant and department. Mounted at /api/queries.
//   POST  /                  { applicationId, subject, message }  open a thread
//   GET   /                  ?applicationId=&status=OPEN|CLOSED   threads you may see
//   GET   /:id               thread with all messages
//   POST  /:id/messages      { body }                             reply
//   PATCH /:id/close                                              close (opener or ADMIN)
// Participants: ADMIN, the applicant/owner, and officers assigned to the application.

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./queries.service');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.LMO, ROLES.GATC, ROLES.INSTRUMENT_OWNER));

router.post(
  '/',
  validateBody({
    applicationId: { required: true, type: 'string' },
    subject: { required: true, type: 'string' },
    message: { required: true, type: 'string' },
  }),
  asyncHandler(async (req, res) => {
    new ApiResponse(201, await service.createQuery(req.user, req.body), 'Query opened').send(res);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.listQueries(req.user, req.query)).send(res);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getQuery(req.user, req.params.id)).send(res);
  })
);

router.post(
  '/:id/messages',
  validateBody({ body: { required: true, type: 'string' } }),
  asyncHandler(async (req, res) => {
    new ApiResponse(201, await service.addMessage(req.user, req.params.id, req.body), 'Message sent').send(res);
  })
);

router.patch(
  '/:id/close',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.closeQuery(req.user, req.params.id), 'Query closed').send(res);
  })
);

module.exports = router;
