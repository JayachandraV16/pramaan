// api/src/modules/qr-auth/qr-auth.service.js
//
// THE single implementation of public certificate verification. Both
//   GET /api/qr-auth/:identifier        and
//   GET /api/certificates/verify/:token
// end up here, so the rules can never drift apart.
//
// A lookup can use the QR token or the printed certificate number. The result
// combines three independent checks:
//   1. lifecycle  - ACTIVE / REVOKED / EXPIRED / not yet valid (by today's date)
//   2. signature  - if the QR link carried `s`, it must match the server HMAC
//   3. record hash - SHA-256 of the immutable certificate fields, recomputed
//                    now and compared with the value stored at issue time
// A failed signature or record hash makes the result INVALID with
// tampered = true; it is also written to the audit log.

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { sha256Hex } = require('../../utils/integrity');
const { verifyPdfSignature } = require('../../utils/pdfSigner');
const { recordFingerprint, verifyQrSignature } = require('../../utils/certificateIntegrity');
const repo = require('./qr-auth.repository');
const { QR_AUTH_RESULTS } = require('./qr-auth.validation');

const certificateId = require('../../utils/certificateId');
const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

// "Rajesh Sharma" -> "R***** S*****" : enough to recognise, not to dox.
function maskName(name) {
  if (!name) return null;
  return name
    .split(/\s+/)
    .map((part) => part[0] + '*'.repeat(Math.max(part.length - 1, 2)))
    .join(' ');
}

// Today's calendar date as YYYY-MM-DD. DATE columns come back from the pool as
// the same plain strings, so ISO dates can be compared lexicographically.
function todayString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

async function findCertificate(identifier) {
  const value = String(identifier || '').trim();
  if (certificateId.looksLikeCertificateNumber(value)) {
    // A structured number carries a check character and a keyed tag: a mistyped or invented number
    // is turned away here without a database lookup. Legacy numbers have neither and go straight to the registry.
    const inspected = certificateId.inspect(value);
    if (!inspected.valid) return { certificate: null, by: 'NUMBER', numberProblem: inspected.reason };
    return { certificate: await repo.findCertificateByNumber(inspected.normalised), by: 'NUMBER' };
  }
  if (QR_TOKEN_PATTERN.test(value)) {
    return { certificate: await repo.findCertificateByQrToken(value), by: 'QR_TOKEN' };
  }
  return { certificate: null, by: null };
}

// Core verification. `signature` is the optional `s` value from the QR link.
async function verifyPublic({ identifier, signature }, metadata = {}) {
  if (typeof identifier !== 'string' || identifier.trim().length === 0) {
    throw ApiError.badRequest('A QR token or certificate number is required');
  }

  const { certificate, by, numberProblem } = await findCertificate(identifier);
  const verifiedAt = new Date().toISOString();

  if (!certificate) {
    return {
      result: QR_AUTH_RESULTS.INVALID,
      valid: false,
      tampered: false,
      reason: numberProblem === 'CHECK_CHARACTER' ? 'NUMBER_CHECK_FAILED' : numberProblem === 'TAG' ? 'NUMBER_TAG_MISMATCH' : 'NOT_FOUND',
      certificate: null,
      integrity: null,
      verifiedAt,
    };
  }

  // ---- integrity ---------------------------------------------------------
  let signatureStatus = 'NOT_PROVIDED';
  if (signature !== undefined && signature !== null && signature !== '') {
    signatureStatus = verifyQrSignature(certificate.qr_token, certificate.certificate_number, String(signature))
      ? 'VALID'
      : 'INVALID';
  }

  let recordHashStatus = 'UNAVAILABLE'; // certificates issued before migration 019
  if (certificate.record_sha256) {
    recordHashStatus =
      recordFingerprint(certificate) === certificate.record_sha256 ? 'MATCH' : 'MISMATCH';
  }

  const tampered = signatureStatus === 'INVALID' || recordHashStatus === 'MISMATCH';

  // ---- lifecycle ---------------------------------------------------------
  const today = todayString();
  const validFrom = String(certificate.valid_from).slice(0, 10);
  const validUntil = String(certificate.valid_until).slice(0, 10);

  let result = QR_AUTH_RESULTS.VALID;
  let reason = null;
  if (tampered) {
    result = QR_AUTH_RESULTS.INVALID;
    reason = signatureStatus === 'INVALID' ? 'SIGNATURE_MISMATCH' : 'RECORD_HASH_MISMATCH';
  } else if (certificate.status === 'REVOKED') {
    result = QR_AUTH_RESULTS.REVOKED;
    reason = 'REVOKED';
  } else if (certificate.status === 'EXPIRED' || today > validUntil) {
    result = QR_AUTH_RESULTS.EXPIRED;
    reason = 'EXPIRED';
  } else if (today < validFrom) {
    result = QR_AUTH_RESULTS.INVALID;
    reason = 'NOT_YET_VALID';
  }

  await repo.createQrAuthentication({
    certificateId: certificate.id,
    result,
    accessSource: metadata.accessSource || (by === 'NUMBER' ? 'PUBLIC_NUMBER_LOOKUP' : 'PUBLIC_PORTAL'),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  if (tampered) {
    await audit.recordStandalone({
      action: 'TAMPER_DETECTED',
      entityType: 'certificate',
      entityId: certificate.id,
      details: {
        certificateNumber: certificate.certificate_number,
        signature: signatureStatus,
        recordHash: recordHashStatus,
        ip: metadata.ipAddress || null,
      },
    });
  }

  return {
    result,
    valid: result === QR_AUTH_RESULTS.VALID,
    tampered,
    reason,
    certificate: {
      certificateNumber: certificate.certificate_number,
      issueDate: certificate.issue_date,
      validFrom: certificate.valid_from,
      validUntil: certificate.valid_until,
      status: certificate.status,
      revokedAt: certificate.revoked_at,
      verificationDate: certificate.verification_date,
      instrumentName: certificate.instrument_name,
      manufacturer: certificate.manufacturer,
      model: certificate.model,
      serialNumber: certificate.serial_number,
      capacity: certificate.capacity,
      capacityUnit: certificate.capacity_unit,
      accuracyClass: certificate.accuracy_class,
      location: certificate.location_address,
      ownerName: maskName(certificate.owner_name),
      ownerOrganization: certificate.owner_organization,
      officerName: certificate.officer_name,
    },
    integrity: {
      signature: signatureStatus,
      recordHash: recordHashStatus,
      pdfSha256: certificate.pdf_sha256 || null,
      pdfSigned: !!certificate.pdf_signed,
      signerSubject: certificate.signature_subject || null,
      signedAt: certificate.signed_at || null,
      recordFingerprint: certificate.record_sha256 || null,
    },
    verifiedAt,
  };
}

// Back-compat shape for GET /api/certificates/verify/:qrToken
function toLegacyShape(outcome) {
  if (!outcome.certificate) {
    throw ApiError.notFound('Certificate not found');
  }
  return { ...outcome, certificate: { ...outcome.certificate } };
}

// Lets anyone check a certificate PDF they were handed: the file's SHA-256 is
// looked up in the registry. A re-saved, edited or fake PDF will not match.
async function checkDocument(buffer, metadata = {}) {
  const pdfSha256 = sha256Hex(buffer);
  const certificate = await repo.findCertificateByPdfSha256(pdfSha256);
  // Independent of the registry: does the file's own embedded signature verify?
  const signature = verifyPdfSignature(buffer);

  if (!certificate) {
    return {
      matches: false,
      sha256: pdfSha256,
      signature,
      message: 'This file does not match any certificate issued by Pramaan.',
    };
  }

  await repo.createQrAuthentication({
    certificateId: certificate.id,
    result: certificate.status === 'REVOKED' ? 'REVOKED' : 'VALID',
    accessSource: 'PUBLIC_DOCUMENT_CHECK',
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return {
    matches: true,
    sha256: pdfSha256,
    signature,
    certificateNumber: certificate.certificate_number,
    status: certificate.status,
    validUntil: certificate.valid_until,
    message: 'File content is identical to the certificate issued by Pramaan.',
  };
}

// Kept for callers/tests that import the old name.
const authenticateQrToken = (qrToken, metadata) => verifyPublic({ identifier: qrToken }, metadata);

module.exports = {
  verifyPublic,
  toLegacyShape,
  checkDocument,
  authenticateQrToken,
  maskName,
};
