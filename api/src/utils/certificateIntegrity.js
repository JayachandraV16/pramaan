// api/src/utils/certificateIntegrity.js
//
// Tamper-evidence helpers specific to verification certificates.
//
//   recordFingerprint(cert)   SHA-256 over the immutable certificate fields.
//                             Stored at issue time (record_sha256) and
//                             recomputed on every public verification, so a
//                             direct edit of the row (e.g. extending
//                             valid_until) is detected.
//   qrSignature(token, no)    truncated HMAC-SHA256 carried in the QR link
//                             (`s=`) so an edited or fabricated QR URL is
//                             rejected before it is trusted.
//
// Only fields that never change after issue are fingerprinted (the DB trigger
// protect_issued_certificate enforces this), so legitimate edits elsewhere —
// such as correcting an instrument's serial number — never cause false alarms.

const { canonicalString, sha256Hex, hmacHex, safeEqualHex } = require('./integrity');

const SIGNATURE_LENGTH = 32; // hex chars = 128 bits

function recordFingerprint(cert) {
  return sha256Hex(
    canonicalString([
      ['v', 1],
      ['certificate_number', cert.certificate_number],
      ['verification_id', cert.verification_id],
      ['instrument_id', cert.instrument_id],
      ['issue_date', cert.issue_date],
      ['valid_from', cert.valid_from],
      ['valid_until', cert.valid_until],
      ['qr_token', cert.qr_token],
    ])
  );
}

function qrSignature(qrToken, certificateNumber) {
  return hmacHex(`qr|${qrToken}|${certificateNumber}`).slice(0, SIGNATURE_LENGTH);
}

function verifyQrSignature(qrToken, certificateNumber, signature) {
  if (typeof signature !== 'string' || signature.length !== SIGNATURE_LENGTH) return false;
  return safeEqualHex(qrSignature(qrToken, certificateNumber), signature);
}

module.exports = { recordFingerprint, qrSignature, verifyQrSignature };
