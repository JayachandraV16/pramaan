// api/src/seed.js
//
// Development seed runner.
//
// Executes all .sql files inside:
// src/db/seeds
//
// Files run in alphabetical order.
//

const fs = require('fs');
const path = require('path');

const pool = require('./pool');
const logger = require('./utils/logger');

const SEEDS_DIR = path.join(__dirname, 'db', 'seeds');

async function runSeeds() {
  if (!fs.existsSync(SEEDS_DIR)) {
    throw new Error(
      `Seeds directory not found: ${SEEDS_DIR}`
    );
  }

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    logger.warn(`No seed files found in ${SEEDS_DIR}`);
    return;
  }

  const client = await pool.connect();

  try {
    for (const file of files) {
      const filePath = path.join(SEEDS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      logger.info(`Running seed: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        logger.info(`Seed completed successfully: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');

        throw new Error(
          `Seed failed: ${file} — ${err.message}`
        );
      }
    }

    logger.info('All seed files completed successfully.');
  } finally {
    client.release();
  }
}

runSeeds()
  .then(() => pool.end())
  .catch((err) => {
    logger.error('Seed run failed:', err.message);

    pool.end().finally(() => process.exit(1));
  });