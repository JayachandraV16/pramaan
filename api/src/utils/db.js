// api/src/utils/db.js
//
// withTransaction(fn): runs fn(client) between BEGIN and COMMIT on a dedicated
// pooled connection, rolling back (and rethrowing) if fn throws. Use it for any
// operation that changes more than one row/table so a failure part-way cannot
// leave half-applied state.

const pool = require('../pool');

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
