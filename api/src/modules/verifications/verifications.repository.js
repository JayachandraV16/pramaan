const pool = require('../../pool');

// Find assignment
async function findAssignmentById(id) {
  const { rows } = await pool.query(
    `SELECT id, application_id, assigned_to_id, status
     FROM verification_assignments
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Find schedule
async function findScheduleById(id) {
  const { rows } = await pool.query(
    `SELECT id, application_id, assignment_id, status
     FROM verification_schedules
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Create actual verification
async function createVerification({
  applicationId,
  assignmentId,
  scheduleId,
  performedById,
  location,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verifications (
      application_id,
      assignment_id,
      schedule_id,
      performed_by_id,
      verification_date,
      start_time,
      location,
      remarks
    )
    VALUES ($1, $2, $3, $4, CURRENT_DATE, NOW(), $5, $6)
    RETURNING *`,
    [
      applicationId,
      assignmentId,
      scheduleId || null,
      performedById,
      location || null,
      remarks || null,
    ]
  );

  return rows[0];
}

// Add qualitative observation
async function createObservation({
  verificationId,
  observationType,
  observationDescription,
  observedValue,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO inspection_observations (
      verification_id,
      observation_type,
      observation_description,
      observed_value,
      remarks
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      verificationId,
      observationType,
      observationDescription || null,
      observedValue || null,
      remarks || null,
    ]
  );

  return rows[0];
}

// Add measurement reading
async function createReading({
  verificationId,
  readingType,
  expectedValue,
  observedValue,
  unit,
  tolerance,
  result,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_readings (
      verification_id,
      reading_type,
      expected_value,
      observed_value,
      unit,
      tolerance,
      result,
      remarks
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      verificationId,
      readingType,
      expectedValue ?? null,
      observedValue,
      unit,
      tolerance ?? null,
      result,
      remarks || null,
    ]
  );

  return rows[0];
}

// Get basic verification
async function findVerificationById(id) {
  const { rows } = await pool.query(
    `SELECT v.*,
            app.application_number,
            u.full_name AS performed_by_name
     FROM verifications v
     JOIN verification_applications app
       ON app.id = v.application_id
     JOIN users u
       ON u.id = v.performed_by_id
     WHERE v.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Get observations for verification
async function findObservationsByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM inspection_observations
     WHERE verification_id = $1
     ORDER BY observed_at ASC`,
    [verificationId]
  );

  return rows;
}

// Get readings for verification
async function findReadingsByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM verification_readings
     WHERE verification_id = $1
     ORDER BY recorded_at ASC`,
    [verificationId]
  );

  return rows;
}

// Get final result
async function findResultByVerificationId(verificationId) {
  const { rows } = await pool.query(
    `SELECT vr.*,
            u.full_name AS decided_by_name
     FROM verification_results vr
     JOIN users u ON u.id = vr.decided_by_id
     WHERE vr.verification_id = $1`,
    [verificationId]
  );

  return rows[0] || null;
}

// Create final PASS/FAIL result
async function createResult({
  verificationId,
  decision,
  decidedById,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_results (
      verification_id,
      decision,
      decided_by_id,
      remarks
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [
      verificationId,
      decision,
      decidedById,
      remarks || null,
    ]
  );

  return rows[0];
}

// Mark verification as completed
async function completeVerification(id) {
  const { rows } = await pool.query(
    `UPDATE verifications
     SET status = 'COMPLETED',
         end_time = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return rows[0] || null;
}

// Get all verifications for ADMIN
async function findAllVerifications() {
  const { rows } = await pool.query(
    `SELECT v.*,
            app.application_number,
            u.full_name AS performed_by_name
     FROM verifications v
     JOIN verification_applications app
       ON app.id = v.application_id
     JOIN users u
       ON u.id = v.performed_by_id
     ORDER BY v.created_at DESC`
  );

  return rows;
}

// Get verifications performed by an officer
async function findVerificationsByOfficerId(userId) {
  const { rows } = await pool.query(
    `SELECT v.*,
            app.application_number
     FROM verifications v
     JOIN verification_applications app
       ON app.id = v.application_id
     WHERE v.performed_by_id = $1
     ORDER BY v.created_at DESC`,
    [userId]
  );

  return rows;
}
async function completeApplication(applicationId) {
  const { rows } = await pool.query(
    `UPDATE verification_applications
     SET status = 'COMPLETED'
     WHERE id = $1
     RETURNING *`,
    [applicationId]
  );

  return rows[0] || null;
}
module.exports = {
  findAssignmentById,
  findScheduleById,
  createVerification,
  createObservation,
  createReading,
  findVerificationById,
  findObservationsByVerificationId,
  findReadingsByVerificationId,
  findResultByVerificationId,
  createResult,
  completeVerification,
  findAllVerifications,
  findVerificationsByOfficerId,
  completeApplication,
};