const APPLICATION_TYPES = Object.freeze({
  VERIFICATION: 'VERIFICATION',
  RE_VERIFICATION: 'RE_VERIFICATION',
});

const createApplicationRules = {
  instrumentId: { required: true, type: 'string' },
  applicationType: { required: true, type: 'string' },
  purpose: { required: false, type: 'string' },
  remarks: { required: false, type: 'string' },
};

function isValidApplicationType(type) {
  return Object.values(APPLICATION_TYPES).includes(type);
}

module.exports = {
  APPLICATION_TYPES,
  createApplicationRules,
  isValidApplicationType,
};