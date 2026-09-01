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

  const division = (data.division && typeof data.division === 'string' && data.division.trim())
    ? data.division.trim().toUpperCase()
    : 'HQ';

  if (data.instrumentOrigin && !isValidInstrumentOrigin(data.instrumentOrigin)) {
    throw ApiError.badRequest(`Invalid instrument origin: ${data.instrumentOrigin}`);
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

  // If lastCertificateId is provided, confirm the referenced certificate exists
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

  const created = await repo.createApplication({
    applicantId: user.id,
    instrumentId: data.instrumentId,
    applicationType: data.applicationType,
    purpose: data.purpose || 'Statutory verification for commercial use',
    remarks: data.remarks,
    division,
    submissionOffice: data.submissionOffice,
    instrumentOrigin: data.instrumentOrigin,
    grasChallanNumber: data.grasChallanNumber,
    grasChallanDate: data.grasChallanDate,
    conveyanceFee: data.conveyanceFee,
    quarterJumpFee: data.quarterJumpFee,
    lastCertificateId: data.lastCertificateId || null,
  });

  return repo.findApplicationById(created.id);
}

async function getApplications(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllApplications();
  }

  if (user.role === ROLES.LMO || user.role === ROLES.GATC) {
    return repo.findApplicationsAssignedToOfficerId(user.id);
  }

  return repo.findApplicationsByApplicantId(user.id);
}

async function getApplicationById(user, applicationId) {
  const application = await repo.findApplicationById(applicationId);

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  if (user.role === ROLES.ADMIN) {
    return application;
  }

  if (user.role === ROLES.LMO || user.role === ROLES.GATC) {
    const isAssigned = await repo.isApplicationAssignedToOfficer(applicationId, user.id);
    if (!isAssigned) {
      throw ApiError.forbidden(
        'You can only access applications assigned to you by the Administrator'
      );
    }
    return application;
  }

  if (application.applicant_id !== user.id) {
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