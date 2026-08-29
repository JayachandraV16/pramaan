// api/src/config/index.js
//
// Central application configuration. Loads and validates process.env once,
// at boot, so a missing var fails loudly here instead of causing a confusing
// bug three layers deep later.
//
// This file does NOT own the DB connection — that's api/src/pool.js
// (Omraj). Keep it that way; don't duplicate pool/connection logic here.

require('dotenv').config();

const REQUIRED_ENV_VARS = ['JWT_SECRET'];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Check your .env against .env.example.'
  );
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
};

module.exports = config;
