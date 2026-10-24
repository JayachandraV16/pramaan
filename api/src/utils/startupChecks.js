// api/src/utils/startupChecks.js
//
// Refuses to start a production server while development/demo accounts are
// active. The seeded dev.*@pramaan.local users (and the demo.* ones created by
// `npm run demo:users`) share passwords that appear in this repository, so an
// active one is an open door - above all the ADMIN.

const pool = require('../pool');

const DEV_DOMAIN = '@pramaan.local';

async function findActiveDevAccounts(db = pool) {
  const { rows } = await db.query(
    `SELECT u.email, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) LIKE $1 AND u.status = 'ACTIVE'
      ORDER BY u.email`,
    [`%${DEV_DOMAIN}`]
  );
  return rows;
}

async function assertNoDevAccounts({ isProduction, db = pool } = {}) {
  if (!isProduction) return [];
  const accounts = await findActiveDevAccounts(db);
  if (accounts.length > 0) {
    const list = accounts.map((a) => `${a.email} (${a.role})`).join(', ');
    throw new Error(
      `Refusing to start in production: development accounts are active: ${list}. ` +
        `Suspend them from the admin console or delete them before deploying.`
    );
  }
  return [];
}

module.exports = { findActiveDevAccounts, assertNoDevAccounts, DEV_DOMAIN };
