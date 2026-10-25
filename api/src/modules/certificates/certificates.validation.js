const CERTIFICATE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

// instrumentId is optional: it is derived from the verification's
// application, and rejected if it disagrees. validFrom / validUntil are
// optional too — when omitted the instrument type's default validity
// (instrument_types.default_validity_months) starting today is used.
const createCertificateRules = {
  verificationId: { required: true, type: 'string' },
  instrumentId: { required: false, type: 'string' },
  validFrom: { required: false, type: 'string' },
  validUntil: { required: false, type: 'string' },
};

const updateCertificateStatusRules = {
  status: { required: true, type: 'string' },
  reason: { required: false, type: 'string' },
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
