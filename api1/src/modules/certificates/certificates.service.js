const ApiError = require('../../utils/ApiError');
const repo = require('./certificates.repository');

const {
  isValidCertificateStatus,
} = require('./certificates.validation');

const { ROLES } = require('../../config/roles');
const fs = require('fs');
const path = require('path');

const { generateQRCode } = require('../../utils/qrGenerator');
const {
  generateCertificatePDF,
} = require('../../utils/certificateGenerator');

// Create certificate
async function createCertificate(user, data) {
  // Only ADMIN can issue certificates
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden(
      'Only ADMIN can issue certificates'
    );
  }

  const verification = await repo.findVerificationById(
    data.verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  // Verification must be completed
  if (verification.status !== 'COMPLETED') {
    throw ApiError.badRequest(
      'Certificate can only be issued for a completed verification'
    );
  }

  // Verification must have PASS result
  if (verification.decision !== 'PASS') {
    throw ApiError.badRequest(
      'Certificate can only be issued for a verification with PASS result'
    );
  }

  // Check instrument
  const instrument = await repo.findInstrumentById(
    data.instrumentId
  );

  if (!instrument) {
    throw ApiError.notFound('Instrument not found');
  }

  // Prevent duplicate certificate
  const existingCertificate =
    await repo.findCertificateByVerificationId(
      data.verificationId
    );

  if (existingCertificate) {
    throw ApiError.badRequest(
      'A certificate has already been issued for this verification'
    );
  }

  // Validate dates
  const validFrom = new Date(data.validFrom);
  const validUntil = new Date(data.validUntil);

  if (Number.isNaN(validFrom.getTime())) {
    throw ApiError.badRequest('Invalid validFrom date');
  }

  if (Number.isNaN(validUntil.getTime())) {
    throw ApiError.badRequest('Invalid validUntil date');
  }

  if (validUntil < validFrom) {
    throw ApiError.badRequest(
      'validUntil must be after or equal to validFrom'
    );
  }

  const certificateNumber =
    await repo.getNextCertificateNumber();

    const certificate = await repo.createCertificate({
    verificationId: data.verificationId,
    instrumentId: data.instrumentId,
    certificateNumber,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
  });

  // Generate QR code
  const qrCodeBuffer = await generateQRCode(
    certificate.qr_token
  );

  // Add instrument details required by PDF generator
  const certificateData = {
    ...certificate,
    instrument_name: instrument.instrument_name,
    manufacturer: instrument.manufacturer,
    model: instrument.model,
  };

  // Generate PDF
  const pdfBuffer = await generateCertificatePDF(
    certificateData,
    qrCodeBuffer
  );

  // Ensure certificates upload directory exists
  const certificatesDir = path.join(
    process.cwd(),
    'uploads',
    'certificates'
  );

  fs.mkdirSync(certificatesDir, {
    recursive: true,
  });

  // Save PDF
  const fileName = `${certificate.certificate_number}.pdf`;

  const filePath = path.join(
    certificatesDir,
    fileName
  );

  fs.writeFileSync(filePath, pdfBuffer);

  // URL stored in database
  const fileUrl =
    `/uploads/certificates/${fileName}`;

  // Update certificate
  const updatedCertificate =
    await repo.updateCertificateFileUrl(
      certificate.id,
      fileUrl
    );

  // Notify Owner
  try {
    const notificationsRepo = require('../notifications/notifications.repository');
    if (instrument.owner_id) {
      await notificationsRepo.createNotification({
        recipientId: instrument.owner_id,
        type: 'CERTIFICATE_ISSUED',
        title: 'Certificate Issued',
        message: `Official Verification Certificate ${certificate.certificate_number} has been issued for instrument ${instrument.instrument_name}.`,
        relatedApplicationId: verification.application_id,
        relatedCertificateId: certificate.id,
      });
    }
  } catch (err) {
    console.error('Certificate issuance notification failed:', err.message);
  }

  return updatedCertificate;
}

// Get all certificates
async function getCertificates(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllCertificates();
  }

  if (user.role === ROLES.INSTRUMENT_OWNER) {
    return repo.findCertificatesByOwnerId(user.id);
  }

  throw ApiError.forbidden('You do not have permission to view certificates');
}

// Get certificate by ID
async function getCertificateById(user, certificateId) {
  const certificate = user.role === ROLES.ADMIN
    ? await repo.findCertificateById(certificateId)
    : user.role === ROLES.INSTRUMENT_OWNER
      ? await repo.findCertificateByIdForOwner(certificateId, user.id)
      : null;

  if (!certificate) {
    throw ApiError.forbidden('You do not have permission to view this certificate');
  }

  return certificate;
}

// Public QR verification
async function verifyCertificate(qrToken) {
  const certificate =
    await repo.findCertificateByQrToken(qrToken);

  if (!certificate) {
    throw ApiError.notFound('Certificate not found');
  }

  const today = new Date();
  const validFrom = new Date(certificate.valid_from);
  const validUntil = new Date(certificate.valid_until);

  const isCurrentlyValid =
    certificate.status === 'ACTIVE' &&
    today >= validFrom &&
    today <= validUntil;

  return {
    valid: isCurrentlyValid,
    certificate: {
      certificateNumber: certificate.certificate_number,
      issueDate: certificate.issue_date,
      validFrom: certificate.valid_from,
      validUntil: certificate.valid_until,
      status: certificate.status,
      instrumentName: certificate.instrument_name,
      manufacturer: certificate.manufacturer,
      model: certificate.model,
    },
  };
}

// Update certificate status
async function updateCertificateStatus(
  user,
  certificateId,
  data
) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden(
      'Only ADMIN can update certificate status'
    );
  }

  if (!isValidCertificateStatus(data.status)) {
    throw ApiError.badRequest(
      `Invalid certificate status: ${data.status}`
    );
  }

  const certificate =
    await repo.findCertificateById(certificateId);

  if (!certificate) {
    throw ApiError.notFound('Certificate not found');
  }

  return repo.updateCertificateStatus(
    certificateId,
    data.status
  );
}

module.exports = {
  createCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  updateCertificateStatus,
};