// api/src/modules/nameplate/nameplate.routes.js
//
// Mounted at /api/nameplate. OCR-assisted nameplate check; the machine result is advice,
// a person decides (see nameplate.service.js).
//   GET   /status                              is the local OCR engine set up?
//   POST  /instruments/:instrumentId           multipart "file" (JPG/PNG photo of the nameplate): store, read, compare
//   GET   /instruments/:instrumentId           checks for the instrument
//   GET   /queue?status=                       ADMIN: all checks; officer: checks on assigned instruments
//   GET   /:id                                 one check
//   POST  /:id/review                          ADMIN / assigned officer (not the uploader):
//                                              { decision: CONFIRMED_MATCH|CONFIRMED_MISMATCH|UNREADABLE, note?, values? }

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const { uploadSingle } = require('../../middleware/upload');
const { rateLimit } = require('../../middleware/security');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const storage = require('../../utils/storage');
const { ROLES } = require('../../config/roles');
const service = require('./nameplate.service');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.INSTRUMENT_OWNER, ROLES.LMO, ROLES.GATC));

// OCR is CPU-heavy: limit uploads per user
const uploadLimiter = rateLimit({ name: 'nameplate', windowMs: 60 * 60 * 1000, max: 30, key: (req) => (req.user ? req.user.id : '') });

async function readStored(key) {
  const file = await storage.open(key);
  if (!file) throw ApiError.badRequest('The uploaded photo could not be read back');
  const chunks = [];
  for await (const chunk of file.stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

router.get('/status', (req, res) => {
  new ApiResponse(200, service.status()).send(res);
});

router.post(
  '/instruments/:instrumentId',
  uploadLimiter,
  uploadSingle('file'),
  asyncHandler(async (req, res) => {
    const key = req.file.filename;
    try {
      if (!['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
        throw ApiError.badRequest('Upload a JPG or PNG photo of the nameplate');
      }
      const buffer = await readStored(key);
      const check = await service.createCheck(req.user, req.params.instrumentId, {
        buffer,
        sha256: req.file.sha256,
        mimeType: req.file.mimetype,
        fileUrl: `/uploads/${key}`,
      });
      new ApiResponse(201, check, 'Nameplate read. A person must confirm the result.').send(res);
    } catch (err) {
      await storage.remove(key).catch(() => {}); // do not keep photos of failed attempts
      throw err;
    }
  })
);

router.get(
  '/instruments/:instrumentId',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.listForInstrument(req.user, req.params.instrumentId)).send(res);
  })
);

router.get(
  '/queue',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.queue(req.user, req.query.status)).send(res);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getCheck(req.user, req.params.id)).send(res);
  })
);

router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.review(req.user, req.params.id, req.body || {}), 'Decision recorded').send(res);
  })
);

module.exports = router;
