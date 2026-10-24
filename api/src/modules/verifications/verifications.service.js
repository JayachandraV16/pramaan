const ApiError = require('../../utils/ApiError');
const repo = require('./verifications.repository');

const {
  isValidReadingResult,
  isValidVerificationDecision,
} = require('./verifications.validation');

const { ROLES } = require('../../config/roles');
const config = require('../../config');
const pool = require('../../pool');
const { withTransaction } = require('../../utils/db');
const { transition } = require('../../utils/applicationStatus');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { computeReadingResult } = require('../../utils/measurement');
const { computeResultSeal } = require('../../utils/verificationSeal');

function assertValidGps(latitude, longitude) {
  const hasLat = latitude !== undefined && latitude !== null;
  const hasLng = longitude !== undefined && longitude !== null;
  if (hasLat !== hasLng) {
    throw ApiError.badRequest('latitude and longitude must be provided together');
  }
  if (hasLat && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    throw ApiError.badRequest('latitude/longitude out of range');
  }
}

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

  // Assignment should be accepted before verification starts
  if (assignment.status !== 'ACCEPTED') {
    throw ApiError.badRequest(
      `Cannot start verification. Assignment status is ${assignment.status}`
    );
  }

  // If a schedule is provided, verify that it belongs to
  // the same application and assignment
  if (data.scheduleId) {
    const schedule = await repo.findScheduleById(
      data.scheduleId
    );

    if (!schedule) {
      throw ApiError.notFound('Schedule not found');
    }

    if (
      schedule.application_id !== data.applicationId ||
      schedule.assignment_id !== data.assignmentId
    ) {
      throw ApiError.badRequest(
        'Schedule does not belong to this application and assignment'
      );
    }

    if (
      schedule.status === 'CANCELLED' ||
      schedule.status === 'COMPLETED'
    ) {
      throw ApiError.badRequest(
        `Cannot use a schedule with status ${schedule.status}`
      );
    }
  }

  assertValidGps(data.latitude, data.longitude);

  // One inspection per assignment: a second one would double-book the work
  // and could overwrite a recorded result.
  const { rows: existing } = await pool.query(
    "SELECT id, status FROM verifications WHERE assignment_id = $1 AND status <> 'ABORTED' LIMIT 1",
    [data.assignmentId]
  );
  if (existing.length > 0) {
    throw ApiError.conflict(`A verification (${existing[0].status}) already exists for this assignment`);
  }

  return repo.createVerification({
    applicationId: data.applicationId,
    assignmentId: data.assignmentId,
    scheduleId: data.scheduleId,
    performedById: user.id,
    location: data.location,
    remarks: data.remarks,
    latitude: data.latitude,
    longitude: data.longitude,
    clientId: data.clientId,
    clientStartedAt: data.clientStartedAt,
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
    clientId: data.clientId,
  });
}

// Add measurement reading
async function addReading(
  user,
  verificationId,
  data
) {
  // The server decides PASS/FAIL whenever it can (expected value + tolerance):
  // |observed - expected| <= tolerance. The officer's own result is only used
  // for readings that cannot be computed (no expected value or tolerance).
  const computed = computeReadingResult(data);
  let result = computed;
  if (!computed) {
    if (!isValidReadingResult(data.result)) {
      throw ApiError.badRequest(
        'result (PASS or FAIL) is required when expectedValue and tolerance are not both provided'
      );
    }
    result = data.result;
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
    result,
    remarks: data.remarks,
    clientId: data.clientId,
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

  return withTransaction(async (client) => {
    // Lock the verification so two submissions cannot race each other.
    const { rows: locked } = await client.query(
      'SELECT status, application_id, assignment_id, schedule_id FROM verifications WHERE id = $1 FOR UPDATE',
      [verificationId]
    );
    if (locked[0].status !== 'IN_PROGRESS') {
      throw ApiError.badRequest('Only an in-progress verification can receive a final result');
    }

    // One verification can have only one final result
    const { rows: existingResult } = await client.query(
      'SELECT 1 FROM verification_results WHERE verification_id = $1',
      [verificationId]
    );
    if (existingResult.length > 0) {
      throw ApiError.badRequest(
        'A final result has already been submitted for this verification'
      );
    }

    const { rows: readings } = await client.query(
      'SELECT * FROM verification_readings WHERE verification_id = $1 ORDER BY recorded_at, id',
      [verificationId]
    );
    const { rows: observations } = await client.query(
      'SELECT * FROM inspection_observations WHERE verification_id = $1 ORDER BY observed_at, id',
      [verificationId]
    );

    // ---- decision must be consistent with the evidence --------------------
    const failedReadings = readings.filter((r) => r.result === 'FAIL');
    if (data.decision === 'PASS') {
      if (readings.length === 0) {
        throw ApiError.badRequest('At least one reading is required to record a PASS result');
      }
      if (failedReadings.length > 0) {
        throw ApiError.badRequest(
          `Cannot record PASS: ${failedReadings.length} reading(s) are outside tolerance. Record FAIL, or correct the readings first.`
        );
      }
      if (config.minEvidenceForPass > 0) {
        const { rows: evidence } = await client.query(
          `SELECT COUNT(*)::int AS n FROM attachments
           WHERE verification_id = $1 AND category IN ('PHOTOGRAPH', 'INSPECTION_EVIDENCE')`,
          [verificationId]
        );
        if (evidence[0].n < config.minEvidenceForPass) {
          throw ApiError.badRequest(
            `At least ${config.minEvidenceForPass} photograph(s) or inspection evidence file(s) must be attached before a PASS result`
          );
        }
      }
    } else if (data.decision === 'FAIL' && failedReadings.length === 0) {
      const remark = typeof data.remarks === 'string' ? data.remarks.trim() : '';
      if (remark.length < 10) {
        throw ApiError.badRequest(
          'A FAIL decision with no out-of-tolerance reading needs remarks (at least 10 characters) explaining why'
        );
      }
    }

    const resultSha256 = computeResultSeal({
      verificationId,
      decision: data.decision,
      readings,
      observations,
    });

    const result = await repo.createResult({
      verificationId,
      decision: data.decision,
      decidedById: user.id,
      remarks: data.remarks,
      resultSha256,
    }, client);

    await client.query(
      `UPDATE verifications SET status = 'COMPLETED', end_time = NOW() WHERE id = $1`,
      [verificationId]
    );

    // The application is done (a FAIL still ends this application; the owner
    // may apply again for re-verification), and the work items are closed.
    await transition(client, locked[0].application_id, 'COMPLETED', {
      actorId: user.id,
      reason: `Verification ${data.decision}`,
    });
    await client.query(
      `UPDATE verification_assignments SET status = 'COMPLETED' WHERE id = $1`,
      [locked[0].assignment_id]
    );
    await client.query(
      `UPDATE verification_schedules SET status = 'COMPLETED'
       WHERE application_id = $1 AND status IN ('SCHEDULED', 'RESCHEDULED')`,
      [locked[0].application_id]
    );

    await audit.record(client, {
      actorId: user.id,
      action: 'VERIFICATION_RESULT_SUBMITTED',
      entityType: 'verification',
      entityId: verificationId,
      details: {
        decision: data.decision,
        readings: readings.length,
        failedReadings: failedReadings.length,
        observations: observations.length,
        resultSha256,
      },
    });

    const { rows: app } = await client.query(
      'SELECT applicant_id, application_number FROM verification_applications WHERE id = $1',
      [locked[0].application_id]
    );
    if (app[0] && app[0].applicant_id !== user.id) {
      await notify(client, {
        recipientId: app[0].applicant_id,
        type: 'APPLICATION_UPDATE',
        key: data.decision === 'PASS' ? 'verification.passed' : 'verification.failed',
        params: { applicationNumber: app[0].application_number },
        relatedApplicationId: locked[0].application_id,
      });
    }

    return result;
  });
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