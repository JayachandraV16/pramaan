const CERTIFICATE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

const createCertificateRules = {
  verificationId: { required: true, type: 'string' },
  instrumentId: { required: true, type: 'string' },
  validFrom: { required: true, type: 'string' },
  validUntil: { required: true, type: 'string' },
};

const updateCertificateStatusRules = {
  status: { required: true, type: 'string' },
};

function isValidCertificateStatus(status) {
  return Object.values(CERTIFICATE_STATUSES).includes(status);
}

module.exports = {
  CERTIFICATE_STATUSES,
  createCertificateRules,
  updateCertificateStatusRules,
  isValidCertificateStatus,
};