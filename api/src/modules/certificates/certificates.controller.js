const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./certificates.service');

// Create certificate
const createCertificate = asyncHandler(async (req, res) => {
  const certificate = await service.createCertificate(
    req.user,
    req.body
  );

  new ApiResponse(
    201,
    certificate,
    'Certificate issued successfully'
  ).send(res);
});

// Get all certificates
const getCertificates = asyncHandler(async (req, res) => {
  const certificates = await service.getCertificates(req.user);

  new ApiResponse(
    200,
    certificates,
    'Certificates retrieved successfully'
  ).send(res);
});

// Get certificate by ID
const getCertificateById = asyncHandler(async (req, res) => {
  const certificate = await service.getCertificateById(
    req.user,
    req.params.id
  );

  new ApiResponse(
    200,
    certificate,
    'Certificate retrieved successfully'
  ).send(res);
});

// Public QR verification
const verifyCertificate = asyncHandler(async (req, res) => {
  const result = await service.verifyCertificate(
    req.params.qrToken
  );

  new ApiResponse(
    200,
    result,
    'Certificate verification completed'
  ).send(res);
});

// Update certificate status
const updateCertificateStatus = asyncHandler(async (req, res) => {
  const certificate = await service.updateCertificateStatus(
    req.user,
    req.params.id,
    req.body
  );

  new ApiResponse(
    200,
    certificate,
    'Certificate status updated successfully'
  ).send(res);
});

module.exports = {
  createCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  updateCertificateStatus,
};