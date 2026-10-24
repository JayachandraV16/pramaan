// api/src/modules/instruments/instruments.lifecycle.js
//
// Editing an instrument and taking it out of service.
//
//   PATCH /api/instruments/:id               edit details (owner of the instrument, or ADMIN)
//   POST  /api/instruments/:id/deactivate    REGISTERED/ACTIVE -> INACTIVE      (reversible)
//   POST  /api/instruments/:id/reactivate    INACTIVE          -> REGISTERED
//   POST  /api/instruments/:id/decommission  any live status   -> DECOMMISSIONED (final; reason >= 10 chars)
//
// Rules:
//   - officers cannot change instruments;
//   - nothing can change while an application for the instrument is open, except
//     its name and location (the verification is in progress on the recorded data);
//   - serial number and type are fixed once the instrument has had any application
//     (certificates refer to them) - also enforced by a database trigger;
//   - a decommissioned instrument is frozen (database trigger).

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const repo = require('./instruments.repository');

const MIN_DECOMMISSION_REASON = 10;
const LIVE = ['REGISTERED', 'ACTIVE'];

// body field -> column; "measured" fields describe what is being verified.
const FIELDS = {
  instrumentName: { column: 'instrument_name', measured: false },
  locationAddress: { column: 'location_address', measured: false },
  locationLat: { column: 'location_lat', measured: false },
  locationLng: { column: 'location_lng', measured: false },
  manufacturer: { column: 'manufacturer', measured: true },
  model: { column: 'model', measured: true },
  capacity: { column: 'capacity', measured: true },
  capacityUnit: { column: 'capacity_unit', measured: true },
  accuracyClass: { column: 'accuracy_class', measured: true },
  serialNumber: { column: 'serial_number', measured: true, identity: true },
  instrumentTypeId: { column: 'instrument_type_id', measured: true, identity: true },
};

function clean(field, value) {
  const text = (max) => {
    if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
    if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text`);
    if (value.trim().length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters`);
    return value.trim();
  };
  switch (field) {
    case 'instrumentName':
    case 'serialNumber': {
      const v = text(field === 'serialNumber' ? 100 : 200);
      if (!v) throw ApiError.badRequest(`${field} cannot be empty`);
      return v;
    }
    case 'manufacturer':
    case 'model':
    case 'accuracyClass':
    case 'capacityUnit':
      return text(100);
    case 'locationAddress':
      return text(500);
    case 'instrumentTypeId':
      if (typeof value !== 'string' || !value) throw ApiError.badRequest('instrumentTypeId must be an id');
      return value;
    case 'capacity':
      if (value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw ApiError.badRequest('capacity must be a number greater than zero');
      return value;
    case 'locationLat':
    case 'locationLng':
      if (value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isFinite(value)) throw ApiError.badRequest(`${field} must be a number`);
      if (Math.abs(value) > (field === 'locationLat' ? 90 : 180)) throw ApiError.badRequest(`${field} is out of range`);
      return value;
    default:
      return value;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadManageable(user, id) {
  if (!UUID_RE.test(id)) throw ApiError.notFound('Instrument not found');
  const instrument = await repo.findInstrumentById(id);
  if (!instrument) throw ApiError.notFound('Instrument not found');
  if (user.role !== ROLES.ADMIN && !(user.role === ROLES.INSTRUMENT_OWNER && instrument.owner_id === user.id)) {
    throw ApiError.forbidden('Only the instrument owner or an administrator can change this instrument');
  }
  if (instrument.status === 'DECOMMISSIONED') {
    throw ApiError.conflict('This instrument has been decommissioned and can no longer be changed');
  }
  return instrument;
}

async function updateInstrument(user, id, data) {
  const instrument = await loadManageable(user, id);

  const changes = {};
  for (const [field, spec] of Object.entries(FIELDS)) {
    if (data[field] === undefined) continue;
    const value = clean(field, data[field]);
    const current = instrument[spec.column];
    const same = current === null || current === undefined ? value === null : String(current) === String(value);
    if (!same) changes[field] = value;
  }
  if (Object.keys(changes).length === 0) return instrument;

  const touchesMeasured = Object.keys(changes).some((f) => FIELDS[f].measured);
  if (touchesMeasured) {
    const open = await repo.findOpenApplication(id);
    if (open) {
      throw ApiError.conflict(
        `Application ${open.application_number} (${open.status}) is open: only the name and location can be edited until it is finished`
      );
    }
  }

  if (changes.serialNumber !== undefined || changes.instrumentTypeId !== undefined) {
    if ((await repo.countApplications(id)) > 0) {
      throw ApiError.conflict('The serial number and type cannot be changed once the instrument has had an application');
    }
  }
  if (changes.serialNumber !== undefined) {
    const dup = await repo.findInstrumentBySerialNumber(changes.serialNumber);
    if (dup && dup.id !== id) throw ApiError.conflict('An instrument with this serial number already exists');
  }
  if (changes.instrumentTypeId !== undefined) {
    const type = await repo.findInstrumentTypeById(changes.instrumentTypeId);
    if (!type) throw ApiError.badRequest('Invalid or inactive instrument type');
  }
  const lat = changes.locationLat !== undefined ? changes.locationLat : instrument.location_lat;
  const lng = changes.locationLng !== undefined ? changes.locationLng : instrument.location_lng;
  if ((lat === null || lat === undefined) !== (lng === null || lng === undefined)) {
    throw ApiError.badRequest('locationLat and locationLng must be given together');
  }

  const columns = {};
  const before = {};
  const after = {};
  for (const [field, value] of Object.entries(changes)) {
    columns[FIELDS[field].column] = value;
    before[field] = instrument[FIELDS[field].column];
    after[field] = value;
  }

  await withTransaction(async (client) => {
    const keys = Object.keys(columns);
    await client.query(
      `UPDATE instruments SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [id, ...keys.map((k) => columns[k])]
    );
    await audit.record(client, {
      actorId: user.id,
      action: 'INSTRUMENT_UPDATED',
      entityType: 'instrument',
      entityId: id,
      details: { serialNumber: instrument.serial_number, before, after },
    });
  });

  return repo.findInstrumentById(id);
}

const ACTIONS = {
  deactivate: { from: LIVE, to: 'INACTIVE', verb: 'deactivated', audit: 'INSTRUMENT_DEACTIVATED', blockedByOpen: true },
  reactivate: { from: ['INACTIVE'], to: 'REGISTERED', verb: 'reactivated', audit: 'INSTRUMENT_REACTIVATED', blockedByOpen: false },
  decommission: { from: [...LIVE, 'INACTIVE'], to: 'DECOMMISSIONED', verb: 'decommissioned', audit: 'INSTRUMENT_DECOMMISSIONED', blockedByOpen: true, reasonRequired: true },
};

async function changeStatus(user, id, action, data = {}) {
  const spec = ACTIONS[action];
  if (!spec) throw ApiError.badRequest('Unknown action');
  const instrument = await loadManageable(user, id);

  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  if (spec.reasonRequired && reason.length < MIN_DECOMMISSION_REASON) {
    throw ApiError.badRequest(`A reason of at least ${MIN_DECOMMISSION_REASON} characters is required`);
  }
  if (reason.length > 500) throw ApiError.badRequest('The reason must be at most 500 characters');
  if (!spec.from.includes(instrument.status)) {
    throw ApiError.conflict(`An instrument that is ${instrument.status} cannot be ${spec.verb}`);
  }
  if (spec.blockedByOpen) {
    const open = await repo.findOpenApplication(id);
    if (open) {
      throw ApiError.conflict(`Application ${open.application_number} (${open.status}) is still open; cancel or finish it first`);
    }
  }

  await withTransaction(async (client) => {
    await repo.setInstrumentStatus(client, id, { status: spec.to, reason, actorId: user.id });
    await audit.record(client, {
      actorId: user.id,
      action: spec.audit,
      entityType: 'instrument',
      entityId: id,
      details: { serialNumber: instrument.serial_number, from: instrument.status, to: spec.to, reason: reason || null },
    });
    if (user.id !== instrument.owner_id) {
      await notify(client, {
        recipientId: instrument.owner_id,
        type: 'APPLICATION_UPDATE',
        key: 'instrument.status',
        params: { action: spec.verb, name: instrument.instrument_name, serial: instrument.serial_number, reason },
      });
    }
  });

  return repo.findInstrumentById(id);
}

module.exports = { updateInstrument, changeStatus };
