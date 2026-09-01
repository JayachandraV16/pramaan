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

async function findCertificateById(id) {
  const { rows } = await pool.query(
    `SELECT id, instrument_id, status
     FROM verification_certificates
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// --- Application number generation -----------------------------------
//
// LM/{year}/{division}/{sequence} — sequence is per (division, year),
// zero-padded to 6 digits, backed by application_number_counters
// (migration 018). Must be called with a `client` inside the SAME
// transaction as the following INSERT, so a failed insert rolls back the
// counter increment too — no skipped numbers on failure.
async function nextApplicationSequence(client, division, year) {
  const { rows } = await client.query(
    `INSERT INTO application_number_counters (division, year, last_sequence)
     VALUES ($1, $2, 1)
     ON CONFLICT (division, year)
     DO UPDATE SET last_sequence = application_number_counters.last_sequence + 1
     RETURNING last_sequence`,
    [division, year]
  );

  return rows[0].last_sequence;
}

function formatApplicationNumber(year, division, sequence) {
  const paddedSequence = String(sequence).padStart(6, '0');
  return `LM/${year}/${division}/${paddedSequence}`;
}

async function createApplication({
  applicantId,
  instrumentId,
  applicationType,
  purpose,
  remarks,
  division,
  submissionOffice,
  instrumentOrigin,
  grasChallanNumber,
  grasChallanDate,
  conveyanceFee,
  quarterJumpFee,
  lastCertificateId,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const year = new Date().getFullYear();
    const sequence = await nextApplicationSequence(client, division, year);
    const applicationNumber = formatApplicationNumber(year, division, sequence);

    const { rows } = await client.query(
      `INSERT INTO verification_applications (
        application_number,
        applicant_id,
        instrument_id,
        application_type,
        status,
        purpose,
        remarks,
        submitted_at,
        division,
        submission_office,
        instrument_origin,
        gras_challan_number,
        gras_challan_date,
        conveyance_fee,
        quarter_jump_fee,
        last_certificate_id
      )
      VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        applicationNumber,
        applicantId,
        instrumentId,
        applicationType,
        purpose || null,
        remarks || null,
        division,
        submissionOffice || null,
        instrumentOrigin || null,
        grasChallanNumber || null,
        grasChallanDate || null,
        conveyanceFee ?? null,
        quarterJumpFee ?? null,
        lastCertificateId || null,
      ]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findApplicationsByApplicantId(applicantId) {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number,
            i.manufacturer,
            i.model,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            i.location_address,
            i.location_lat,
            i.location_lng,
            it.name AS instrument_type_name,
            owner.full_name AS owner_name,
            owner.phone AS owner_phone,
            owner.email AS owner_email,
            owner.organization_name AS owner_organization,
            owner.address AS owner_address,
            u.full_name AS applicant_name,
            u.phone AS applicant_phone,
            u.email AS applicant_email,
            u.organization_name AS applicant_organization
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users owner ON owner.id = i.owner_id
     JOIN users u ON u.id = va.applicant_id
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
            i.manufacturer,
            i.model,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            i.location_address,
            i.location_lat,
            i.location_lng,
            it.name AS instrument_type_name,
            owner.full_name AS owner_name,
            owner.phone AS owner_phone,
            owner.email AS owner_email,
            owner.organization_name AS owner_organization,
            owner.address AS owner_address,
            u.full_name AS applicant_name,
            u.phone AS applicant_phone,
            u.email AS applicant_email,
            u.organization_name AS applicant_organization
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users owner ON owner.id = i.owner_id
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
            i.manufacturer,
            i.model,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            i.location_address,
            i.location_lat,
            i.location_lng,
            it.name AS instrument_type_name,
            owner.full_name AS owner_name,
            owner.phone AS owner_phone,
            owner.email AS owner_email,
            owner.organization_name AS owner_organization,
            owner.address AS owner_address,
            u.full_name AS applicant_name,
            u.phone AS applicant_phone,
            u.email AS applicant_email,
            u.organization_name AS applicant_organization
     FROM verification_applications va
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users owner ON owner.id = i.owner_id
     JOIN users u ON u.id = va.applicant_id
     WHERE va.id = $1`,
    [id]
  );

  return rows[0] || null;
}

async function findApplicationsAssignedToOfficerId(officerId) {
  const { rows } = await pool.query(
    `SELECT va.*,
            i.instrument_name,
            i.serial_number,
            i.manufacturer,
            i.model,
            i.capacity,
            i.capacity_unit,
            i.accuracy_class,
            i.location_address,
            i.location_lat,
            i.location_lng,
            it.name AS instrument_type_name,
            owner.full_name AS owner_name,
            owner.phone AS owner_phone,
            owner.email AS owner_email,
            owner.organization_name AS owner_organization,
            owner.address AS owner_address,
            u.full_name AS applicant_name,
            u.phone AS applicant_phone,
            u.email AS applicant_email,
            u.organization_name AS applicant_organization
     FROM verification_applications va
     JOIN verification_assignments vas ON vas.application_id = va.id
     JOIN instruments i ON i.id = va.instrument_id
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users owner ON owner.id = i.owner_id
     JOIN users u ON u.id = va.applicant_id
     WHERE vas.assigned_to_id = $1
     ORDER BY va.created_at DESC`,
    [officerId]
  );

  return rows;
}

async function isApplicationAssignedToOfficer(applicationId, officerId) {
  const { rows } = await pool.query(
    `SELECT id FROM verification_assignments
     WHERE application_id = $1 AND assigned_to_id = $2`,
    [applicationId, officerId]
  );

  return rows.length > 0;
}

module.exports = {
  findInstrumentById,
  findCertificateById,
  createApplication,
  findApplicationsByApplicantId,
  findApplicationsAssignedToOfficerId,
  isApplicationAssignedToOfficer,
  findAllApplications,
  findApplicationById,
};