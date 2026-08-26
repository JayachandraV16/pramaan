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
            it.name AS instrument_type_name
     FROM instruments i
     JOIN instrument_types it ON it.id = i.instrument_type_id
     WHERE i.id = $1`,
    [id]
  );

  return rows[0] || null;
}

async function findInstrumentsByOwnerId(ownerId) {
  const { rows } = await pool.query(
    `SELECT i.*,
            it.name AS instrument_type_name
     FROM instruments i
     JOIN instrument_types it ON it.id = i.instrument_type_id
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
            u.full_name AS owner_name
     FROM instruments i
     JOIN instrument_types it ON it.id = i.instrument_type_id
     JOIN users u ON u.id = i.owner_id
     ORDER BY i.created_at DESC`
  );

  return rows;
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
  findAllInstruments,
};