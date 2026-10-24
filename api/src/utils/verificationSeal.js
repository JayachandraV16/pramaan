// api/src/utils/verificationSeal.js
//
// SHA-256 seal over everything a verification result rests on: the decision,
// every reading and every observation. It is stored in
// verification_results.result_sha256 when the result is submitted; after
// that the readings/observations are locked by database triggers, and anyone
// can recompute the seal to prove nothing was altered.

const { canonicalString, sha256Hex } = require('./integrity');

function num(value) {
  if (value === null || value === undefined) return '';
  return String(Number(value));
}

function computeResultSeal({ verificationId, decision, readings, observations }) {
  const readingLines = [...readings]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((r) =>
      canonicalString([
        ['type', r.reading_type],
        ['expected', num(r.expected_value)],
        ['observed', num(r.observed_value)],
        ['unit', r.unit],
        ['tolerance', num(r.tolerance)],
        ['result', r.result],
      ])
    );
  const observationLines = [...observations]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((o) =>
      canonicalString([
        ['type', o.observation_type],
        ['description', o.observation_description],
        ['value', o.observed_value],
      ])
    );

  return sha256Hex(
    [
      canonicalString([['v', 1], ['verification', verificationId], ['decision', decision]]),
      'readings:' + readingLines.join('\n'),
      'observations:' + observationLines.join('\n'),
    ].join('\n')
  );
}

module.exports = { computeResultSeal };
