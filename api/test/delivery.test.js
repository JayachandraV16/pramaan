// Phase 5: e-mail / SMS delivery of notifications (outbox, retries, opt-out).

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const h = require('./helpers');
const { createActors, ok } = require('./workflow');
const config = require('../src/config');
const delivery = require('../src/utils/delivery');

let actors;
const original = { ...config.delivery };

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  Object.assign(config.delivery, original);
  delivery.setProviders(null);
  await h.stop();
});

test.beforeEach(() => {
  config.delivery.mode = 'log';
  delivery.setProviders(null);
});

// An owner with a deliverable e-mail address and a mobile number.
async function owner(extra = {}) {
  const u = await h.createUser('INSTRUMENT_OWNER', { email: `${h.unique('own')}@mailtest.dev` });
  await h.pool.query('UPDATE users SET phone = $2 WHERE id = $1', [u.id, extra.phone || '98765 43210']);
  if (extra.language) await h.pool.query('UPDATE users SET preferred_language = $2 WHERE id = $1', [u.id, extra.language]);
  if (extra.notifyEmail === false) await h.pool.query('UPDATE users SET notify_email = false WHERE id = $1', [u.id]);
  if (extra.notifySms === false) await h.pool.query('UPDATE users SET notify_sms = false WHERE id = $1', [u.id]);
  return u;
}

const registerCase = (subjectUserId) =>
  ok(
    h.call('POST', '/api/enforcement', {
      token: actors.lmo.token,
      body: { source: 'SPOT_CHECK', offenceType: 'UNSTAMPED_INSTRUMENT', description: 'No stamp on scale', subjectUserId },
    }),
    201,
    'case'
  );

const deliveriesFor = async (userId) =>
  (
    await h.pool.query(
      `SELECT d.* FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id
        WHERE n.recipient_id = $1 ORDER BY d.channel`,
      [userId]
    )
  ).rows;

test('nothing is queued while delivery is off', async () => {
  config.delivery.mode = 'off';
  const o = await owner();
  await registerCase(o.id);
  assert.equal((await deliveriesFor(o.id)).length, 0);
  assert.deepEqual(await delivery.deliverDue(), { sent: 0, failed: 0, retried: 0, skipped: 0 });
});

test('a notification queues an e-mail and (for important types) an SMS to the normalised number', async () => {
  const o = await owner();
  await registerCase(o.id);
  const rows = await deliveriesFor(o.id);
  assert.deepEqual(rows.map((r) => r.channel), ['EMAIL', 'SMS']);
  assert.equal(rows.find((r) => r.channel === 'SMS').destination, '+919876543210');
  assert.equal(rows.find((r) => r.channel === 'EMAIL').destination, o.email.toLowerCase());
  assert.ok(rows.every((r) => r.status === 'PENDING'));
});

test('less important notifications go by e-mail only; opt-outs, bad numbers and reserved domains are respected', async () => {
  const noSms = await owner({ notifySms: false });
  await registerCase(noSms.id);
  assert.deepEqual((await deliveriesFor(noSms.id)).map((r) => r.channel), ['EMAIL']);

  const noEmail = await owner({ notifyEmail: false });
  await registerCase(noEmail.id);
  assert.deepEqual((await deliveriesFor(noEmail.id)).map((r) => r.channel), ['SMS']);

  const badPhone = await owner({ phone: '12345' });
  await registerCase(badPhone.id);
  assert.deepEqual((await deliveriesFor(badPhone.id)).map((r) => r.channel), ['EMAIL']);

  const reserved = await h.createUser('INSTRUMENT_OWNER'); // @test.local cannot receive mail
  await registerCase(reserved.id);
  assert.equal((await deliveriesFor(reserved.id)).length, 0);

  // a query reply is e-mail only (not an SMS type)
  assert.equal(delivery.SMS_TYPES.has('QUERY_MESSAGE'), false);
});

test('the worker sends through the providers, in the user\'s language, and never twice', async () => {
  const sent = [];
  delivery.setProviders({
    email: { send: async (m) => { sent.push(['email', m]); return { ref: 'm-1' }; } },
    sms: { send: async (m) => { sent.push(['sms', m]); return { ref: 's-1' }; } },
  });
  const o = await owner({ language: 'hi' });
  await registerCase(o.id);

  const first = await delivery.deliverDue();
  assert.ok(first.sent >= 2);
  const mail = sent.find(([k, m]) => k === 'email' && m.to === o.email.toLowerCase())[1];
  const sms = sent.find(([k, m]) => k === 'sms' && m.to === '+919876543210')[1];
  assert.match(mail.subject, /^\[Pramaan\] /);
  assert.match(mail.subject, /[ऀ-ॿ]/, 'subject is Hindi');
  assert.ok(mail.text.includes('/notifications'));
  assert.ok(sms.text.startsWith('Pramaan: ') && sms.text.length <= 320);

  const rows = await deliveriesFor(o.id);
  assert.ok(rows.every((r) => r.status === 'SENT' && r.sent_at && r.attempts === 1));
  const before = sent.length;
  await delivery.deliverDue();
  assert.equal(sent.length, before, 'second run sends nothing new');
});

test('failures are retried with backoff and given up after five attempts; permanent errors fail at once', async () => {
  const o = await owner();
  await registerCase(o.id);
  delivery.setProviders({
    email: { send: async () => { throw new Error('SMTP down'); } },
    sms: { send: async () => { const e = new Error('bad number'); e.permanent = true; throw e; } },
  });

  await delivery.deliverDue();
  let rows = await deliveriesFor(o.id);
  const email = rows.find((r) => r.channel === 'EMAIL');
  const sms = rows.find((r) => r.channel === 'SMS');
  assert.equal(email.status, 'PENDING');
  assert.equal(email.attempts, 1);
  assert.match(email.last_error, /SMTP down/);
  assert.ok(new Date(email.next_attempt_at) > new Date(), 'retry is scheduled in the future');
  assert.equal(sms.status, 'FAILED');
  assert.equal(sms.attempts, 1);

  // not due yet: untouched
  const idle = await delivery.deliverDue();
  assert.equal(idle.retried + idle.sent + idle.failed, 0);

  for (let i = 0; i < delivery.MAX_ATTEMPTS - 1; i++) {
    await h.pool.query("UPDATE notification_deliveries SET next_attempt_at = now() WHERE id = $1", [email.id]);
    await delivery.deliverDue();
  }
  rows = await deliveriesFor(o.id);
  assert.equal(rows.find((r) => r.channel === 'EMAIL').status, 'FAILED');
  assert.equal(rows.find((r) => r.channel === 'EMAIL').attempts, delivery.MAX_ATTEMPTS);
});

test('a missing provider marks the delivery SKIPPED instead of retrying forever', async () => {
  config.delivery.mode = 'live';
  config.delivery.smtpUrl = '';
  config.delivery.smsUrl = '';
  const o = await owner();
  await registerCase(o.id);
  const summary = await delivery.deliverDue();
  assert.ok(summary.skipped >= 2);
  assert.ok((await deliveriesFor(o.id)).every((r) => r.status === 'SKIPPED' && /provider/.test(r.last_error)));
});

test('the SMS gateway receives the documented JSON request and 4xx answers are permanent', async () => {
  const seen = [];
  let status = 200;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method, auth: req.headers.authorization, body: JSON.parse(body) });
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'sms-42' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    config.delivery.mode = 'live';
    config.delivery.smsUrl = `http://127.0.0.1:${server.address().port}/send`;
    config.delivery.smsToken = 'gateway-token';
    config.delivery.smsSender = 'PRAMAN';
    delivery.setProviders({ email: { send: async () => ({ ref: 'e' }) } }); // sms: real HTTP provider

    const o = await owner({ notifyEmail: false });
    await registerCase(o.id);
    await delivery.deliverDue();
    assert.equal(seen.length >= 1, true);
    const req = seen.find((s) => s.body.to === '+919876543210');
    assert.equal(req.method, 'POST');
    assert.equal(req.auth, 'Bearer gateway-token');
    assert.equal(req.body.sender, 'PRAMAN');
    assert.match(req.body.message, /^Pramaan: /);
    const row = (await deliveriesFor(o.id))[0];
    assert.equal(row.status, 'SENT');
    assert.equal(row.provider_ref, 'sms-42');

    status = 400;
    const o2 = await owner({ notifyEmail: false });
    await registerCase(o2.id);
    await delivery.deliverDue();
    assert.equal((await deliveriesFor(o2.id))[0].status, 'FAILED');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('address helpers and profile preferences', async () => {
  assert.equal(delivery.normalisePhone('+91 98765-43210'), '+919876543210');
  assert.equal(delivery.normalisePhone('09876543210'), '+919876543210');
  assert.equal(delivery.normalisePhone('919876543210'), '+919876543210');
  assert.equal(delivery.normalisePhone('+14155550123'), '+14155550123');
  assert.equal(delivery.normalisePhone('5876543210'), null);
  assert.equal(delivery.normaliseEmail(' Owner@Shop.IN '), 'owner@shop.in');
  assert.equal(delivery.normaliseEmail('x@pramaan.local'), null);
  assert.equal(delivery.normaliseEmail('x@example.com'), null);
  assert.equal(delivery.normaliseEmail('not-an-email'), null);
  assert.equal(delivery.buildEmail({ destination: 'a@b.in', title: 'Hi\r\nBcc: x@y.z', message: 'm' }).subject.includes('\n'), false);

  const u = await owner();
  const me = await ok(h.call('PATCH', '/api/users/me', { token: u.token, body: { notifyEmail: false, notifySms: false } }), 200, 'prefs');
  assert.equal(me.notify_email, false);
  assert.equal(me.notify_sms, false);
  assert.equal((await h.call('PATCH', '/api/users/me', { token: u.token, body: { notifyEmail: 'no' } })).status, 400);
});
