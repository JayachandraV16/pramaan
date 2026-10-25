const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./assignments.service');

const createAssignment = asyncHandler(async (req, res) => {
  const assignment = await service.createAssignment(
    req.user,
    req.body
  );

  new ApiResponse(
    201,
    assignment,
    'Assignment created successfully'
  ).send(res);
});

const getAssignments = asyncHandler(async (req, res) => {
  const assignments = await service.getAssignments(req.user);

  new ApiResponse(
    200,
    assignments,
    'Assignments retrieved successfully'
  ).send(res);
});

const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await service.getAssignmentById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    assignment,
    'Assignment retrieved successfully'
  ).send(res);
});

const updateAssignmentStatus = asyncHandler(async (req, res) => {
  const assignment = await service.updateAssignmentStatus(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    200,
    assignment,
    'Assignment status updated successfully'
  ).send(res);
});

const getAvailableOfficers = asyncHandler(async (req, res) => {
  const officers = await service.getAvailableOfficers();

  new ApiResponse(
    200,
    officers,
    'Available officers retrieved successfully'
  ).send(res);
});

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  getAvailableOfficers,
  updateAssignmentStatus,
};