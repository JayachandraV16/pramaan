// api/src/config/index.js
//
// Central application configuration. Loads and validates process.env once,
// at boot, so a missing var fails loudly here instead of causing a confusing
// bug three layers deep later.
//
// This file does NOT own the DB connection — that's api/src/pool.js
// (Omraj). Keep it that way; don't duplicate pool/connection logic here.

const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const REQUIRED_ENV_VARS = ['JWT_SECRET'];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Check your .env against .env.example.'
  );
}

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

// In production, refuse weak or missing secrets. In development/test a
// derived INTEGRITY_SECRET is allowed so a fresh checkout still boots.
if (isProduction) {
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (!process.env.INTEGRITY_SECRET || process.env.INTEGRITY_SECRET.length < 32) {
    throw new Error('INTEGRITY_SECRET (>= 32 chars) is required in production.');
  }
  if (process.env.STORAGE_DRIVER === 's3' && !process.env.S3_BUCKET) {
    throw new Error('STORAGE_DRIVER=s3 needs S3_BUCKET.');
  }
  if (process.env.DELIVERY_MODE === 'live' && !process.env.SMTP_URL && !process.env.SMS_GATEWAY_URL) {
    throw new Error('DELIVERY_MODE=live needs SMTP_URL and/or SMS_GATEWAY_URL.');
  }
}

const integritySecret =
  process.env.INTEGRITY_SECRET ||
  crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update('pramaan-integrity-key-v1')
    .digest('hex');

const certIdScheme = (process.env.CERT_ID_SCHEME || 'legacy').toLowerCase();
if (!['legacy', 'v2'].includes(certIdScheme)) throw new Error('CERT_ID_SCHEME must be "legacy" or "v2"');
const certOfficeCode = (process.env.CERT_OFFICE_CODE || 'IND').toUpperCase();
if (!/^[A-Z]{3}$/.test(certOfficeCode)) throw new Error('CERT_OFFICE_CODE must be three letters, for example IND');

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

const config = {
  env,
  isProduction,
  port: parseInt(process.env.PORT, 10) || 5000,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // Key for HMAC signatures on QR payloads and file URLs. Keep separate
  // from JWT_SECRET so rotating one does not invalidate the other.
  integritySecret,

  frontendUrl,

  // Browser origins allowed to call the API (comma separated). Defaults to
  // the frontend URL only; set CORS_ORIGINS explicitly for other hosts.
  corsOrigins: (process.env.CORS_ORIGINS || frontendUrl)
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  trustProxy: process.env.TRUST_PROXY === 'true',

  // Single source of truth for uploaded files and generated certificates.
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')),

  // Minimum photographs / inspection-evidence files that must be attached to a
  // verification before a PASS result can be recorded (0 = rule off).
  minEvidenceForPass: Math.max(parseInt(process.env.MIN_EVIDENCE_FOR_PASS, 10) || 0, 0),

  // When true an ADMIN must confirm the GRAS challan payment
  // (POST /api/applications/:id/payment-verified) before an officer is assigned.
  requirePaymentBeforeAssignment: process.env.REQUIRE_PAYMENT_BEFORE_ASSIGNMENT === 'true',

  // Object storage (see utils/storage.js). STORAGE_DRIVER=local (default) | s3
  storage: {
    driver: process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local',
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'ap-south-1',
      endpoint: process.env.S3_ENDPOINT || '', // MinIO / Cloudflare R2 / other S3-compatible services
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      prefix: (process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '').replace(/(.+)/, '$1/'),
      serverSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || '', // e.g. AES256
    },
  },

  // Digital signature of certificate PDFs (see utils/pdfSigner.js). Unset = PDFs are not signed.
  signing: {
    p12Path: process.env.SIGNING_P12_PATH ? path.resolve(process.env.SIGNING_P12_PATH) : '',
    passphrase: process.env.SIGNING_P12_PASSPHRASE || '',
    reason: 'Certificate of verification issued under the Legal Metrology Act, 2009',
    location: process.env.SIGNING_LOCATION || 'India',
    contactInfo: process.env.SIGNING_CONTACT || '',
    signerName: process.env.SIGNING_NAME || 'Pramaan',
  },

  // E-mail / SMS delivery of notifications (see utils/delivery.js).
  //   DELIVERY_MODE=off|log|live   SMTP_URL=smtps://user:pass@host:465   EMAIL_FROM="Pramaan <no-reply@...>"
  //   SMS_GATEWAY_URL / SMS_GATEWAY_TOKEN / SMS_SENDER_ID (generic JSON gateway)
  delivery: {
    mode: ['log', 'live'].includes(process.env.DELIVERY_MODE) ? process.env.DELIVERY_MODE : 'off',
    smtpUrl: process.env.SMTP_URL || '',
    emailFrom: process.env.EMAIL_FROM || 'Pramaan <no-reply@pramaan.local>',
    smsUrl: process.env.SMS_GATEWAY_URL || '',
    smsToken: process.env.SMS_GATEWAY_TOKEN || '',
    smsSender: process.env.SMS_SENDER_ID || 'PRAMAN',
    intervalSeconds: parseInt(process.env.DELIVERY_INTERVAL_SECONDS, 10) || 60,
  },

  // Local OCR for nameplate checks (see modules/nameplate). The model is fetched once by `npm run ocr:setup`.
  ocr: {
    enabled: process.env.OCR_ENABLED !== 'false',
    lang: 'eng',
    langPath: path.resolve(process.env.OCR_LANG_PATH || path.join(__dirname, '..', '..', 'ocr-data')),
    timeoutMs: Math.max(parseInt(process.env.OCR_TIMEOUT_MS, 10) || 60000, 5000),
  },

  // Certificate numbers (see utils/certificateId.js): legacy CERT-YYYY-NNNNNN or structured PRM-YY-OOO-NNNNNNN-C-TTTT.
  // Existing numbers of either kind stay valid whatever this is set to.
  certificateIds: {
    scheme: certIdScheme,
    officeCode: certOfficeCode,
  },

  // Renewal opens this many days before a valid certificate expires (see utils/renewal.js).
  renewalWindowDays: Math.max(parseInt(process.env.RENEWAL_WINDOW_DAYS, 10) || 60, 0),

  // Lifetime of signed /uploads links handed out in API responses.
  fileUrlTtlSeconds: parseInt(process.env.FILE_URL_TTL_SECONDS, 10) || 1800,
};

module.exports = config;
