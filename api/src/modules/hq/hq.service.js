// api/src/modules/hq/hq.service.js
//
// Command HQ (ADMIN only). Reuses the management report and enforcement summary that already exist and adds
// the national counters, the instrument map, drill-down lists and evidence packs. Looking at evidence is itself
// recorded in the audit log (who looked at which record, and when).

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { toCsv } = require('../../utils/csv');
const { recordFingerprint } = require('../../utils/certificateIntegrity');
const { ROLES } = require('../../config/roles');
const reports = require('../reports/reports.service');
const enforcement = require('../enforcement/enforcement.service');
const repo = require('./hq.repository');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ['NEVER_VERIFIED', 'VALID', 'DUE_SOON', 'OVERDUE', 'REVOKED'];
const CERT_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'];
const ATTENTION = ['applications-unassigned', 'applications-stuck', 'instruments-overdue', 'certificates-expiring', 'verifications-failed', 'enforcement-open'];

function requireAdmin(user) {
  // The routes already insist on ADMIN; this keeps the service safe if it is ever called from elsewhere.
  if (!user || user.role !== ROLES.ADMIN) throw ApiError.forbidden('Command HQ is for administrators');
}

async function overview(user) {
  requireAdmin(user);
  const [counters, summary, trends, enforcementSummary, ...attention] = await Promise.all([
    repo.counters(),
    reports.getSummary(user),
    reports.getMonthlyTrends(user),
    enforcement.summary(),
    ...ATTENTION.map((m) => repo.drill(m, { limit: 5 })),
  ]);
  const { instrumentStates, ...tiles } = counters;
  return {
    generatedAt: new Date().toISOString(),
    tiles,
    instrumentStates,
    pendency: summary.pendency,
    byDivision: summary.byDivision,
    officerWorkload: summary.officerWorkload,
    expiryForecast: summary.expiryForecast,
    monthlyTrends: trends,
    publicScans: summary.publicScans,
    enforcement: enforcementSummary,
    attention: attention.map((a) => ({ metric: a.metric, title: a.title, total: a.total, rows: a.rows })),
    metrics: repo.metricList(),
  };
}

async function drill(user, metric, query) {
  requireAdmin(user);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const division = typeof query.division === 'string' && query.division.trim() ? query.division.trim().slice(0, 60) : null;
  const result = await repo.drill(metric, { division, limit, offset });
  if (!result) throw ApiError.notFound(`Unknown metric "${metric}"`);
  return result;
}

async function map(user, query) {
  requireAdmin(user);
  const state = query.state ? String(query.state).toUpperCase() : null;
  if (state && !STATES.includes(state)) throw ApiError.badRequest(`state must be one of ${STATES.join(', ')}`);
  return repo.mapPoints({ state });
}

const photo = (p) => ({
  id: p.id, kind: p.evidence_kind || p.category, fileName: p.file_name, file_url: p.file_url, sha256: p.file_sha256,
  capturedAt: p.captured_at, uploadedAt: p.uploaded_at, gps: p.lat == null ? null : { lat: p.lat, lng: p.lng },
  uploadedBy: { id: p.uploaded_by_id, name: p.uploaded_by_name },
});

async function certificateEvidence(user, id) {
  requireAdmin(user);
  if (!UUID_RE.test(String(id))) throw ApiError.notFound('Certificate not found');
  const found = await repo.certificateEvidence(id);
  if (!found) throw ApiError.notFound('Certificate not found');
  const { cert, readings, photos, nameplates, audit: trail } = found;

  const recomputed = recordFingerprint(cert);
  await audit.recordStandalone({ actorId: user.id, action: 'HQ_EVIDENCE_VIEWED', entityType: 'certificate', entityId: cert.id, details: { certificateNumber: cert.certificate_number } });

  const issued = trail.find((e) => e.action === 'CERTIFICATE_ISSUED');
  return {
    generatedAt: new Date().toISOString(),
    certificate: {
      id: cert.id, number: cert.certificate_number, status: cert.status, issueDate: cert.issue_date, validFrom: cert.valid_from, validUntil: cert.valid_until,
      qrToken: cert.qr_token, file_url: cert.certificate_file_url,
      fingerprints: { recordSha256: cert.record_sha256, pdfSha256: cert.pdf_sha256, recordRecomputed: recomputed, recordMatches: !!cert.record_sha256 && recomputed === cert.record_sha256 },
      signature: { signed: !!cert.pdf_signed, subject: cert.signature_subject, signedAt: cert.signed_at },
      issuedBy: issued ? { id: issued.actor_id, name: issued.actor_name, at: issued.occurred_at } : null,
      revocation: cert.status === 'REVOKED' ? { at: cert.revoked_at, reason: cert.revocation_reason, by: { id: cert.revoked_by_user_id, name: cert.revoked_by_name } } : null,
    },
    instrument: { id: cert.instrument_id, name: cert.instrument_name, serialNumber: cert.serial_number, manufacturer: cert.manufacturer, model: cert.model, owner: { id: cert.owner_id, name: cert.owner_name }, location: cert.inst_lat == null ? null : { lat: cert.inst_lat, lng: cert.inst_lng } },
    application: { id: cert.application_id, number: cert.application_number },
    verification: {
      id: cert.verification_id, date: cert.verification_date, startedAt: cert.start_time, endedAt: cert.end_time, location: cert.verification_location,
      startGps: cert.start_lat == null ? null : { lat: cert.start_lat, lng: cert.start_lng },
      officer: { id: cert.performed_by_id, name: cert.performed_by_name },
      decision: cert.decision, resultSha256: cert.result_sha256, decidedAt: cert.result_date, decidedBy: cert.decided_by_id ? { id: cert.decided_by_id, name: cert.decided_by_name } : null,
    },
    readings: readings.map((r) => ({ id: r.id, type: r.reading_type, expected: r.expected_value, observed: r.observed_value, unit: r.unit, tolerance: r.tolerance, result: r.result, recordedAt: r.recorded_at })),
    photos: photos.map(photo),
    nameplateChecks: nameplates.map((n) => ({ id: n.id, file_url: n.file_url, sha256: n.file_sha256, advisory: n.advisory, status: n.status, uploadedBy: n.uploaded_by_name, at: n.created_at, reviewedBy: n.reviewed_by_name, reviewedAt: n.reviewed_at, note: n.review_note })),
    auditTrail: trail.map((e) => ({ id: e.id, action: e.action, at: e.occurred_at, by: e.actor_id ? { id: e.actor_id, name: e.actor_name } : null, hash: e.hash, previousHash: e.prev_hash })),
  };
}

async function caseEvidence(user, id) {
  requireAdmin(user);
  if (!UUID_RE.test(String(id))) throw ApiError.notFound('Case not found');
  const found = await repo.caseEvidence(id);
  if (!found) throw ApiError.notFound('Case not found');
  const c = found.case;
  await audit.recordStandalone({ actorId: user.id, action: 'HQ_EVIDENCE_VIEWED', entityType: 'enforcement_case', entityId: c.id, details: { caseNumber: c.case_number } });
  return {
    generatedAt: new Date().toISOString(),
    case: {
      id: c.id, number: c.case_number, source: c.source, offence: c.offence_type, status: c.status, description: c.description, location: c.location,
      gps: c.lat == null ? null : { lat: c.lat, lng: c.lng }, detectedOn: c.detected_on, detectedBy: { id: c.detected_by_id, name: c.detected_by_name },
      subject: { id: c.subject_user_id, name: c.subject_name, organization: c.subject_organization },
      penalty: c.penalty_amount,
    },
    instrument: c.instrument_id ? { id: c.instrument_id, name: c.instrument_name, serialNumber: c.serial_number } : null,
    certificate: c.certificate_id ? { id: c.certificate_id, number: c.certificate_number, recordSha256: c.record_sha256, pdfSha256: c.pdf_sha256 } : null,
    events: found.events.map((e) => ({ id: e.id, from: e.from_status, to: e.to_status, note: e.note, at: e.created_at, by: e.actor_id ? { id: e.actor_id, name: e.actor_name } : null })),
    auditTrail: found.audit.map((e) => ({ id: e.id, action: e.action, at: e.occurred_at, by: e.actor_name, hash: e.hash })),
  };
}

function parseDate(value, label) {
  if (value === undefined || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(value))) throw ApiError.badRequest(`${label} must be a date in YYYY-MM-DD format`);
  return String(value);
}

const EVIDENCE_COLUMNS = [
  ['certificate_id', 'Certificate ID'], ['certificate_number', 'Certificate number'], ['status', 'Status'], ['issue_date', 'Issue date'],
  ['valid_from', 'Valid from'], ['valid_until', 'Valid until'], ['record_sha256', 'Record fingerprint (SHA-256)'], ['pdf_sha256', 'PDF fingerprint (SHA-256)'],
  ['pdf_signed', 'PDF digitally signed'], ['issued_by', 'Issued by'], ['issued_by_id', 'Issued by (user ID)'], ['issued_at', 'Issued at'],
  ['instrument_id', 'Instrument ID'], ['serial_number', 'Serial number'], ['instrument_name', 'Instrument'], ['owner_name', 'Owner'], ['owner_id', 'Owner (user ID)'],
  ['application_number', 'Application'], ['verification_id', 'Verification ID'], ['verification_date', 'Verification date'], ['start_time', 'Started at'],
  ['start_lat', 'Start latitude'], ['start_lng', 'Start longitude'], ['officer_name', 'Inspecting officer'], ['officer_id', 'Officer (user ID)'],
  ['decision', 'Decision'], ['result_sha256', 'Result seal (SHA-256)'], ['result_date', 'Decided at'], ['decided_by', 'Decided by'],
  ['photo_count', 'Inspection photos'], ['photos', 'Photos (kind:ID:SHA-256)'], ['nameplate_checks', 'Nameplate checks'], ['latest_nameplate_status', 'Latest nameplate decision'],
  ['revoked_at', 'Revoked at'], ['revoked_by', 'Revoked by'],
];

async function evidenceCsv(user, query) {
  requireAdmin(user);
  const status = query.status ? String(query.status).toUpperCase() : null;
  if (status && !CERT_STATUSES.includes(status)) throw ApiError.badRequest(`status must be one of ${CERT_STATUSES.join(', ')}`);
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from && to && from > to) throw ApiError.badRequest('from must not be after to');
  const rows = await repo.evidenceRows({ status, from, to });
  await audit.recordStandalone({ actorId: user.id, action: 'HQ_EVIDENCE_EXPORTED', entityType: 'report', entityId: 'evidence-certificates', details: { status, from, to, rows: rows.length } });
  return { filename: `pramaan-evidence-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(EVIDENCE_COLUMNS, rows), rowCount: rows.length, truncated: rows.length >= repo.EVIDENCE_CSV_LIMIT };
}

module.exports = { overview, drill, map, certificateEvidence, caseEvidence, evidenceCsv };
