const ApiError = require('../../utils/ApiError');
const repo = require('./verifications.repository');

const {
  isValidReadingResult,
  isValidVerificationDecision,
} = require('./verifications.validation');

const { ROLES } = require('../../config/roles');

// Start a field verification
async function createVerification(user, data) {
  const assignment = await repo.findAssignmentById(
    data.assignmentId
  );

  if (!assignment) {
    throw ApiError.notFound('Assignment not found');
  }

  // Assignment must belong to the application
  if (assignment.application_id !== data.applicationId) {
    throw ApiError.badRequest(
      'Assignment does not belong to this application'
    );
  }

  // Only the assigned officer can perform verification
  if (assignment.assigned_to_id !== user.id) {
    throw ApiError.forbidden(
      'You can only perform verifications assigned to you'
    );
  }

  // Cannot start verification for declined assignment
  if (assignment.status === 'DECLINED') {
    throw ApiError.badRequest(
      'Cannot start verification for a declined assignment'
    );
  }

  // Never create a duplicate/second verification for the same assignment/application.
  const existingVerification =
    await repo.findLatestVerificationByAssignmentId(
      data.assignmentId
    );

  if (existingVerification) {
    if (existingVerification.result_date || existingVerification.status === 'COMPLETED') {
      throw ApiError.badRequest(
        'Verification has already been started/completed for this application.'
      );
    }

    if (existingVerification.status === 'IN_PROGRESS') {
      throw ApiError.badRequest(
        'A verification is already in progress for this assignment'
      );
    }
  }

  // Require a valid schedule
  let schedule = null;
  if (data.scheduleId) {
    schedule = await repo.findScheduleById(data.scheduleId);
  } else {
    schedule = await repo.findActiveScheduleByAssignmentId(data.assignmentId);
  }

  if (
    !schedule ||
    schedule.application_id !== data.applicationId ||
    schedule.assignment_id !== data.assignmentId
  ) {
    throw ApiError.badRequest(
      'Verification cannot be started because this application has not been scheduled.'
    );
  }

  if (schedule.status === 'CANCELLED') {
    throw ApiError.badRequest(
      'Verification cannot be started because the schedule has been cancelled.'
    );
  }

  // Enforce ON/AFTER scheduled date/time rule
  const scheduledDateStr =
    typeof schedule.scheduled_date === 'string'
      ? schedule.scheduled_date
      : new Date(schedule.scheduled_date).toISOString().split('T')[0];

  const scheduledTimeStr = schedule.scheduled_time || '00:00:00';

  const [sYear, sMonth, sDay] = scheduledDateStr.split('-').map(Number);
  const [sHour, sMin, sSec] = scheduledTimeStr.split(':').map(Number);
  const scheduledDateTime = new Date(
    sYear,
    sMonth - 1,
    sDay,
    sHour || 0,
    sMin || 0,
    sSec || 0
  );

  const now = new Date();

  if (now < scheduledDateTime) {
    throw ApiError.badRequest(
      'Verification cannot be started before the scheduled date and time.'
    );
  }

  return repo.createVerification({
    applicationId: data.applicationId,
    assignmentId: data.assignmentId,
    scheduleId: schedule.id,
    performedById: user.id,
    location: data.location,
    remarks: data.remarks,
  });
}

// Add inspection observation
async function addObservation(
  user,
  verificationId,
  data
) {
  const verification = await repo.findVerificationById(
    verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  if (
    user.role !== ROLES.ADMIN &&
    verification.performed_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only add observations to your own verification'
    );
  }

  if (verification.status !== 'IN_PROGRESS') {
    throw ApiError.badRequest(
      'Observations can only be added to an in-progress verification'
    );
  }

  return repo.createObservation({
    verificationId,
    observationType: data.observationType,
    observationDescription: data.observationDescription,
    observedValue: data.observedValue,
    remarks: data.remarks,
  });
}

// Add measurement reading
async function addReading(
  user,
  verificationId,
  data
) {
  if (!isValidReadingResult(data.result)) {
    throw ApiError.badRequest(
      `Invalid reading result: ${data.result}`
    );
  }

  const verification = await repo.findVerificationById(
    verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  if (
    user.role !== ROLES.ADMIN &&
    verification.performed_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only add readings to your own verification'
    );
  }

  if (verification.status !== 'IN_PROGRESS') {
    throw ApiError.badRequest(
      'Readings can only be added to an in-progress verification'
    );
  }

  return repo.createReading({
    verificationId,
    readingType: data.readingType,
    expectedValue: data.expectedValue,
    observedValue: data.observedValue,
    unit: data.unit,
    tolerance: data.tolerance,
    result: data.result,
    remarks: data.remarks,
  });
}

// Get verification list
async function getVerifications(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllVerifications();
  }

  return repo.findVerificationsByOfficerId(user.id);
}

// Get complete verification details
async function getVerificationById(user, verificationId) {
  const verification = await repo.findVerificationById(
    verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  if (
    user.role !== ROLES.ADMIN &&
    verification.performed_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You do not have permission to access this verification'
    );
  }

  const [
    observations,
    readings,
    result,
  ] = await Promise.all([
    repo.findObservationsByVerificationId(verificationId),
    repo.findReadingsByVerificationId(verificationId),
    repo.findResultByVerificationId(verificationId),
  ]);

  return {
    ...verification,
    observations,
    readings,
    result,
  };
}

// Submit final PASS/FAIL result
async function submitResult(
  user,
  verificationId,
  data
) {
  if (!isValidVerificationDecision(data.decision)) {
    throw ApiError.badRequest(
      `Invalid verification decision: ${data.decision}`
    );
  }

  const verification = await repo.findVerificationById(
    verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  if (
    user.role !== ROLES.ADMIN &&
    verification.performed_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only submit results for your own verification'
    );
  }

  if (verification.status !== 'IN_PROGRESS') {
    throw ApiError.badRequest(
      'Only an in-progress verification can receive a final result'
    );
  }

  // One verification can have only one final result
  const existingResult =
    await repo.findResultByVerificationId(verificationId);

  if (existingResult) {
    throw ApiError.badRequest(
      'A final result has already been submitted for this verification'
    );
  }

  const result = await repo.createResult({
    verificationId,
    decision: data.decision,
    decidedById: user.id,
    remarks: data.remarks,
  });

  await repo.completeVerification(verificationId);
  await repo.completeAssignment(verification.assignment_id);
  await repo.completeSchedule(verification.schedule_id);

  // PASS completes the application successfully.
  // FAIL rejects the application so the owner can see the failed outcome
  // and re-apply through a new verification application.
  await repo.completeApplication(
    verification.application_id,
    data.decision
  );

  // Notify Applicant
  try {
    const notificationsRepo = require('../notifications/notifications.repository');
    if (verification.applicant_id) {
      await notificationsRepo.createNotification({
        recipientId: verification.applicant_id,
        type: 'APPLICATION_UPDATE',
        title: 'Verification Completed',
        message: `Verification completed for application ${verification.application_number}: Result ${data.decision}.`,
        relatedApplicationId: verification.application_id,
      });
    }
  } catch (err) {
    console.error('Verification result notification failed:', err.message);
  }

  return result;
}
async function getVerificationResult(user, verificationId) {
  const verification = await repo.findVerificationById(
    verificationId
  );

  if (!verification) {
    throw ApiError.notFound('Verification not found');
  }

  // ADMIN can access any result
  // Officer can access only their own verification
  if (
    user.role !== ROLES.ADMIN &&
    verification.performed_by_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You do not have permission to access this verification result'
    );
  }

  const result = await repo.findResultByVerificationId(
    verificationId
  );

  if (!result) {
    throw ApiError.notFound(
      'Verification result has not been submitted yet'
    );
  }

  return result;
}
module.exports = {
  createVerification,
  addObservation,
  addReading,
  getVerifications,
  getVerificationById,
  getVerificationResult,
  submitResult,
};