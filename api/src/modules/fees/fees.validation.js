// api/src/modules/fees/fees.validation.js

const FEE_KINDS = Object.freeze(['VERIFICATION', 'CONVEYANCE', 'QUARTER_JUMP']);
const APPLICATION_TYPES = Object.freeze(['VERIFICATION', 'RE_VERIFICATION']);

const createFeeRuleRules = {
  feeKind: { required: true, type: 'string' },
  amount: { required: true, type: 'number' },
  instrumentTypeId: { required: false, type: 'string' },
  applicationType: { required: false, type: 'string' },
  minCapacity: { required: false, type: 'number' },
  maxCapacity: { required: false, type: 'number' },
  description: { required: false, type: 'string' },
  effectiveFrom: { required: false, type: 'string' },
  effectiveTo: { required: false, type: 'string' },
};

const updateFeeRuleRules = {
  amount: { required: false, type: 'number' },
  description: { required: false, type: 'string' },
  effectiveTo: { required: false, type: 'string' },
  isActive: { required: false, type: 'boolean' },
};

module.exports = { FEE_KINDS, APPLICATION_TYPES, createFeeRuleRules, updateFeeRuleRules };
