const VERIFICATION_STATUSES = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const READING_RESULTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
});

const VERIFICATION_DECISIONS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
});

const createVerificationRules = {
  applicationId: { required: true, type: 'string' },
  assignmentId: { required: true, type: 'string' },
  scheduleId: { required: false, type: 'string' },
  location: { required: false, type: 'string' },
  remarks: { required: false, type: 'string' },
};

const createObservationRules = {
  observationType: { required: true, type: 'string' },
  observationDescription: { required: false, type: 'string' },
  observedValue: { required: false, type: 'string' },
  remarks: { required: false, type: 'string' },
};

const createReadingRules = {
  readingType: { required: true, type: 'string' },
  expectedValue: { required: false, type: 'number' },
  observedValue: { required: true, type: 'number' },
  unit: { required: true, type: 'string' },
  tolerance: { required: false, type: 'number' },
  result: { required: true, type: 'string' },
  remarks: { required: false, type: 'string' },
};

const createResultRules = {
  decision: { required: true, type: 'string' },
  remarks: { required: false, type: 'string' },
};

function isValidReadingResult(result) {
  return Object.values(READING_RESULTS).includes(result);
}

function isValidVerificationDecision(decision) {
  return Object.values(VERIFICATION_DECISIONS).includes(decision);
}

module.exports = {
  VERIFICATION_STATUSES,
  READING_RESULTS,
  VERIFICATION_DECISIONS,
  createVerificationRules,
  createObservationRules,
  createReadingRules,
  createResultRules,
  isValidReadingResult,
  isValidVerificationDecision,
};