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

// A real bcrypt hash (same cost as production hashes) of a random value.
// Compared against when a login names an unknown account so the response
// time does not reveal whether the email exists.
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(16).toString('hex'), config.bcryptSaltRounds);

module.exports = { hashPassword, comparePassword, DUMMY_HASH };
