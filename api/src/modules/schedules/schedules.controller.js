const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./schedules.service');

const createSchedule = asyncHandler(async (req, res) => {
  const schedule = await service.createSchedule(
    req.user,
    req.body
  );

  new ApiResponse(
    201,
    schedule,
    'Verification schedule created successfully'
  ).send(res);
});

const getSchedules = asyncHandler(async (req, res) => {
  const schedules = await service.getSchedules(req.user);

  new ApiResponse(
    200,
    schedules,
    'Schedules retrieved successfully'
  ).send(res);
});

const getScheduleById = asyncHandler(async (req, res) => {
  const schedule = await service.getScheduleById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    schedule,
    'Schedule retrieved successfully'
  ).send(res);
});

const updateScheduleStatus = asyncHandler(async (req, res) => {
  const schedule = await service.updateScheduleStatus(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    200,
    schedule,
    'Schedule status updated successfully'
  ).send(res);
});

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateScheduleStatus,
};