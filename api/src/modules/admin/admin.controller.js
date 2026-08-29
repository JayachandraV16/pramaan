const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./admin.service');

const getActiveOfficers = asyncHandler(async (req, res) => {
  const officers = await service.getActiveOfficers(req.user);

  new ApiResponse(200, officers, 'Eligible officers retrieved successfully').send(res);
});

module.exports = { getActiveOfficers };