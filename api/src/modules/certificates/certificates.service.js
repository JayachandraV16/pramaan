const fs = require('fs');
const path = require('path');

const pool = require('../../pool');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { sha256Hex } = require('../../utils/integrity');
const { recordFingerprint } = require('../../utils/certificateIntegrity');
const { generateQRCode } = require('../../utils/qrGenerator');
const { generateCertificatePDF } = require('../../utils/certificateGenerator');
const repo = require('./certificates.repository');
const { isValidCertificateStatus, CERTIFICATE_STATUSES } = require('./certificates.validation');
const { ROLES } = require('../../config/roles');

const MIN_REVOCATION_REASON_LENGTH = 10;
const MAX_VALIDITY_YEARS = 10;

function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  // 31 Jan + 1 month would roll into March; clamp to the last day instead.
  if (result.getDate() < day) result.setDate(0);
  return result;
}

function parseDateInput(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    throw ApiError.badRequest(`${label} must be a date in YYYY-MM-DD format`);
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`Invalid ${label} date`);
  }
  return date;
}

// Resolves the validity window: explicit dates, or default months from today.
function resolveValidity(data, defaultMonths) {
  const validFrom = data.validFrom ? parseDateInput(data.validFrom, 'validFrom') : new Date();
  validFrom.setHours(0, 0, 0, 0);

  let validUntil;
  if (data.validUntil) {
    validUntil = parseDateInput(data.validUntil, 'validUntil');
  } else {
    validUntil = addMonths(validFrom, defaultMonths || 12);
    validUntil.setDate(validUntil.getDate() - 1);
  }

  if (validUntil <= validFrom) {
    throw ApiError.badRequest('validUntil must be after validFrom');
  }
  if (validUntil > addMonths(validFrom, MAX_VALIDITY_YEARS * 12)) {
    throw ApiError.badRequest(`Validity cannot exceed ${MAX_VALIDITY_YEARS} years`);
  }
  return { validFrom: toDateOnly(validFrom), validUntil: toDateOnly(validUntil) };
}

// Create certificate. Everything that must succeed together (number, row,
// hashes, audit entry, owner notification) commits in ONE transaction; the PDF
// file is removed again if anything fails afterwards.
async function createCertificate(user, data) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only ADMIN can issue certificates');
  }

  const context = await repo.findIssuanceContext(data.verificationId);
  if (!context) {
    throw ApiError.notFound('Verification not found');
  }
  if (context.verification_status !== 'COMPLETED') {
    throw ApiError.badRequest('Certificate can only be issued for a completed verification');
  }
  if (context.decision !== 'PASS') {
    throw ApiError.badRequest('Certificate can only be issued for a verification with PASS result');
  }
  // The instrument is derived from the verification's application; a
  // client-supplied id must agree with it (prevents certifying another
  // instrument under this verification).
  if (data.instrumentId && data.instrumentId !== context.instrument_id) {
    throw ApiError.badRequest('instrumentId does not match the instrument of this verification');
  }

  const existing = await repo.findCertificateByVerificationId(data.verificationId);
  if (existing) {
    throw ApiError.badRequest('A certificate has already been issued for this verification');
  }

  const { validFrom, validUntil } = resolveValidity(data, context.default_validity_months);

  const certificatesDir = path.join(config.uploadDir, 'certificates');
  fs.mkdirSync(certificatesDir, { recursive: true });
  let writtenFile = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const certificateNumber = await repo.nextCertificateNumber(client, new Date().getFullYear());
    const certificate = await repo.insertCertificate(client, {
      verificationId: data.verificationId,
      instrumentId: context.instrument_id,
      certificateNumber,
      validFrom,
      validUntil,
    });

    // Fingerprint of the immutable fields (includes the DB-generated qr_token).
    const recordSha256 = recordFingerprint(certificate);

    const qrCodeBuffer = await generateQRCode(certificate.qr_token, certificate.certificate_number);
    const pdfBuffer = await generateCertificatePDF(
      {
        ...certificate,
        instrument_name: context.instrument_name,
        manufacturer: context.manufacturer,
        model: context.model,
        serial_number: context.serial_number,
        record_sha256: recordSha256,
      },
      qrCodeBuffer
    );
    const pdfSha256 = sha256Hex(pdfBuffer);

    const fileName = `${certificate.certificate_number}.pdf`;
    writtenFile = path.join(certificatesDir, fileName);
    fs.writeFileSync(writtenFile, pdfBuffer);

    const updated = await repo.setIntegrityFields(client, {
      id: certificate.id,
      fileUrl: `/uploads/certificates/${fileName}`,
      pdfSha256,
      recordSha256,
    });

    await audit.record(client, {
      actorId: user.id,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'certificate',
      entityId: certificate.id,
      details: {
        certificateNumber: certificate.certificate_number,
        verificationId: data.verificationId,
        instrumentId: context.instrument_id,
        validFrom,
        validUntil,
        recordSha256,
        pdfSha256,
      },
    });

    await notify(client, {
      recipientId: context.applicant_id,
      type: 'CERTIFICATE_ISSUED',
      title: 'Verification certificate issued',
      message: `Certificate ${certificate.certificate_number} for ${context.instrument_name} is valid until ${validUntil}.`,
      relatedApplicationId: context.application_id,
      relatedCertificateId: certificate.id,
    });

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    if (writtenFile) fs.unlink(writtenFile, () => {});
    throw err;
  } finally {
    client.release();
  }
}

// Get certificates
async function getCertificates(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllCertificates();
  }

  if (user.role === ROLES.INSTRUMENT_OWNER) {
    return repo.findCertificatesByOwnerId(user.id);
  }

  if (user.role === ROLES.LMO || user.role === ROLES.GATC) {
    return repo.findAllCertificates();
  }

  throw ApiError.forbidden('You do not have permission to view certificates');
}

// Get certificate by ID. Owners can only read certificates of their own
// instruments/applications; staff roles can read any (same as the list).
async function getCertificateById(user, certificateId) {
  const certificate = await repo.findCertificateById(certificateId);

  if (!certificate) {
    throw ApiError.notFound('Certificate not found');
  }

  if (user.role === ROLES.INSTRUMENT_OWNER) {
    const owns = await repo.isCertificateOwnedBy(certificateId, user.id);
    if (!owns) {
      throw ApiError.forbidden('You do not have permission to view this certificate');
    }
  }

  return certificate;
}

// Public verification now lives in qr-auth (single implementation). This thin
// wrapper keeps the legacy endpoint GET /certificates/verify/:qrToken working.
async function verifyCertificate(qrToken, options = {}) {
  const qrAuth = require('../qr-auth/qr-auth.service');
  const outcome = await qrAuth.verifyPublic(
    { identifier: qrToken, signature: options.signature },
    options.metadata || {}
  );
  return qrAuth.toLegacyShape(outcome);
}

// Update certificate status. Allowed transitions (also enforced by a DB
// trigger): ACTIVE -> REVOKED (reason required), ACTIVE -> EXPIRED. A revoked
// certificate can never change again.
async function updateCertificateStatus(user, certificateId, data) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only ADMIN can update certificate status');
  }

  if (!isValidCertificateStatus(data.status)) {
    throw ApiError.badRequest(`Invalid certificate status: ${data.status}`);
  }

  const certificate = await repo.findCertificateById(certificateId);
  if (!certificate) {
    throw ApiError.notFound('Certificate not found');
  }

  if (certificate.status === data.status) {
    return certificate;
  }
  if (certificate.status === CERTIFICATE_STATUSES.REVOKED) {
    throw ApiError.conflict('A revoked certificate cannot be changed');
  }
  if (data.status === CERTIFICATE_STATUSES.ACTIVE) {
    throw ApiError.conflict(
      'A certificate cannot be reactivated; issue a new one through re-verification'
    );
  }

  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  if (data.status === CERTIFICATE_STATUSES.REVOKED && reason.length < MIN_REVOCATION_REASON_LENGTH) {
    throw ApiError.badRequest(
      `A revocation reason of at least ${MIN_REVOCATION_REASON_LENGTH} characters is required`
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updated;
    if (data.status === CERTIFICATE_STATUSES.REVOKED) {
      updated = await repo.markRevoked(client, {
        id: certificateId,
        revokedById: user.id,
        reason,
      });
    } else {
      const { rows } = await client.query(
        "UPDATE verification_certificates SET status = 'EXPIRED' WHERE id = $1 RETURNING *",
        [certificateId]
      );
      updated = rows[0];
    }

    await audit.record(client, {
      actorId: user.id,
      action: data.status === 'REVOKED' ? 'CERTIFICATE_REVOKED' : 'CERTIFICATE_EXPIRED_MANUALLY',
      entityType: 'certificate',
      entityId: certificateId,
      details: {
        certificateNumber: certificate.certificate_number,
        from: certificate.status,
        to: data.status,
        reason: reason || null,
      },
    });

    const recipients = await repo.findCertificateRecipients(client, certificateId);
    if (recipients) {
      await notify(client, {
        recipientId: recipients.applicant_id,
        type: data.status === 'REVOKED' ? 'CERTIFICATE_REVOKED' : 'CERTIFICATE_EXPIRED',
        title: data.status === 'REVOKED' ? 'Certificate revoked' : 'Certificate expired',
        message:
          data.status === 'REVOKED'
            ? `Certificate ${certificate.certificate_number} has been revoked. Reason: ${reason}`
            : `Certificate ${certificate.certificate_number} has expired. Apply for re-verification.`,
        relatedApplicationId: recipients.application_id,
        relatedCertificateId: certificateId,
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  updateCertificateStatus,
};
