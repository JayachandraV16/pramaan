const pool = require('../../pool');

async function findActiveOfficers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'ACTIVE'
       AND r.name IN ('LMO', 'GATC')
     ORDER BY r.name, u.full_name`
  );

  return rows;
}

module.exports = { findActiveOfficers };