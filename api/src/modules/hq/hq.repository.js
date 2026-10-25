// api/src/modules/hq/hq.repository.js
//
// Command HQ queries (ADMIN only; the routes enforce that). Parameterised SQL only.
// Every number on the HQ page has a drill-down that returns the records behind it. Both come from the
// same definition in DRILL below, so a tile and its list can never disagree.

const pool = require('../../pool');

const OPEN_APPLICATION = `a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED')`;
const ACTIVE_ASSIGNMENT = `s.status IN ('ASSIGNED', 'ACCEPTED', 'COMPLETED')`;

// Every drill-down yields rows of the same shape:
//   id, reference, title, status, at, responsible, responsible_id
// `entity` + `id` give the web link. `division` filters the application metrics only.
const assigneeOf = (alias = 'a') => `(
  SELECT string_agg(ou.full_name, ', ' ORDER BY ou.full_name)
    FROM verification_assignments s JOIN users ou ON ou.id = s.assigned_to_id
   WHERE s.application_id = ${alias}.id AND ${ACTIVE_ASSIGNMENT})`;

const applicationRows = (where) => `
  SELECT a.id, a.application_number AS reference, i.instrument_name AS title, a.status::text AS status,
         a.submitted_at AS at, COALESCE(${assigneeOf()}, 'Unassigned') AS responsible, NULL::uuid AS responsible_id
    FROM verification_applications a JOIN instruments i ON i.id = a.instrument_id
   WHERE ${where} AND ($1::text IS NULL OR a.division = $1::text)`;

const certificateRows = (where, atColumn = 'vc.issue_date::timestamptz', responsible = 'ou.full_name', responsibleId = 'ou.id') => `
  SELECT vc.id, vc.certificate_number AS reference, i.instrument_name AS title, vc.status::text AS status,
         ${atColumn} AS at, ${responsible} AS responsible, ${responsibleId} AS responsible_id
    FROM verification_certificates vc
    JOIN instruments i ON i.id = vc.instrument_id
    JOIN verifications v ON v.id = vc.verification_id
    LEFT JOIN users ou ON ou.id = v.performed_by_id
   WHERE ${where}`;

const instrumentRows = (state) => `
  SELECT i.id, i.serial_number AS reference, i.instrument_name AS title, st.verification_state AS status,
         st.next_due_date::timestamptz AS at, ow.full_name AS responsible, ow.id AS responsible_id
    FROM instrument_verification_status st
    JOIN instruments i ON i.id = st.instrument_id
    JOIN users ow ON ow.id = i.owner_id
   WHERE st.verification_state = '${state}' AND i.status NOT IN ('INACTIVE', 'DECOMMISSIONED')`;

const DRILL = {
  'applications-open': { title: 'Open applications', entity: 'application', division: true, sql: applicationRows(OPEN_APPLICATION), order: 'at ASC NULLS LAST' },
  'applications-stuck': { title: 'Open for more than 30 days', entity: 'application', division: true, sql: applicationRows(`${OPEN_APPLICATION} AND a.submitted_at < now() - interval '30 days'`), order: 'at ASC' },
  'applications-unassigned': {
    title: 'Submitted, no officer assigned', entity: 'application', division: true, order: 'at ASC',
    sql: applicationRows(`a.status = 'SUBMITTED' AND NOT EXISTS (SELECT 1 FROM verification_assignments s WHERE s.application_id = a.id AND ${ACTIVE_ASSIGNMENT})`),
  },
  'certificates-active': { title: 'Active certificates', entity: 'certificate', sql: certificateRows(`vc.status = 'ACTIVE' AND vc.valid_until >= CURRENT_DATE`), order: 'at DESC' },
  'certificates-expiring': { title: 'Certificates expiring within 30 days', entity: 'certificate', sql: certificateRows(`vc.status = 'ACTIVE' AND vc.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`, 'vc.valid_until::timestamptz'), order: 'at ASC' },
  'certificates-revoked': {
    title: 'Revoked certificates', entity: 'certificate', order: 'at DESC',
    sql: certificateRows(`vc.status = 'REVOKED'`, 'vc.revoked_at', 'rb.full_name', 'rb.id').replace('LEFT JOIN users ou ON ou.id = v.performed_by_id', 'LEFT JOIN users ou ON ou.id = v.performed_by_id LEFT JOIN users rb ON rb.id = vc.revoked_by_id'),
  },
  'certificates-expired': { title: 'Expired certificates', entity: 'certificate', sql: certificateRows(`vc.status = 'EXPIRED' OR (vc.status = 'ACTIVE' AND vc.valid_until < CURRENT_DATE)`, 'vc.valid_until::timestamptz'), order: 'at DESC' },
  'instruments-overdue': { title: 'Overdue for re-verification', entity: 'instrument', sql: instrumentRows('OVERDUE'), order: 'at ASC' },
  'instruments-due-soon': { title: 'Due within 30 days', entity: 'instrument', sql: instrumentRows('DUE_SOON'), order: 'at ASC' },
  'instruments-never-verified': { title: 'Never verified', entity: 'instrument', sql: instrumentRows('NEVER_VERIFIED'), order: 'reference ASC' },
  'verifications-failed': {
    title: 'Failed verifications (last 30 days)', entity: 'verification', order: 'at DESC',
    sql: `SELECT v.id, a.application_number AS reference, i.instrument_name AS title, vr.decision::text AS status,
                 vr.result_date AS at, du.full_name AS responsible, du.id AS responsible_id
            FROM verification_results vr
            JOIN verifications v ON v.id = vr.verification_id
            JOIN verification_applications a ON a.id = v.application_id
            JOIN instruments i ON i.id = a.instrument_id
            JOIN users du ON du.id = vr.decided_by_id
           WHERE vr.decision = 'FAIL' AND vr.result_date >= now() - interval '30 days'`,
  },
  'enforcement-open': {
    title: 'Open enforcement cases', entity: 'enforcement', order: 'at DESC',
    sql: `SELECT c.id, c.case_number AS reference, c.offence_type::text || ' - ' || c.subject_name AS title, c.status::text AS status,
                 c.detected_on::timestamptz AS at, du.full_name AS responsible, du.id AS responsible_id
            FROM enforcement_cases c JOIN users du ON du.id = c.detected_by_id
           WHERE c.status IN ('OPEN', 'NOTICE_ISSUED')`,
  },
  'queries-awaiting-department': {
    title: 'Queries waiting for the department', entity: 'query', order: 'at ASC',
    sql: `SELECT q.id, a.application_number AS reference, q.subject AS title, q.status::text AS status,
                 lm.created_at AS at, ru.full_name AS responsible, ru.id AS responsible_id
            FROM application_queries q
            JOIN verification_applications a ON a.id = q.application_id
            JOIN users ru ON ru.id = q.raised_by_id
            JOIN LATERAL (SELECT m.author_id, m.created_at FROM application_query_messages m WHERE m.query_id = q.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) lm ON TRUE
            JOIN users lu ON lu.id = lm.author_id JOIN roles lr ON lr.id = lu.role_id
           WHERE q.status = 'OPEN' AND lr.name = 'INSTRUMENT_OWNER'`,
  },
  'nameplate-pending': {
    title: 'Nameplate photos waiting for a decision', entity: 'nameplate', order: 'at ASC',
    sql: `SELECT n.id, i.serial_number AS reference, i.instrument_name AS title, n.advisory::text AS status,
                 n.created_at AS at, uu.full_name AS responsible, uu.id AS responsible_id
            FROM nameplate_checks n JOIN instruments i ON i.id = n.instrument_id JOIN users uu ON uu.id = n.uploaded_by_id
           WHERE n.status = 'PENDING_REVIEW'`,
  },
};

const LINKS = {
  application: (id) => `/applications/${id}`,
  certificate: (id) => `/certificates/${id}`,
  instrument: (id) => `/instruments/${id}`,
  verification: (id) => `/verifications/${id}`,
  enforcement: () => '/enforcement',
  query: () => '/queries',
  nameplate: () => '/nameplate-queue',
};

const metricList = () => Object.entries(DRILL).map(([id, d]) => ({ id, title: d.title, entity: d.entity, division: !!d.division }));

async function drill(metric, { division = null, limit = 25, offset = 0 } = {}) {
  const def = DRILL[metric];
  if (!def) return null;
  const params = def.division ? [division] : [];
  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM (${def.sql}) m`, params),
    pool.query(`SELECT * FROM (${def.sql}) m ORDER BY ${def.order}, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
  ]);
  return {
    metric, title: def.title, entity: def.entity, total: countRows[0].n, limit, offset,
    rows: rows.map((r) => ({ ...r, entity: def.entity, link: LINKS[def.entity](r.id) })),
  };
}

// One round trip for every tile. Each figure is also a drill-down metric above.
async function counters() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM instruments WHERE status NOT IN ('INACTIVE', 'DECOMMISSIONED'))::int AS instruments,
      (SELECT COUNT(*) FROM instruments WHERE status NOT IN ('INACTIVE', 'DECOMMISSIONED') AND location_lat IS NOT NULL)::int AS instruments_on_map,
      (SELECT COUNT(*) FROM verification_certificates WHERE status = 'ACTIVE' AND valid_until >= CURRENT_DATE)::int AS "certificates-active",
      (SELECT COUNT(*) FROM verification_certificates WHERE status = 'ACTIVE' AND valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS "certificates-expiring",
      (SELECT COUNT(*) FROM verification_certificates WHERE status = 'REVOKED')::int AS "certificates-revoked",
      (SELECT COUNT(*) FROM verification_certificates WHERE status = 'EXPIRED' OR (status = 'ACTIVE' AND valid_until < CURRENT_DATE))::int AS "certificates-expired",
      (SELECT COUNT(*) FROM verification_applications a WHERE ${OPEN_APPLICATION})::int AS "applications-open",
      (SELECT COUNT(*) FROM verification_applications a WHERE ${OPEN_APPLICATION} AND a.submitted_at < now() - interval '30 days')::int AS "applications-stuck",
      (SELECT COUNT(*) FROM verification_applications a WHERE a.status = 'SUBMITTED' AND NOT EXISTS (SELECT 1 FROM verification_assignments s WHERE s.application_id = a.id AND ${ACTIVE_ASSIGNMENT}))::int AS "applications-unassigned",
      (SELECT COUNT(*) FROM verification_results WHERE decision = 'FAIL' AND result_date >= now() - interval '30 days')::int AS "verifications-failed",
      (SELECT COUNT(*) FROM verification_results WHERE result_date >= now() - interval '30 days')::int AS verifications_30d,
      (SELECT COUNT(*) FROM enforcement_cases WHERE status IN ('OPEN', 'NOTICE_ISSUED'))::int AS "enforcement-open",
      (SELECT COUNT(*) FROM nameplate_checks WHERE status = 'PENDING_REVIEW')::int AS "nameplate-pending",
      (SELECT COUNT(*) FROM application_queries WHERE status = 'OPEN')::int AS queries_open,
      (SELECT COUNT(*) FROM (SELECT q.id FROM application_queries q
          JOIN LATERAL (SELECT m.author_id FROM application_query_messages m WHERE m.query_id = q.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) lm ON TRUE
          JOIN users lu ON lu.id = lm.author_id JOIN roles lr ON lr.id = lu.role_id
         WHERE q.status = 'OPEN' AND lr.name = 'INSTRUMENT_OWNER') w)::int AS "queries-awaiting-department"`);
  const states = await pool.query(
    `SELECT st.verification_state AS state, COUNT(*)::int AS count
       FROM instrument_verification_status st JOIN instruments i ON i.id = st.instrument_id
      WHERE i.status NOT IN ('INACTIVE', 'DECOMMISSIONED') GROUP BY 1`
  );
  const byState = Object.fromEntries(states.rows.map((r) => [r.state, r.count]));
  return {
    ...rows[0],
    'instruments-overdue': byState.OVERDUE || 0,
    'instruments-due-soon': byState.DUE_SOON || 0,
    'instruments-never-verified': byState.NEVER_VERIFIED || 0,
    instrumentStates: byState,
  };
}

const MAP_LIMIT = 2000;

async function mapPoints({ state = null } = {}) {
  const [{ rows: instruments }, { rows: cases }] = await Promise.all([
    pool.query(
      `SELECT i.id, i.instrument_name, i.serial_number, i.location_lat::float AS lat, i.location_lng::float AS lng,
              st.verification_state AS state, st.certificate_number, st.next_due_date, ow.full_name AS owner_name
         FROM instruments i
         JOIN instrument_verification_status st ON st.instrument_id = i.id
         JOIN users ow ON ow.id = i.owner_id
        WHERE i.location_lat IS NOT NULL AND i.status NOT IN ('INACTIVE', 'DECOMMISSIONED')
          AND ($1::text IS NULL OR st.verification_state = $1::text)
        ORDER BY i.id LIMIT $2`,
      [state, MAP_LIMIT + 1]
    ),
    pool.query(
      `SELECT c.id, c.case_number, c.offence_type::text AS offence_type, c.status::text AS status, c.latitude::float AS lat, c.longitude::float AS lng, c.detected_on
         FROM enforcement_cases c
        WHERE c.latitude IS NOT NULL AND c.status IN ('OPEN', 'NOTICE_ISSUED')
        ORDER BY c.detected_on DESC LIMIT 500`
    ),
  ]);
  const truncated = instruments.length > MAP_LIMIT;
  return { instruments: instruments.slice(0, MAP_LIMIT), cases, truncated };
}

// ---------------------------------------------------------------------------- evidence

async function certificateEvidence(id) {
  const { rows } = await pool.query(
    `SELECT vc.*, i.instrument_name, i.serial_number, i.manufacturer, i.model, i.location_lat::float AS inst_lat, i.location_lng::float AS inst_lng,
            ow.id AS owner_id, ow.full_name AS owner_name,
            v.id AS verification_id, v.verification_date, v.start_time, v.end_time, v.location AS verification_location,
            v.start_latitude::float AS start_lat, v.start_longitude::float AS start_lng,
            pb.id AS performed_by_id, pb.full_name AS performed_by_name,
            a.id AS application_id, a.application_number,
            vr.decision, vr.result_sha256, vr.result_date, db.id AS decided_by_id, db.full_name AS decided_by_name,
            rb.id AS revoked_by_user_id, rb.full_name AS revoked_by_name
       FROM verification_certificates vc
       JOIN instruments i ON i.id = vc.instrument_id
       JOIN users ow ON ow.id = i.owner_id
       JOIN verifications v ON v.id = vc.verification_id
       JOIN verification_applications a ON a.id = v.application_id
       JOIN users pb ON pb.id = v.performed_by_id
       LEFT JOIN verification_results vr ON vr.verification_id = v.id
       LEFT JOIN users db ON db.id = vr.decided_by_id
       LEFT JOIN users rb ON rb.id = vc.revoked_by_id
      WHERE vc.id = $1`,
    [id]
  );
  const cert = rows[0];
  if (!cert) return null;

  const [readings, photos, nameplates, audit] = await Promise.all([
    pool.query(
      `SELECT id, reading_type, expected_value, observed_value, unit, tolerance, result::text AS result, recorded_at
         FROM verification_readings WHERE verification_id = $1 ORDER BY recorded_at, id`, [cert.verification_id]),
    pool.query(
      `SELECT at.id, at.evidence_kind, at.category::text AS category, at.file_name, at.file_url, at.file_sha256, at.captured_at, at.uploaded_at,
              at.latitude::float AS lat, at.longitude::float AS lng, up.id AS uploaded_by_id, up.full_name AS uploaded_by_name
         FROM attachments at JOIN users up ON up.id = at.uploaded_by_id
        WHERE at.verification_id = $1 ORDER BY at.uploaded_at, at.id`, [cert.verification_id]),
    pool.query(
      `SELECT n.id, n.file_url, n.file_sha256, n.advisory::text AS advisory, n.status::text AS status, n.created_at, n.reviewed_at, n.review_note,
              up.full_name AS uploaded_by_name, rv.full_name AS reviewed_by_name
         FROM nameplate_checks n JOIN users up ON up.id = n.uploaded_by_id LEFT JOIN users rv ON rv.id = n.reviewed_by_id
        WHERE n.instrument_id = $1 ORDER BY n.created_at`, [cert.instrument_id]),
    pool.query(
      `SELECT l.id, l.action, l.occurred_at, l.hash, l.prev_hash, u.id AS actor_id, u.full_name AS actor_name
         FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id
        WHERE (l.entity_type = 'certificate' AND l.entity_id = $1) OR (l.entity_type = 'verification' AND l.entity_id = $2)
        ORDER BY l.id`, [cert.id, cert.verification_id]),
  ]);
  return { cert, readings: readings.rows, photos: photos.rows, nameplates: nameplates.rows, audit: audit.rows };
}

async function caseEvidence(id) {
  const { rows } = await pool.query(
    `SELECT c.*, c.latitude::float AS lat, c.longitude::float AS lng, du.full_name AS detected_by_name,
            vc.certificate_number, vc.record_sha256, vc.pdf_sha256, i.instrument_name, i.serial_number
       FROM enforcement_cases c
       JOIN users du ON du.id = c.detected_by_id
       LEFT JOIN verification_certificates vc ON vc.id = c.certificate_id
       LEFT JOIN instruments i ON i.id = c.instrument_id
      WHERE c.id = $1`, [id]);
  if (!rows[0]) return null;
  const [events, audit] = await Promise.all([
    pool.query(`SELECT e.id, e.from_status::text AS from_status, e.to_status::text AS to_status, e.note, e.created_at, u.id AS actor_id, u.full_name AS actor_name
                  FROM enforcement_case_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.case_id = $1 ORDER BY e.created_at, e.id`, [id]),
    pool.query(`SELECT l.id, l.action, l.occurred_at, l.hash, u.full_name AS actor_name FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id
                 WHERE l.entity_type = 'enforcement_case' AND l.entity_id = $1 ORDER BY l.id`, [id]),
  ]);
  return { case: rows[0], events: events.rows, audit: audit.rows };
}

const EVIDENCE_CSV_LIMIT = 5000;

/** One row per certificate with its fingerprints, photos and the people involved. */
async function evidenceRows({ status = null, from = null, to = null } = {}) {
  const { rows } = await pool.query(
    `SELECT vc.id AS certificate_id, vc.certificate_number, vc.status::text AS status, vc.issue_date, vc.valid_from, vc.valid_until,
            vc.record_sha256, vc.pdf_sha256, vc.pdf_signed, vc.revoked_at, rb.full_name AS revoked_by,
            i.id AS instrument_id, i.serial_number, i.instrument_name, ow.id AS owner_id, ow.full_name AS owner_name,
            a.application_number, v.id AS verification_id, v.verification_date, v.start_time, v.start_latitude::float AS start_lat, v.start_longitude::float AS start_lng,
            pb.id AS officer_id, pb.full_name AS officer_name,
            vr.decision::text AS decision, vr.result_sha256, vr.result_date, db.full_name AS decided_by,
            issued.actor_id AS issued_by_id, issued.actor_name AS issued_by, issued.occurred_at AS issued_at,
            COALESCE(ph.photo_count, 0)::int AS photo_count, ph.photos,
            COALESCE(np.checks, 0)::int AS nameplate_checks, np.latest_nameplate_status
       FROM verification_certificates vc
       JOIN instruments i ON i.id = vc.instrument_id
       JOIN users ow ON ow.id = i.owner_id
       JOIN verifications v ON v.id = vc.verification_id
       JOIN verification_applications a ON a.id = v.application_id
       JOIN users pb ON pb.id = v.performed_by_id
       LEFT JOIN verification_results vr ON vr.verification_id = v.id
       LEFT JOIN users db ON db.id = vr.decided_by_id
       LEFT JOIN users rb ON rb.id = vc.revoked_by_id
       LEFT JOIN LATERAL (SELECT l.actor_id, u.full_name AS actor_name, l.occurred_at FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id
                           WHERE l.entity_type = 'certificate' AND l.entity_id = vc.id::text AND l.action = 'CERTIFICATE_ISSUED' ORDER BY l.id LIMIT 1) issued ON TRUE
       LEFT JOIN LATERAL (SELECT COUNT(*) AS photo_count,
                                 string_agg(COALESCE(at.evidence_kind, 'PHOTO') || ':' || at.id::text || ':' || COALESCE(at.file_sha256, ''), ' ; ' ORDER BY at.uploaded_at) AS photos
                            FROM attachments at WHERE at.verification_id = v.id) ph ON TRUE
       LEFT JOIN LATERAL (SELECT COUNT(*) AS checks, (array_agg(n.status::text ORDER BY n.created_at DESC))[1] AS latest_nameplate_status
                            FROM nameplate_checks n WHERE n.instrument_id = i.id) np ON TRUE
      WHERE ($1::text IS NULL OR vc.status::text = $1::text)
        AND ($2::date IS NULL OR vc.issue_date >= $2::date)
        AND ($3::date IS NULL OR vc.issue_date <= $3::date)
      ORDER BY vc.issue_date DESC, vc.certificate_number DESC
      LIMIT ${EVIDENCE_CSV_LIMIT}`,
    [status, from, to]
  );
  return rows;
}

module.exports = { DRILL, metricList, drill, counters, mapPoints, certificateEvidence, caseEvidence, evidenceRows, EVIDENCE_CSV_LIMIT, MAP_LIMIT };
