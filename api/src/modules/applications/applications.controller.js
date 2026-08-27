const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./applications.service');

const createApplication = asyncHandler(async (req, res) => {
  const application = await service.createApplication(
    req.user,
    req.body
  );

  new ApiResponse(
    201,
    application,
    'Verification application submitted successfully'
  ).send(res);
});

const getApplications = asyncHandler(async (req, res) => {
  const applications = await service.getApplications(req.user);

  new ApiResponse(
    200,
    applications,
    'Applications retrieved successfully'
  ).send(res);
});

const getApplicationById = asyncHandler(async (req, res) => {
  const application = await service.getApplicationById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    application,
    'Application retrieved successfully'
  ).send(res);
});

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
};