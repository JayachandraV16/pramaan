const ApiError = require('../../utils/ApiError');
const repo = require('./instruments.repository');
const { ROLES } = require('../../config/roles');
const audit = require('../../utils/audit');

async function createInstrument(user, data) {
  const type = await repo.findInstrumentTypeById(data.instrumentTypeId);

  if (!type) {
    throw ApiError.badRequest('Invalid or inactive instrument type');
  }

  // A map location is optional, but when given it must be a complete, valid point.
  const lat = data.locationLat ?? null;
  const lng = data.locationLng ?? null;
  if ((lat === null) !== (lng === null)) {
    throw ApiError.badRequest('locationLat and locationLng must be provided together');
  }
  if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    throw ApiError.badRequest('locationLat/locationLng are out of range');
  }

  const existing = await repo.findInstrumentBySerialNumber(data.serialNumber);

  if (existing) {
    throw ApiError.conflict('An instrument with this serial number already exists');
  }

  const created = await repo.createInstrument({
    ownerId: user.id,
    ...data,
  });

  return repo.findInstrumentById(created.id);
}

async function getInstruments(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllInstruments();
  }

  if (user.role === ROLES.LMO || user.role === ROLES.GATC) {
    return repo.findInstrumentsAssignedToOfficerId(user.id);
  }

  return repo.findInstrumentsByOwnerId(user.id);
}

async function getInstrumentById(user, instrumentId) {
  const instrument = await repo.findInstrumentById(instrumentId);

  if (!instrument) {
    throw ApiError.notFound('Instrument not found');
  }

  if (user.role === ROLES.ADMIN) {
    return instrument;
  }

  if (user.role === ROLES.LMO || user.role === ROLES.GATC) {
    const isAssigned = await repo.isInstrumentAssignedToOfficer(instrumentId, user.id);
    if (!isAssigned) {
      throw ApiError.forbidden('You can only access instruments assigned to you by the Administrator');
    }
    return instrument;
  }

  if (instrument.owner_id !== user.id) {
    throw ApiError.forbidden('You do not have permission to access this instrument');
  }

  return instrument;
}

const VERIFICATION_STATES = ['NEVER_VERIFIED', 'VALID', 'DUE_SOON', 'OVERDUE', 'REVOKED'];

// Instruments with their next re-verification due date. Owners see their own,
// LMO/GATC the instruments assigned to them, ADMIN everything.
async function getVerificationStatus(user, query = {}) {
  let state;
  if (query.state) {
    state = String(query.state).toUpperCase();
    if (!VERIFICATION_STATES.includes(state)) {
      throw ApiError.badRequest(`Invalid state: ${query.state}`);
    }
  }
  let withinDays;
  if (query.withinDays !== undefined) {
    withinDays = Number(query.withinDays);
    if (!Number.isInteger(withinDays) || withinDays < 0 || withinDays > 3650) {
      throw ApiError.badRequest('withinDays must be an integer between 0 and 3650');
    }
  }

  const scope =
    user.role === ROLES.INSTRUMENT_OWNER ? { ownerId: user.id }
      : user.role === ROLES.LMO || user.role === ROLES.GATC ? { officerId: user.id }
        : {};

  return repo.findVerificationStatus({ ...scope, state, withinDays });
}

async function listInstrumentTypes(user) {
  // Owners only need the types they can register; admins also see inactive ones.
  return repo.listInstrumentTypes({ activeOnly: user.role !== ROLES.ADMIN });
}

async function updateInstrumentType(user, id, data) {
  if (data.defaultValidityMonths !== undefined) {
    const months = data.defaultValidityMonths;
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      throw ApiError.badRequest('defaultValidityMonths must be a whole number between 1 and 120');
    }
  }
  const updated = await repo.updateInstrumentType(id, data);
  if (!updated) throw ApiError.notFound('Instrument type not found');
  await audit.recordStandalone({
    actorId: user.id,
    action: 'INSTRUMENT_TYPE_UPDATED',
    entityType: 'instrument_type',
    entityId: id,
    details: data,
  });
  return updated;
}

module.exports = {
  listInstrumentTypes,
  updateInstrumentType,
  getVerificationStatus,
  createInstrument,
  getInstruments,
  getInstrumentById,
};