const asyncHandler = require('../../utils/asyncHandler');
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
  const instruments = await service.getInstruments(req.user);

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

module.exports = {
  createInstrument,
  getInstruments,
  getInstrumentById,
};