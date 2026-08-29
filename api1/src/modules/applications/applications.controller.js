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

const requestInfo = asyncHandler(async (req, res) => {
  const application = await service.requestInfo(req.user, req.params.id, req.body);
  new ApiResponse(200, application, 'Information requested successfully').send(res);
});

const respondInfo = asyncHandler(async (req, res) => {
  const application = await service.respondInfo(req.user, req.params.id, req.body);
  new ApiResponse(200, application, 'Response submitted successfully').send(res);
});

const returnForCorrection = asyncHandler(async (req, res) => {
  const application = await service.returnForCorrection(req.user, req.params.id, req.body);
  new ApiResponse(200, application, 'Application returned for correction').send(res);
});

const resubmitApplication = asyncHandler(async (req, res) => {
  const application = await service.resubmitApplication(req.user, req.params.id, req.body);
  new ApiResponse(200, application, 'Application resubmitted successfully').send(res);
});

const rejectApplication = asyncHandler(async (req, res) => {
  const application = await service.rejectApplication(req.user, req.params.id, req.body);
  new ApiResponse(200, application, 'Application rejected successfully').send(res);
});

const trackApplicationPublic = asyncHandler(async (req, res) => {
  const data = await service.trackApplicationPublic(req.params.applicationNumber);
  new ApiResponse(200, data, 'Application status retrieved successfully').send(res);
});

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  requestInfo,
  respondInfo,
  returnForCorrection,
  resubmitApplication,
  rejectApplication,
  trackApplicationPublic,
};