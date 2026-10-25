// api/src/modules/sync/sync.service.js
//
// Offline field inspection support for the mobile app.
//
// push: the device uploads whole inspections that were recorded offline. Every
//       record carries a client-generated UUID, so a retried upload is a no-op
//       ("DUPLICATE") instead of creating a second inspection. Each inspection
//       is handled independently: one bad item never blocks the others.
// pull: the device asks for what changed since its last sync (delta) and gets
//       a server timestamp to use as the next cursor.
//
// Conflict rules (server wins, nothing is silently overwritten):
//   - one inspection per assignment: if the server already has one under a
//     different clientId, the upload is REJECTED and the device must re-pull;
//   - an inspection that is already finalised accepts no more readings or
//     observations (database triggers enforce this too);
//   - resubmitting the same final decision is a DUPLICATE, a different one is
//     REJECTED (results are sealed and immutable).
// All business rules (ownership, assignment state, computed PASS/FAIL, evidence
// rule) are the ones in the verifications service; sync only orchestrates.

const pool = require('../../pool');
const ApiError = require('../../utils/ApiError');
const verifications = require('../verifications/verifications.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VERIFICATIONS = 50;
const MAX_CHILDREN = 200;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const errorText = (err) => (err instanceof ApiError ? err.message : 'Unexpected error');

async function findByClientId(table, clientId) {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE client_id = $1`, [clientId]);
  return rows[0] || null;
}

// Applies a list of child records (observations or readings) one by one.
async function applyChildren(items, { table, add, verificationId, user, finalised }) {
  const out = [];
  for (const item of items) {
    if (!isUuid(item && item.clientId)) {
      out.push({ clientId: item && item.clientId, status: 'REJECTED', error: 'clientId (UUID) is required' });
      continue;
    }
    const existing = await findByClientId(table, item.clientId);
    if (existing) {
      out.push({ clientId: item.clientId, serverId: existing.id, status: 'DUPLICATE' });
      continue;
    }
    if (finalised) {
      out.push({ clientId: item.clientId, status: 'REJECTED', error: 'Inspection is already finalised' });
      continue;
    }
    try {
      const row = await add(user, verificationId, item);
      out.push({ clientId: item.clientId, serverId: row.id, status: 'APPLIED' });
    } catch (err) {
      out.push({ clientId: item.clientId, status: 'REJECTED', error: errorText(err) });
    }
  }
  return out;
}

async function pushOne(user, item) {
  const report = { clientId: item && item.clientId, serverId: null, status: 'REJECTED', observations: [], readings: [], result: null };

  if (!item || !isUuid(item.clientId)) {
    report.error = 'clientId (UUID) is required';
    return report;
  }
  if (!item.applicationId || !item.assignmentId) {
    report.error = 'applicationId and assignmentId are required';
    return report;
  }
  const observations = Array.isArray(item.observations) ? item.observations : [];
  const readings = Array.isArray(item.readings) ? item.readings : [];
  if (observations.length > MAX_CHILDREN || readings.length > MAX_CHILDREN) {
    report.error = `At most ${MAX_CHILDREN} observations and readings per inspection`;
    return report;
  }

  let verification = await findByClientId('verifications', item.clientId);
  if (verification) {
    if (verification.performed_by_id !== user.id) {
      report.error = 'This inspection belongs to another officer';
      return report;
    }
    report.status = 'DUPLICATE';
  } else {
    try {
      verification = await verifications.createVerification(user, {
        applicationId: item.applicationId,
        assignmentId: item.assignmentId,
        scheduleId: item.scheduleId,
        location: item.location,
        latitude: item.latitude,
        longitude: item.longitude,
        remarks: item.remarks,
        clientId: item.clientId,
        clientStartedAt: item.startedAt,
      });
      report.status = 'APPLIED';
    } catch (err) {
      report.error = errorText(err);
      return report;
    }
  }
  report.serverId = verification.id;

  const finalised = verification.status !== 'IN_PROGRESS';
  report.observations = await applyChildren(observations, {
    table: 'inspection_observations', add: verifications.addObservation, verificationId: verification.id, user, finalised,
  });
  report.readings = await applyChildren(readings, {
    table: 'verification_readings', add: verifications.addReading, verificationId: verification.id, user, finalised,
  });

  if (item.result) {
    if (finalised) {
      const { rows } = await pool.query('SELECT decision FROM verification_results WHERE verification_id = $1', [verification.id]);
      const same = rows[0] && rows[0].decision === item.result.decision;
      report.result = same
        ? { status: 'DUPLICATE' }
        : { status: 'REJECTED', error: 'A different final result is already recorded' };
    } else {
      try {
        await verifications.submitResult(user, verification.id, item.result);
        report.result = { status: 'APPLIED' };
      } catch (err) {
        report.result = { status: 'REJECTED', error: errorText(err) };
      }
    }
  }
  return report;
}

async function push(user, body) {
  const items = body && body.verifications;
  if (!Array.isArray(items)) throw ApiError.badRequest('verifications must be an array');
  if (items.length > MAX_VERIFICATIONS) throw ApiError.badRequest(`At most ${MAX_VERIFICATIONS} inspections per push`);

  const results = [];
  for (const item of items) {
    results.push(await pushOne(user, item));
  }
  return { serverTime: new Date().toISOString(), results };
}

// Everything the officer's device needs, changed since `since` (ISO time).
// Without `since` it returns the full working set (first sync).
async function pull(user, since) {
  let sinceDate = null;
  if (since) {
    sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) throw ApiError.badRequest('since must be an ISO date-time');
  }
  // Take the cursor before reading so changes made during the query are not missed.
  const serverTime = new Date().toISOString();

  const { rows: assignments } = await pool.query(
    `SELECT a.id AS assignment_id, a.status AS assignment_status, a.remarks AS assignment_remarks,
            app.id AS application_id, app.application_number, app.application_type, app.purpose,
            app.status AS application_status,
            i.id AS instrument_id, i.instrument_name, i.manufacturer, i.model, i.serial_number,
            i.capacity, i.capacity_unit, t.name AS instrument_type,
            s.id AS schedule_id, s.scheduled_date, s.scheduled_time, s.verification_location,
            s.status AS schedule_status,
            GREATEST(a.updated_at, app.updated_at, COALESCE(s.updated_at, a.updated_at)) AS changed_at
       FROM verification_assignments a
       JOIN verification_applications app ON app.id = a.application_id
       JOIN instruments i ON i.id = app.instrument_id
       JOIN instrument_types t ON t.id = i.instrument_type_id
       LEFT JOIN LATERAL (
              SELECT * FROM verification_schedules sc
               WHERE sc.assignment_id = a.id AND sc.status <> 'CANCELLED'
               ORDER BY sc.scheduled_date DESC, sc.created_at DESC LIMIT 1) s ON TRUE
      WHERE a.assigned_to_id = $1
        AND ($2::timestamptz IS NULL
             OR GREATEST(a.updated_at, app.updated_at, COALESCE(s.updated_at, a.updated_at)) > $2)
        AND ($2::timestamptz IS NOT NULL OR a.status IN ('ASSIGNED', 'ACCEPTED'))
      ORDER BY changed_at`,
    [user.id, sinceDate]
  );

  const { rows: inspections } = await pool.query(
    `SELECT id, client_id, assignment_id, status, updated_at
       FROM verifications
      WHERE performed_by_id = $1 AND ($2::timestamptz IS NULL OR updated_at > $2)
      ORDER BY updated_at`,
    [user.id, sinceDate]
  );

  return { serverTime, assignments, inspections };
}

module.exports = { push, pull };
