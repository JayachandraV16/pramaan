const service = require('./qr-auth.service');
const ApiResponse = require('../../utils/ApiResponse');

// Public QR certificate authentication
async function authenticateQr(req, res, next) {
  try {
    const result =
      await service.authenticateQrToken(
        req.params.token,
        {
          accessSource:
            req.get('x-access-source') ||
            'PUBLIC_PORTAL',

          ipAddress: req.ip,

          userAgent:
            req.get('user-agent'),
        }
      );

    new ApiResponse(
      200,
      result,
      'QR authentication completed'
    ).send(res);

  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateQr,
};