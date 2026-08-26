const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./verifications.service');

// Start field verification
const createVerification = asyncHandler(async (req, res) => {
  const verification = await service.createVerification(
    req.user,
    req.body
  );

  new ApiResponse(
    201,
    verification,
    'Verification started successfully'
  ).send(res);
});

// Add observation
const addObservation = asyncHandler(async (req, res) => {
  const observation = await service.addObservation(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    201,
    observation,
    'Observation added successfully'
  ).send(res);
});

// Add measurement reading
const addReading = asyncHandler(async (req, res) => {
  const reading = await service.addReading(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    201,
    reading,
    'Verification reading added successfully'
  ).send(res);
});

// Get all accessible verifications
const getVerifications = asyncHandler(async (req, res) => {
  const verifications = await service.getVerifications(req.user);

  new ApiResponse(
    200,
    verifications,
    'Verifications retrieved successfully'
  ).send(res);
});

// Get one verification with observations/readings/result
const getVerificationById = asyncHandler(async (req, res) => {
  const verification = await service.getVerificationById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    verification,
    'Verification retrieved successfully'
  ).send(res);
});

// Submit final PASS/FAIL result
const submitResult = asyncHandler(async (req, res) => {
  const result = await service.submitResult(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    200,
    result,
    'Verification result submitted successfully'
  ).send(res);
});

module.exports = {
  createVerification,
  addObservation,
  addReading,
  getVerifications,
  getVerificationById,
  submitResult,
};