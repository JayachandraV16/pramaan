const pool = require('../../pool');

async function findInstrumentById(id) {
  const { rows } = await pool.query(
    `SELECT id, owner_id, status
     FROM instruments
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

async function createApplication({
  applicationNumber,
  applicantId,
  instrumentId,
  applicationType,
  purpose,
  remarks,
}) {
  const { rows } = await pool.query(
    `INSERT INTO verification_applications (
      application_number,
      applicant_id,
      instrument_id,
      application_type,
      status,
      purpose,
      remarks,
      submitted_at
    )
    VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, $6, NOW())
    RETURNING *`,
    [
      applicationNumber,
      applicantId,
      instrumentId,
      applicationType,
      purpose || null,
      remarks || null,
    ]
  );

  return rows[0];
}

async function findApplicationsByApplicantId(applicantId) {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     WHERE va.applicant_id = $1
     ORDER BY va.created_at DESC`,
    [applicantId]
  );

  return rows;
}

async function findAllApplications() {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number,
            u.full_name AS applicant_name
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     JOIN users u ON u.id = va.applicant_id
     ORDER BY va.created_at DESC`
  );

  return rows;
}

async function findApplicationById(id) {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number,
            u.full_name AS applicant_name
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     JOIN users u ON u.id = va.applicant_id
     WHERE va.id = $1`,
    [id]
  );

  return rows[0] || null;
}

module.exports = {
  findInstrumentById,
  createApplication,
  findApplicationsByApplicantId,
  findAllApplications,
  findApplicationById,
};