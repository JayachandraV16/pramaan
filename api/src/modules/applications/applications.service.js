const ApiError = require('../../utils/ApiError');
const repo = require('./applications.repository');
const {
  isValidApplicationType,
  isValidInstrumentOrigin,
  APPLICATION_TYPES,
} = require('./applications.validation');
const { ROLES } = require('../../config/roles');
const { withTransaction } = require('../../utils/db');
const { transition } = require('../../utils/applicationStatus');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');

const feesService = require('../fees/fees.service');

const MIN_REASON_LENGTH = 10;

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

  const open = await repo.findOpenApplicationForInstrument(data.instrumentId);
  if (open) {
    throw ApiError.conflict(
      `This instrument already has an open application (${open.application_number}, ${open.status})`
    );
  }

  // Fees come from the configurable fee_rules table. Where a rule matches, the
  // server's amount replaces whatever the client sent; where none is configured
  // the client's figure is kept (and the verification fee/total stay empty).
  const fees = await feesService.computeFees(instrument, data.applicationType, {
    conveyance: Number(data.conveyanceFee) > 0,
    quarterJump: Number(data.quarterJumpFee) > 0,
  });
  const conveyanceFee = fees.rules.conveyance ? fees.conveyanceFee : data.conveyanceFee;
  const quarterJumpFee = fees.rules.quarterJump ? fees.quarterJumpFee : data.quarterJumpFee;
  const verificationFee = fees.configured ? fees.verificationFee : null;
  const totalFee = fees.configured
    ? Math.round((verificationFee + Number(conveyanceFee || 0) + Number(quarterJumpFee || 0)) * 100) / 100
    : null;

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
    conveyanceFee,
    quarterJumpFee,
    lastCertificateId: data.lastCertificateId || null,
    verificationFee,
    totalFee,
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

// ADMIN confirms the GRAS challan against the fee due. Needs a challan number.
async function verifyPayment(user, applicationId) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an administrator can verify a payment');
  }
  const application = await repo.findApplicationById(applicationId);
  if (!application) throw ApiError.notFound('Application not found');
  if (!application.gras_challan_number) {
    throw ApiError.badRequest('The application has no GRAS challan number to verify');
  }
  if (['REJECTED', 'CANCELLED'].includes(application.status)) {
    throw ApiError.conflict(`Cannot verify payment for a ${application.status.toLowerCase()} application`);
  }
  if (application.payment_verified_at) {
    return application;
  }

  return withTransaction(async (client) => {
    await client.query(
      'UPDATE verification_applications SET payment_verified_at = now(), payment_verified_by_id = $2 WHERE id = $1',
      [applicationId, user.id]
    );
    await audit.record(client, {
      actorId: user.id,
      action: 'APPLICATION_PAYMENT_VERIFIED',
      entityType: 'application',
      entityId: applicationId,
      details: {
        grasChallanNumber: application.gras_challan_number,
        totalFee: application.total_fee,
      },
    });
    await notify(client, {
      recipientId: application.applicant_id,
      type: 'APPLICATION_UPDATE',
      key: 'payment.verified',
      params: { challan: application.gras_challan_number, applicationNumber: application.application_number },
      relatedApplicationId: applicationId,
    });
    const { rows } = await client.query('SELECT * FROM verification_applications WHERE id = $1', [applicationId]);
    return rows[0];
  });
}

async function getApplicationHistory(user, applicationId) {
  // getApplicationById enforces who may see this application
  await getApplicationById(user, applicationId);
  return repo.findStatusHistory(applicationId);
}

// Shared by cancel/reject: one transaction moves the status, withdraws open
// assignments/schedules, audits, and tells the people affected.
async function closeApplication(user, applicationId, { toStatus, action, reason, notifyApplicant }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT va.id, va.status, va.applicant_id, va.application_number
       FROM verification_applications va WHERE va.id = $1 FOR UPDATE`,
      [applicationId]
    );
    const application = rows[0];
    if (!application) throw ApiError.notFound('Application not found');

    if (await repo.hasStartedVerification(client, applicationId)) {
      throw ApiError.conflict('A verification has already started for this application and it can no longer be closed');
    }

    const { from } = await transition(client, applicationId, toStatus, { actorId: user.id, reason });
    const officerIds = await repo.closeOpenWork(client, applicationId, `Application ${toStatus.toLowerCase()}`);

    await audit.record(client, {
      actorId: user.id,
      action,
      entityType: 'application',
      entityId: applicationId,
      details: { applicationNumber: application.application_number, from, to: toStatus, reason },
    });

    const recipients = new Set(officerIds);
    if (notifyApplicant) recipients.add(application.applicant_id);
    recipients.delete(user.id);
    for (const recipientId of recipients) {
      await notify(client, {
        recipientId,
        type: 'APPLICATION_UPDATE',
        title: `Application ${application.application_number} ${toStatus.toLowerCase()}`,
        message: reason,
        relatedApplicationId: applicationId,
      });
    }

    const { rows: updated } = await client.query('SELECT * FROM verification_applications WHERE id = $1', [applicationId]);
    return updated[0];
  });
}

// Owner (own application) or ADMIN withdraws an application that has not started.
async function cancelApplication(user, applicationId, reason) {
  const application = await getApplicationById(user, applicationId);
  if (user.role === ROLES.INSTRUMENT_OWNER && application.applicant_id !== user.id) {
    throw ApiError.forbidden('You can only cancel your own application');
  }
  if (user.role !== ROLES.INSTRUMENT_OWNER && user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the applicant or an administrator can cancel an application');
  }
  const text = (reason || '').trim() || 'Cancelled by applicant';
  return closeApplication(user, applicationId, {
    toStatus: 'CANCELLED',
    action: 'APPLICATION_CANCELLED',
    reason: text,
    notifyApplicant: user.role === ROLES.ADMIN,
  });
}

// ADMIN refuses an application, with a recorded reason shown to the applicant.
async function rejectApplication(user, applicationId, reason) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an administrator can reject an application');
  }
  const text = (reason || '').trim();
  if (text.length < MIN_REASON_LENGTH) {
    throw ApiError.badRequest(`A rejection reason of at least ${MIN_REASON_LENGTH} characters is required`);
  }
  return closeApplication(user, applicationId, {
    toStatus: 'REJECTED',
    action: 'APPLICATION_REJECTED',
    reason: text,
    notifyApplicant: true,
  });
}

module.exports = {
  verifyPayment,
  getApplicationHistory,
  cancelApplication,
  rejectApplication,
  createApplication,
  getApplications,
  getApplicationById,
};