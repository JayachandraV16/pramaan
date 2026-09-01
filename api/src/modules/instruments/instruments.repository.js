const pool = require('../../pool');

async function findInstrumentTypeById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, description, default_unit
     FROM instrument_types
     WHERE id = $1 AND is_active = TRUE`,
    [id]
  );

  return rows[0] || null;
}

async function createInstrument({
  ownerId,
  instrumentTypeId,
  instrumentName,
  manufacturer,
  model,
  serialNumber,
  capacity,
  capacityUnit,
  accuracyClass,
  locationAddress,
  locationLat,
  locationLng,
}) {
  const { rows } = await pool.query(
    `INSERT INTO instruments (
      owner_id,
      instrument_type_id,
      instrument_name,
      manufacturer,
      model,
      serial_number,
      capacity,
      capacity_unit,
      accuracy_class,
      location_address,
      location_lat,
      location_lng
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      ownerId,
      instrumentTypeId,
      instrumentName,
      manufacturer || null,
      model || null,
      serialNumber,
      capacity ?? null,
      capacityUnit || null,
      accuracyClass || null,
      locationAddress || null,
      locationLat ?? null,
      locationLng ?? null,
    ]
  );

  return rows[0];
}

async function findInstrumentById(id) {
  const { rows } = await pool.query(
    `SELECT i.*,
            it.name AS instrument_type_name,
            COALESCE(u.full_name, app_user.full_name) AS owner_name,
            COALESCE(u.phone, app_user.phone) AS owner_phone,
            COALESCE(u.email, app_user.email) AS owner_email,
            COALESCE(u.organization_name, app_user.organization_name) AS owner_organization,
            COALESCE(u.address, app_user.address) AS owner_address
     FROM instruments i
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users u ON u.id = i.owner_id
     LEFT JOIN LATERAL (
       SELECT va_user.full_name, va_user.phone, va_user.email, va_user.organization_name, va_user.address
       FROM verification_applications va
       JOIN users va_user ON va_user.id = va.applicant_id
       WHERE va.instrument_id = i.id
       ORDER BY va.created_at DESC
       LIMIT 1
     ) app_user ON true
     WHERE i.id = $1`,
    [id]
  );

  return rows[0] || null;
}

async function findInstrumentsByOwnerId(ownerId) {
  const { rows } = await pool.query(
    `SELECT i.*,
            it.name AS instrument_type_name,
            COALESCE(u.full_name, app_user.full_name) AS owner_name,
            COALESCE(u.phone, app_user.phone) AS owner_phone,
            COALESCE(u.email, app_user.email) AS owner_email,
            COALESCE(u.organization_name, app_user.organization_name) AS owner_organization,
            COALESCE(u.address, app_user.address) AS owner_address
     FROM instruments i
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users u ON u.id = i.owner_id
     LEFT JOIN LATERAL (
       SELECT va_user.full_name, va_user.phone, va_user.email, va_user.organization_name, va_user.address
       FROM verification_applications va
       JOIN users va_user ON va_user.id = va.applicant_id
       WHERE va.instrument_id = i.id
       ORDER BY va.created_at DESC
       LIMIT 1
     ) app_user ON true
     WHERE i.owner_id = $1
     ORDER BY i.created_at DESC`,
    [ownerId]
  );

  return rows;
}

async function findAllInstruments() {
  const { rows } = await pool.query(
    `SELECT i.*,
            it.name AS instrument_type_name,
            COALESCE(u.full_name, app_user.full_name) AS owner_name,
            COALESCE(u.phone, app_user.phone) AS owner_phone,
            COALESCE(u.email, app_user.email) AS owner_email,
            COALESCE(u.organization_name, app_user.organization_name) AS owner_organization,
            COALESCE(u.address, app_user.address) AS owner_address
     FROM instruments i
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users u ON u.id = i.owner_id
     LEFT JOIN LATERAL (
       SELECT va_user.full_name, va_user.phone, va_user.email, va_user.organization_name, va_user.address
       FROM verification_applications va
       JOIN users va_user ON va_user.id = va.applicant_id
       WHERE va.instrument_id = i.id
       ORDER BY va.created_at DESC
       LIMIT 1
     ) app_user ON true
     ORDER BY i.created_at DESC`
  );

  return rows;
}

async function findInstrumentsAssignedToOfficerId(officerId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT i.*,
            it.name AS instrument_type_name,
            COALESCE(u.full_name, app_user.full_name) AS owner_name,
            COALESCE(u.phone, app_user.phone) AS owner_phone,
            COALESCE(u.email, app_user.email) AS owner_email,
            COALESCE(u.organization_name, app_user.organization_name) AS owner_organization,
            COALESCE(u.address, app_user.address) AS owner_address
     FROM instruments i
     JOIN verification_applications va ON va.instrument_id = i.id
     JOIN verification_assignments vas ON vas.application_id = va.id
     LEFT JOIN instrument_types it ON it.id = i.instrument_type_id
     LEFT JOIN users u ON u.id = i.owner_id
     LEFT JOIN LATERAL (
       SELECT va_user.full_name, va_user.phone, va_user.email, va_user.organization_name, va_user.address
       FROM verification_applications va2
       JOIN users va_user ON va_user.id = va2.applicant_id
       WHERE va2.instrument_id = i.id
       ORDER BY va2.created_at DESC
       LIMIT 1
     ) app_user ON true
     WHERE vas.assigned_to_id = $1
     ORDER BY i.created_at DESC`,
    [officerId]
  );

  return rows;
}

async function isInstrumentAssignedToOfficer(instrumentId, officerId) {
  const { rows } = await pool.query(
    `SELECT vas.id
     FROM verification_assignments vas
     JOIN verification_applications va ON va.id = vas.application_id
     WHERE va.instrument_id = $1 AND vas.assigned_to_id = $2`,
    [instrumentId, officerId]
  );

  return rows.length > 0;
}

async function findInstrumentBySerialNumber(serialNumber) {
  const { rows } = await pool.query(
    `SELECT id FROM instruments WHERE serial_number = $1`,
    [serialNumber]
  );

  return rows[0] || null;
}

module.exports = {
  findInstrumentTypeById,
  findInstrumentBySerialNumber,
  createInstrument,
  findInstrumentById,
  findInstrumentsByOwnerId,
  findInstrumentsAssignedToOfficerId,
  isInstrumentAssignedToOfficer,
  findAllInstruments,
};