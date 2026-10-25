const asyncHandler = require('../../utils/asyncHandler');
const { applyListQuery } = require('../../utils/listQuery');
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
  const certificates = applyListQuery(await service.getCertificates(req.user), req.query, {
    searchFields: ['certificate_number', 'instrument_name', 'instrument_serial', 'owner_name', 'application_number'],
    filters: { status: 'status' },
    sortFields: ['created_at', 'issue_date', 'valid_until', 'certificate_number', 'status'],
  });

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
    req.params.qrToken,
    {
      signature: req.query.s,
      metadata: {
        accessSource: req.get('x-access-source') || 'PUBLIC_PORTAL',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    }
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