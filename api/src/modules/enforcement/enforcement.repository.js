// api/src/modules/enforcement/enforcement.repository.js
// Parameterised SQL only; business rules live in enforcement.service.js.

const pool = require('../../pool');

async function nextCaseNumber(client, year) {
  const { rows } = await client.query(
    `INSERT INTO enforcement_case_counters (year, last_sequence)
     VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_sequence = enforcement_case_counters.last_sequence + 1
     RETURNING last_sequence`,
    [year]
  );
  return `ENF-${year}-${String(rows[0].last_sequence).padStart(6, '0')}`;
}

// Serialises concurrent registrations for the same offender so offence_number
// (the nth offence) cannot be assigned twice.
async function lockOffender(client, offenderKey) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [offenderKey]);
}

async function countCountedOffences(client, offenderKey) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM enforcement_cases
     WHERE offender_key = $1 AND offence_type <> 'NONE' AND status <> 'DISMISSED'`,
    [offenderKey]
  );
  return rows[0].n;
}

async function insertCase(client, c) {
  const { rows } = await client.query(
    `INSERT INTO enforcement_cases (
       case_number, source, offence_type, status, offender_key, subject_user_id, subject_name,
       subject_organization, subject_phone, instrument_id, certificate_id, description, location,
       latitude, longitude, detected_on, detected_by_id, offence_number, resolved_at, resolution_note
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16::date, CURRENT_DATE), $17, $18, $19, $20
     ) RETURNING *`,
    [
      c.caseNumber, c.source, c.offenceType, c.status, c.offenderKey, c.subjectUserId, c.subjectName,
      c.subjectOrganization, c.subjectPhone, c.instrumentId, c.certificateId, c.description, c.location,
      c.latitude, c.longitude, c.detectedOn, c.detectedById, c.offenceNumber, c.resolvedAt, c.resolutionNote,
    ]
  );
  return rows[0];
}

async function insertEvent(client, { caseId, fromStatus, toStatus, note, actorId }) {
  await client.query(
    `INSERT INTO enforcement_case_events (case_id, from_status, to_status, note, actor_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [caseId, fromStatus, toStatus, note || null, actorId]
  );
}

async function findByIdForUpdate(client, id) {
  const { rows } = await client.query('SELECT * FROM enforcement_cases WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] || null;
}

async function applyStatus(client, id, { status, penaltyAmount, penaltyReference, resolutionNote, resolvedAt }) {
  const { rows } = await client.query(
    `UPDATE enforcement_cases
        SET status = $2,
            penalty_amount = COALESCE($3, penalty_amount),
            penalty_reference = COALESCE($4, penalty_reference),
            resolution_note = COALESCE($5, resolution_note),
            resolved_at = COALESCE($6, resolved_at)
      WHERE id = $1 RETURNING *`,
    [id, status, penaltyAmount ?? null, penaltyReference ?? null, resolutionNote ?? null, resolvedAt ?? null]
  );
  return rows[0];
}

const CASE_SELECT = `
  SELECT c.*, d.full_name AS detected_by_name, i.instrument_name, i.serial_number,
         vc.certificate_number, o.flag AS offender_flag, o.offences_12m AS offender_offences_12m
    FROM enforcement_cases c
    JOIN users d ON d.id = c.detected_by_id
    LEFT JOIN instruments i ON i.id = c.instrument_id
    LEFT JOIN verification_certificates vc ON vc.id = c.certificate_id
    LEFT JOIN repeat_offenders o ON o.offender_key = c.offender_key`;

async function findById(id) {
  const { rows } = await pool.query(`${CASE_SELECT} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

// scope: { all: true } | { detectedBy } | { subjectUserId }
async function listCases(scope) {
  const where = [];
  const params = [];
  if (scope.detectedBy) {
    params.push(scope.detectedBy);
    where.push(`c.detected_by_id = $${params.length}`);
  }
  if (scope.subjectUserId) {
    params.push(scope.subjectUserId);
    where.push(`c.subject_user_id = $${params.length}`, `c.offence_type <> 'NONE'`);
  }
  const { rows } = await pool.query(
    `${CASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.created_at DESC`,
    params
  );
  return rows;
}

async function findEvents(caseId) {
  const { rows } = await pool.query(
    `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.full_name AS actor_name
       FROM enforcement_case_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.case_id = $1 ORDER BY e.created_at, e.id`,
    [caseId]
  );
  return rows;
}

async function offenderStanding(client, offenderKey) {
  const { rows } = await client.query('SELECT * FROM repeat_offenders WHERE offender_key = $1', [offenderKey]);
  return rows[0] || null;
}

async function listOffenders({ flags }) {
  const { rows } = await pool.query(
    `SELECT * FROM repeat_offenders WHERE flag = ANY($1::text[])
      ORDER BY offences_12m DESC, last_offence_on DESC NULLS LAST`,
    [flags]
  );
  return rows;
}

async function findInstrument(id) {
  const { rows } = await pool.query('SELECT id, owner_id, instrument_name FROM instruments WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findCertificate(id) {
  const { rows } = await pool.query('SELECT id, instrument_id FROM verification_certificates WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findUser(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.organization_name, u.phone, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findAdminIds(client) {
  const { rows } = await client.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'`
  );
  return rows.map((r) => r.id);
}

async function summary() {
  const q = (sql) => pool.query(sql).then((r) => r.rows);
  const [byStatus, byType, bySource, monthly, totals, flags] = await Promise.all([
    q(`SELECT status, COUNT(*)::int AS count FROM enforcement_cases GROUP BY status`),
    q(`SELECT offence_type, COUNT(*)::int AS count FROM enforcement_cases WHERE offence_type <> 'NONE' GROUP BY offence_type ORDER BY count DESC`),
    q(`SELECT source, COUNT(*)::int AS count FROM enforcement_cases GROUP BY source`),
    q(`SELECT to_char(date_trunc('month', detected_on), 'YYYY-MM') AS month, COUNT(*)::int AS cases
         FROM enforcement_cases WHERE detected_on >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY 1 ORDER BY 1`),
    q(`SELECT COUNT(*) FILTER (WHERE status IN ('OPEN', 'NOTICE_ISSUED'))::int AS open_cases,
              COUNT(*) FILTER (WHERE offence_type = 'NONE')::int AS compliant_spot_checks,
              COALESCE(SUM(penalty_amount) FILTER (WHERE status IN ('PENALTY_IMPOSED', 'RESOLVED')), 0)::numeric(12,2) AS penalties_total
         FROM enforcement_cases`),
    q(`SELECT flag, COUNT(*)::int AS count FROM repeat_offenders GROUP BY flag`),
  ]);
  return { byStatus, byType, bySource, monthly, totals: totals[0], offenderFlags: flags };
}

module.exports = {
  nextCaseNumber, lockOffender, countCountedOffences, insertCase, insertEvent, findByIdForUpdate,
  applyStatus, findById, listCases, findEvents, offenderStanding, listOffenders, findInstrument,
  findCertificate, findUser, findAdminIds, summary,
};
