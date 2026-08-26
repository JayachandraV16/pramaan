const ApiError = require('../../utils/ApiError');
const repo = require('./applications.repository');
const { isValidApplicationType } = require('./applications.validation');
const { ROLES } = require('../../config/roles');

function generateApplicationNumber() {
  return `APP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function createApplication(user, data) {
  if (!isValidApplicationType(data.applicationType)) {
    throw ApiError.badRequest(
      `Invalid application type: ${data.applicationType}`
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

  const applicationNumber = generateApplicationNumber();

  return repo.createApplication({
    applicationNumber,
    applicantId: user.id,
    instrumentId: data.instrumentId,
    applicationType: data.applicationType,
    purpose: data.purpose,
    remarks: data.remarks,
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