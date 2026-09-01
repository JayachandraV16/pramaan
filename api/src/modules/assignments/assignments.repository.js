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
            i.instrument_name,
            i.serial_number AS instrument_serial,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.phone, applicant.phone) AS owner_phone,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            assigned_to.full_name AS assigned_to_name,
            assigned_by.full_name AS assigned_by_name
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN instruments i
       ON i.id = app.instrument_id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     JOIN users assigned_to
       ON assigned_to.id = va.assigned_to_id
     LEFT JOIN users assigned_by
       ON assigned_by.id = va.assigned_by_id
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
            i.instrument_name,
            i.serial_number AS instrument_serial,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.phone, applicant.phone) AS owner_phone,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            assigned_to.full_name AS assigned_to_name,
            assigned_by.full_name AS assigned_by_name
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN instruments i
       ON i.id = app.instrument_id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     JOIN users assigned_to
       ON assigned_to.id = va.assigned_to_id
     LEFT JOIN users assigned_by
       ON assigned_by.id = va.assigned_by_id
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
            i.instrument_name,
            i.serial_number AS instrument_serial,
            COALESCE(i.location_address, owner.address, applicant.address) AS location_address,
            COALESCE(owner.full_name, applicant.full_name) AS owner_name,
            COALESCE(owner.phone, applicant.phone) AS owner_phone,
            COALESCE(owner.organization_name, applicant.organization_name) AS owner_organization,
            assigned_to.full_name AS assigned_to_name,
            assigned_by.full_name AS assigned_by_name
     FROM verification_assignments va
     JOIN verification_applications app
       ON app.id = va.application_id
     JOIN instruments i
       ON i.id = app.instrument_id
     LEFT JOIN users owner
       ON owner.id = i.owner_id
     LEFT JOIN users applicant
       ON applicant.id = app.applicant_id
     JOIN users assigned_to
       ON assigned_to.id = va.assigned_to_id
     LEFT JOIN users assigned_by
       ON assigned_by.id = va.assigned_by_id
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

async function findAvailableOfficers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.organization_name,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('LMO', 'GATC') AND u.status = 'ACTIVE'
     ORDER BY u.full_name ASC`
  );

  return rows;
}

module.exports = {
  findApplicationById,
  findUserById,
  findAvailableOfficers,
  createAssignment,
  findAllAssignments,
  findAssignmentsByAssigneeId,
  findAssignmentById,
  updateAssignmentStatus,
  updateApplicationStatus,
};