const QR_AUTH_RESULTS = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

function isValidQrToken(token) {
  return typeof token === 'string' && token.trim().length > 0;
}

module.exports = {
  QR_AUTH_RESULTS,
  isValidQrToken,
};