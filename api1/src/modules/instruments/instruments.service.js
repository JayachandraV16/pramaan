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

  return repo.createInstrument({
    ownerId: user.id,
    ...data,
  });
}

async function getInstruments(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllInstruments();
  }

  return repo.findInstrumentsByOwnerId(user.id);
}

async function getInstrumentById(user, instrumentId) {
  const instrument = await repo.findInstrumentById(instrumentId);

  if (!instrument) {
    throw ApiError.notFound('Instrument not found');
  }

  if (
    user.role !== ROLES.ADMIN &&
    instrument.owner_id !== user.id
  ) {
    throw ApiError.forbidden('You do not have permission to access this instrument');
  }

  return instrument;
}

module.exports = {
  createInstrument,
  getInstruments,
  getInstrumentById,
};