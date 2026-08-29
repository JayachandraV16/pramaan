const ApiError = require('../../utils/ApiError');
const repo = require('./applications.repository');
const {
  isValidApplicationType,
  isValidInstrumentOrigin,
  APPLICATION_TYPES,
} = require('./applications.validation');
const { ROLES } = require('../../config/roles');

async function createApplication(user, data) {
  if (!isValidApplicationType(data.applicationType)) {
    throw ApiError.badRequest(
      `Invalid application type: ${data.applicationType}`
    );
  }

  if (!data.division || typeof data.division !== 'string' || !data.division.trim()) {
    throw ApiError.badRequest('division is required');
  }

  if (data.instrumentOrigin && !isValidInstrumentOrigin(data.instrumentOrigin)) {
    throw ApiError.badRequest(`Invalid instrument origin: ${data.instrumentOrigin}`);
  }

  // Renewal applications must reference the certificate being renewed.
  // New verifications must not (nothing to renew yet).
  if (data.applicationType === APPLICATION_TYPES.RE_VERIFICATION && !data.lastCertificateId) {
    throw ApiError.badRequest(
      'lastCertificateId is required for RE_VERIFICATION applications'
    );
  }

  const instrument = await repo.findInstrumentById(data.instrumentId);

  if (!instrument) {
    throw ApiError.notFound('Instrument not found');
  }

  // Instrument owners can only create applications for their own instruments
  if (
    user.role === ROLES.INSTRUMENT_OWNER &&
    instrument.owner_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only create an application for your own instrument'
    );
  }

  // For renewals, confirm the referenced certificate exists and actually
  // belongs to this instrument. Lightweight sanity check, not a rules
  // engine — full document-checklist logic is out of scope here.
  if (data.lastCertificateId) {
    const lastCertificate = await repo.findCertificateById(data.lastCertificateId);

    if (!lastCertificate) {
      throw ApiError.badRequest(
        'lastCertificateId does not reference an existing certificate'
      );
    }

    if (lastCertificate.instrument_id !== data.instrumentId) {
      throw ApiError.badRequest(
        'lastCertificateId does not belong to the specified instrument'
      );
    }
  }

  // Normalized once here so both the stored `division` column and the
  // application-number generation (repository layer) use the same value —
  // avoids "Pune" vs "PUNE" silently creating two different counters.
  const division = data.division.trim().toUpperCase();

  return repo.createApplication({
    applicantId: user.id,
    instrumentId: data.instrumentId,
    applicationType: data.applicationType,
    purpose: data.purpose,
    remarks: data.remarks,
    division,
    submissionOffice: data.submissionOffice,
    instrumentOrigin: data.instrumentOrigin,
    grasChallanNumber: data.grasChallanNumber,
    grasChallanDate: data.grasChallanDate,
    conveyanceFee: data.conveyanceFee,
    quarterJumpFee: data.quarterJumpFee,
    lastCertificateId: data.lastCertificateId,
  });
}

async function getApplications(user) {
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.GATC
  ) {
    return repo.findAllApplications();
  }

  return repo.findApplicationsByApplicantId(user.id);
}

async function getApplicationById(user, applicationId) {
  const application = await repo.findApplicationById(applicationId);

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  const canAccessAll =
    user.role === ROLES.ADMIN ||
    user.role === ROLES.GATC;

  if (!canAccessAll && application.applicant_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to access this application'
    );
  }

  return application;
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
};