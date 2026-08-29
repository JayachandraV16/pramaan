// api/src/reset.js
//
// DEV-ONLY database reset.
//
// Removes all application tables, views, sequences, and custom types
// from the public schema so migrations can run from a clean state.
//
// Refuses to run if NODE_ENV=production.
//

const pool = require('./pool');
const logger = require('./utils/logger');

async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run reset.js with NODE_ENV=production.'
    );
  }

  const client = await pool.connect();

  try {
    logger.warn(
      'Resetting development database. All application data will be deleted...'
    );

    await client.query('BEGIN');

    // --------------------------------------------------
    // Drop all views
    // --------------------------------------------------
    logger.info('Dropping views...');

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT table_name
          FROM information_schema.views
          WHERE table_schema = 'public'
        LOOP
          EXECUTE
            'DROP VIEW IF EXISTS public.'
            || quote_ident(r.table_name)
            || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // --------------------------------------------------
    // Drop all tables
    // --------------------------------------------------
    logger.info('Dropping tables...');

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
        LOOP
          EXECUTE
            'DROP TABLE IF EXISTS public.'
            || quote_ident(r.tablename)
            || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // --------------------------------------------------
    // Drop remaining sequences
    // --------------------------------------------------
    logger.info('Dropping sequences...');

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT sequence_name
          FROM information_schema.sequences
          WHERE sequence_schema = 'public'
        LOOP
          EXECUTE
            'DROP SEQUENCE IF EXISTS public.'
            || quote_ident(r.sequence_name)
            || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // --------------------------------------------------
    // Drop custom ENUM types
    // This fixes:
    // type "role_name" already exists
    // --------------------------------------------------
    logger.info('Dropping custom ENUM types...');

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT t.typname
          FROM pg_type t
          JOIN pg_namespace n
            ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typtype = 'e'
        LOOP
          EXECUTE
            'DROP TYPE IF EXISTS public.'
            || quote_ident(r.typname)
            || ' CASCADE';
        END LOOP;
      END $$;
    `);

    await client.query('COMMIT');

    logger.info(
      'Database reset successfully. Run `npm run migrate` to rebuild the schema.'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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