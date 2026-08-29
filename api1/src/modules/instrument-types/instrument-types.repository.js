const pool = require('../../pool');

async function findActiveInstrumentTypes() {
  const { rows } = await pool.query(
    `SELECT id, name, description, default_unit
     FROM instrument_types
     WHERE is_active = TRUE
     ORDER BY name`
  );

  return rows;
}

module.exports = {
  findActiveInstrumentTypes,
};
