// Unit tests for utils/integrity.js (no HTTP, no data needed).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sha256Hex,
  canonicalString,
  hmacHex,
  safeEqualHex,
  signUploadPath,
  verifyUploadSignature,
} = require('../src/utils/integrity');

test('sha256Hex matches the known SHA-256 test vector', () => {
  assert.equal(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('canonicalString is order-sensitive and normalises dates/nulls', () => {
  const a = canonicalString([['n', 'C1'], ['d', new Date(2026, 0, 5)], ['x', null]]);
  assert.equal(a, 'n=C1|d=2026-01-05|x=');
  const b = canonicalString([['d', new Date(2026, 0, 5)], ['n', 'C1'], ['x', null]]);
  assert.notEqual(a, b);
});

test('hmacHex depends on the secret and message', () => {
  assert.equal(hmacHex('m', 'k1'), hmacHex('m', 'k1'));
  assert.notEqual(hmacHex('m', 'k1'), hmacHex('m', 'k2'));
  assert.notEqual(hmacHex('m', 'k1'), hmacHex('m2', 'k1'));
});

test('safeEqualHex handles mismatches, bad input and length differences', () => {
  const h = sha256Hex('x');
  assert.equal(safeEqualHex(h, h), true);
  assert.equal(safeEqualHex(h, sha256Hex('y')), false);
  assert.equal(safeEqualHex(h, h.slice(2)), false);
  assert.equal(safeEqualHex(undefined, h), false);
  assert.equal(safeEqualHex('', ''), false);
});

test('signed upload links verify, and fail when altered or expired', () => {
  const signed = signUploadPath('/uploads/certificates/CERT-1.pdf', 60);
  const url = new URL(signed, 'http://x');
  const exp = url.searchParams.get('exp');
  const sig = url.searchParams.get('sig');

  assert.equal(verifyUploadSignature(url.pathname, exp, sig), true);
  // different file, same signature
  assert.equal(verifyUploadSignature('/uploads/certificates/CERT-2.pdf', exp, sig), false);
  // extended expiry
  assert.equal(verifyUploadSignature(url.pathname, Number(exp) + 1000, sig), false);
  // expired link (negative TTL)
  const expired = new URL(signUploadPath('/uploads/a.png', -5), 'http://x');
  assert.equal(
    verifyUploadSignature(expired.pathname, expired.searchParams.get('exp'), expired.searchParams.get('sig')),
    false
  );
});
