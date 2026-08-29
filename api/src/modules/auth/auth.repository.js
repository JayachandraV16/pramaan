// api/src/modules/auth/auth.repository.js
//
// All raw SQL for auth lives here. Rewritten to match the real schema
// (db/migrations/002_create_roles.sql, 003_create_users.sql,
// 018_add_metrology_domain_fields.sql):
//   - users.id is UUID (gen_random_uuid())
//   - role is a role_id -> roles.id FK, not a column on users
//   - email is nullable (CHECK: email IS NOT NULL OR phone IS NOT NULL)
//   - users.status (ACTIVE/INACTIVE/SUSPENDED) gates login
//   - users.lcr_number / users.applicant_type (migration 018), owner-only
//
// Every read joins roles to resolve the role name, since the rest of the
// app (JWT payload, RBAC middleware) works with role name strings.

const pool = require('../../pool');

async function findRoleIdByName(roleName) {
  const { rows } = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
  return rows[0]?.id || null;
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.password_hash, u.status,
            u.organization_name, u.address, u.lcr_number, u.applicant_type,
            u.created_at,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status,
            u.organization_name, u.address, u.lcr_number, u.applicant_type,
            u.created_at,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser({
  fullName,
  email,
  phone,
  passwordHash,
  roleId,
  organizationName,
  address,
  lcrNumber,
  applicantType,
}) {
  const { rows } = await pool.query(
    `INSERT INTO users (
      role_id, full_name, email, phone, password_hash,
      organization_name, address, lcr_number, applicant_type
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, full_name, email, phone, status, organization_name,
               address, lcr_number, applicant_type, created_at`,
    [
      roleId,
      fullName,
      email || null,
      phone || null,
      passwordHash,
      organizationName || null,
      address || null,
      lcrNumber || null,
      applicantType || null,
    ]
  );
  return rows[0];
}

module.exports = { findRoleIdByName, findUserByEmail, findUserById, createUser };