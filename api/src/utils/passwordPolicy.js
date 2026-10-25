// api/src/utils/passwordPolicy.js
//
// Minimal password policy: 8–128 characters with at least one letter and one
// digit. Length is capped because bcrypt only uses the first 72 bytes.

const ApiError = require('./ApiError');

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw ApiError.badRequest('Password must be between 8 and 128 characters');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw ApiError.badRequest('Password must contain at least one letter and one digit');
  }
}

module.exports = { validatePasswordStrength };
