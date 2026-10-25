// api/src/modules/fees/fees.service.js
//
// Fee computation from the configurable fee_rules table.
//
// For each fee kind (VERIFICATION, CONVEYANCE, QUARTER_JUMP) the single most
// specific active rule applies:
//   +4 matches the instrument type    +2 matches the application type
//   +1 has a capacity band that contains the instrument's capacity
// (a rule never matches if it names a different type, or a band that does not
// contain the capacity). Ties: latest effective_from wins. CONVEYANCE and
// QUARTER_JUMP are only charged when the applicant asks for them.

const ApiError = require('../../utils/ApiError');
const pool = require('../../pool');
const audit = require('../../utils/audit');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const repo = require('./fees.repository');
const { FEE_KINDS, APPLICATION_TYPES } = require('./fees.validation');

function todayString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function score(rule, { instrumentTypeId, applicationType, capacity }) {
  if (rule.instrument_type_id && rule.instrument_type_id !== instrumentTypeId) return -1;
  if (rule.application_type && rule.application_type !== applicationType) return -1;

  const hasBand = rule.min_capacity !== null || rule.max_capacity !== null;
  if (hasBand) {
    if (capacity === null || capacity === undefined) return -1;
    const c = Number(capacity);
    if (rule.min_capacity !== null && c < Number(rule.min_capacity)) return -1;
    if (rule.max_capacity !== null && c > Number(rule.max_capacity)) return -1;
  }

  return (rule.instrument_type_id ? 4 : 0) + (rule.application_type ? 2 : 0) + (hasBand ? 1 : 0);
}

function pickRule(rules, kind, context) {
  let best = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.fee_kind !== kind) continue;
    const s = score(rule, context);
    if (s < 0) continue;
    if (
      s > bestScore ||
      (s === bestScore && best && String(rule.effective_from) > String(best.effective_from))
    ) {
      best = rule;
      bestScore = s;
    }
  }
  return best;
}

// Pure computation given the instrument row and the options.
async function computeFees(instrument, applicationType, { conveyance = false, quarterJump = false } = {}, onDate = todayString()) {
  const rules = await repo.findCandidateRules(onDate);
  const context = {
    instrumentTypeId: instrument.instrument_type_id,
    applicationType,
    capacity: instrument.capacity,
  };

  const verification = pickRule(rules, 'VERIFICATION', context);
  const convRule = conveyance ? pickRule(rules, 'CONVEYANCE', context) : null;
  const quarterRule = quarterJump ? pickRule(rules, 'QUARTER_JUMP', context) : null;

  const amount = (rule) => (rule ? Number(rule.amount) : 0);
  const verificationFee = amount(verification);
  const conveyanceFee = amount(convRule);
  const quarterJumpFee = amount(quarterRule);

  return {
    verificationFee,
    conveyanceFee,
    quarterJumpFee,
    total: Math.round((verificationFee + conveyanceFee + quarterJumpFee) * 100) / 100,
    // false when no VERIFICATION rule matches: fees are then not enforced
    configured: Boolean(verification),
    rules: {
      verification: verification ? verification.id : null,
      conveyance: convRule ? convRule.id : null,
      quarterJump: quarterRule ? quarterRule.id : null,
    },
    requested: { conveyance: Boolean(conveyance), quarterJump: Boolean(quarterJump) },
    onDate,
  };
}

async function quote(user, query) {
  if (!query.instrumentId) throw ApiError.badRequest('instrumentId is required');
  const applicationType = String(query.applicationType || 'VERIFICATION').toUpperCase();
  if (!APPLICATION_TYPES.includes(applicationType)) {
    throw ApiError.badRequest(`Invalid applicationType: ${query.applicationType}`);
  }

  const instrument = await repo.findInstrumentForFees(query.instrumentId);
  if (!instrument) throw ApiError.notFound('Instrument not found');
  if (user.role === ROLES.INSTRUMENT_OWNER && instrument.owner_id !== user.id) {
    throw ApiError.forbidden('You can only request a quote for your own instrument');
  }

  const flag = (v) => v === true || v === 'true' || v === '1';
  return computeFees(instrument, applicationType, {
    conveyance: flag(query.conveyance),
    quarterJump: flag(query.quarterJump),
  });
}

function assertRuleData(data, { partial = false } = {}) {
  if (!partial) {
    if (!FEE_KINDS.includes(data.feeKind)) throw ApiError.badRequest(`feeKind must be one of ${FEE_KINDS.join(', ')}`);
    if (data.applicationType && !APPLICATION_TYPES.includes(data.applicationType)) {
      throw ApiError.badRequest(`applicationType must be one of ${APPLICATION_TYPES.join(', ')}`);
    }
  }
  if (data.amount !== undefined && (typeof data.amount !== 'number' || !(data.amount >= 0) || data.amount > 9999999)) {
    throw ApiError.badRequest('amount must be a non-negative number');
  }
  if (!partial && data.amount === undefined) throw ApiError.badRequest('amount is required');
  for (const key of ['effectiveFrom', 'effectiveTo']) {
    if (data[key] && !/^\d{4}-\d{2}-\d{2}$/.test(data[key])) {
      throw ApiError.badRequest(`${key} must be a date in YYYY-MM-DD format`);
    }
  }
  if (data.effectiveFrom && data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
    throw ApiError.badRequest('effectiveTo must not be before effectiveFrom');
  }
  if (data.minCapacity != null && data.maxCapacity != null && data.minCapacity > data.maxCapacity) {
    throw ApiError.badRequest('minCapacity must not exceed maxCapacity');
  }
}

async function listRules(query) {
  return repo.listRules({
    feeKind: query.feeKind,
    instrumentTypeId: query.instrumentTypeId,
    activeOnly: query.active === 'true',
  });
}

async function createRule(user, data) {
  assertRuleData(data);
  if (data.instrumentTypeId) {
    const { rows } = await pool.query('SELECT 1 FROM instrument_types WHERE id = $1', [data.instrumentTypeId]);
    if (rows.length === 0) throw ApiError.badRequest('instrumentTypeId does not exist');
  }
  return withTransaction(async (client) => {
    const rule = await repo.createRule(client, { ...data, createdById: user.id });
    await audit.record(client, {
      actorId: user.id,
      action: 'FEE_RULE_CREATED',
      entityType: 'fee_rule',
      entityId: rule.id,
      details: { feeKind: rule.fee_kind, amount: rule.amount, instrumentTypeId: rule.instrument_type_id },
    });
    return rule;
  });
}

async function updateRule(user, id, data) {
  assertRuleData(data, { partial: true });
  const existing = await repo.findRuleById(id);
  if (!existing) throw ApiError.notFound('Fee rule not found');
  return withTransaction(async (client) => {
    const rule = await repo.updateRule(client, id, data);
    await audit.record(client, {
      actorId: user.id,
      action: 'FEE_RULE_UPDATED',
      entityType: 'fee_rule',
      entityId: id,
      details: {
        before: { amount: existing.amount, isActive: existing.is_active, effectiveTo: existing.effective_to },
        after: { amount: rule.amount, isActive: rule.is_active, effectiveTo: rule.effective_to },
      },
    });
    return rule;
  });
}

module.exports = { computeFees, quote, listRules, createRule, updateRule, pickRule, score };
