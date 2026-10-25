// api/src/modules/users/users.repository.js
//
// SQL for user administration and profile management. Login/registration
// SQL stays in modules/auth/auth.repository.js.

const pool = require('../../pool');

const USER_COLUMNS = `
  u.id, u.full_name, u.email, u.phone, u.status,
  u.organization_name, u.address, u.lcr_number, u.applicant_type,
  u.created_at, u.updated_at, u.preferred_language, u.notify_email, u.notify_sms, r.name AS role`;

async function findById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT ${USER_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findPasswordHashById(id) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
  return rows[0]?.password_hash || null;
}

async function list({ status, role, search, limit, offset }) {
  const where = [];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`u.status = $${params.length}`);
  }
  if (role) {
    params.push(role);
    where.push(`r.name = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.organization_name ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users u JOIN roles r ON r.id = u.role_id ${whereSql}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}
     FROM users u JOIN roles r ON r.id = u.role_id
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total: countRows[0].total };
}

async function setStatus(client, id, status) {
  const { rows } = await client.query(
    'UPDATE users SET status = $2 WHERE id = $1 RETURNING id',
    [id, status]
  );
  return rows[0] || null;
}

async function updateProfile(id, { fullName, phone, organizationName, address, preferredLanguage, notifyEmail, notifySms }) {
  const { rows } = await pool.query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone = COALESCE($3, phone),
       organization_name = COALESCE($4, organization_name),
       address = COALESCE($5, address),
       preferred_language = COALESCE($6, preferred_language),
       notify_email = COALESCE($7, notify_email),
       notify_sms = COALESCE($8, notify_sms)
     WHERE id = $1
     RETURNING id`,
    [id, fullName ?? null, phone ?? null, organizationName ?? null, address ?? null, preferredLanguage ?? null, notifyEmail ?? null, notifySms ?? null]
  );
  return rows[0] || null;
}

async function setPasswordHash(client, id, passwordHash) {
  await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

module.exports = { findById, findPasswordHashById, list, setStatus, updateProfile, setPasswordHash };
