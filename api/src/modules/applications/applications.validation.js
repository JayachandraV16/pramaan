const APPLICATION_TYPES = Object.freeze({
  VERIFICATION: 'VERIFICATION',
  RE_VERIFICATION: 'RE_VERIFICATION',
});

const INSTRUMENT_ORIGINS = Object.freeze({
  LOCAL: 'LOCAL',
  IMPORTED: 'IMPORTED',
});

// Kept flat/dependency-free per the existing validateBody() middleware
// (see middleware/validate.js) — it only supports required/type checks,
// not conditional-required logic. Fields that are conditionally required
// (lastCertificateId for RE_VERIFICATION only) are validated in
// applications.service.js instead.
const createApplicationRules = {
  instrumentId: { required: true, type: 'string' },
  applicationType: { required: true, type: 'string' },
  division: { required: true, type: 'string' },
  purpose: { required: false, type: 'string' },
  remarks: { required: false, type: 'string' },

  // Legal Metrology domain fields — optional at this layer.
  submissionOffice: { required: false, type: 'string' },
  instrumentOrigin: { required: false, type: 'string' },
  grasChallanNumber: { required: false, type: 'string' },
  grasChallanDate: { required: false, type: 'string' },
  conveyanceFee: { required: false, type: 'number' },
  quarterJumpFee: { required: false, type: 'number' },
  lastCertificateId: { required: false, type: 'string' },
};

function isValidApplicationType(type) {
  return Object.values(APPLICATION_TYPES).includes(type);
}

function isValidInstrumentOrigin(origin) {
  return Object.values(INSTRUMENT_ORIGINS).includes(origin);
}

module.exports = {
  APPLICATION_TYPES,
  INSTRUMENT_ORIGINS,
  createApplicationRules,
  isValidApplicationType,
  isValidInstrumentOrigin,
};