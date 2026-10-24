// api/src/modules/reports/reports.repository.js
//
// Read-only aggregate queries for dashboards, reports and CSV exports.
//
// Every query is scoped to what the caller may see:
//   ADMIN          everything
//   INSTRUMENT_OWNER  their own instruments / applications / certificates
//   LMO, GATC      instruments / applications assigned to them
// The scope condition always references $1 (the user id, or NULL for ADMIN),
// so every query is called with exactly one parameter: [scope.param].

const pool = require('../../pool');
const { ROLES } = require('../../config/roles');

function scope(user) {
  if (user.role === ROLES.ADMIN) {
    return {
      param: null,
      instrument: '($1::uuid IS NULL OR TRUE)',
      application: '($1::uuid IS NULL OR TRUE)',
    };
  }
  if (user.role === ROLES.INSTRUMENT_OWNER) {
    return {
      param: user.id,
      instrument: 'i.owner_id = $1::uuid',
      application: 'a.applicant_id = $1::uuid',
    };
  }
  // LMO / GATC: only work assigned to them
  return {
    param: user.id,
    instrument: `EXISTS (
      SELECT 1 FROM verification_applications sa
      JOIN verification_assignments sas ON sas.application_id = sa.id
      WHERE sa.instrument_id = i.id AND sas.assigned_to_id = $1::uuid)`,
    application: `EXISTS (
      SELECT 1 FROM verification_assignments sas
      WHERE sas.application_id = a.id AND sas.assigned_to_id = $1::uuid)`,
  };
}

async function one(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function all(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function dashboardCounts(user) {
  const s = scope(user);
  const p = [s.param];

  const [instruments, activeCerts, pending, completed, results, turnaround, expiring, overdue, awaiting] =
    await Promise.all([
      one(`SELECT COUNT(*)::int AS n FROM instruments i
           WHERE i.status <> 'DECOMMISSIONED' AND ${s.instrument}`, p),
      one(`SELECT COUNT(*)::int AS n
           FROM verification_certificates vc JOIN instruments i ON i.id = vc.instrument_id
           WHERE vc.status = 'ACTIVE' AND vc.valid_until >= CURRENT_DATE AND ${s.instrument}`, p),
      one(`SELECT COUNT(*)::int AS n FROM verification_applications a
           WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED') AND ${s.application}`, p),
      one(`SELECT COUNT(*)::int AS n
           FROM verifications v JOIN verification_applications a ON a.id = v.application_id
           WHERE v.status = 'COMPLETED' AND ${s.application}`, p),
      one(`SELECT COUNT(*) FILTER (WHERE vr.decision = 'PASS')::int AS pass,
                  COUNT(*)::int AS total
           FROM verification_results vr
           JOIN verifications v ON v.id = vr.verification_id
           JOIN verification_applications a ON a.id = v.application_id
           WHERE ${s.application}`, p),
      one(`SELECT AVG(EXTRACT(EPOCH FROM (vc.created_at - a.submitted_at))) AS seconds
           FROM verification_certificates vc
           JOIN verifications v ON v.id = vc.verification_id
           JOIN verification_applications a ON a.id = v.application_id
           WHERE a.submitted_at IS NOT NULL AND ${s.application}`, p),
      one(`SELECT COUNT(*)::int AS n
           FROM verification_certificates vc JOIN instruments i ON i.id = vc.instrument_id
           WHERE vc.status = 'ACTIVE' AND vc.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
             AND ${s.instrument}`, p),
      one(`SELECT COUNT(*)::int AS n
           FROM instrument_verification_status st JOIN instruments i ON i.id = st.instrument_id
           WHERE st.verification_state = 'OVERDUE' AND ${s.instrument}`, p),
      one(`SELECT COUNT(*)::int AS n FROM verification_applications a
           WHERE a.status = 'SUBMITTED' AND ${s.application}
             AND NOT EXISTS (SELECT 1 FROM verification_assignments x
                             WHERE x.application_id = a.id AND x.status IN ('ASSIGNED', 'ACCEPTED'))`, p),
    ]);

  return { instruments, activeCerts, pending, completed, results, turnaround, expiring, overdue, awaiting };
}

async function applicationsByStatus(user) {
  const s = scope(user);
  return all(
    `SELECT a.status, COUNT(*)::int AS count
     FROM verification_applications a WHERE ${s.application}
     GROUP BY a.status ORDER BY a.status`,
    [s.param]
  );
}

async function recentActivity(user, limit = 10) {
  const s = scope(user);
  return all(
    `SELECT * FROM (
       SELECT a.id::text AS id, 'APPLICATION' AS type,
              'Application ' || a.application_number AS title,
              i.instrument_name || ' - ' || a.application_type::text AS description,
              a.created_at AS timestamp, a.status::text AS status
       FROM verification_applications a JOIN instruments i ON i.id = a.instrument_id
       WHERE ${s.application}
       UNION ALL
       SELECT v.id::text, 'VERIFICATION', 'Verification of ' || i.instrument_name,
              COALESCE(vr.decision::text, 'In progress'), COALESCE(v.end_time, v.start_time, v.created_at), v.status::text
       FROM verifications v
       JOIN verification_applications a ON a.id = v.application_id
       JOIN instruments i ON i.id = a.instrument_id
       LEFT JOIN verification_results vr ON vr.verification_id = v.id
       WHERE ${s.application}
       UNION ALL
       SELECT vc.id::text, 'CERTIFICATE', 'Certificate ' || vc.certificate_number,
              i.instrument_name || ' valid until ' || vc.valid_until::text, vc.created_at, vc.status::text
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       JOIN verification_applications a ON a.id = v.application_id
       JOIN instruments i ON i.id = vc.instrument_id
       WHERE ${s.application}
     ) activity
     ORDER BY timestamp DESC
     LIMIT ${Number(limit)}`,
    [s.param]
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

async function approvalsByInstrumentType(user) {
  const s = scope(user);
  return all(
    `SELECT it.name AS label, COUNT(*)::int AS approvals
     FROM verification_certificates vc
     JOIN instruments i ON i.id = vc.instrument_id
     JOIN instrument_types it ON it.id = i.instrument_type_id
     WHERE ${s.instrument}
     GROUP BY it.name
     ORDER BY approvals DESC, it.name`,
    [s.param]
  );
}

async function monthlyTrends(user, months = 6) {
  const s = scope(user);
  return all(
    `WITH months AS (
       SELECT date_trunc('month', CURRENT_DATE) - (g || ' month')::interval AS m
       FROM generate_series($2::int - 1, 0, -1) g
     )
     SELECT to_char(months.m, 'Mon YYYY') AS month,
            (SELECT COUNT(*)::int FROM verification_applications a
              WHERE date_trunc('month', a.created_at) = months.m AND ${s.application}) AS submitted,
            (SELECT COUNT(*)::int FROM verification_results vr
              JOIN verifications v ON v.id = vr.verification_id
              JOIN verification_applications a ON a.id = v.application_id
              WHERE vr.decision = 'PASS' AND date_trunc('month', vr.result_date) = months.m AND ${s.application}) AS approved,
            (SELECT COUNT(*)::int FROM verification_results vr
              JOIN verifications v ON v.id = vr.verification_id
              JOIN verification_applications a ON a.id = v.application_id
              WHERE vr.decision = 'FAIL' AND date_trunc('month', vr.result_date) = months.m AND ${s.application}) AS rejected
     FROM months
     ORDER BY months.m`,
    [s.param, months]
  );
}

// ---------------------------------------------------------------------------
// Management summary (pendency, workload, forecast)
// ---------------------------------------------------------------------------

async function pendencyBuckets(user) {
  const s = scope(user);
  return one(
    `SELECT
       COUNT(*) FILTER (WHERE age <= 7)::int AS "0-7 days",
       COUNT(*) FILTER (WHERE age BETWEEN 8 AND 14)::int AS "8-14 days",
       COUNT(*) FILTER (WHERE age BETWEEN 15 AND 30)::int AS "15-30 days",
       COUNT(*) FILTER (WHERE age > 30)::int AS "over 30 days",
       COALESCE(MAX(age), 0)::int AS "oldest",
       COUNT(*)::int AS "total"
     FROM (
       SELECT (CURRENT_DATE - a.submitted_at::date) AS age
       FROM verification_applications a
       WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED') AND a.submitted_at IS NOT NULL AND ${s.application}
     ) open_apps`,
    [s.param]
  );
}

async function byDivision(user) {
  const s = scope(user);
  return all(
    `SELECT COALESCE(a.division, 'UNSPECIFIED') AS division,
            COUNT(*)::int AS applications,
            COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
            COUNT(*) FILTER (WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED'))::int AS open,
            COUNT(*) FILTER (WHERE a.status IN ('REJECTED', 'CANCELLED'))::int AS closed_without_result
     FROM verification_applications a
     WHERE ${s.application}
     GROUP BY 1 ORDER BY applications DESC, division`,
    [s.param]
  );
}

async function officerWorkload(user) {
  const s = scope(user);
  return all(
    `SELECT u.id AS officer_id, u.full_name AS officer_name, r.name AS role,
            COUNT(*) FILTER (WHERE x.status IN ('ASSIGNED', 'ACCEPTED'))::int AS open_assignments,
            COUNT(*) FILTER (WHERE x.status = 'COMPLETED')::int AS completed_assignments,
            COUNT(*) FILTER (WHERE x.status = 'DECLINED')::int AS declined_assignments
     FROM verification_assignments x
     JOIN verification_applications a ON a.id = x.application_id
     JOIN users u ON u.id = x.assigned_to_id
     JOIN roles r ON r.id = u.role_id
     WHERE ${s.application}
     GROUP BY u.id, u.full_name, r.name
     ORDER BY open_assignments DESC, u.full_name`,
    [s.param]
  );
}

async function expiryForecast(user, months = 12) {
  const s = scope(user);
  return all(
    `SELECT to_char(date_trunc('month', vc.valid_until), 'YYYY-MM') AS month,
            COUNT(*)::int AS expiring
     FROM verification_certificates vc JOIN instruments i ON i.id = vc.instrument_id
     WHERE vc.status = 'ACTIVE'
       AND vc.valid_until >= CURRENT_DATE
       AND vc.valid_until < (date_trunc('month', CURRENT_DATE) + ($2::int || ' month')::interval)
       AND ${s.instrument}
     GROUP BY 1 ORDER BY 1`,
    [s.param, months]
  );
}

async function verificationStateCounts(user) {
  const s = scope(user);
  return all(
    `SELECT st.verification_state AS state, COUNT(*)::int AS count
     FROM instrument_verification_status st JOIN instruments i ON i.id = st.instrument_id
     WHERE ${s.instrument}
     GROUP BY 1 ORDER BY 1`,
    [s.param]
  );
}

async function scanStats(user) {
  // Public QR scans only make sense org-wide, so this is ADMIN-only data.
  if (user.role !== ROLES.ADMIN) return null;
  return one(
    `SELECT COUNT(*)::int AS scans_30d,
            COUNT(*) FILTER (WHERE result = 'INVALID')::int AS invalid_30d,
            COUNT(*) FILTER (WHERE result = 'REVOKED')::int AS revoked_30d
     FROM qr_authentications
     WHERE authenticated_at >= now() - interval '30 days'`,
    []
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const EXPORTS = {
  applications: {
    columns: [
      ['application_number', 'Application No.'], ['status', 'Status'], ['application_type', 'Type'],
      ['division', 'Division'], ['instrument_name', 'Instrument'], ['serial_number', 'Serial No.'],
      ['applicant_name', 'Applicant'], ['submitted_at', 'Submitted'], ['gras_challan_number', 'GRAS challan'],
      ['conveyance_fee', 'Conveyance fee'], ['quarter_jump_fee', 'Quarter-jump fee'],
    ],
    sql: (s) => `
      SELECT a.application_number, a.status, a.application_type, a.division,
             i.instrument_name, i.serial_number, u.full_name AS applicant_name,
             a.submitted_at, a.gras_challan_number, a.conveyance_fee, a.quarter_jump_fee
      FROM verification_applications a
      JOIN instruments i ON i.id = a.instrument_id
      JOIN users u ON u.id = a.applicant_id
      WHERE ${s.application} AND ($2::date IS NULL OR a.created_at::date >= $2::date)
        AND ($3::date IS NULL OR a.created_at::date <= $3::date)
      ORDER BY a.created_at DESC`,
  },
  certificates: {
    columns: [
      ['certificate_number', 'Certificate No.'], ['status', 'Status'], ['instrument_name', 'Instrument'],
      ['serial_number', 'Serial No.'], ['owner_name', 'Owner'], ['issue_date', 'Issued'],
      ['valid_from', 'Valid from'], ['valid_until', 'Valid until'], ['application_number', 'Application No.'],
      ['revoked_at', 'Revoked at'], ['revocation_reason', 'Revocation reason'],
    ],
    sql: (s) => `
      SELECT vc.certificate_number, vc.status, i.instrument_name, i.serial_number,
             COALESCE(o.full_name, ap.full_name) AS owner_name, vc.issue_date, vc.valid_from, vc.valid_until,
             a.application_number, vc.revoked_at, vc.revocation_reason
      FROM verification_certificates vc
      JOIN instruments i ON i.id = vc.instrument_id
      JOIN verifications v ON v.id = vc.verification_id
      JOIN verification_applications a ON a.id = v.application_id
      LEFT JOIN users o ON o.id = i.owner_id
      LEFT JOIN users ap ON ap.id = a.applicant_id
      WHERE ${s.application} AND ($2::date IS NULL OR vc.issue_date >= $2::date)
        AND ($3::date IS NULL OR vc.issue_date <= $3::date)
      ORDER BY vc.issue_date DESC, vc.certificate_number DESC`,
  },
  verifications: {
    columns: [
      ['application_number', 'Application No.'], ['instrument_name', 'Instrument'], ['officer_name', 'Officer'],
      ['verification_date', 'Date'], ['status', 'Status'], ['decision', 'Decision'],
      ['readings', 'Readings'], ['failed_readings', 'Failed readings'], ['location', 'Location'],
    ],
    sql: (s) => `
      SELECT a.application_number, i.instrument_name, u.full_name AS officer_name, v.verification_date,
             v.status, vr.decision, v.location,
             (SELECT COUNT(*) FROM verification_readings r WHERE r.verification_id = v.id)::int AS readings,
             (SELECT COUNT(*) FROM verification_readings r WHERE r.verification_id = v.id AND r.result = 'FAIL')::int AS failed_readings
      FROM verifications v
      JOIN verification_applications a ON a.id = v.application_id
      JOIN instruments i ON i.id = a.instrument_id
      JOIN users u ON u.id = v.performed_by_id
      LEFT JOIN verification_results vr ON vr.verification_id = v.id
      WHERE ${s.application} AND ($2::date IS NULL OR v.verification_date >= $2::date)
        AND ($3::date IS NULL OR v.verification_date <= $3::date)
      ORDER BY v.verification_date DESC`,
  },
  'instruments-due': {
    columns: [
      ['instrument_name', 'Instrument'], ['serial_number', 'Serial No.'], ['owner_name', 'Owner'],
      ['verification_state', 'State'], ['certificate_number', 'Certificate No.'],
      ['next_due_date', 'Next due'], ['days_until_due', 'Days until due'],
    ],
    sql: (s) => `
      SELECT st.instrument_name, st.serial_number, o.full_name AS owner_name, st.verification_state,
             st.certificate_number, st.next_due_date, st.days_until_due
      FROM instrument_verification_status st
      JOIN instruments i ON i.id = st.instrument_id
      LEFT JOIN users o ON o.id = st.owner_id
      WHERE ${s.instrument} AND ($2::date IS NULL OR TRUE) AND ($3::date IS NULL OR TRUE)
      ORDER BY st.next_due_date ASC NULLS FIRST, st.instrument_name`,
  },
};

async function exportRows(user, dataset, { from, to }) {
  const def = EXPORTS[dataset];
  if (!def) return null;
  const s = scope(user);
  const rows = await all(def.sql(s), [s.param, from || null, to || null]);
  return { columns: def.columns, rows };
}

module.exports = {
  dashboardCounts,
  applicationsByStatus,
  recentActivity,
  approvalsByInstrumentType,
  monthlyTrends,
  pendencyBuckets,
  byDivision,
  officerWorkload,
  expiryForecast,
  verificationStateCounts,
  scanStats,
  exportRows,
  EXPORT_DATASETS: Object.keys(EXPORTS),
};
