const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const os = require('os');

const config = require('../config');
const objectStorage = require('../utils/storage');
const ApiError = require('../utils/ApiError');
const pool = require('../pool');
const { describeImage } = require('../utils/imageTools');

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

// What the database remembers about every stored upload (table stored_files): who sent it, when, its
// size and SHA-256 and, for pictures, the pixel size and camera orientation.
async function recordStoredFile(req, kind, image) {
  await pool.query(
    `INSERT INTO stored_files (key, kind, mime_type, size_bytes, sha256, width, height, exif_orientation, driver, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (key) DO NOTHING`,
    [
      req.file.filename, kind, req.file.mimetype, req.file.size, req.file.sha256,
      image ? image.width : null, image ? image.height : null, image ? image.orientation : null,
      config.storage.driver, req.user ? req.user.id : null,
    ]
  );
}

async function discardUpload(file) {
  // local files sit in the upload folder (or the temp folder while staged for object storage); stored objects are removed by key
  fs.unlink(file.path, () => {});
  if (config.storage.driver !== 'local') await objectStorage.remove(file.filename).catch(() => {});
  await pool.query('DELETE FROM stored_files WHERE key = $1', [file.filename]).catch(() => {});
}

// Wraps multer so that (a) multer/filter errors become 400/413 ApiErrors
// instead of generic 500s, (b) the uploaded file's real type is checked
// against its extension, (c) pictures must really decode (a damaged or absurdly large
// picture is refused) and (d) the stored mimetype and a SHA-256 of the
// content are set from the server's own read of the file (req.file.sha256),
// the metadata is written to PostgreSQL, and the file is removed again if the
// request then fails (so refused requests leave no stray files behind).
function uploadSingle(fieldName, { optional = false } = {}) {
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
        if (optional) return next();
        return next(ApiError.badRequest('A file is required'));
      }

      const extension = path.extname(req.file.originalname).toLowerCase();
      if (!matchesSignature(req.file.path, extension)) {
        fs.unlink(req.file.path, () => {});
        return next(ApiError.badRequest('File content does not match its extension'));
      }

      req.file.mimetype = MIME_BY_EXTENSION[extension];
      const bytes = fs.readFileSync(req.file.path);
      req.file.sha256 = require('../utils/integrity').sha256Hex(bytes);

      const file = req.file;
      (async () => {
        const isImage = file.mimetype.startsWith('image/');
        const image = isImage ? await describeImage(bytes) : null; // 400 if damaged or too large
        file.image = image;
        if (config.storage.driver !== 'local') {
          await objectStorage.put(file.filename, file.path);
          fs.unlink(file.path, () => {});
        }
        await recordStoredFile(req, isImage ? 'IMAGE' : 'PDF', image);
        // whatever happens next in the request, a refused request must not leave its file behind
        res.on('finish', () => {
          if (res.statusCode >= 400) discardUpload(file).catch(() => {});
        });
      })().then(
        () => next(),
        async (problem) => {
          await discardUpload(file);
          next(problem);
        }
      );
    });
  };
}

module.exports = upload;
module.exports.uploadSingle = uploadSingle;