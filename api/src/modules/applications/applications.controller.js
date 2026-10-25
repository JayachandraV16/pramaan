const asyncHandler = require('../../utils/asyncHandler');
const { applyListQuery } = require('../../utils/listQuery');
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
  const applications = applyListQuery(await service.getApplications(req.user), req.query, {
    searchFields: ['application_number', 'instrument_name', 'serial_number', 'applicant_name', 'owner_name', 'division', 'gras_challan_number'],
    filters: { status: 'status', type: 'application_type', division: 'division' },
    sortFields: ['created_at', 'submitted_at', 'application_number', 'status'],
  });

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

const getApplicationHistory = asyncHandler(async (req, res) => {
  const history = await service.getApplicationHistory(req.user, req.params.id);

  new ApiResponse(200, history, 'Application history retrieved successfully').send(res);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const application = await service.verifyPayment(req.user, req.params.id);

  new ApiResponse(200, application, 'Payment verified').send(res);
});

const cancelApplication = asyncHandler(async (req, res) => {
  const application = await service.cancelApplication(req.user, req.params.id, req.body?.reason);

  new ApiResponse(200, application, 'Application cancelled').send(res);
});

const rejectApplication = asyncHandler(async (req, res) => {
  const application = await service.rejectApplication(req.user, req.params.id, req.body?.reason);

  new ApiResponse(200, application, 'Application rejected').send(res);
});

module.exports = {
  verifyPayment,
  createApplication,
  getApplications,
  getApplicationById,
  getApplicationHistory,
  cancelApplication,
  rejectApplication,
};