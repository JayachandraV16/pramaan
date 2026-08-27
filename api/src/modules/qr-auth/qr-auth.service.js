const ApiError = require('../../utils/ApiError');

const repo = require('./qr-auth.repository');

const {
  QR_AUTH_RESULTS,
  isValidQrToken,
} = require('./qr-auth.validation');

// Authenticate certificate using QR token
async function authenticateQrToken(
  qrToken,
  metadata = {}
) {
  if (!isValidQrToken(qrToken)) {
    throw ApiError.badRequest(
      'A valid QR token is required'
    );
  }

  const certificate =
    await repo.findCertificateByQrToken(qrToken);

  // QR token does not belong to any certificate
  if (!certificate) {
    return {
      result: QR_AUTH_RESULTS.INVALID,
      certificate: null,
    };
  }

  let result = QR_AUTH_RESULTS.VALID;

  // Certificate explicitly revoked
  if (certificate.status === 'REVOKED') {
    result = QR_AUTH_RESULTS.REVOKED;
  }

  // Certificate validity period expired
  else {
    const today = new Date();
    const validUntil = new Date(
      certificate.valid_until
    );

    if (today > validUntil) {
      result = QR_AUTH_RESULTS.EXPIRED;
    }
  }

  // Log authentication attempt
  await repo.createQrAuthentication({
    certificateId: certificate.id,
    result,
    accessSource: metadata.accessSource,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return {
    result,
    certificate: {
      id: certificate.id,
      certificateNumber:
        certificate.certificate_number,

      issueDate: certificate.issue_date,

      validFrom: certificate.valid_from,

      validUntil: certificate.valid_until,

      status: certificate.status,

      instrument: {
        id: certificate.instrument_id,
        name: certificate.instrument_name,
        manufacturer: certificate.manufacturer,
        model: certificate.model,
        serialNumber: certificate.serial_number,
      },
    },
  };
}

module.exports = {
  authenticateQrToken,
};