const ApiError = require('../../utils/ApiError');
const repo = require('./applications.repository');
const notificationsRepo = require('../notifications/notifications.repository');
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

  if (
    user.role === ROLES.INSTRUMENT_OWNER &&
    instrument.owner_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only create an application for your own instrument'
    );
  }

  const applicationNumber = generateApplicationNumber();

  const app = await repo.createApplication({
    applicationNumber,
    applicantId: user.id,
    instrumentId: data.instrumentId,
    applicationType: data.applicationType,
    purpose: data.purpose,
    remarks: data.remarks,
  });

  // Persist database notification for Applicant
  try {
    await notificationsRepo.createNotification({
      recipientId: user.id,
      type: 'APPLICATION_UPDATE',
      title: 'Application Submitted',
      message: `Your verification application ${applicationNumber} has been submitted successfully.`,
      relatedApplicationId: app.id,
    });
  } catch (err) {
    console.error('Failed to create notification on submit:', err.message);
  }

  return app;
}

async function getApplications(user) {
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.GATC ||
    user.role === ROLES.LMO
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
    user.role === ROLES.GATC ||
    user.role === ROLES.LMO;

  if (!canAccessAll && application.applicant_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to access this application'
    );
  }

  const attachmentsRepo = require('../attachments/attachments.repository');
  const attachments = await attachmentsRepo.findAttachmentsByApplicationId(applicationId);
  application.attachments = attachments || [];

  return application;
}

// Officer Review Action: Request Document or Clarification
async function requestInfo(user, applicationId, data) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  if (app.status === 'COMPLETED' || app.status === 'REJECTED') {
    throw ApiError.badRequest(`Cannot request information for application with status ${app.status}`);
  }

  const requestType = data.requestType === 'DOCUMENT' ? 'DOCUMENT' : 'CLARIFICATION';
  const details = data.details || data.remarks || 'Additional information requested by officer';

  const updatedRemarks = `[REQUESTED_${requestType}]: ${details}`;
  const updatedApp = await repo.updateApplicationState(applicationId, {
    status: 'UNDER_REVIEW',
    remarks: updatedRemarks,
  });

  // Notify Applicant
  try {
    await notificationsRepo.createNotification({
      recipientId: app.applicant_id,
      type: 'APPLICATION_UPDATE',
      title: requestType === 'DOCUMENT' ? 'Document Requested' : 'Clarification Requested',
      message: `Officer requested ${requestType.toLowerCase()} for application ${app.application_number}: ${details}`,
      relatedApplicationId: applicationId,
    });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return updatedApp;
}

// Owner Response to Document or Clarification Request
async function respondInfo(user, applicationId, data) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  if (app.applicant_id !== user.id) {
    throw ApiError.forbidden('Only the applicant can respond to information requests');
  }

  const responseText = data.responseText || data.remarks || 'Information provided by applicant';
  const updatedRemarks = `[APPLICANT_RESPONSE]: ${responseText}`;

  const updatedApp = await repo.updateApplicationState(applicationId, {
    status: 'UNDER_REVIEW',
    remarks: updatedRemarks,
  });

  // Notify assigned Officer or Admin
  const targetRecipient = app.assigned_to_id || app.applicant_id;
  try {
    await notificationsRepo.createNotification({
      recipientId: targetRecipient,
      type: 'APPLICATION_UPDATE',
      title: 'Applicant Responded',
      message: `Applicant submitted requested information for application ${app.application_number}: ${responseText}`,
      relatedApplicationId: applicationId,
    });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return updatedApp;
}

// Officer Action: Return for Correction
async function returnForCorrection(user, applicationId, data) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  if (!data.remarks || !data.remarks.trim()) {
    throw ApiError.badRequest('Remarks are required when returning an application for correction.');
  }

  if (app.status === 'COMPLETED' || app.status === 'REJECTED') {
    throw ApiError.badRequest(`Cannot return application with status ${app.status}`);
  }

  const correctionRemarks = `[RETURNED_FOR_CORRECTION]: ${data.remarks.trim()}`;
  const updatedApp = await repo.updateApplicationState(applicationId, {
    status: 'UNDER_REVIEW',
    remarks: correctionRemarks,
  });

  // Notify Applicant
  try {
    await notificationsRepo.createNotification({
      recipientId: app.applicant_id,
      type: 'APPLICATION_UPDATE',
      title: 'Application Returned for Correction',
      message: `Your application ${app.application_number} was returned for correction: ${data.remarks.trim()}`,
      relatedApplicationId: applicationId,
    });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return updatedApp;
}

// Owner Action: Resubmit SAME Application
async function resubmitApplication(user, applicationId, data) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  if (app.applicant_id !== user.id) {
    throw ApiError.forbidden('Only the applicant can resubmit this application');
  }

  const updatedPurpose = data.purpose !== undefined ? data.purpose : app.purpose;
  const updatedRemarks = data.remarks !== undefined ? data.remarks : `[RESUBMITTED]: Application resubmitted by applicant`;

  const updatedApp = await repo.updateApplicationState(applicationId, {
    status: 'UNDER_REVIEW',
    purpose: updatedPurpose,
    remarks: updatedRemarks,
  });

  // Notify assigned Officer if present
  if (app.assigned_to_id) {
    try {
      await notificationsRepo.createNotification({
        recipientId: app.assigned_to_id,
        type: 'APPLICATION_UPDATE',
        title: 'Application Resubmitted',
        message: `Applicant resubmitted application ${app.application_number}`,
        relatedApplicationId: applicationId,
      });
    } catch (err) {
      console.error('Notification failed:', err.message);
    }
  }

  return updatedApp;
}

// Officer Action: Reject Application
async function rejectApplication(user, applicationId, data) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  if (!data.rejectionReason || !data.rejectionReason.trim()) {
    throw ApiError.badRequest('Rejection reason is required.');
  }

  if (app.status === 'COMPLETED') {
    throw ApiError.badRequest('Cannot reject a completed application.');
  }

  const fullRejectionReason = `REJECTED: ${data.rejectionReason.trim()}${data.remarks ? ' — ' + data.remarks.trim() : ''}`;

  const updatedApp = await repo.updateApplicationState(applicationId, {
    status: 'REJECTED',
    remarks: fullRejectionReason,
  });

  // Notify Applicant
  try {
    await notificationsRepo.createNotification({
      recipientId: app.applicant_id,
      type: 'APPLICATION_UPDATE',
      title: 'Application Rejected',
      message: `Your application ${app.application_number} was rejected: ${data.rejectionReason.trim()}`,
      relatedApplicationId: applicationId,
    });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return updatedApp;
}

// Public Unauthenticated Tracking Endpoint
async function trackApplicationPublic(applicationNumber) {
  if (!applicationNumber || !applicationNumber.trim()) {
    throw ApiError.badRequest('Application number is required');
  }

  const app = await repo.findApplicationByNumberPublic(applicationNumber.trim());

  if (!app) {
    throw ApiError.notFound('Application not found');
  }

  return {
    applicationNumber: app.application_number,
    applicationType: app.application_type,
    status: app.status,
    purpose: app.purpose,
    submittedAt: app.submitted_at,
    createdAt: app.created_at,
    instrumentName: app.instrument_name,
    serialNumber: app.serial_number,
    verificationDecision: app.verification_decision || null,
    resultDate: app.result_date || null,
    certificateNumber: app.certificate_number || null,
    certificateStatus: app.certificate_status || null,
  };
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  requestInfo,
  respondInfo,
  returnForCorrection,
  resubmitApplication,
  rejectApplication,
  trackApplicationPublic,
};