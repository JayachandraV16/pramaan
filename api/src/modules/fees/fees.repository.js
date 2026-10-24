// api/src/modules/fees/fees.repository.js

const pool = require('../../pool');

async function findInstrumentForFees(instrumentId) {
  const { rows } = await pool.query(
    'SELECT id, owner_id, instrument_type_id, capacity FROM instruments WHERE id = $1',
    [instrumentId]
  );
  return rows[0] || null;
}

// Active rules whose effective window covers `onDate`, for the given
// application type; instrument-type / capacity matching is done in the service.
async function findCandidateRules(onDate) {
  const { rows } = await pool.query(
    `SELECT * FROM fee_rules
     WHERE is_active = TRUE
       AND effective_from <= $1::date
       AND (effective_to IS NULL OR effective_to >= $1::date)`,
    [onDate]
  );
  return rows;
}

async function listRules({ feeKind, instrumentTypeId, activeOnly }) {
  const where = [];
  const params = [];
  if (feeKind) {
    params.push(feeKind);
    where.push(`r.fee_kind = $${params.length}`);
  }
  if (instrumentTypeId) {
    params.push(instrumentTypeId);
    where.push(`r.instrument_type_id = $${params.length}`);
  }
  if (activeOnly) where.push('r.is_active = TRUE');

  const { rows } = await pool.query(
    `SELECT r.*, it.name AS instrument_type_name
     FROM fee_rules r
     LEFT JOIN instrument_types it ON it.id = r.instrument_type_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY r.fee_kind, it.name NULLS FIRST, r.min_capacity NULLS FIRST, r.effective_from DESC`,
    params
  );
  return rows;
}

async function findRuleById(id) {
  const { rows } = await pool.query('SELECT * FROM fee_rules WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createRule(client, data) {
  const { rows } = await client.query(
    `INSERT INTO fee_rules (
       fee_kind, instrument_type_id, application_type, min_capacity, max_capacity,
       amount, description, effective_from, effective_to, is_active, created_by_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE), $9, COALESCE($10, TRUE), $11)
     RETURNING *`,
    [
      data.feeKind,
      data.instrumentTypeId || null,
      data.applicationType || null,
      data.minCapacity ?? null,
      data.maxCapacity ?? null,
      data.amount,
      data.description || null,
      data.effectiveFrom || null,
      data.effectiveTo || null,
      data.isActive ?? null,
      data.createdById,
    ]
  );
  return rows[0];
}

async function updateRule(client, id, data) {
  const { rows } = await client.query(
    `UPDATE fee_rules SET
       amount = COALESCE($2, amount),
       description = COALESCE($3, description),
       effective_to = CASE WHEN $4::boolean THEN $5::date ELSE effective_to END,
       is_active = COALESCE($6, is_active)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.amount ?? null,
      data.description ?? null,
      data.effectiveTo !== undefined,
      data.effectiveTo || null,
      data.isActive ?? null,
    ]
  );
  return rows[0] || null;
}

module.exports = {
  findInstrumentForFees,
  findCandidateRules,
  listRules,
  findRuleById,
  createRule,
  updateRule,
};
