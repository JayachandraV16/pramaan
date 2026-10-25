// api/src/modules/enforcement/enforcement.service.js
//
// Enforcement cases and repeat-offender tracking.
//   - ADMIN, LMO and GATC register cases (spot checks, complaints, routine
//     inspections). A spot check that finds nothing is recorded as offence
//     type NONE and is closed immediately; it is not counted against anyone.
//   - The facts of a case are immutable (database trigger). Only ADMIN moves
//     the handling status: OPEN -> NOTICE_ISSUED -> PENALTY_IMPOSED -> RESOLVED,
//     or DISMISSED (reason required). Every step is stored in the case timeline
//     and in the audit log.
//   - An offender is the registered owner, or an unregistered trader identified
//     by normalised name (+ phone). The 2nd offence within 12 months flags
//     REPEAT, the 3rd HABITUAL (view repeat_offenders); admins are notified.

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const repo = require('./enforcement.repository');

const SOURCES = ['SPOT_CHECK', 'COMPLAINT', 'ROUTINE_INSPECTION'];
const OFFENCES = ['NONE', 'UNVERIFIED_INSTRUMENT', 'EXPIRED_CERTIFICATE', 'UNSTAMPED_INSTRUMENT', 'SEAL_TAMPERING', 'FALSE_WEIGHT_OR_MEASURE', 'OTHER'];

const TRANSITIONS = {
  OPEN: ['NOTICE_ISSUED', 'PENALTY_IMPOSED', 'RESOLVED', 'DISMISSED'],
  NOTICE_ISSUED: ['PENALTY_IMPOSED', 'RESOLVED', 'DISMISSED'],
  PENALTY_IMPOSED: ['RESOLVED'],
  RESOLVED: [],
  DISMISSED: [],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw ApiError.badRequest(`${field} is required`);
    return null;
  }
  const s = String(value).trim();
  if (s.length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters`);
  return s;
}

function normaliseName(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function offenderKeyFor({ subjectUserId, subjectName, subjectPhone }) {
  if (subjectUserId) return `user:${subjectUserId}`;
  const phone = (subjectPhone || '').replace(/\D/g, '');
  return `name:${normaliseName(subjectName)}${phone ? `|${phone}` : ''}`;
}

async function createCase(user, data) {
  const source = String(data.source || '').toUpperCase();
  const offenceType = String(data.offenceType || '').toUpperCase();
  if (!SOURCES.includes(source)) throw ApiError.badRequest(`source must be one of ${SOURCES.join(', ')}`);
  if (!OFFENCES.includes(offenceType)) throw ApiError.badRequest(`offenceType must be one of ${OFFENCES.join(', ')}`);
  const description = text(data.description, 'description', { required: true });

  const latitude = data.latitude ?? null;
  const longitude = data.longitude ?? null;
  if ((latitude === null) !== (longitude === null)) throw ApiError.badRequest('latitude and longitude must be provided together');
  if (latitude !== null && (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) throw ApiError.badRequest('latitude/longitude out of range');
  if (data.detectedOn && !/^\d{4}-\d{2}-\d{2}$/.test(data.detectedOn)) throw ApiError.badRequest('detectedOn must be YYYY-MM-DD');
  if (data.detectedOn && data.detectedOn > new Date().toISOString().slice(0, 10)) throw ApiError.badRequest('detectedOn cannot be in the future');

  // Resolve who the case is about.
  let subjectUserId = null;
  let instrument = null;
  if (data.certificateId && !UUID_RE.test(data.certificateId)) throw ApiError.badRequest('certificateId is not valid');
  if (data.instrumentId) {
    if (!UUID_RE.test(data.instrumentId)) throw ApiError.badRequest('instrumentId is not valid');
    instrument = await repo.findInstrument(data.instrumentId);
    if (!instrument) throw ApiError.notFound('Instrument not found');
    subjectUserId = instrument.owner_id;
  }
  if (data.certificateId) {
    const cert = await repo.findCertificate(data.certificateId);
    if (!cert) throw ApiError.notFound('Certificate not found');
    if (instrument && cert.instrument_id !== instrument.id) throw ApiError.badRequest('The certificate does not belong to that instrument');
  }
  if (data.subjectUserId) {
    if (!UUID_RE.test(data.subjectUserId)) throw ApiError.badRequest('subjectUserId is not valid');
    if (subjectUserId && subjectUserId !== data.subjectUserId) throw ApiError.badRequest('The instrument belongs to a different owner');
    subjectUserId = data.subjectUserId;
  }

  let subjectName = text(data.subjectName, 'subjectName', { max: 200 });
  let subjectOrganization = text(data.subjectOrganization, 'subjectOrganization', { max: 200 });
  let subjectPhone = text(data.subjectPhone, 'subjectPhone', { max: 30 });
  if (subjectUserId) {
    const owner = await repo.findUser(subjectUserId);
    if (!owner) throw ApiError.notFound('Subject user not found');
    subjectName = owner.full_name;
    subjectOrganization = subjectOrganization || owner.organization_name;
    subjectPhone = subjectPhone || owner.phone;
  }
  if (!subjectName) throw ApiError.badRequest('subjectName is required when the subject is not a registered user');

  const compliant = offenceType === 'NONE';
  const offenderKey = offenderKeyFor({ subjectUserId, subjectName, subjectPhone });
  const year = new Date().getUTCFullYear();

  return withTransaction(async (client) => {
    await repo.lockOffender(client, offenderKey);
    const offenceNumber = compliant ? 0 : (await repo.countCountedOffences(client, offenderKey)) + 1;
    const caseNumber = await repo.nextCaseNumber(client, year);

    const row = await repo.insertCase(client, {
      caseNumber, source, offenceType, status: compliant ? 'RESOLVED' : 'OPEN', offenderKey,
      subjectUserId, subjectName, subjectOrganization, subjectPhone,
      instrumentId: instrument ? instrument.id : null, certificateId: data.certificateId || null,
      description, location: text(data.location, 'location', { max: 500 }), latitude, longitude,
      detectedOn: data.detectedOn || null, detectedById: user.id, offenceNumber,
      resolvedAt: compliant ? new Date() : null,
      resolutionNote: compliant ? 'Spot check found no offence' : null,
    });
    await repo.insertEvent(client, { caseId: row.id, fromStatus: null, toStatus: row.status, note: 'Case registered', actorId: user.id });
    await audit.record(client, {
      actorId: user.id, action: 'ENFORCEMENT_CASE_REGISTERED', entityType: 'enforcement_case', entityId: row.id,
      details: { caseNumber, offenceType, source, offenderKey, offenceNumber },
    });

    if (!compliant && subjectUserId) {
      await notify(client, {
        recipientId: subjectUserId, type: 'ENFORCEMENT_ACTION',
        key: 'enforcement.registered',
        params: { caseNumber, offence: offenceType },
      });
    }
    const standing = await repo.offenderStanding(client, offenderKey);
    if (standing && (standing.flag === 'REPEAT' || standing.flag === 'HABITUAL') && !compliant) {
      for (const adminId of await repo.findAdminIds(client)) {
        await notify(client, {
          recipientId: adminId, type: 'ENFORCEMENT_ACTION',
          key: 'enforcement.offender',
          params: { flag: standing.flag, name: standing.subject_name, offences: standing.offences_12m, caseNumber },
        });
      }
    }
    return { ...row, offender_flag: standing ? standing.flag : 'FIRST', offender_offences_12m: standing ? standing.offences_12m : 0 };
  });
}

async function updateStatus(user, id, data) {
  const target = String(data.status || '').toUpperCase();
  if (!Object.keys(TRANSITIONS).includes(target)) throw ApiError.badRequest('status is not valid');
  const note = text(data.note, 'note', { max: 2000 });
  const amount = data.penaltyAmount === undefined || data.penaltyAmount === null ? null : Number(data.penaltyAmount);

  if (target === 'DISMISSED' && (!note || note.length < 5)) throw ApiError.badRequest('A reason (note) is required to dismiss a case');
  if (target === 'PENALTY_IMPOSED' && !(amount > 0)) throw ApiError.badRequest('penaltyAmount greater than zero is required to impose a penalty');
  if (amount !== null && !Number.isFinite(amount)) throw ApiError.badRequest('penaltyAmount must be a number');

  return withTransaction(async (client) => {
    const current = await repo.findByIdForUpdate(client, id);
    if (!current) throw ApiError.notFound('Enforcement case not found');
    if (!TRANSITIONS[current.status].includes(target)) {
      throw ApiError.badRequest(`A case that is ${current.status} cannot move to ${target}`);
    }
    const final = target === 'RESOLVED' || target === 'DISMISSED';
    const updated = await repo.applyStatus(client, id, {
      status: target,
      penaltyAmount: target === 'PENALTY_IMPOSED' ? amount : null,
      penaltyReference: target === 'PENALTY_IMPOSED' ? text(data.penaltyReference, 'penaltyReference', { max: 200 }) : null,
      resolutionNote: final ? note : null,
      resolvedAt: final ? new Date() : null,
    });
    await repo.insertEvent(client, { caseId: id, fromStatus: current.status, toStatus: target, note, actorId: user.id });
    await audit.record(client, {
      actorId: user.id, action: 'ENFORCEMENT_STATUS_CHANGED', entityType: 'enforcement_case', entityId: id,
      details: { caseNumber: current.case_number, from: current.status, to: target, penaltyAmount: amount, note },
    });
    if (current.subject_user_id && current.offence_type !== 'NONE' && target !== 'DISMISSED') {
      await notify(client, {
        recipientId: current.subject_user_id, type: 'ENFORCEMENT_ACTION',
        key: 'enforcement.status',
        params: { caseNumber: current.case_number, status: target, penaltyAmount: target === 'PENALTY_IMPOSED' ? amount : null, note },
      });
    }
    return updated;
  });
}

function canSee(user, row) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.INSTRUMENT_OWNER) return row.subject_user_id === user.id && row.offence_type !== 'NONE';
  return row.detected_by_id === user.id;
}

async function listCases(user) {
  if (user.role === ROLES.ADMIN) return repo.listCases({});
  if (user.role === ROLES.INSTRUMENT_OWNER) return repo.listCases({ subjectUserId: user.id });
  return repo.listCases({ detectedBy: user.id });
}

async function getCase(user, id) {
  if (!UUID_RE.test(id)) throw ApiError.notFound('Enforcement case not found');
  const row = await repo.findById(id);
  if (!row || !canSee(user, row)) throw ApiError.notFound('Enforcement case not found');
  return { ...row, events: await repo.findEvents(id) };
}

async function listOffenders(query) {
  const flags = query.all === 'true' ? ['FIRST', 'REPEAT', 'HABITUAL'] : query.flag ? [String(query.flag).toUpperCase()] : ['REPEAT', 'HABITUAL'];
  return repo.listOffenders({ flags });
}

module.exports = { createCase, updateStatus, listCases, getCase, listOffenders, summary: repo.summary, SOURCES, OFFENCES };
