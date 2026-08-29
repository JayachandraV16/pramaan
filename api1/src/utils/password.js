// api/src/utils/password.js
//
// bcrypt hash/compare helpers. Never store or log plain-text passwords —
// always go through hashPassword before touching the DB.

const bcrypt = require('bcrypt');
const config = require('../config');

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
