const QRCode = require('qrcode');

async function generateQRCode(qrToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-public?q=${encodeURIComponent(qrToken)}`;

  const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
    type: 'png',
    width: 300,
    margin: 2,
  });

  return qrCodeBuffer;
}

module.exports = {
  generateQRCode,
};