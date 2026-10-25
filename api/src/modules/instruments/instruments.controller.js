const asyncHandler = require('../../utils/asyncHandler');
const { applyListQuery } = require('../../utils/listQuery');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./instruments.service');

const createInstrument = asyncHandler(async (req, res) => {
  const instrument = await service.createInstrument(req.user, req.body);

  new ApiResponse(
    201,
    instrument,
    'Instrument created successfully'
  ).send(res);
});

const getInstruments = asyncHandler(async (req, res) => {
  const instruments = applyListQuery(await service.getInstruments(req.user), req.query, {
    searchFields: ['instrument_name', 'serial_number', 'manufacturer', 'model', 'registration_number', 'owner_name', 'location_address'],
    filters: { status: 'status', typeId: 'instrument_type_id' },
    sortFields: ['created_at', 'instrument_name', 'serial_number', 'status'],
  });

  new ApiResponse(
    200,
    instruments,
    'Instruments retrieved successfully'
  ).send(res);
});

const getInstrumentById = asyncHandler(async (req, res) => {
  const instrument = await service.getInstrumentById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    instrument,
    'Instrument retrieved successfully'
  ).send(res);
});

const getVerificationStatus = asyncHandler(async (req, res) => {
  const items = await service.getVerificationStatus(req.user, req.query);

  new ApiResponse(
    200,
    items,
    'Instrument verification status retrieved successfully'
  ).send(res);
});

const listInstrumentTypes = asyncHandler(async (req, res) => {
  new ApiResponse(200, await service.listInstrumentTypes(req.user), 'Instrument types retrieved').send(res);
});

const updateInstrumentType = asyncHandler(async (req, res) => {
  const type = await service.updateInstrumentType(req.user, req.params.id, req.body);
  new ApiResponse(200, type, 'Instrument type updated').send(res);
});

module.exports = {
  listInstrumentTypes,
  updateInstrumentType,
  getVerificationStatus,
  createInstrument,
  getInstruments,
  getInstrumentById,
};