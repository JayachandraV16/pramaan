// api/src/pool.js
//
// The single PostgreSQL connection pool for the whole app. Every module's
// repository file imports THIS file — never creates its own `new Pool()`.
//
// Deliberately does NOT import ./config — config/index.js requires
// JWT_SECRET to exist, but migrate.js and reset.js are standalone scripts
// that have nothing to do with JWT. Keeping pool.js independent means the
// DB layer can be used/tested without the rest of the app config.
//
// Supports either a single DATABASE_URL, or discrete DB_* vars — use
// whichever your .env has. DATABASE_URL wins if both are set.

require('dotenv').config();
const { Pool, types } = require('pg');

// Return SQL DATE columns (issue_date, valid_until, scheduled_date, ...) as
// plain 'YYYY-MM-DD' strings. By default node-pg turns them into local-time
// Date objects, which JSON-serialise as a shifted UTC timestamp (a date in
// India would appear as the previous day at 18:30Z).
types.setTypeParser(1082, (value) => value);
const logger = require('./utils/logger');

const connectionString = process.env.DATABASE_URL;

if (!connectionString && !process.env.DB_HOST) {
  throw new Error(
    'Missing database config: set either DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME. ' +
      'Check your .env against .env.example.'
  );
}

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
);

// A dropped/broken idle connection shouldn't silently corrupt later
// queries — fail loudly instead.
pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
  process.exit(1);
});

module.exports = pool;
