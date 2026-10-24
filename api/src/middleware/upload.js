const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const os = require('os');

const config = require('../config');
const objectStorage = require('../utils/storage');
const ApiError = require('../utils/ApiError');

// Absolute path to the uploads directory (single source of truth in config;
// the same folder is used for certificates and for signed /uploads serving)
const uploadDirectory = config.uploadDir;

// Create the uploads directory automatically if it does not exist
fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // With object storage the file is only staged here until it has been verified.
    cb(null, config.storage.driver === 'local' ? uploadDirectory : os.tmpdir());
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    cb(null, `${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.pdf',
  ];

  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only JPG, JPEG, PNG, and PDF files are allowed'
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// File signatures ("magic bytes") — the extension alone is client-controlled.
const SIGNATURES = {
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  '.pdf': [Buffer.from('%PDF-')],
};

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

function matchesSignature(filePath, extension) {
  const signatures = SIGNATURES[extension];
  if (!signatures) return false;
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    return signatures.some((sig) => header.subarray(0, sig.length).equals(sig));
  } finally {
    fs.closeSync(fd);
  }
}

// Wraps multer so that (a) multer/filter errors become 400/413 ApiErrors
// instead of generic 500s, (b) the uploaded file's real type is checked
// against its extension, and (c) the stored mimetype and a SHA-256 of the
// content are set from the server's own read of the file (req.file.sha256).
function uploadSingle(fieldName) {
  const handler = upload.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          return next(new ApiError(status, err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large (max 10 MB)'
            : `Upload error: ${err.message}`));
        }
        return next(ApiError.badRequest(err.message));
      }

      if (!req.file) {
        return next(ApiError.badRequest('A file is required'));
      }

      const extension = path.extname(req.file.originalname).toLowerCase();
      if (!matchesSignature(req.file.path, extension)) {
        fs.unlink(req.file.path, () => {});
        return next(ApiError.badRequest('File content does not match its extension'));
      }

      req.file.mimetype = MIME_BY_EXTENSION[extension];
      req.file.sha256 = require('../utils/integrity').sha256Hex(fs.readFileSync(req.file.path));

      if (config.storage.driver === 'local') return next();
      objectStorage
        .put(req.file.filename, req.file.path)
        .then(() => {
          fs.unlink(req.file.path, () => {});
          next();
        })
        .catch((storeErr) => {
          fs.unlink(req.file.path, () => {});
          next(storeErr);
        });
    });
  };
}

module.exports = upload;
module.exports.uploadSingle = uploadSingle;