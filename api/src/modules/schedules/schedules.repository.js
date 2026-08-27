const pool = require('../../pool');

// Find assignment and its linked application
async function findAssignmentById(id) {
  const { rows } = await pool.query(
    `SELECT id, application_id, assigned_to_id, status
     FROM verification_assignments
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Create a verification schedule
async function createSchedule({
  applicationId,
  assignmentId,
  scheduledDate,
  scheduledTime,
  verificationLocation,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_schedules (
      application_id,
      assignment_id,
      scheduled_date,
      scheduled_time,
      verification_location,
      remarks
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      applicationId,
      assignmentId,
      scheduledDate,
      scheduledTime || null,
      verificationLocation || null,
      remarks || null,
    ]
  );

  return rows[0];
}

// ADMIN: get all schedules
async function findAllSchedules() {
  const { rows } = await pool.query(
    `SELECT vs.*,
            app.application_number,
            va.assigned_to_id,
            u.full_name AS assigned_to_name
     FROM verification_schedules vs
     JOIN verification_applications app
       ON app.id = vs.application_id
     JOIN verification_assignments va
       ON va.id = vs.assignment_id
     JOIN users u
       ON u.id = va.assigned_to_id
     ORDER BY vs.scheduled_date ASC,
              vs.scheduled_time ASC NULLS LAST`
  );

  return rows;
}

// LMO/GATC: get only their schedules
async function findSchedulesByAssigneeId(userId) {
  const { rows } = await pool.query(
    `SELECT vs.*,
            app.application_number
     FROM verification_schedules vs
     JOIN verification_applications app
       ON app.id = vs.application_id
     JOIN verification_assignments va
       ON va.id = vs.assignment_id
     WHERE va.assigned_to_id = $1
     ORDER BY vs.scheduled_date ASC,
              vs.scheduled_time ASC NULLS LAST`,
    [userId]
  );

  return rows;
}

// Get one schedule
async function findScheduleById(id) {
  const { rows } = await pool.query(
    `SELECT vs.*,
            app.application_number,
            va.assigned_to_id,
            u.full_name AS assigned_to_name
     FROM verification_schedules vs
     JOIN verification_applications app
       ON app.id = vs.application_id
     JOIN verification_assignments va
       ON va.id = vs.assignment_id
     JOIN users u
       ON u.id = va.assigned_to_id
     WHERE vs.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Update schedule status
async function updateScheduleStatus(id, status, remarks) {
  const { rows } = await pool.query(
    `UPDATE verification_schedules
     SET status = $2,
         remarks = COALESCE($3, remarks)
     WHERE id = $1
     RETURNING *`,
    [id, status, remarks || null]
  );

  return rows[0] || null;
}
async function updateApplicationStatus(
  applicationId,
  status
) {
  const { rows } = await pool.query(
    `UPDATE verification_applications
     SET status = $2
     WHERE id = $1
     RETURNING *`,
    [applicationId, status]
  );

  return rows[0] || null;
}
module.exports = {
  findAssignmentById,
  createSchedule,
  findAllSchedules,
  findSchedulesByAssigneeId,
  findScheduleById,
  updateScheduleStatus,
  updateApplicationStatus,
};