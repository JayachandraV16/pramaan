const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./instrument-types.service');

const getInstrumentTypes = asyncHandler(async (req, res) => {
  const instrumentTypes = await service.getInstrumentTypes();

  new ApiResponse(
    200,
    instrumentTypes,
    'Instrument types retrieved successfully'
  ).send(res);
});

module.exports = {
  getInstrumentTypes,
};
