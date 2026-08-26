// api/src/reset.js
//
// DEV-ONLY. Drops every table in the public schema so you can re-run
// `node src/migrate.js` from a clean slate. Refuses to run if
// NODE_ENV=production as a basic safety rail.
//
// Run with: node src/reset.js  (or `npm run reset` once that script exists)

const pool = require('./pool');
const logger = require('./utils/logger');

async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run reset.js with NODE_ENV=production.');
  }

  const client = await pool.connect();
  try {
    logger.warn('Dropping all tables in the public schema...');

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    logger.info('All tables dropped. Run `node src/migrate.js` to rebuild the schema.');
  } finally {
    client.release();
  }
}

resetDatabase()
  .then(() => pool.end())
  .catch((err) => {
    logger.error('Reset failed:', err.message);
    pool.end().finally(() => process.exit(1));
  });
