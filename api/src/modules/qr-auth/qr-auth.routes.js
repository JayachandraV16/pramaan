// Public (no authentication) verification endpoints, mounted at /api/qr-auth.
//   POST /check-document   multipart "file" (PDF): is this exact file a certificate we issued?
//   GET  /:identifier      QR token OR certificate number; optional ?s=<signature> from the QR link
// Both are rate limited because they are unauthenticated.

const express = require('express');
const multer = require('multer');

const controller = require('./qr-auth.controller');
const ApiError = require('../../utils/ApiError');
const { rateLimit } = require('../../middleware/security');

const router = express.Router();

const publicLimiter = rateLimit({ name: 'public-verify', windowMs: 60 * 1000, max: 60 });

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('file');

function pdfUpload(req, res, next) {
  memoryUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ApiError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.message));
    }
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest('A PDF file is required'));
    if (!req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return next(ApiError.badRequest('Only PDF files can be checked'));
    }
    next();
  });
}

router.post('/check-document', publicLimiter, pdfUpload, controller.checkDocument);
router.get('/:identifier', publicLimiter, controller.authenticateQr);

module.exports = router;
