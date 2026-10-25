const service = require('./qr-auth.service');
const copyCheck = require('./copyCheck');
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

// Public: a photograph, scan or scanned PDF of a paper certificate (QR code + printed text vs the registry)
const checkCopy = asyncHandler(async (req, res) => {
  const result = await copyCheck.checkCopy({ buffer: req.file.buffer, mimetype: req.file.mimetype }, requestMetadata(req));

  new ApiResponse(200, result, 'Copy check completed').send(res);
});

module.exports = {
  authenticateQr,
  checkDocument,
  checkCopy,
};
