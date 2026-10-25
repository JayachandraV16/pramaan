// End-to-end demonstration run: owner -> admin -> officer -> certificate -> public verification,
// plus the cryptographic integrity features, driven through the real HTTP API on a throw-away
// database. Every numbered step is a named subtest so the output reads as a PASS/FAIL checklist
// (docs/TEST_REPORT.md maps these to the report).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');

const h = require('./helpers');
const config = require('../src/config');
const { sha256Hex } = require('../src/utils/integrity');
const { verifyChain } = require('../src/utils/audit');
const { verifyPdfSignature } = require('../src/utils/pdfSigner');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const original = { ...config.signing };
let signingDir;

test.before(async () => {
  await h.start();
});
test.after(async () => {
  Object.assign(config.signing, original);
  if (signingDir) fs.rmSync(signingDir, { recursive: true, force: true });
  await h.stop();
});

function throwAwayIdentity() {
  signingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-e2e-'));
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60000);
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const subject = [{ name: 'commonName', value: 'Pramaan E2E Signer' }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const file = path.join(signingDir, 'e2e.p12');
  fs.writeFileSync(file, Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' })).getBytes(), 'binary'));
  return file;
}

test('owner -> admin -> officer -> certificate -> public verification, with integrity checks', async (t) => {
  const admin = await h.createUser('ADMIN');
  const owner = await h.createUser('INSTRUMENT_OWNER');
  const officer = await h.createUser('LMO');
  const api = (method, url, token, body) => h.call(method, url, { token, body });
  const must = async (promise, status, label) => {
    const res = await promise;
    assert.equal(res.status, status, `${label}: ${res.status} ${res.text}`);
    return res.body ? res.body.data : null;
  };
  const S = {}; // shared state between steps

  config.signing.p12Path = throwAwayIdentity();
  config.signing.passphrase = 'pw';

  await t.test('01 owner registers an instrument using the types the API publishes', async () => {
    const types = await must(api('GET', '/api/instruments/types', owner.token), 200, 'types');
    S.instrument = await must(
      api('POST', '/api/instruments', owner.token, { instrumentTypeId: types[0].id, instrumentName: 'Demo Platform Scale', serialNumber: h.unique('E2E'), capacity: 100, capacityUnit: 'kg', manufacturer: 'Acme', model: 'P-100' }),
      201, 'register instrument'
    );
    assert.equal(S.instrument.status, 'REGISTERED');
  });

  await t.test('02 the server says this is a first verification, and refuses a renewal', async () => {
    const info = await must(api('GET', `/api/instruments/${S.instrument.id}/renewal`, owner.token), 200, 'renewal info');
    assert.equal(info.suggestedType, 'VERIFICATION');
    assert.equal((await api('POST', '/api/applications', owner.token, { instrumentId: S.instrument.id, applicationType: 'RE_VERIFICATION', division: 'PUNE' })).status, 400);
  });

  await t.test('03 owner applies; status history starts at SUBMITTED', async () => {
    S.application = await must(api('POST', '/api/applications', owner.token, { instrumentId: S.instrument.id, applicationType: 'VERIFICATION', division: 'PUNE' }), 201, 'apply');
    assert.equal(S.application.status, 'SUBMITTED');
    const history = await must(api('GET', `/api/applications/${S.application.id}/history`, owner.token), 200, 'history');
    assert.equal(history[0].to_status, 'SUBMITTED');
  });

  await t.test('04 admin assigns an officer, the officer accepts, admin schedules (no past dates)', async () => {
    S.assignment = await must(api('POST', '/api/assignments', admin.token, { applicationId: S.application.id, assignedToId: officer.id }), 201, 'assign');
    await must(api('PATCH', `/api/assignments/${S.assignment.id}/status`, officer.token, { status: 'ACCEPTED' }), 200, 'accept');
    assert.equal((await api('POST', '/api/schedules', admin.token, { applicationId: S.application.id, assignmentId: S.assignment.id, scheduledDate: '2001-01-01' })).status, 400);
    S.schedule = await must(api('POST', '/api/schedules', admin.token, { applicationId: S.application.id, assignmentId: S.assignment.id, scheduledDate: '2030-06-15', verificationLocation: 'Shop 4, Market Road' }), 201, 'schedule');
    const notes = await must(api('GET', '/api/notifications', owner.token), 200, 'owner notifications');
    assert.ok(notes.some((n) => n.type === 'VERIFICATION_SCHEDULED'), 'the owner was told about the date');
  });

  await t.test('05 officer inspects: GPS, readings (server decides PASS/FAIL), observation, evidence photo', async () => {
    S.verification = await must(
      api('POST', '/api/verifications', officer.token, { applicationId: S.application.id, assignmentId: S.assignment.id, scheduleId: S.schedule.id, location: 'Shop 4', latitude: 18.5204, longitude: 73.8567 }),
      201, 'start verification'
    );
    const reading = await must(
      api('POST', `/api/verifications/${S.verification.id}/readings`, officer.token, { readingType: 'Load 50 kg', expectedValue: 50, observedValue: 50.02, unit: 'kg', tolerance: 0.05, result: 'FAIL' }),
      201, 'reading'
    );
    assert.equal(reading.result, 'PASS', 'the officer claimed FAIL, the server computed PASS');
    await must(api('POST', `/api/verifications/${S.verification.id}/observations`, officer.token, { observationType: 'Seal', observedValue: 'intact' }), 201, 'observation');

    const form = new FormData();
    form.append('file', new Blob([png]), 'seal.png');
    form.append('category', 'PHOTOGRAPH');
    form.append('verificationId', S.verification.id);
    const up = await fetch(`${await h.start()}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${officer.token}` }, body: form });
    assert.equal(up.status, 201);
    S.evidence = (await up.json()).data;
    assert.equal(S.evidence.file_sha256, sha256Hex(png), 'evidence is fingerprinted by the server');
  });

  await t.test('06 a PASS cannot be recorded over a failing reading (separate verification)', async () => {
    const flowApp = await must(api('POST', '/api/instruments', owner.token, { instrumentTypeId: S.instrument.instrument_type_id, instrumentName: 'Bad Scale', serialNumber: h.unique('BAD') }), 201, 'second instrument');
    const app2 = await must(api('POST', '/api/applications', owner.token, { instrumentId: flowApp.id, applicationType: 'VERIFICATION', division: 'PUNE' }), 201, 'application 2');
    const as2 = await must(api('POST', '/api/assignments', admin.token, { applicationId: app2.id, assignedToId: officer.id }), 201, 'assign 2');
    await must(api('PATCH', `/api/assignments/${as2.id}/status`, officer.token, { status: 'ACCEPTED' }), 200, 'accept 2');
    const v2 = await must(api('POST', '/api/verifications', officer.token, { applicationId: app2.id, assignmentId: as2.id }), 201, 'start 2');
    await must(api('POST', `/api/verifications/${v2.id}/readings`, officer.token, { readingType: 'Load 50 kg', expectedValue: 50, observedValue: 52, unit: 'kg', tolerance: 0.05 }), 201, 'bad reading');
    const refused = await api('POST', `/api/verifications/${v2.id}/result`, officer.token, { decision: 'PASS' });
    assert.ok(refused.status >= 400 && refused.status < 500, `PASS over a failed reading must be refused, got ${refused.status}`);
  });

  await t.test('07 the result is sealed (SHA-256) and the readings can no longer be altered', async () => {
    const sealed = await must(api('POST', `/api/verifications/${S.verification.id}/result`, officer.token, { decision: 'PASS', remarks: 'All load points within tolerance' }), 200, 'result');
    assert.match(sealed.result_sha256, /^[0-9a-f]{64}$/);
    await assert.rejects(h.pool.query("UPDATE verification_readings SET observed_value = 50 WHERE verification_id = $1", [S.verification.id]));
    assert.equal((await api('POST', `/api/verifications/${S.verification.id}/readings`, officer.token, { readingType: 'late', observedValue: 1, unit: 'kg', result: 'PASS' })).status, 400);
  });

  await t.test('08 admin issues the certificate: PDF stored, SHA-256 + record fingerprint, digitally signed, English + Hindi pages', async () => {
    S.cert = await must(api('POST', '/api/certificates', admin.token, { verificationId: S.verification.id }), 201, 'issue');
    assert.match(S.cert.certificate_number, /^CERT-\d{4}-\d{6}$/);
    assert.match(S.cert.pdf_sha256, /^[0-9a-f]{64}$/);
    assert.match(S.cert.record_sha256, /^[0-9a-f]{64}$/);
    S.pdf = fs.readFileSync(path.join(config.uploadDir, 'certificates', `${S.cert.certificate_number}.pdf`));
    assert.equal(sha256Hex(S.pdf), S.cert.pdf_sha256);
    const text = S.pdf.toString('latin1');
    // the signature is an incremental update that rewrites page 1, so count pages from the page tree
    assert.match(text, /\/Count 2\b/, 'two pages: English and Hindi');
    assert.match(text, /NotoSansDevanagari/, 'Hindi page font embedded');
    assert.equal(S.cert.pdf_signed, true);
    const sig = verifyPdfSignature(S.pdf);
    assert.equal(sig.valid, true);
    assert.equal(sig.coversWholeFile, true);
  });

  await t.test('09 public verification through the real QR link (signed) and by certificate number', async () => {
    const { buildVerificationUrl } = require('../src/utils/qrGenerator');
    const url = new URL(buildVerificationUrl(S.cert.qr_token, S.cert.certificate_number));
    S.qr = { q: url.searchParams.get('q'), s: url.searchParams.get('s') };
    const byQr = await must(api('GET', `/api/qr-auth/${encodeURIComponent(S.qr.q)}?s=${encodeURIComponent(S.qr.s)}`), 200, 'verify by QR');
    assert.equal(byQr.result, 'VALID');
    assert.equal(byQr.integrity.signature, 'VALID');
    assert.equal(byQr.integrity.recordHash, 'MATCH');
    assert.equal(byQr.integrity.pdfSigned, true);
    const byNumber = await must(api('GET', `/api/qr-auth/${S.cert.certificate_number}`), 200, 'verify by number');
    assert.equal(byNumber.result, 'VALID');
    assert.equal(byNumber.certificate.ownerName.includes(owner.email.split('@')[0]), false, 'owner identity is masked');
  });

  await t.test('10 a forged QR signature is flagged as tampering and logged', async () => {
    const bad = await must(api('GET', `/api/qr-auth/${encodeURIComponent(S.qr.q)}?s=${'0'.repeat(32)}`), 200, 'forged QR');
    assert.equal(bad.tampered, true);
    assert.equal(bad.result, 'INVALID');
    assert.equal(bad.reason, 'SIGNATURE_MISMATCH');
  });

  await t.test('11 uploading the genuine PDF matches; a one-byte edit does not; the embedded signature catches it too', async () => {
    const check = async (buffer) => {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'certificate.pdf');
      const res = await fetch(`${await h.start()}/api/qr-auth/check-document`, { method: 'POST', body: form });
      assert.equal(res.status, 200);
      return (await res.json()).data;
    };
    const good = await check(S.pdf);
    assert.equal(good.matches, true);
    assert.equal(good.signature.valid, true);
    const forged = Buffer.from(S.pdf);
    forged[400] ^= 0x01;
    const bad = await check(forged);
    assert.equal(bad.matches, false);
    assert.equal(bad.signature.valid, false);
  });

  await t.test('12 editing the certificate row in the database is blocked, and detected if the guard is bypassed', async () => {
    await assert.rejects(h.pool.query("UPDATE verification_certificates SET valid_until = valid_until + 365 WHERE id = $1", [S.cert.id]), /immutable/);
    await h.pool.query('ALTER TABLE verification_certificates DISABLE TRIGGER trg_protect_issued_certificate');
    try {
      await h.pool.query('UPDATE verification_certificates SET valid_until = valid_until + 365 WHERE id = $1', [S.cert.id]);
      const res = await must(api('GET', `/api/qr-auth/${S.cert.certificate_number}`), 200, 'verify after tampering');
      assert.equal(res.tampered, true);
      assert.equal(res.reason, 'RECORD_HASH_MISMATCH');
      await h.pool.query('UPDATE verification_certificates SET valid_until = valid_until - 365 WHERE id = $1', [S.cert.id]);
    } finally {
      await h.pool.query('ALTER TABLE verification_certificates ENABLE TRIGGER trg_protect_issued_certificate');
    }
    const restored = await must(api('GET', `/api/qr-auth/${S.cert.certificate_number}`), 200, 'verify after restore');
    assert.equal(restored.result, 'VALID');
  });

  await t.test('13 the audit log is a valid hash chain, and cannot be edited', async () => {
    const chain = await verifyChain();
    assert.equal(chain.valid, true);
    assert.ok(chain.checked > 5);
    await assert.rejects(h.pool.query("UPDATE audit_log SET action = 'FORGED' WHERE id = (SELECT max(id) FROM audit_log)"));
    await assert.rejects(h.pool.query('DELETE FROM audit_log WHERE id = (SELECT max(id) FROM audit_log)'));
  });

  await t.test('14 the instrument shows as certified and not yet due; reports and the due list agree', async () => {
    const info = await must(api('GET', `/api/instruments/${S.instrument.id}/renewal`, owner.token), 200, 'renewal after issue');
    assert.equal(info.code, 'NOT_DUE');
    assert.equal(info.latestCertificate.number, S.cert.certificate_number);
    const due = await must(api('GET', '/api/instruments/due', owner.token), 200, 'due');
    assert.equal(due.find((d) => d.instrument_id === S.instrument.id).verification_state, 'VALID');
    const stats = await must(api('GET', '/api/dashboard/stats', admin.token), 200, 'stats');
    assert.ok(stats.activeCertificates >= 1);
    const csv = await h.call('GET', '/api/reports/export/certificates', { token: admin.token });
    assert.equal(csv.status, 200);
    assert.ok(csv.text.includes(S.cert.certificate_number));
  });

  await t.test('15 admin revokes with a reason: public result REVOKED, owner notified, no un-revoking', async () => {
    assert.equal((await api('PATCH', `/api/certificates/${S.cert.id}/status`, owner.token, { status: 'REVOKED', reason: 'owners cannot revoke' })).status, 403);
    await must(api('PATCH', `/api/certificates/${S.cert.id}/status`, admin.token, { status: 'REVOKED', reason: 'Seal found broken at spot check' }), 200, 'revoke');
    const res = await must(api('GET', `/api/qr-auth/${encodeURIComponent(S.qr.q)}?s=${encodeURIComponent(S.qr.s)}`), 200, 'verify revoked');
    assert.equal(res.result, 'REVOKED');
    assert.equal((await api('PATCH', `/api/certificates/${S.cert.id}/status`, admin.token, { status: 'ACTIVE' })).status, 409);
    await assert.rejects(h.pool.query("UPDATE verification_certificates SET status = 'ACTIVE' WHERE id = $1", [S.cert.id]), /REVOKED/);
    const notes = await must(api('GET', '/api/notifications', owner.token), 200, 'notifications');
    assert.ok(notes.some((n) => n.type === 'CERTIFICATE_REVOKED'));
  });

  await t.test('16 access control: an unrelated owner, an anonymous caller and an officer cannot reach the owner\'s data', async () => {
    const stranger = await h.createUser('INSTRUMENT_OWNER');
    assert.equal((await api('GET', `/api/instruments/${S.instrument.id}`, stranger.token)).status, 403);
    assert.equal((await api('PATCH', `/api/instruments/${S.instrument.id}`, stranger.token, { instrumentName: 'x' })).status, 403);
    assert.equal((await api('GET', `/api/applications/${S.application.id}`, stranger.token)).status, 403);
    assert.equal((await api('GET', '/api/instruments', undefined)).status, 401);
    assert.equal((await api('POST', '/api/certificates', owner.token, { verificationId: S.verification.id })).status, 403);
    const base = await h.start();
    assert.equal((await fetch(`${base}/uploads/certificates/${S.cert.certificate_number}.pdf`)).status, 403, 'a bare file path is not public');
    assert.equal((await fetch(`${base}${S.cert.certificate_file_url}`)).status, 200, 'the signed link the API hands out works');
  });
});
