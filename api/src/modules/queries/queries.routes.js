// api/src/modules/queries/queries.routes.js
//
// Clarification threads between applicant and department. Mounted at /api/queries.
//   POST  /                  { applicationId, subject, message, kind?, requestedItems? }  open a thread
//                            kind CLARIFICATION (default) or DOCUMENT_REQUEST (department only; requestedItems = what is wanted)
//   GET   /                  ?applicationId=&status=OPEN|CLOSED&kind=&awaiting=me   threads you may see (the inbox)
//   GET   /:id               thread with all messages
//   POST  /:id/messages      { body } as JSON, or multipart with body and an optional "file" (JPG/PNG/PDF)   reply
//   PATCH /:id/close                                              close (opener or ADMIN)
//   PATCH /:id/reopen                                             reopen (department or ADMIN)
// Participants: ADMIN, the applicant/owner, and officers assigned to the application.

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { uploadSingle } = require('../../middleware/upload');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const storage = require('../../utils/storage');
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
  uploadSingle('file', { optional: true }),
  validateBody({ body: { required: true, type: 'string' } }),
  asyncHandler(async (req, res) => {
    const file = req.file
      ? { fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size, sha256: req.file.sha256 }
      : null;
    try {
      new ApiResponse(201, await service.addMessage(req.user, req.params.id, req.body, file), 'Message sent').send(res);
    } catch (err) {
      if (req.file) await storage.remove(req.file.filename).catch(() => {}); // keep no file for a refused reply
      throw err;
    }
  })
);

router.patch(
  '/:id/close',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.closeQuery(req.user, req.params.id), 'Query closed').send(res);
  })
);

router.patch(
  '/:id/reopen',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.reopenQuery(req.user, req.params.id), 'Query reopened').send(res);
  })
);

module.exports = router;
