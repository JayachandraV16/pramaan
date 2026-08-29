const QRCode = require('qrcode');

async function generateQRCode(qrToken) {
  const verificationUrl =
    `http://localhost:5000/api/certificates/verify/${qrToken}`;

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