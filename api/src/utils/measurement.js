// api/src/utils/measurement.js
//
// Server-side pass/fail rule for a quantitative reading: it PASSES when the
// observed value is within +/- tolerance of the expected value (inclusive).
// The officer's own PASS/FAIL is no longer trusted when both numbers exist.

// Tolerances are decimal quantities such as 0.05 kg; allow for binary
// floating point noise (e.g. 50.05 - 50 = 0.0499999999999972).
const EPSILON = 1e-9;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Returns 'PASS' | 'FAIL', or null when it cannot be computed (no expected
// value or no tolerance - e.g. a qualitative reading).
function computeReadingResult({ expectedValue, observedValue, tolerance }) {
  const expected = toNumber(expectedValue);
  const observed = toNumber(observedValue);
  const tol = toNumber(tolerance);
  if (expected === null || observed === null || tol === null) return null;
  return Math.abs(observed - expected) <= tol + EPSILON ? 'PASS' : 'FAIL';
}

module.exports = { computeReadingResult };
