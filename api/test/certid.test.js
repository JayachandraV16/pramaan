// Checkpoint 4: structured certificate numbers (PRM-YY-OOO-NNNNNNN-C-TTTT), legacy numbers kept,
// and the full record fingerprint on the certificate.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const h = require('./helpers');
const config = require('../src/config');
const cid = require('../src/utils/certificateId');
const { createActors, runVerification, ok } = require('./workflow');

let actors;
test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  config.certificateIds.scheme = 'legacy';
  await h.stop();
});

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

test('check character: every single wrong character and every neighbour swap is detected (ISO 7064 MOD 37,36)', () => {
  const bodies = ['26IND0000001', '26IND0000123', '27MHA9999999', '25DEL0420420', '26IND0100010'];
  for (const body of bodies) {
    const full = body + cid.checkCharacter(body);
    assert.ok(cid.checkIsValid(full), full);
    for (let i = 0; i < full.length; i += 1) {
      for (const ch of ALPHA) {
        if (ch === full[i]) continue;
        assert.equal(cid.checkIsValid(full.slice(0, i) + ch + full.slice(i + 1)), false, `substitution at ${i} in ${full}`);
      }
    }
    for (let i = 0; i < full.length - 1; i += 1) {
      if (full[i] === full[i + 1]) continue;
      const swapped = full.slice(0, i) + full[i + 1] + full[i] + full.slice(i + 2);
      assert.equal(cid.checkIsValid(swapped), false, `swap at ${i} in ${full}`);
    }
  }
});

test('number format, keyed tag and inspection (no database)', () => {
  const secret = 'unit-test-secret-unit-test-secret-1234';
  const id = cid.build({ year: 2026, office: 'IND', sequence: 123, secret });
  assert.match(id, /^PRM-26-IND-0000123-[0-9A-Z]-[0-9A-Z]{4}$/);
  assert.equal(cid.build({ year: 2026, office: 'IND', sequence: 123, secret }), id, 'deterministic');
  assert.notEqual(cid.build({ year: 2026, office: 'IND', sequence: 124, secret }), id);

  assert.deepEqual(cid.inspect(id, secret), { scheme: 'v2', valid: true, reason: null, normalised: id });
  assert.equal(cid.inspect(id.toLowerCase(), secret).valid, true, 'case does not matter');
  assert.equal(cid.inspect(`  ${id}  `, secret).valid, true, 'surrounding spaces do not matter');

  // a different server secret cannot produce the same tag
  const other = cid.build({ year: 2026, office: 'IND', sequence: 123, secret: 'another-secret-another-secret-9999' });
  assert.equal(other.split('-')[4] === id.split('-')[4], true, 'the check character does not depend on the secret');
  assert.equal(cid.inspect(other, secret).reason, 'TAG', 'a tag made with another key is refused');

  // a wrong tag with a right check character, and a wrong check character
  const parts = id.split('-');
  const badTag = `${parts.slice(0, 5).join('-')}-${parts[5] === 'AAAA' ? 'BBBB' : 'AAAA'}`;
  assert.equal(cid.inspect(badTag, secret).reason, 'TAG');
  const badCheck = `${parts.slice(0, 4).join('-')}-${parts[4] === 'A' ? 'B' : 'A'}-${parts[5]}`;
  assert.equal(cid.inspect(badCheck, secret).reason, 'CHECK_CHARACTER');
  assert.equal(cid.inspect('PRM-26-IND-123-K-7QXM', secret).reason, 'FORMAT');
  assert.equal(cid.inspect('nonsense', secret).reason, 'FORMAT');

  // legacy numbers are still understood
  assert.deepEqual(cid.inspect('CERT-2026-000123'), { scheme: 'legacy', valid: true, reason: null, normalised: 'CERT-2026-000123' });
  assert.equal(cid.looksLikeCertificateNumber('cert-2024-000007'), true);
  assert.equal(cid.looksLikeCertificateNumber(id), true);
  assert.equal(cid.looksLikeCertificateNumber('abcdefabcdefabcdefabcd'), false);

  assert.throws(() => cid.build({ year: 2026, office: 'in', sequence: 1 }), /three capital letters/);
  assert.throws(() => cid.build({ year: 2026, office: 'IND', sequence: 0 }), /out of range/);
  assert.throws(() => cid.build({ year: 2026, office: 'IND', sequence: 10000000 }), /out of range/);
});

const pdfText = (buffer) => {
  // pdfkit compresses page streams with deflate: inflate every stream and join what comes out
  const text = buffer.toString('latin1');
  const out = [];
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const end = text.indexOf('endstream', start);
    try {
      const content = zlib.inflateSync(buffer.subarray(start, end)).toString('latin1');
      // standard-font text is written as hex pieces inside TJ arrays: join the pieces back into plain text
      for (const arr of content.matchAll(/\[(.*?)\]\s*TJ/g)) {
        out.push([...arr[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => Buffer.from(x[1], 'hex').toString('latin1')).join(''));
      }
    } catch {
      /* not a deflate stream (fonts, images) */
    }
  }
  return out.join('\n');
};

test('API: legacy by default, structured when switched on, both verify publicly, bad numbers are turned away', async () => {
  assert.equal(config.certificateIds.scheme, 'legacy');
  const legacy = await runVerification(actors);
  const legacyCert = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: legacy.verification.id } }), 201, 'legacy issue');
  assert.match(legacyCert.certificate_number, /^CERT-\d{4}-\d{6}$/);

  config.certificateIds.scheme = 'v2';
  config.certificateIds.officeCode = 'IND';
  const a = await runVerification(actors);
  const certA = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: a.verification.id } }), 201, 'v2 issue');
  const b = await runVerification(actors);
  const certB = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: b.verification.id } }), 201, 'v2 issue 2');
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
  assert.match(certA.certificate_number, new RegExp(`^PRM-${yy}-IND-\\d{7}-[0-9A-Z]-[0-9A-Z]{4}$`));
  const seq = (c) => Number(c.certificate_number.split('-')[3]);
  assert.equal(seq(certB), seq(certA) + 1, 'serials count up per year and office');
  assert.equal(cid.inspect(certA.certificate_number).valid, true);

  // another office has its own counter
  config.certificateIds.officeCode = 'MHA';
  const c = await runVerification(actors);
  const certC = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: c.verification.id } }), 201, 'other office');
  assert.match(certC.certificate_number, new RegExp(`^PRM-${yy}-MHA-0000001-`));
  config.certificateIds.officeCode = 'IND';
  config.certificateIds.scheme = 'legacy';

  // public verification by number: both kinds, any case
  const verify = (n) => h.call('GET', `/api/qr-auth/${encodeURIComponent(n)}`, {});
  const goodLegacy = await ok(verify(legacyCert.certificate_number), 200, 'legacy verify');
  assert.equal(goodLegacy.result, 'VALID');
  const goodV2 = await ok(verify(certA.certificate_number.toLowerCase()), 200, 'v2 verify');
  assert.equal(goodV2.result, 'VALID');
  assert.equal(goodV2.certificate.certificateNumber, certA.certificate_number);

  // the full 64-character record fingerprint is public and equals the stored one
  const stored = (await h.pool.query('SELECT record_sha256, pdf_sha256 FROM verification_certificates WHERE id = $1', [certA.id])).rows[0];
  assert.equal(goodV2.integrity.recordFingerprint, stored.record_sha256);
  assert.match(goodV2.integrity.recordFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(goodV2.integrity.pdfSha256, stored.pdf_sha256);

  // mistyped and invented numbers are refused before the registry is asked, and leave no scan record
  const scans = async () => (await h.pool.query('SELECT count(*)::int n FROM qr_authentications')).rows[0].n;
  const before = await scans();
  const p = certA.certificate_number.split('-');
  const typo = `${p.slice(0, 3).join('-')}-${p[3].slice(0, 6)}${(Number(p[3][6]) + 1) % 10}-${p[4]}-${p[5]}`;
  const typoRes = await ok(verify(typo), 200, 'typo');
  assert.equal(typoRes.result, 'INVALID');
  assert.equal(typoRes.valid, false);
  assert.match(typoRes.reason, /NUMBER_(CHECK_FAILED|TAG_MISMATCH)/);
  const forged = await ok(verify(`${p.slice(0, 5).join('-')}-ZZZZ`), 200, 'forged tag');
  assert.equal(forged.reason, 'NUMBER_TAG_MISMATCH');
  assert.equal(forged.certificate, null);
  const unknown = await ok(verify(cid.build({ year: 2026, office: 'IND', sequence: 9999 })), 200, 'well-formed but never issued');
  assert.equal(unknown.reason, 'NOT_FOUND');
  assert.equal(await scans(), before, 'refused numbers are not recorded as scans of a certificate');

  // revocation and expiry work the same for the new numbers
  await ok(h.call('PATCH', `/api/certificates/${certB.id}/status`, { token: actors.admin.token, body: { status: 'REVOKED', reason: 'Seal found broken' } }), 200, 'revoke');
  assert.equal((await ok(verify(certB.certificate_number), 200, 'revoked')).result, 'REVOKED');

  // the PDF carries the whole fingerprint and says it is not a digital signature
  const file = await ok(h.call('GET', `/api/certificates/${certA.id}`, { token: actors.admin.token }), 200, 'detail');
  const res = await fetch(`${await h.start()}${file.certificate_file_url}`);
  assert.equal(res.status, 200);
  const text = pdfText(Buffer.from(await res.arrayBuffer()));
  assert.ok(text.includes(stored.record_sha256.slice(0, 32)) && text.includes(stored.record_sha256.slice(32)), 'both halves of the 64-character fingerprint are printed');
  assert.match(text, /not a digital signature/i);
  assert.ok(text.includes(certA.certificate_number), 'the structured number is printed');
});

test('configuration: bad scheme or office code stops start-up', () => {
  const { spawnSync } = require('node:child_process');
  const run = (env) =>
    spawnSync(process.execPath, ['-e', "require('./src/config')"], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, JWT_SECRET: 'x'.repeat(40), ...env }, encoding: 'utf8' });
  assert.notEqual(run({ CERT_ID_SCHEME: 'v3' }).status, 0);
  assert.notEqual(run({ CERT_OFFICE_CODE: 'in' }).status, 0);
  assert.equal(run({ CERT_ID_SCHEME: 'v2', CERT_OFFICE_CODE: 'del' }).status, 0, 'lower case is accepted and upper-cased');
});
