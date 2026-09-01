const ApiError = require('../../utils/ApiError');
const repo = require('./instruments.repository');
const { ROLES } = require('../../config/roles');

async function createInstrument(user, data) {
  const type = await repo.findInstrumentTypeById(data.instrumentTypeId);

  if (!type) {
    throw ApiError.badRequest('Invalid or inactive instrument type');
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

module.exports = {
  createInstrument,
  getInstruments,
  getInstrumentById,
};