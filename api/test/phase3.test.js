// Phase 3: expiry reminders + scheduler, configurable fees, payment
// verification, instrument-type validity and officer-owner query threads.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, runVerification, newApplication, assignTo, ok } = require('./workflow');
const config = require('../src/config');
const { sendExpiryReminders, stageFor } = require('../src/jobs/expiryReminders');
const { runDailyJobs } = require('../src/jobs');
const { runOnceWithLock } = require('../src/jobs/scheduler');

let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  // fee rules must not leak into other test files sharing this database
  await h.pool.query('DELETE FROM fee_rules');
  await h.stop();
});

async function withoutCertificateProtection(fn) {
  await h.pool.query('ALTER TABLE verification_certificates DISABLE TRIGGER trg_protect_issued_certificate');
  try {
    return await fn();
  } finally {
    await h.pool.query('ALTER TABLE verification_certificates ENABLE TRIGGER trg_protect_issued_certificate');
  }
}

async function issueCertificate(extra = {}) {
  const flow = await runVerification(actors);
  const cert = await ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id, ...extra } }),
    201,
    'issue'
  );
  return { flow, cert };
}

const setDaysLeft = (certId, days) =>
  withoutCertificateProtection(() =>
    h.pool.query(
      'UPDATE verification_certificates SET valid_from = CURRENT_DATE - 300, valid_until = CURRENT_DATE + $2::int WHERE id = $1',
      [certId, days]
    )
  );

const remindersFor = async (certId) =>
  (
    await h.pool.query(
      "SELECT threshold_days FROM reminder_log WHERE certificate_id = $1 ORDER BY threshold_days DESC",
      [certId]
    )
  ).rows.map((r) => r.threshold_days);

// ---------------------------------------------------------------------------
// reminders + scheduler
// ---------------------------------------------------------------------------

test('reminder stage is the smallest threshold reached', () => {
  assert.equal(stageFor(45), null);
  assert.equal(stageFor(30), 30);
  assert.equal(stageFor(20), 30);
  assert.equal(stageFor(15), 15);
  assert.equal(stageFor(10), 15);
  assert.equal(stageFor(7), 7);
  assert.equal(stageFor(3), 7);
  assert.equal(stageFor(1), 1);
  assert.equal(stageFor(0), 1);
});

test('expiry reminders are staged, sent once per stage and reach applicant and owner', async () => {
  const { cert } = await issueCertificate();
  const noteCount = async () =>
    (await h.pool.query(
      "SELECT COUNT(*)::int AS n FROM notifications WHERE related_certificate_id = $1 AND type = 'CERTIFICATE_EXPIRING' AND recipient_id = $2",
      [cert.id, actors.owner.id]
    )).rows[0].n;

  await sendExpiryReminders();
  assert.deepEqual(await remindersFor(cert.id), [], 'a fresh 1-year certificate gets no reminder');

  await setDaysLeft(cert.id, 20);
  await sendExpiryReminders();
  assert.deepEqual(await remindersFor(cert.id), [30]);
  assert.equal(await noteCount(), 1);

  // running again the same day sends nothing new (idempotent)
  const again = await sendExpiryReminders();
  assert.equal(again.certificates, 0);
  assert.equal(await noteCount(), 1);

  await setDaysLeft(cert.id, 5);
  await sendExpiryReminders();
  assert.deepEqual(await remindersFor(cert.id), [30, 7]);

  await setDaysLeft(cert.id, 1);
  await sendExpiryReminders();
  assert.deepEqual(await remindersFor(cert.id), [30, 7, 1]);
  assert.equal(await noteCount(), 3);

  const { rows } = await h.pool.query(
    "SELECT message FROM notifications WHERE related_certificate_id = $1 AND type = 'CERTIFICATE_EXPIRING' ORDER BY created_at DESC, id LIMIT 1",
    [cert.id]
  );
  assert.match(rows[0].message, new RegExp(cert.certificate_number));
  assert.match(rows[0].message, /tomorrow|in \d+ days/);
});

test('revoked, expired and far-future certificates get no reminders', async () => {
  const revoked = (await issueCertificate()).cert;
  const far = (await issueCertificate()).cert;
  await setDaysLeft(revoked.id, 10);
  await ok(
    h.call('PATCH', `/api/certificates/${revoked.id}/status`, {
      token: actors.admin.token,
      body: { status: 'REVOKED', reason: 'Revoked before reminders ran' },
    }),
    200,
    'revoke'
  );
  await sendExpiryReminders();
  assert.deepEqual(await remindersFor(revoked.id), []);
  assert.deepEqual(await remindersFor(far.id), []);
});

test('daily job expires lapsed certificates and then reminds; running it twice is harmless', async () => {
  const lapsed = (await issueCertificate()).cert;
  const soon = (await issueCertificate()).cert;
  await withoutCertificateProtection(async () => {
    await h.pool.query('UPDATE verification_certificates SET valid_from = CURRENT_DATE - 400, valid_until = CURRENT_DATE - 2 WHERE id = $1', [lapsed.id]);
    await h.pool.query('UPDATE verification_certificates SET valid_from = CURRENT_DATE - 300, valid_until = CURRENT_DATE + 12 WHERE id = $1', [soon.id]);
  });

  const first = await runDailyJobs();
  assert.ok(first.expired >= 1);
  assert.ok(first.reminders.certificates >= 1);
  assert.equal((await h.pool.query('SELECT status FROM verification_certificates WHERE id = $1', [lapsed.id])).rows[0].status, 'EXPIRED');
  assert.deepEqual(await remindersFor(soon.id), [15]);

  const second = await runDailyJobs();
  assert.equal(second.expired, 0);
  assert.equal(second.reminders.certificates, 0);
});

test('the scheduler lock stops two instances running the jobs at once', async () => {
  const other = await h.pool.connect();
  try {
    await other.query('SELECT pg_advisory_lock(727002)');
    assert.equal(await runOnceWithLock(), null, 'skipped while another instance holds the lock');
  } finally {
    await other.query('SELECT pg_advisory_unlock(727002)');
    other.release();
  }
  const summary = await runOnceWithLock();
  assert.ok(summary && 'expired' in summary);
});

// ---------------------------------------------------------------------------
// fees
// ---------------------------------------------------------------------------

const rule = (body, token = actors.admin.token) => h.call('POST', '/api/fees/rules', { token, body });

test('fee rules: ADMIN only, validated, audited', async () => {
  assert.equal((await rule({ feeKind: 'VERIFICATION', amount: 100 }, actors.owner.token)).status, 403);
  assert.equal((await rule({ feeKind: 'BOGUS', amount: 100 })).status, 400);
  assert.equal((await rule({ feeKind: 'VERIFICATION', amount: -5 })).status, 400);
  assert.equal((await rule({ feeKind: 'VERIFICATION', amount: 10, minCapacity: 50, maxCapacity: 5 })).status, 400);
  assert.equal((await rule({ feeKind: 'VERIFICATION', amount: 10, effectiveFrom: '2030-01-02', effectiveTo: '2030-01-01' })).status, 400);
  assert.equal((await rule({ feeKind: 'VERIFICATION', amount: 10, instrumentTypeId: '00000000-0000-0000-0000-000000000000' })).status, 400);

  const created = await rule({ feeKind: 'VERIFICATION', amount: 250.5, description: 'Base fee' });
  assert.equal(created.status, 201);
  assert.equal(Number(created.body.data.amount), 250.5);
  const { rows } = await h.pool.query("SELECT 1 FROM audit_log WHERE action = 'FEE_RULE_CREATED' AND entity_id = $1", [created.body.data.id]);
  assert.equal(rows.length, 1);

  const list = await h.call('GET', '/api/fees/rules', { token: actors.admin.token });
  assert.ok(list.body.data.some((r) => r.id === created.body.data.id));
  assert.equal((await h.call('GET', '/api/fees/rules', { token: actors.owner.token })).status, 403);

  await h.pool.query('DELETE FROM fee_rules');
});

test('the most specific active rule wins; capacity bands, types and dates are respected', async () => {
  const { instrument } = await newApplication(actors);
  const typeId = (await h.pool.query('SELECT instrument_type_id FROM instruments WHERE id = $1', [instrument.id])).rows[0].instrument_type_id;
  // instrument capacity is 100 kg
  await rule({ feeKind: 'VERIFICATION', amount: 100, description: 'generic' });
  await rule({ feeKind: 'VERIFICATION', amount: 150, minCapacity: 0, maxCapacity: 500, description: 'small' });
  await rule({ feeKind: 'VERIFICATION', amount: 400, minCapacity: 501, maxCapacity: 5000, description: 'large' });
  await rule({ feeKind: 'VERIFICATION', amount: 175, instrumentTypeId: typeId, description: 'this type' });
  await rule({ feeKind: 'VERIFICATION', amount: 90, instrumentTypeId: typeId, applicationType: 'RE_VERIFICATION', description: 're-verification' });
  await rule({ feeKind: 'VERIFICATION', amount: 999, effectiveFrom: '2000-01-01', effectiveTo: '2000-12-31', description: 'expired rule' });
  await rule({ feeKind: 'CONVEYANCE', amount: 300 });
  await rule({ feeKind: 'QUARTER_JUMP', amount: 50 });

  const quote = (q) => h.call('GET', `/api/fees/quote?instrumentId=${instrument.id}&${q}`, { token: actors.owner.token });

  const base = (await quote('applicationType=VERIFICATION')).body.data;
  assert.equal(base.verificationFee, 175, 'type-specific beats capacity band beats generic');
  assert.equal(base.conveyanceFee, 0, 'not requested, not charged');
  assert.equal(base.total, 175);
  assert.equal(base.configured, true);

  const reverif = (await quote('applicationType=RE_VERIFICATION')).body.data;
  assert.equal(reverif.verificationFee, 90, 'type + application type is the most specific');

  const full = (await quote('applicationType=VERIFICATION&conveyance=true&quarterJump=true')).body.data;
  assert.equal(full.conveyanceFee, 300);
  assert.equal(full.quarterJumpFee, 50);
  assert.equal(full.total, 525);

  assert.equal((await quote('applicationType=NOPE')).status, 400);
  assert.equal((await h.call('GET', '/api/fees/quote', { token: actors.owner.token })).status, 400);
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal(
    (await h.call('GET', `/api/fees/quote?instrumentId=${instrument.id}`, { token: stranger.token })).status,
    403
  );

  await h.pool.query('DELETE FROM fee_rules');
});

test('applications use server-computed fees; without rules the client figures are kept', async () => {
  // no rules: behaviour unchanged, nothing computed
  const { instrument } = await newApplication(actors);
  const { rows: before } = await h.pool.query('SELECT verification_fee, total_fee FROM verification_applications WHERE instrument_id = $1', [instrument.id]);
  assert.equal(before[0].verification_fee, null);
  assert.equal(before[0].total_fee, null);

  await rule({ feeKind: 'VERIFICATION', amount: 200 });
  await rule({ feeKind: 'CONVEYANCE', amount: 120 });

  // a second instrument; the owner tries to under-declare the conveyance fee
  const second = await newApplicationFor(actors, { conveyanceFee: 1, quarterJumpFee: 75 });
  assert.equal(Number(second.verification_fee), 200);
  assert.equal(Number(second.conveyance_fee), 120, 'server amount replaces the client value');
  assert.equal(Number(second.quarter_jump_fee), 75, 'no QUARTER_JUMP rule: client figure kept');
  assert.equal(Number(second.total_fee), 395);

  await h.pool.query('DELETE FROM fee_rules');
});

async function newApplicationFor(a, extra) {
  const { rows } = await h.pool.query('SELECT id FROM instrument_types ORDER BY name LIMIT 1');
  const instrument = await ok(
    h.call('POST', '/api/instruments', {
      token: a.owner.token,
      body: { instrumentTypeId: rows[0].id, instrumentName: 'Fee scale', serialNumber: h.unique('SN'), capacity: 100, capacityUnit: 'kg' },
    }),
    201,
    'instrument'
  );
  return ok(
    h.call('POST', '/api/applications', {
      token: a.owner.token,
      body: { instrumentId: instrument.id, applicationType: 'VERIFICATION', division: 'PUNE', ...extra },
    }),
    201,
    'application'
  );
}

test('fee rules can be deactivated or end-dated but not deleted', async () => {
  const created = (await rule({ feeKind: 'VERIFICATION', amount: 60 })).body.data;
  const patch = (body, token = actors.admin.token) => h.call('PATCH', `/api/fees/rules/${created.id}`, { token, body });
  assert.equal((await patch({ amount: 70 }, actors.owner.token)).status, 403);
  assert.equal((await patch({ amount: -1 })).status, 400);
  const updated = await patch({ amount: 70, isActive: false });
  assert.equal(updated.status, 200);
  assert.equal(Number(updated.body.data.amount), 70);
  assert.equal(updated.body.data.is_active, false);
  assert.equal((await h.call('DELETE', `/api/fees/rules/${created.id}`, { token: actors.admin.token })).status, 404);
  assert.equal((await h.call('PATCH', '/api/fees/rules/00000000-0000-0000-0000-000000000000', { token: actors.admin.token, body: { amount: 1 } })).status, 404);

  const { rows } = await h.pool.query("SELECT details FROM audit_log WHERE action = 'FEE_RULE_UPDATED' AND entity_id = $1", [created.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].details.after.isActive, false);
  await h.pool.query('DELETE FROM fee_rules');
});

// ---------------------------------------------------------------------------
// payment verification
// ---------------------------------------------------------------------------

test('payment verification: ADMIN only, needs a challan, optionally required before assignment', async () => {
  const noChallan = await newApplication(actors);
  const verify = (id, token = actors.admin.token) => h.call('POST', `/api/applications/${id}/payment-verified`, { token });
  assert.equal((await verify(noChallan.application.id)).status, 400, 'no challan number');

  const withChallan = await newApplicationFor(actors, { grasChallanNumber: 'GRAS-12345', grasChallanDate: '2031-01-01' });
  assert.equal((await verify(withChallan.id, actors.owner.token)).status, 403);

  const previous = config.requirePaymentBeforeAssignment;
  config.requirePaymentBeforeAssignment = true;
  try {
    const blocked = await h.call('POST', '/api/assignments', {
      token: actors.admin.token,
      body: { applicationId: withChallan.id, assignedToId: actors.lmo.id },
    });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /payment/i);

    const verified = await verify(withChallan.id);
    assert.equal(verified.status, 200);
    assert.ok(verified.body.data.payment_verified_at);
    assert.equal(verified.body.data.payment_verified_by_id, actors.admin.id);
    assert.equal((await verify(withChallan.id)).status, 200, 'idempotent');

    const allowed = await h.call('POST', '/api/assignments', {
      token: actors.admin.token,
      body: { applicationId: withChallan.id, assignedToId: actors.lmo.id },
    });
    assert.equal(allowed.status, 201);
  } finally {
    config.requirePaymentBeforeAssignment = previous;
  }

  const { rows } = await h.pool.query("SELECT 1 FROM audit_log WHERE action = 'APPLICATION_PAYMENT_VERIFIED' AND entity_id = $1", [withChallan.id]);
  assert.equal(rows.length, 1);
  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE related_application_id = $1 AND title = 'Payment verified' AND recipient_id = $2",
    [withChallan.id, actors.owner.id]
  );
  assert.equal(notes.length, 1);
});

// ---------------------------------------------------------------------------
// instrument types / validity
// ---------------------------------------------------------------------------

test('ADMIN can configure default validity per instrument type and issuance uses it', async () => {
  const types = await ok(h.call('GET', '/api/instruments/types', { token: actors.owner.token }), 200, 'types');
  assert.ok(types.length >= 1);
  assert.ok(types.every((t) => t.is_active === true), 'owners only see active types');
  assert.equal(types[0].default_validity_months, 12);

  const flow = await runVerification(actors);
  const typeId = (await h.pool.query('SELECT instrument_type_id FROM instruments WHERE id = $1', [flow.instrument.id])).rows[0].instrument_type_id;

  const patch = (body, token = actors.admin.token) => h.call('PATCH', `/api/instruments/types/${typeId}`, { token, body });
  assert.equal((await patch({ defaultValidityMonths: 24 }, actors.owner.token)).status, 403);
  assert.equal((await patch({ defaultValidityMonths: 0 })).status, 400);
  assert.equal((await patch({ defaultValidityMonths: 6.5 })).status, 400);
  assert.equal((await patch({ defaultValidityMonths: 24 })).status, 200);

  try {
    const cert = await ok(
      h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
      201,
      'issue'
    );
    const days = Math.round((new Date(cert.valid_until) - new Date(cert.valid_from)) / 86400000);
    assert.ok(days >= 729 && days <= 731, `24-month validity, got ${days} days`);
  } finally {
    await patch({ defaultValidityMonths: 12 });
  }

  const adminTypes = await ok(h.call('GET', '/api/instruments/types', { token: actors.admin.token }), 200, 'admin types');
  assert.ok(adminTypes.length >= types.length);
});

// ---------------------------------------------------------------------------
// query threads
// ---------------------------------------------------------------------------

test('officer-owner query thread: open, reply, notify, close, permissions', async () => {
  const { application } = await newApplication(actors);
  await assignTo(actors, application.id, actors.lmo);

  const open = await h.call('POST', '/api/queries', {
    token: actors.lmo.token,
    body: { applicationId: application.id, subject: 'Missing calibration record', message: 'Please upload the last calibration certificate.' },
  });
  assert.equal(open.status, 201);
  const queryId = open.body.data.id;

  // the owner is notified and sees whose turn it is
  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'QUERY_MESSAGE' AND related_application_id = $2",
    [actors.owner.id, application.id]
  );
  assert.equal(notes.length, 1);

  const ownerView = await ok(h.call('GET', `/api/queries/${queryId}`, { token: actors.owner.token }), 200, 'owner view');
  assert.equal(ownerView.messages.length, 1);
  assert.equal(ownerView.awaiting, 'APPLICANT');
  assert.equal(ownerView.messages[0].author_role, 'LMO');
  assert.equal(ownerView.application_number, application.application_number);

  const reply = await h.call('POST', `/api/queries/${queryId}/messages`, {
    token: actors.owner.token,
    body: { body: 'Uploaded in the documents section.' },
  });
  assert.equal(reply.status, 201);
  const afterReply = await ok(h.call('GET', `/api/queries/${queryId}`, { token: actors.lmo.token }), 200, 'officer view');
  assert.equal(afterReply.awaiting, 'DEPARTMENT');
  assert.equal(afterReply.messages.length, 2);

  // the officer is told about the reply, the author is not told about their own message
  const { rows: officerNotes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'QUERY_MESSAGE' AND title LIKE 'Reply on query%'",
    [actors.lmo.id]
  );
  assert.equal(officerNotes.length, 1);

  const list = await ok(h.call('GET', `/api/queries?applicationId=${application.id}`, { token: actors.owner.token }), 200, 'list');
  assert.equal(list.length, 1);
  assert.equal(list[0].message_count, 2);
  assert.equal(list[0].awaiting, 'DEPARTMENT');

  // outsiders see nothing and cannot post
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const otherOfficer = await h.createUser('LMO');
  for (const outsider of [stranger, otherOfficer]) {
    assert.equal((await h.call('GET', `/api/queries/${queryId}`, { token: outsider.token })).status, 403);
    assert.equal((await h.call('POST', `/api/queries/${queryId}/messages`, { token: outsider.token, body: { body: 'hi' } })).status, 403);
    assert.deepEqual(await ok(h.call('GET', '/api/queries', { token: outsider.token }), 200, 'outsider list'), []);
  }
  assert.equal(
    (await h.call('POST', '/api/queries', { token: stranger.token, body: { applicationId: application.id, subject: 'x', message: 'y' } })).status,
    403
  );

  // only the opener or an admin closes; closed threads take no messages
  assert.equal((await h.call('PATCH', `/api/queries/${queryId}/close`, { token: actors.owner.token })).status, 403);
  const closed = await h.call('PATCH', `/api/queries/${queryId}/close`, { token: actors.lmo.token });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.data.status, 'CLOSED');
  assert.equal((await h.call('POST', `/api/queries/${queryId}/messages`, { token: actors.owner.token, body: { body: 'one more thing' } })).status, 409);
  const adminView = await ok(h.call('GET', `/api/queries?status=closed`, { token: actors.admin.token }), 200, 'admin closed list');
  assert.ok(adminView.some((q) => q.id === queryId));
});

test('query input is validated', async () => {
  const { application } = await newApplication(actors);
  const post = (body) => h.call('POST', '/api/queries', { token: actors.owner.token, body: { applicationId: application.id, ...body } });
  assert.equal((await post({ subject: '   ', message: 'text' })).status, 400);
  assert.equal((await post({ subject: 'x'.repeat(201), message: 'text' })).status, 400);
  assert.equal((await post({ subject: 'ok', message: 'x'.repeat(4001) })).status, 400);
  assert.equal(
    (await h.call('POST', '/api/queries', { token: actors.owner.token, body: { applicationId: '00000000-0000-0000-0000-000000000000', subject: 'a', message: 'b' } })).status,
    404
  );
  const pub = await h.createUser('PUBLIC_USER');
  assert.equal((await h.call('GET', '/api/queries', { token: pub.token })).status, 403);
});
