// Public (no authentication) verification endpoints, mounted at /api/qr-auth.
//   POST /check-document   multipart "file" (PDF): is this exact file a certificate we issued?
//   POST /check-copy       multipart "file" (JPG, PNG or PDF): photograph / scan of a paper certificate; QR + printed text vs the registry
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

// A paper copy may be a photograph or a scan. Image decoding and text reading are expensive, so this
// endpoint has its own, tighter limits on top of the general one.
const copyLimiterMinute = rateLimit({ name: 'copy-check-min', windowMs: 60 * 1000, max: 6 });
const copyLimiterHour = rateLimit({ name: 'copy-check-hour', windowMs: 60 * 60 * 1000, max: 40 });

function copyUpload(req, res, next) {
  memoryUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ApiError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : err.message));
    }
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest('A photograph, scan or PDF of the certificate is required'));
    const b = req.file.buffer;
    const isPdf = b.subarray(0, 5).equals(Buffer.from('%PDF-'));
    const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!isPdf && !isJpeg && !isPng) return next(ApiError.badRequest('Upload a JPG or PNG photograph, or a PDF'));
    next();
  });
}

router.post('/check-document', publicLimiter, pdfUpload, controller.checkDocument);
router.post('/check-copy', publicLimiter, copyLimiterMinute, copyLimiterHour, copyUpload, controller.checkCopy);
router.get('/:identifier', publicLimiter, controller.authenticateQr);

module.exports = router;
