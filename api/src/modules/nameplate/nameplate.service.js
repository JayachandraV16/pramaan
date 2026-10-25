// api/src/modules/nameplate/nameplate.service.js
//
// OCR-assisted nameplate check.
//   upload  owner of the instrument, ADMIN, or an officer assigned to it: the photo is
//           stored, read by the local OCR engine and compared with the registered data.
//   review  ADMIN or an assigned officer, never the person who uploaded the photo:
//           records CONFIRMED_MATCH, CONFIRMED_MISMATCH or UNREADABLE with a note.
//
// The machine's output is evidence and advice only. This module never changes the
// instrument, its certificates or enforcement cases; any follow-up is a human action.

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const pool = require('../../pool');
const instrumentsRepo = require('../instruments/instruments.repository');
const { parseNameplate } = require('./nameplate.parse');
const { compareToRegistered, advise } = require('./nameplate.compare');
const ocr = require('./ocrEngine');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = ['CONFIRMED_MATCH', 'CONFIRMED_MISMATCH', 'UNREADABLE'];
const NOTE_REQUIRED = ['CONFIRMED_MISMATCH', 'UNREADABLE'];
const VALUE_KEYS = ['serialNumber', 'manufacturer', 'model', 'capacity', 'accuracyClass'];

async function accessibleInstrument(user, instrumentId) {
  if (!UUID_RE.test(String(instrumentId))) throw ApiError.notFound('Instrument not found');
  const instrument = await instrumentsRepo.findInstrumentById(instrumentId);
  if (!instrument) throw ApiError.notFound('Instrument not found');
  if (user.role === ROLES.ADMIN) return instrument;
  if (user.role === ROLES.INSTRUMENT_OWNER && instrument.owner_id === user.id) return instrument;
  if ((user.role === ROLES.LMO || user.role === ROLES.GATC) && (await instrumentsRepo.isInstrumentAssignedToOfficer(instrumentId, user.id))) {
    return instrument;
  }
  throw ApiError.forbidden('You do not have access to this instrument');
}

const canReview = (user) => user.role === ROLES.ADMIN || user.role === ROLES.LMO || user.role === ROLES.GATC;

const REGISTERED_FIELDS = ['serial_number', 'manufacturer', 'model', 'capacity', 'capacity_unit', 'accuracy_class'];

function status() {
  return { available: ocr.isAvailable(), engine: ocr.isAvailable() ? ocr.engineName() : null };
}

async function createCheck(user, instrumentId, file) {
  const instrument = await accessibleInstrument(user, instrumentId);

  const recognised = await ocr.recognize(file.buffer);
  const { fields } = parseNameplate(recognised.text);
  const registeredSnapshot = Object.fromEntries(REGISTERED_FIELDS.map((k) => [k, instrument[k] ?? null]));
  const comparison = compareToRegistered(fields, registeredSnapshot);
  const { advisory, summary } = advise(comparison, recognised.confidence);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO nameplate_checks (
         instrument_id, uploaded_by_id, file_url, file_sha256, mime_type, engine, ocr_confidence,
         raw_text, extracted, registered_snapshot, comparison, advisory, advisory_summary
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        instrument.id, user.id, file.fileUrl, file.sha256, file.mimeType || null, recognised.engine,
        recognised.confidence, recognised.text, fields, registeredSnapshot, comparison, advisory, summary,
      ]
    );
    await audit.record(client, {
      actorId: user.id,
      action: 'NAMEPLATE_CHECK_CREATED',
      entityType: 'nameplate_check',
      entityId: rows[0].id,
      details: { instrumentId: instrument.id, serialNumber: instrument.serial_number, advisory, ocrConfidence: recognised.confidence, fileSha256: file.sha256 },
    });
    return rows[0].id;
  }).then((id) => getCheck(user, id));
}

async function loadRow(id) {
  if (!UUID_RE.test(String(id))) throw ApiError.notFound('Nameplate check not found');
  const { rows } = await pool.query(
    `SELECT c.*, u.full_name AS uploaded_by_name, r.full_name AS reviewed_by_name
       FROM nameplate_checks c
       JOIN users u ON u.id = c.uploaded_by_id
       LEFT JOIN users r ON r.id = c.reviewed_by_id
      WHERE c.id = $1`,
    [id]
  );
  if (!rows[0]) throw ApiError.notFound('Nameplate check not found');
  return rows[0];
}

async function getCheck(user, id) {
  const row = await loadRow(id);
  await accessibleInstrument(user, row.instrument_id);
  return { ...row, disclaimer: 'Machine reading and suggestion only; a person must confirm.' };
}

async function listForInstrument(user, instrumentId) {
  const instrument = await accessibleInstrument(user, instrumentId);
  const { rows } = await pool.query(
    `SELECT c.*, u.full_name AS uploaded_by_name, r.full_name AS reviewed_by_name
       FROM nameplate_checks c
       JOIN users u ON u.id = c.uploaded_by_id
       LEFT JOIN users r ON r.id = c.reviewed_by_id
      WHERE c.instrument_id = $1 ORDER BY c.created_at DESC`,
    [instrument.id]
  );
  return rows;
}

function cleanReviewerValues(values) {
  if (values === undefined || values === null) return null;
  if (typeof values !== 'object' || Array.isArray(values)) throw ApiError.badRequest('values must be an object');
  const out = {};
  for (const key of VALUE_KEYS) {
    if (values[key] === undefined || values[key] === null || values[key] === '') continue;
    if (typeof values[key] !== 'string' || values[key].length > 100) throw ApiError.badRequest(`values.${key} must be text of at most 100 characters`);
    out[key] = values[key].trim();
  }
  return Object.keys(out).length ? out : null;
}

async function review(user, id, data) {
  if (!canReview(user)) throw ApiError.forbidden('Only an administrator or an assigned officer can review a nameplate check');
  const decision = String(data.decision || '').toUpperCase();
  if (!DECISIONS.includes(decision)) throw ApiError.badRequest(`decision must be one of ${DECISIONS.join(', ')}`);
  const note = typeof data.note === 'string' ? data.note.trim() : '';
  if (note.length > 1000) throw ApiError.badRequest('note must be at most 1000 characters');
  if (NOTE_REQUIRED.includes(decision) && note.length < 5) throw ApiError.badRequest('A note (at least 5 characters) is required for this decision');
  const reviewerValues = cleanReviewerValues(data.values);

  const existing = await loadRow(id);
  const instrument = await accessibleInstrument(user, existing.instrument_id);
  if (existing.uploaded_by_id === user.id) {
    throw ApiError.conflict('A different person must review this check: you uploaded the photo');
  }

  await withTransaction(async (client) => {
    const { rows: locked } = await client.query('SELECT status, advisory FROM nameplate_checks WHERE id = $1 FOR UPDATE', [id]);
    if (locked[0].status !== 'PENDING_REVIEW') throw ApiError.conflict('This check has already been decided');

    await client.query(
      `UPDATE nameplate_checks
          SET status = $2, reviewed_by_id = $3, reviewed_at = now(), review_note = $4, reviewer_values = $5
        WHERE id = $1`,
      [id, decision, user.id, note || null, reviewerValues]
    );
    const agreed =
      (locked[0].advisory === 'ALL_MATCH' && decision === 'CONFIRMED_MATCH') ||
      (locked[0].advisory === 'LIKELY_MISMATCH' && decision === 'CONFIRMED_MISMATCH') ||
      (locked[0].advisory === 'UNREADABLE' && decision === 'UNREADABLE');
    await audit.record(client, {
      actorId: user.id,
      action: 'NAMEPLATE_CHECK_REVIEWED',
      entityType: 'nameplate_check',
      entityId: id,
      details: { instrumentId: instrument.id, machineAdvisory: locked[0].advisory, humanDecision: decision, agreedWithMachine: agreed, note: note || null },
    });
    if (instrument.owner_id !== user.id) {
      await notify(client, {
        recipientId: instrument.owner_id,
        type: 'APPLICATION_UPDATE',
        key: 'nameplate.result',
        params: { decision, name: instrument.instrument_name, serial: instrument.serial_number, note },
      });
    }
  });

  return getCheck(user, id);
}

module.exports = { status, createCheck, getCheck, listForInstrument, review, DECISIONS };
