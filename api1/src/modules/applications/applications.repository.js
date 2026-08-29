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
            i.serial_number,
            latest_assignment.assignment_id,
            latest_assignment.assigned_to_id,
            latest_assignment.assignment_status,
            latest_assignment.assignment_remarks,
            latest_result.verification_id,
            latest_result.verification_status,
            latest_result.verification_decision,
            latest_result.verification_remarks,
            latest_result.result_date,
            latest_certificate.certificate_id,
            latest_certificate.certificate_number,
            latest_certificate.certificate_file_url,
            latest_certificate.certificate_status
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN LATERAL (
       SELECT asn.id AS assignment_id,
              asn.assigned_to_id AS assigned_to_id,
              asn.status AS assignment_status,
              asn.remarks AS assignment_remarks
       FROM verification_assignments asn
       WHERE asn.application_id = va.id
       ORDER BY asn.created_at DESC
       LIMIT 1
     ) latest_assignment ON TRUE
     LEFT JOIN LATERAL (
       SELECT v.id AS verification_id,
              v.status AS verification_status,
              vr.decision AS verification_decision,
              vr.remarks AS verification_remarks,
              vr.result_date
       FROM verifications v
       LEFT JOIN verification_results vr
         ON vr.verification_id = v.id
       WHERE v.application_id = va.id
       ORDER BY
         CASE WHEN vr.result_date IS NOT NULL THEN 0 ELSE 1 END,
         vr.result_date DESC NULLS LAST,
         v.created_at DESC
       LIMIT 1
     ) latest_result ON TRUE
     LEFT JOIN LATERAL (
       SELECT vc.id AS certificate_id,
              vc.certificate_number,
              vc.certificate_file_url,
              vc.status AS certificate_status
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       WHERE v.application_id = va.id
       ORDER BY vc.created_at DESC
       LIMIT 1
     ) latest_certificate ON TRUE
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
            u.full_name AS applicant_name,
            latest_assignment.assignment_id,
            latest_assignment.assigned_to_id,
            latest_assignment.assignment_status,
            latest_assignment.assignment_remarks,
            latest_result.verification_id,
            latest_result.verification_status,
            latest_result.verification_decision,
            latest_result.verification_remarks,
            latest_result.result_date,
            latest_certificate.certificate_id,
            latest_certificate.certificate_number,
            latest_certificate.certificate_file_url,
            latest_certificate.certificate_status
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     JOIN users u ON u.id = va.applicant_id
     LEFT JOIN LATERAL (
       SELECT asn.id AS assignment_id,
              asn.assigned_to_id AS assigned_to_id,
              asn.status AS assignment_status,
              asn.remarks AS assignment_remarks
       FROM verification_assignments asn
       WHERE asn.application_id = va.id
       ORDER BY asn.created_at DESC
       LIMIT 1
     ) latest_assignment ON TRUE
     LEFT JOIN LATERAL (
       SELECT v.id AS verification_id,
              v.status AS verification_status,
              vr.decision AS verification_decision,
              vr.remarks AS verification_remarks,
              vr.result_date
       FROM verifications v
       LEFT JOIN verification_results vr
         ON vr.verification_id = v.id
       WHERE v.application_id = va.id
       ORDER BY
         CASE WHEN vr.result_date IS NOT NULL THEN 0 ELSE 1 END,
         vr.result_date DESC NULLS LAST,
         v.created_at DESC
       LIMIT 1
     ) latest_result ON TRUE
     LEFT JOIN LATERAL (
       SELECT vc.id AS certificate_id,
              vc.certificate_number,
              vc.certificate_file_url,
              vc.status AS certificate_status
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       WHERE v.application_id = va.id
       ORDER BY vc.created_at DESC
       LIMIT 1
     ) latest_certificate ON TRUE
     ORDER BY va.created_at DESC`
  );

  return rows;
}

async function findApplicationById(id) {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number,
            u.full_name AS applicant_name,
            latest_assignment.assignment_id,
            latest_assignment.assigned_to_id,
            latest_assignment.assignment_status,
            latest_assignment.assignment_remarks,
            latest_result.verification_id,
            latest_result.verification_status,
            latest_result.verification_decision,
            latest_result.verification_remarks,
            latest_result.result_date,
            latest_certificate.certificate_id,
            latest_certificate.certificate_number,
            latest_certificate.certificate_file_url,
            latest_certificate.certificate_status
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     JOIN users u ON u.id = va.applicant_id
     LEFT JOIN LATERAL (
       SELECT asn.id AS assignment_id,
              asn.assigned_to_id AS assigned_to_id,
              asn.status AS assignment_status,
              asn.remarks AS assignment_remarks
       FROM verification_assignments asn
       WHERE asn.application_id = va.id
       ORDER BY asn.created_at DESC
       LIMIT 1
     ) latest_assignment ON TRUE
     LEFT JOIN LATERAL (
       SELECT v.id AS verification_id,
              v.status AS verification_status,
              vr.decision AS verification_decision,
              vr.remarks AS verification_remarks,
              vr.result_date
       FROM verifications v
       LEFT JOIN verification_results vr
         ON vr.verification_id = v.id
       WHERE v.application_id = va.id
       ORDER BY
         CASE WHEN vr.result_date IS NOT NULL THEN 0 ELSE 1 END,
         vr.result_date DESC NULLS LAST,
         v.created_at DESC
       LIMIT 1
     ) latest_result ON TRUE
     LEFT JOIN LATERAL (
       SELECT vc.id AS certificate_id,
              vc.certificate_number,
              vc.certificate_file_url,
              vc.status AS certificate_status
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       WHERE v.application_id = va.id
       ORDER BY vc.created_at DESC
       LIMIT 1
     ) latest_certificate ON TRUE
     WHERE va.id = $1`,
    [id]
  );

  return rows[0] || null;
}

async function updateApplicationState(id, { status, purpose, remarks }) {
  const fields = [];
  const values = [];
  let index = 1;

  if (status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(status);
  }
  if (purpose !== undefined) {
    fields.push(`purpose = $${index++}`);
    values.push(purpose);
  }
  if (remarks !== undefined) {
    fields.push(`remarks = $${index++}`);
    values.push(remarks);
  }

  if (fields.length === 0) return findApplicationById(id);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE verification_applications
     SET ${fields.join(', ')}
     WHERE id = $${index}
     RETURNING *`,
    values
  );

  return findApplicationById(id);
}

async function findApplicationByNumberPublic(applicationNumber) {
  const { rows } = await pool.query(
    `SELECT va.id,
            va.application_number,
            va.application_type,
            va.status,
            va.purpose,
            va.remarks,
            va.submitted_at,
            va.created_at,
            i.instrument_name,
            i.serial_number,
            latest_result.verification_decision,
            latest_result.result_date,
            latest_certificate.certificate_number,
            latest_certificate.certificate_status
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN LATERAL (
       SELECT vr.decision AS verification_decision,
              vr.result_date
       FROM verifications v
       LEFT JOIN verification_results vr ON vr.verification_id = v.id
       WHERE v.application_id = va.id
       ORDER BY vr.result_date DESC NULLS LAST, v.created_at DESC
       LIMIT 1
     ) latest_result ON TRUE
     LEFT JOIN LATERAL (
       SELECT vc.certificate_number,
              vc.status AS certificate_status
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       WHERE v.application_id = va.id
       ORDER BY vc.created_at DESC
       LIMIT 1
     ) latest_certificate ON TRUE
     WHERE TRIM(UPPER(va.application_number)) = TRIM(UPPER($1))`,
    [applicationNumber]
  );

  return rows[0] || null;
}

module.exports = {
  findInstrumentById,
  createApplication,
  findApplicationsByApplicantId,
  findAllApplications,
  findApplicationById,
  updateApplicationState,
  findApplicationByNumberPublic,
};