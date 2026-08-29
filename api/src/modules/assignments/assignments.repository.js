const pool = require('../../pool');

// Check whether the application exists
async function findApplicationById(id) {
  const { rows } = await pool.query(
    `SELECT id, status
     FROM verification_applications
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Find the user and their role
async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.status,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Create assignment
async function createAssignment({
  applicationId,
  assignedToId,
  assignedById,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_assignments (
      application_id,
      assigned_to_id,
      assigned_by_id,
      remarks
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [
      applicationId,
      assignedToId,
      assignedById,
      remarks || null,
    ]
  );

  return rows[0];
}

// ADMIN: get all assignments
async function findAllAssignments() {
  const { rows } = await pool.query(
    `SELECT va.*,
            app.application_number,
            app.application_type,
            app.status AS application_status,
            app.purpose AS application_purpose,
            app.remarks AS application_remarks,
            app.applicant_id,
            owner.full_name AS applicant_name,
            owner.email AS applicant_email,
            i.id AS instrument_id,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number,
            i.location_address,
            i.capacity,
            i.capacity_unit,
            latest_schedule.id AS schedule_id,
            latest_schedule.scheduled_date,
            latest_schedule.scheduled_time,
            latest_schedule.verification_location,
            latest_schedule.status AS schedule_status,
            assigned_to.full_name AS assigned_to_name,
            assigned_by.full_name AS assigned_by_name
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN users owner
       ON owner.id = app.applicant_id
     JOIN instruments i
       ON i.id = app.instrument_id
     JOIN users assigned_to
       ON assigned_to.id = va.assigned_to_id
     LEFT JOIN users assigned_by
       ON assigned_by.id = va.assigned_by_id
     LEFT JOIN LATERAL (
       SELECT vs.*
       FROM verification_schedules vs
       WHERE vs.assignment_id = va.id
       ORDER BY vs.created_at DESC
       LIMIT 1
     ) latest_schedule ON TRUE
     ORDER BY va.created_at DESC`
  );

  return rows;
}

// LMO/GATC: get only assignments assigned to them
async function findAssignmentsByAssigneeId(userId) {
  const { rows } = await pool.query(
    `SELECT va.*,
            app.application_number,
            app.application_type,
            app.status AS application_status,
            app.purpose AS application_purpose,
            app.remarks AS application_remarks,
            app.applicant_id,
            owner.full_name AS applicant_name,
            owner.email AS applicant_email,
            i.id AS instrument_id,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number,
            i.location_address,
            i.capacity,
            i.capacity_unit,
            latest_schedule.id AS schedule_id,
            latest_schedule.scheduled_date,
            latest_schedule.scheduled_time,
            latest_schedule.verification_location,
            latest_schedule.status AS schedule_status
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN users owner
       ON owner.id = app.applicant_id
     JOIN instruments i
       ON i.id = app.instrument_id
     LEFT JOIN LATERAL (
       SELECT vs.*
       FROM verification_schedules vs
       WHERE vs.assignment_id = va.id
       ORDER BY vs.created_at DESC
       LIMIT 1
     ) latest_schedule ON TRUE
     WHERE va.assigned_to_id = $1
     ORDER BY va.created_at DESC`,
    [userId]
  );

  return rows;
}

// Get one assignment
async function findAssignmentById(id) {
  const { rows } = await pool.query(
    `SELECT va.*,
            app.application_number,
            app.application_type,
            app.status AS application_status,
            app.purpose AS application_purpose,
            app.remarks AS application_remarks,
            app.applicant_id,
            owner.full_name AS applicant_name,
            owner.email AS applicant_email,
            owner.phone AS applicant_phone,
            i.id AS instrument_id,
            i.instrument_name,
            i.manufacturer,
            i.model,
            i.serial_number,
            i.location_address,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            latest_schedule.id AS schedule_id,
            latest_schedule.scheduled_date,
            latest_schedule.scheduled_time,
            latest_schedule.verification_location,
            latest_schedule.status AS schedule_status,
            assigned_to.full_name AS assigned_to_name,
            assigned_by.full_name AS assigned_by_name
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN users owner
       ON owner.id = app.applicant_id
     JOIN instruments i
       ON i.id = app.instrument_id
     JOIN users assigned_to
       ON assigned_to.id = va.assigned_to_id
     LEFT JOIN users assigned_by
       ON assigned_by.id = va.assigned_by_id
     LEFT JOIN LATERAL (
       SELECT vs.*
       FROM verification_schedules vs
       WHERE vs.assignment_id = va.id
       ORDER BY vs.created_at DESC
       LIMIT 1
     ) latest_schedule ON TRUE
     WHERE va.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Assigned officer can update assignment status
async function updateAssignmentStatus(id, status, remarks) {
  const { rows } = await pool.query(
    `UPDATE verification_assignments
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
  findApplicationById,
  findUserById,
  createAssignment,
  findAllAssignments,
  findAssignmentsByAssigneeId,
  findAssignmentById,
  updateAssignmentStatus,
  updateApplicationStatus,
};