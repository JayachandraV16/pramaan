// api/src/utils/integrity.js
//
// Cryptographic helpers used for tamper evidence. Everything here uses
// Node's built-in `crypto` — no extra dependency.
//
//   sha256Hex(data)            SHA-256 of a Buffer/string  -> hex
//   canonicalString(fields)    stable "key=value|..." string for hashing records
//   hmacHex(message)           HMAC-SHA256 with INTEGRITY_SECRET -> hex
//   safeEqualHex(a, b)         constant-time comparison of two hex strings
//   signUploadPath / verifyUploadSignature   short-lived signed file links
//
// SHA-256 detects that something changed; HMAC proves the value was produced
// by this server. Neither replaces access control.

const crypto = require('crypto');
const config = require('../config');

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Dates are normalised to YYYY-MM-DD so a DATE column read back from
// PostgreSQL hashes identically to the string used at issue time.
function normaliseValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

// fields: array of [name, value] pairs in a FIXED order.
function canonicalString(fields) {
  return fields.map(([name, value]) => `${name}=${normaliseValue(value)}`).join('|');
}

function hmacHex(message, secret = config.integritySecret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- signed upload links -------------------------------------------------

function uploadSignature(uploadPath, expires) {
  return hmacHex(`upload|${uploadPath}|${expires}`);
}

// '/uploads/certificates/x.pdf' -> '/uploads/certificates/x.pdf?exp=...&sig=...'
function signUploadPath(uploadPath, ttlSeconds = config.fileUrlTtlSeconds) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${uploadPath}?exp=${expires}&sig=${uploadSignature(uploadPath, expires)}`;
}

function verifyUploadSignature(uploadPath, expires, signature) {
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqualHex(uploadSignature(uploadPath, exp), String(signature || ''));
}

module.exports = {
  sha256Hex,
  canonicalString,
  hmacHex,
  safeEqualHex,
  signUploadPath,
  verifyUploadSignature,
};
