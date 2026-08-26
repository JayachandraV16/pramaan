// api/src/migrate.js
//
// Minimal migration runner. No node-pg-migrate/knex — just: read .sql
// files from api/migrations/, apply any not yet in schema_migrations, in
// filename order, each inside its own transaction.
//
// Migration filenames MUST sort in the order they should run — use a
// zero-padded numeric prefix: 001_create_users.sql, 002_create_instruments.sql, etc.
//
// Run with: node src/migrate.js  (or `npm run migrate` once that script exists)

const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const logger = require('./utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'db', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY id');
  return new Set(rows.map((r) => r.name));
}

async function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const client = await pool.connect();
  let appliedCount = 0;

  try {
    await ensureMigrationsTable(client);
    const alreadyApplied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.warn(`No .sql files found in ${MIGRATIONS_DIR}`);
      return;
    }

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        logger.debug(`Skipping already-applied migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info(`Applying migration: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed: ${file} — ${err.message}`);
      }
    }

    if (appliedCount === 0) {
      logger.info('No new migrations to apply. Database is up to date.');
    } else {
      logger.info(`Applied ${appliedCount} migration(s) successfully.`);
    }
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    logger.error('Migration run failed:', err.message);
    pool.end().finally(() => process.exit(1));
  });
