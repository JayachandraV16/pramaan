const service = require('./qr-auth.service');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');

function requestMetadata(req) {
  return {
    accessSource: req.get('x-access-source') || undefined,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

// Public QR / certificate-number authentication
const authenticateQr = asyncHandler(async (req, res) => {
  const result = await service.verifyPublic(
    { identifier: req.params.identifier, signature: req.query.s },
    requestMetadata(req)
  );

  new ApiResponse(200, result, 'QR authentication completed').send(res);
});

// Public: check an uploaded certificate PDF against the registry by SHA-256
const checkDocument = asyncHandler(async (req, res) => {
  const result = await service.checkDocument(req.file.buffer, requestMetadata(req));

  new ApiResponse(200, result, 'Document check completed').send(res);
});

module.exports = {
  authenticateQr,
  checkDocument,
};
