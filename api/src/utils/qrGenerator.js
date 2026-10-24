const QRCode = require('qrcode');
const config = require('../config');
const { qrSignature } = require('./certificateIntegrity');

// The QR encodes a link to the public verification page:
//   {FRONTEND_URL}/verify-public?q=<qr_token>&s=<signature>
// `s` is an HMAC over the token and certificate number, so a hand-edited or
// fabricated link is rejected by the server.
function buildVerificationUrl(qrToken, certificateNumber) {
  const params = new URLSearchParams({
    q: qrToken,
    s: qrSignature(qrToken, certificateNumber),
  });
  return `${config.frontendUrl}/verify-public?${params.toString()}`;
}

async function generateQRCode(qrToken, certificateNumber) {
  const qrCodeBuffer = await QRCode.toBuffer(
    buildVerificationUrl(qrToken, certificateNumber),
    {
      type: 'png',
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    }
  );

  return qrCodeBuffer;
}

module.exports = {
  generateQRCode,
  buildVerificationUrl,
};
