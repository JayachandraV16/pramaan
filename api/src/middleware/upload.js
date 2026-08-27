const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Absolute path to the uploads directory
const uploadDirectory = path.resolve(__dirname, '../uploads');

// Create the uploads directory automatically if it does not exist
fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
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

module.exports = upload;