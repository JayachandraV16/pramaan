// api/src/demoUsers.js
//
// DEVELOPMENT ONLY. Creates three clearly named demo accounts so the full
// owner -> admin -> officer -> certificate flow can be demonstrated:
//   demo.admin@pramaan.local, demo.owner@pramaan.local, demo.lmo@pramaan.local
//
//   npm run demo:users                      create missing accounts, print the password once
//   npm run demo:users -- --reset-password  also set a new password on the existing demo accounts
//   DEMO_PASSWORD=...  use your own password (8+ chars, a letter and a digit)
//
// It never touches any other user, never deletes anything and refuses to run
// when NODE_ENV=production. Remove the accounts before a real deployment.

require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('./pool');
const config = require('./config');
const { validatePasswordStrength } = require('./utils/passwordPolicy');

const DEMO_USERS = [
  { email: 'demo.admin@pramaan.local', role: 'ADMIN', name: 'Demo Administrator', org: 'Legal Metrology Department (demo)' },
  { email: 'demo.owner@pramaan.local', role: 'INSTRUMENT_OWNER', name: 'Demo Shop Owner', org: 'Demo Kirana Store' },
  { email: 'demo.lmo@pramaan.local', role: 'LMO', name: 'Demo Legal Metrology Officer', org: 'Legal Metrology Department (demo)' },
];

function generatePassword() {
  // letters + digits, always satisfies the password policy
  return `Demo-${crypto.randomBytes(6).toString('hex')}9`;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create demo accounts when NODE_ENV=production');
  }
  const reset = process.argv.includes('--reset-password');
  const password = process.env.DEMO_PASSWORD || generatePassword();
  validatePasswordStrength(password); // throws if DEMO_PASSWORD is too weak
  const hash = await bcrypt.hash(password, config.bcryptSaltRounds);

  const created = [];
  const kept = [];
  for (const u of DEMO_USERS) {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO users (role_id, full_name, email, password_hash, status, organization_name)
         SELECT r.id, $2, $3, $4, 'ACTIVE', $5 FROM roles r WHERE r.name = $1`,
        [u.role, u.name, u.email, hash, u.org]
      );
      created.push(u.email);
    } else if (reset) {
      await pool.query("UPDATE users SET password_hash = $2, status = 'ACTIVE' WHERE email = $1", [u.email, hash]);
      created.push(`${u.email} (password reset)`);
    } else {
      kept.push(u.email);
    }
  }

  console.log('\nDemo accounts');
  created.forEach((e) => console.log('  created  ', e));
  kept.forEach((e) => console.log('  unchanged', e, '(use --reset-password to set a new password)'));
  if (created.length) console.log(`\nPassword for the accounts above: ${password}\n(shown once - it is not stored anywhere)\n`);
}

main()
  .catch((err) => {
    console.error('demo:users failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
