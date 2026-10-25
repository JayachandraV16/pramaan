// api/src/utils/jwt.js
//
// Thin wrapper around jsonwebtoken. Keep the token payload minimal: only
// { id, role }. Never put password_hash or a full user row in the token.

const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signToken, verifyToken };
