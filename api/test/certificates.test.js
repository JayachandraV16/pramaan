// Phase 1: trustworthy certificates — issuance with hashes, unified public
// verification, tamper detection, revocation, expiry sweep and due dates.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const h = require('./helpers');
const { createActors, runVerification, ok } = require('./workflow');
const config = require('../src/config');
const audit = require('../src/utils/audit');
const { sha256Hex } = require('../src/utils/integrity');
const { buildVerificationUrl } = require('../src/utils/qrGenerator');
const { expireDueCertificates } = require('../src/jobs/certificateLifecycle');

let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(() => h.stop());

async function issue(extra = {}, flow) {
  const f = flow || (await runVerification(actors));
  const cert = await ok(
    h.call('POST', '/api/certificates', {
      token: actors.admin.token,
      body: { verificationId: f.verification.id, ...extra },
    }),
    201,
    'issue certificate'
  );
  return { flow: f, cert };
}

const qrParams = (cert) => {
  const url = new URL(buildVerificationUrl(cert.qr_token, cert.certificate_number));
  return { token: url.searchParams.get('q'), sig: url.searchParams.get('s') };
};

// The immutability trigger would (rightly) block a backdating UPDATE, so tests
// that simulate a malicious DB edit switch it off for a moment.
async function withoutCertificateProtection(fn) {
  await h.pool.query('ALTER TABLE verification_certificates DISABLE TRIGGER trg_protect_issued_certificate');
  try {
    return await fn();
  } finally {
    await h.pool.query('ALTER TABLE verification_certificates ENABLE TRIGGER trg_protect_issued_certificate');
  }
}

test('issuance stores SHA-256 hashes, writes the PDF, audits and notifies the owner', async () => {
  const { flow, cert } = await issue();

  assert.match(cert.certificate_number, /^CERT-\d{4}-\d{6}$/);
  assert.match(cert.pdf_sha256, /^[0-9a-f]{64}$/);
  assert.match(cert.record_sha256, /^[0-9a-f]{64}$/);
  assert.match(cert.certificate_file_url, /^\/uploads\/certificates\/CERT-/);

  const file = path.join(config.uploadDir, 'certificates', `${cert.certificate_number}.pdf`);
  assert.equal(sha256Hex(fs.readFileSync(file)), cert.pdf_sha256, 'stored hash equals file content hash');

  // default validity: 12 months from today for the seeded instrument types
  const from = new Date(cert.valid_from);
  const until = new Date(cert.valid_until);
  const days = Math.round((until - from) / 86400000);
  assert.ok(days >= 364 && days <= 366, `default validity ~1 year, got ${days} days`);

  const { rows: audits } = await h.pool.query(
    "SELECT 1 FROM audit_log WHERE action = 'CERTIFICATE_ISSUED' AND entity_id = $1",
    [cert.id]
  );
  assert.equal(audits.length, 1);

  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE related_certificate_id = $1 AND type = 'CERTIFICATE_ISSUED' AND recipient_id = $2",
    [cert.id, actors.owner.id]
  );
  assert.equal(notes.length, 1);
  assert.equal((await audit.verifyChain()).valid, true);
  assert.ok(flow.verification.id);
});

test('certificate numbers are sequential and unique under concurrent issuance', async () => {
  const flows = [];
  for (let i = 0; i < 4; i++) flows.push(await runVerification(actors));
  const results = await Promise.all(
    flows.map((f) =>
      h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: f.verification.id } })
    )
  );
  for (const r of results) assert.equal(r.status, 201, r.text);
  const numbers = results.map((r) => r.body.data.certificate_number);
  assert.equal(new Set(numbers).size, 4);
});

test('issuance rules: PASS only, one per verification, instrument must match, ADMIN only', async () => {
  const failFlow = await runVerification(actors, { decision: 'FAIL' });
  const fail = await h.call('POST', '/api/certificates', {
    token: actors.admin.token,
    body: { verificationId: failFlow.verification.id },
  });
  assert.equal(fail.status, 400);

  const { flow, cert } = await issue();
  const dup = await h.call('POST', '/api/certificates', {
    token: actors.admin.token,
    body: { verificationId: flow.verification.id },
  });
  assert.equal(dup.status, 400);

  const other = await runVerification(actors);
  const mismatch = await h.call('POST', '/api/certificates', {
    token: actors.admin.token,
    body: { verificationId: other.verification.id, instrumentId: flow.instrument.id },
  });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.body.message, /instrument/i);

  const nonAdmin = await h.call('POST', '/api/certificates', {
    token: actors.lmo.token,
    body: { verificationId: other.verification.id },
  });
  assert.equal(nonAdmin.status, 403);
  assert.ok(cert.id);
});

test('explicit validity dates are honoured and validated', async () => {
  const f = await runVerification(actors);
  const bad = await h.call('POST', '/api/certificates', {
    token: actors.admin.token,
    body: { verificationId: f.verification.id, validFrom: '2030-02-01', validUntil: '2030-01-01' },
  });
  assert.equal(bad.status, 400);

  const tooLong = await h.call('POST', '/api/certificates', {
    token: actors.admin.token,
    body: { verificationId: f.verification.id, validFrom: '2030-01-01', validUntil: '2045-01-01' },
  });
  assert.equal(tooLong.status, 400);

  const { cert } = await issue({ validFrom: '2030-01-01', validUntil: '2030-12-31' }, f);
  assert.equal(String(cert.valid_from).slice(0, 10), '2030-01-01');
});

test('public verification by QR token with a valid signature', async () => {
  const { cert } = await issue();
  const { token, sig } = qrParams(cert);

  const res = await h.call('GET', `/api/qr-auth/${token}?s=${sig}`);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.result, 'VALID');
  assert.equal(d.valid, true);
  assert.equal(d.tampered, false);
  assert.equal(d.integrity.signature, 'VALID');
  assert.equal(d.integrity.recordHash, 'MATCH');
  assert.equal(d.certificate.certificateNumber, cert.certificate_number);
  // owner's name is masked, ids/hash internals are not exposed
  assert.match(d.certificate.ownerName, /\*/);
  assert.equal(d.certificate.id, undefined);

  // scan was logged
  const { rows } = await h.pool.query(
    'SELECT result FROM qr_authentications WHERE certificate_id = $1',
    [cert.id]
  );
  assert.ok(rows.length >= 1);
});

test('public verification by certificate number, and the legacy endpoint agrees', async () => {
  const { cert } = await issue();

  const byNumber = await h.call('GET', `/api/qr-auth/${cert.certificate_number}`);
  assert.equal(byNumber.body.data.result, 'VALID');
  assert.equal(byNumber.body.data.integrity.signature, 'NOT_PROVIDED');

  const legacy = await h.call('GET', `/api/certificates/verify/${cert.qr_token}`);
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.data.result, 'VALID');
  assert.equal(legacy.body.data.valid, true);
  assert.equal(legacy.body.data.certificate.certificateNumber, cert.certificate_number);

  const unknown = await h.call('GET', '/api/qr-auth/CERT-1999-000001');
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.data.result, 'INVALID');
  assert.equal(unknown.body.data.reason, 'NOT_FOUND');

  const legacyUnknown = await h.call('GET', '/api/certificates/verify/AAAAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(legacyUnknown.status, 404);
});

test('an edited QR link (bad signature) is flagged as tampered and audited', async () => {
  const { cert } = await issue();
  const { token } = qrParams(cert);

  const res = await h.call('GET', `/api/qr-auth/${token}?s=${'0'.repeat(32)}`);
  const d = res.body.data;
  assert.equal(d.result, 'INVALID');
  assert.equal(d.tampered, true);
  assert.equal(d.reason, 'SIGNATURE_MISMATCH');

  const { rows } = await h.pool.query(
    "SELECT 1 FROM audit_log WHERE action = 'TAMPER_DETECTED' AND entity_id = $1",
    [cert.id]
  );
  assert.ok(rows.length >= 1);
});

test('direct database edits to an issued certificate are blocked, and detected if the guard is bypassed', async () => {
  const { cert } = await issue();

  await assert.rejects(
    h.pool.query("UPDATE verification_certificates SET valid_until = valid_until + 365 WHERE id = $1", [cert.id]),
    /immutable/
  );

  await withoutCertificateProtection(async () => {
    await h.pool.query('UPDATE verification_certificates SET valid_until = valid_until + 365 WHERE id = $1', [cert.id]);
  });

  const res = await h.call('GET', `/api/qr-auth/${cert.certificate_number}`);
  assert.equal(res.body.data.tampered, true);
  assert.equal(res.body.data.result, 'INVALID');
  assert.equal(res.body.data.reason, 'RECORD_HASH_MISMATCH');
});

test('revocation: admin only, reason required, irreversible, owner notified, public result REVOKED', async () => {
  const { cert } = await issue();
  const patch = (token, body) => h.call('PATCH', `/api/certificates/${cert.id}/status`, { token, body });

  assert.equal((await patch(actors.owner.token, { status: 'REVOKED', reason: 'because I say so ok' })).status, 403);
  assert.equal((await patch(actors.admin.token, { status: 'REVOKED' })).status, 400);
  assert.equal((await patch(actors.admin.token, { status: 'REVOKED', reason: 'short' })).status, 400);

  const done = await patch(actors.admin.token, { status: 'REVOKED', reason: 'Instrument failed re-inspection' });
  assert.equal(done.status, 200);
  assert.equal(done.body.data.status, 'REVOKED');
  assert.ok(done.body.data.revoked_at);
  assert.equal(done.body.data.revoked_by_id, actors.admin.id);

  const pub = await h.call('GET', `/api/qr-auth/${cert.certificate_number}`);
  assert.equal(pub.body.data.result, 'REVOKED');
  assert.equal(pub.body.data.valid, false);

  // cannot be undone via API or database
  assert.equal((await patch(actors.admin.token, { status: 'ACTIVE' })).status, 409);
  assert.equal((await patch(actors.admin.token, { status: 'EXPIRED' })).status, 409);
  await assert.rejects(
    h.pool.query("UPDATE verification_certificates SET status = 'ACTIVE' WHERE id = $1", [cert.id]),
    /REVOKED/
  );

  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE related_certificate_id = $1 AND type = 'CERTIFICATE_REVOKED' AND recipient_id = $2",
    [cert.id, actors.owner.id]
  );
  assert.equal(notes.length, 1);
  const { rows: audits } = await h.pool.query(
    "SELECT details FROM audit_log WHERE action = 'CERTIFICATE_REVOKED' AND entity_id = $1",
    [cert.id]
  );
  assert.equal(audits.length, 1);
  assert.equal(audits[0].details.reason, 'Instrument failed re-inspection');
});

test('uploaded PDF check: genuine file matches, altered or foreign files do not', async () => {
  const { cert } = await issue();
  const file = path.join(config.uploadDir, 'certificates', `${cert.certificate_number}.pdf`);
  const original = fs.readFileSync(file);
  const base = await h.start();

  const post = async (buffer, name = 'cert.pdf') => {
    const form = new FormData();
    form.append('file', new Blob([buffer]), name);
    const res = await fetch(`${base}/api/qr-auth/check-document`, { method: 'POST', body: form });
    return { status: res.status, body: await res.json() };
  };

  const genuine = await post(original);
  assert.equal(genuine.status, 200);
  assert.equal(genuine.body.data.matches, true);
  assert.equal(genuine.body.data.certificateNumber, cert.certificate_number);

  const altered = Buffer.concat([original, Buffer.from('\n% edited')]);
  const edited = await post(altered);
  assert.equal(edited.body.data.matches, false);

  const notPdf = await post(Buffer.from('hello world'), 'x.pdf');
  assert.equal(notPdf.status, 400);
});

test('expiry sweep marks past-due certificates EXPIRED once, audited, owner notified', async () => {
  const { cert } = await issue();
  await withoutCertificateProtection(() =>
    h.pool.query(
      "UPDATE verification_certificates SET valid_from = CURRENT_DATE - 400, valid_until = CURRENT_DATE - 10 WHERE id = $1",
      [cert.id]
    )
  );

  const first = await expireDueCertificates();
  assert.ok(first.expired >= 1);
  const { rows } = await h.pool.query('SELECT status FROM verification_certificates WHERE id = $1', [cert.id]);
  assert.equal(rows[0].status, 'EXPIRED');

  const again = await expireDueCertificates();
  assert.equal(again.expired, 0);

  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE related_certificate_id = $1 AND type = 'CERTIFICATE_EXPIRED'",
    [cert.id]
  );
  assert.equal(notes.length, 1);

  // the unprotected backdating above changed fields, so integrity correctly fails;
  // an EXPIRED result is only reported for untampered records, which is covered below
});

test('public verification reports EXPIRED by date even before the sweep runs', async () => {
  const { cert } = await issue({ validFrom: '2020-01-01', validUntil: '2020-12-31' });
  const res = await h.call('GET', `/api/qr-auth/${cert.certificate_number}`);
  assert.equal(res.body.data.result, 'EXPIRED');
  assert.equal(res.body.data.tampered, false);
});

test('owners can read only their own certificates', async () => {
  const { cert } = await issue();
  const stranger = await h.createUser('INSTRUMENT_OWNER');

  const own = await h.call('GET', `/api/certificates/${cert.id}`, { token: actors.owner.token });
  assert.equal(own.status, 200);
  assert.match(own.body.data.certificate_file_url, /\?exp=\d+&sig=[0-9a-f]{64}$/);

  const other = await h.call('GET', `/api/certificates/${cert.id}`, { token: stranger.token });
  assert.equal(other.status, 403);

  // the signed link actually downloads the PDF
  const file = await h.call('GET', own.body.data.certificate_file_url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
});

test('re-verification due dates per instrument', async () => {
  const fresh = await h.call('POST', '/api/instruments', {
    token: actors.owner.token,
    body: {
      instrumentTypeId: (await h.pool.query('SELECT id FROM instrument_types LIMIT 1')).rows[0].id,
      instrumentName: 'Never verified',
      serialNumber: h.unique('SN'),
    },
  });
  assert.equal(fresh.status, 201);

  const { flow, cert } = await issue({ validFrom: '2030-01-01', validUntil: '2030-12-31' });
  void cert;

  const list = await h.call('GET', '/api/instruments/due', { token: actors.owner.token });
  assert.equal(list.status, 200);
  const byId = Object.fromEntries(list.body.data.map((r) => [r.instrument_id, r]));
  assert.equal(byId[fresh.body.data.id].verification_state, 'NEVER_VERIFIED');
  assert.equal(byId[flow.instrument.id].verification_state, 'VALID');
  assert.equal(String(byId[flow.instrument.id].next_due_date).slice(0, 4), '2030');

  // due soon / overdue
  await withoutCertificateProtection(() =>
    h.pool.query(
      "UPDATE verification_certificates SET valid_from = CURRENT_DATE - 300, valid_until = CURRENT_DATE + 10 WHERE instrument_id = $1",
      [flow.instrument.id]
    )
  );
  const soon = await h.call('GET', '/api/instruments/due?state=DUE_SOON', { token: actors.owner.token });
  assert.ok(soon.body.data.some((r) => r.instrument_id === flow.instrument.id));

  const within = await h.call('GET', '/api/instruments/due?withinDays=30', { token: actors.owner.token });
  assert.ok(within.body.data.every((r) => r.verification_state !== 'VALID'));
  assert.equal((await h.call('GET', '/api/instruments/due?state=BOGUS', { token: actors.owner.token })).status, 400);

  // owners do not see each other's instruments; admin sees all
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const strangerList = await h.call('GET', '/api/instruments/due', { token: stranger.token });
  assert.equal(strangerList.body.data.length, 0);
  const adminList = await h.call('GET', '/api/instruments/due', { token: actors.admin.token });
  assert.ok(adminList.body.data.length >= list.body.data.length);
});

test('the QR link embeds a verifiable signature', async () => {
  const { cert } = await issue();
  const url = new URL(buildVerificationUrl(cert.qr_token, cert.certificate_number));
  assert.equal(url.origin, 'http://localhost:5173');
  assert.equal(url.pathname, '/verify-public');
  assert.equal(url.searchParams.get('q'), cert.qr_token);
  assert.equal(url.searchParams.get('s').length, 32);
});
