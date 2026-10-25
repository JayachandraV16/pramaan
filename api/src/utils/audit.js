// api/src/utils/audit.js
//
// Tamper-evident audit trail. Each row stores
//   hash = SHA-256( prev_hash | actor | action | entity | details | time )
// so editing or removing a past row breaks every later hash (see
// verifyChain). The table itself blocks UPDATE/DELETE (migration 019).
//
// record() must be given a client that is inside the same transaction as the
// change being audited, so the audit row and the change commit together.

const pool = require('../pool');
const { sha256Hex } = require('./integrity');

// Arbitrary constant; serialises writers so the chain stays linear.
const AUDIT_LOCK_KEY = 727001;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function computeHash({ prevHash, actorId, action, entityType, entityId, details, occurredAt }) {
  return sha256Hex(
    [
      prevHash || '',
      actorId || '',
      action,
      entityType,
      entityId || '',
      stableStringify(details || {}),
      new Date(occurredAt).toISOString(),
    ].join('|')
  );
}

async function record(client, { actorId = null, action, entityType, entityId = null, details = {} }) {
  // Normalise to plain JSON first (Dates -> ISO strings, undefined dropped) so
  // the hashed value is exactly what is stored and later read back.
  details = JSON.parse(JSON.stringify(details || {}));
  await client.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_LOCK_KEY]);
  const { rows: last } = await client.query(
    'SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1'
  );
  const prevHash = last[0]?.hash || null;

  // Use the database clock so the stored timestamp and hashed timestamp match.
  const { rows: now } = await client.query(
    "SELECT date_trunc('milliseconds', clock_timestamp()) AS t"
  );
  const occurredAt = now[0].t;

  const hash = computeHash({
    prevHash, actorId, action, entityType, entityId: entityId && String(entityId), details, occurredAt,
  });

  const { rows } = await client.query(
    `INSERT INTO audit_log
       (occurred_at, actor_id, action, entity_type, entity_id, details, prev_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING id, hash`,
    [occurredAt, actorId, action, entityType, entityId && String(entityId),
      JSON.stringify(details || {}), prevHash, hash]
  );
  return rows[0];
}

// Convenience wrapper for callers without their own transaction.
async function recordStandalone(entry) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await record(client, entry);
    await client.query('COMMIT');
    return row;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Recomputes the whole chain. Returns { valid, checked, brokenAtId }.
async function verifyChain() {
  const { rows } = await pool.query('SELECT * FROM audit_log ORDER BY id ASC');
  let prev = null;
  for (const row of rows) {
    const expected = computeHash({
      prevHash: prev,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
      occurredAt: row.occurred_at,
    });
    if (row.prev_hash !== prev || row.hash !== expected) {
      return { valid: false, checked: rows.length, brokenAtId: Number(row.id) };
    }
    prev = row.hash;
  }
  return { valid: true, checked: rows.length, brokenAtId: null };
}

module.exports = { record, recordStandalone, verifyChain, computeHash };
