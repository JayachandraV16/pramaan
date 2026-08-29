// api/src/modules/auth/auth.validation.js

const { ROLES } = require('../../config/roles');

// email and phone are each optional individually — the DB enforces
// "at least one of the two" via ck_users_email_or_phone. That can't be
// expressed by the flat validateBody() middleware, so it's checked
// explicitly in auth.service.js instead.
const registerRules = {
  fullName: { required: true, type: 'string' },
  password: { required: true, type: 'string' },
  role: { required: true, type: 'string' },
};

// MVP login is by email only. LMO/GATC mobile login-by-phone is a real
// future need (Section 7) but out of scope for Stage 0 — flagging so it
// doesn't get silently forgotten.
const loginRules = {
  email: { required: true, type: 'string' },
  password: { required: true, type: 'string' },
};

function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = { registerRules, loginRules, isValidRole };
