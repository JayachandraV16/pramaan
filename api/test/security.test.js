// Phase 0 security foundations: registration rules, account approval,
// immediate suspension, signed file links, CORS and rate limiting.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const h = require('./helpers');
const config = require('../src/config');
const { signUploadPath } = require('../src/utils/integrity');
const audit = require('../src/utils/audit');

let admin;

test.before(async () => {
  await h.start();
  admin = await h.createUser('ADMIN');
});
test.after(() => h.stop());

const register = (body) =>
  h.call('POST', '/api/auth/register', {
    body: { fullName: 'T User', password: 'Passw0rd!x', email: `${h.unique('r')}@test.local`, ...body },
  });

test('public registration of ADMIN is rejected', async () => {
  const res = await register({ role: 'ADMIN' });
  assert.equal(res.status, 403);
});

test('owner registration is active immediately and returns a token', async () => {
  const res = await register({ role: 'INSTRUMENT_OWNER' });
  assert.equal(res.status, 201);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.status, 'ACTIVE');
});

test('weak passwords are rejected', async () => {
  for (const password of ['short1', 'allletters', '12345678']) {
    const res = await register({ role: 'INSTRUMENT_OWNER', password });
    assert.equal(res.status, 400, password);
  }
});

test('LMO self-registration is pending until an admin approves', async () => {
  const email = `${h.unique('lmo')}@test.local`;
  const reg = await register({ role: 'LMO', email });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.data.token, null);
  assert.equal(reg.body.data.pendingApproval, true);
  assert.equal(reg.body.data.user.status, 'PENDING_APPROVAL');

  const blocked = await h.call('POST', '/api/auth/login', { body: { email, password: 'Passw0rd!x' } });
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.message, /awaiting administrator approval/);

  // wrong password must not reveal the pending status
  const wrong = await h.call('POST', '/api/auth/login', { body: { email, password: 'nope-nope-1' } });
  assert.equal(wrong.status, 401);

  const approve = await h.call('PATCH', `/api/users/${reg.body.data.user.id}/status`, {
    token: admin.token,
    body: { status: 'ACTIVE' },
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.data.status, 'ACTIVE');

  const ok = await h.call('POST', '/api/auth/login', { body: { email, password: 'Passw0rd!x' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);
});

test('only ADMIN can list users or change status', async () => {
  const owner = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await h.call('GET', '/api/users', { token: owner.token })).status, 403);
  assert.equal(
    (await h.call('PATCH', `/api/users/${owner.id}/status`, { token: owner.token, body: { status: 'SUSPENDED' } })).status,
    403
  );
  const list = await h.call('GET', '/api/users?role=INSTRUMENT_OWNER&limit=5', { token: admin.token });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.data.items));
});

test('suspending a user invalidates their existing token immediately', async () => {
  const owner = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await h.call('GET', '/api/auth/me', { token: owner.token })).status, 200);

  const res = await h.call('PATCH', `/api/users/${owner.id}/status`, {
    token: admin.token,
    body: { status: 'SUSPENDED' },
  });
  assert.equal(res.status, 200);
  assert.equal((await h.call('GET', '/api/auth/me', { token: owner.token })).status, 403);
});

test('admin cannot change their own status; PENDING_APPROVAL cannot be set manually', async () => {
  const self = await h.call('PATCH', `/api/users/${admin.id}/status`, {
    token: admin.token,
    body: { status: 'SUSPENDED' },
  });
  assert.equal(self.status, 400);

  const owner = await h.createUser('INSTRUMENT_OWNER');
  const pending = await h.call('PATCH', `/api/users/${owner.id}/status`, {
    token: admin.token,
    body: { status: 'PENDING_APPROVAL' },
  });
  assert.equal(pending.status, 400);
});

test('admin-created accounts and audit trail', async () => {
  const email = `${h.unique('staff')}@test.local`;
  const res = await h.call('POST', '/api/users', {
    token: admin.token,
    body: { fullName: 'Staff GATC', password: 'Passw0rd!x', role: 'GATC', email },
  });
  assert.equal(res.status, 201);
  const login = await h.call('POST', '/api/auth/login', { body: { email, password: 'Passw0rd!x' } });
  assert.equal(login.status, 200);

  const { rows } = await h.pool.query(
    "SELECT 1 FROM audit_log WHERE action = 'USER_CREATED_BY_ADMIN' AND entity_id = $1",
    [res.body.data.id]
  );
  assert.equal(rows.length, 1);
  const chain = await audit.verifyChain();
  assert.equal(chain.valid, true);
});

test('audit log is append-only and a tampered row breaks the chain', async () => {
  await assert.rejects(h.pool.query("UPDATE audit_log SET action = 'X' WHERE id = (SELECT min(id) FROM audit_log)"), /append-only/);
  await assert.rejects(h.pool.query('DELETE FROM audit_log'), /append-only/);

  // Simulate an attacker with DB superuser rights bypassing the trigger.
  const { rows: first } = await h.pool.query('SELECT id, action FROM audit_log ORDER BY id LIMIT 1');
  await h.pool.query('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update');
  try {
    await h.pool.query("UPDATE audit_log SET action = 'FORGED' WHERE id = $1", [first[0].id]);
    const chain = await audit.verifyChain();
    assert.equal(chain.valid, false);
    assert.ok(chain.brokenAtId);
    await h.pool.query('UPDATE audit_log SET action = $2 WHERE id = $1', [first[0].id, first[0].action]);
    assert.equal((await audit.verifyChain()).valid, true, 'chain valid again after restoring the row');
  } finally {
    await h.pool.query('ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update');
  }
});

test('/uploads requires a valid signature', async () => {
  fs.mkdirSync(path.join(config.uploadDir, 'certificates'), { recursive: true });
  const name = `${h.unique('file')}.pdf`;
  fs.writeFileSync(path.join(config.uploadDir, name), '%PDF-1.4 test');

  assert.equal((await h.call('GET', `/uploads/${name}`)).status, 403);
  assert.equal((await h.call('GET', `/uploads/${name}?exp=9999999999&sig=deadbeef`)).status, 403);

  const ok = await h.call('GET', signUploadPath(`/uploads/${name}`));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');

  const expired = await h.call('GET', signUploadPath(`/uploads/${name}`, -10));
  assert.equal(expired.status, 403);

  // path traversal with an otherwise valid signature for a different path
  const traversal = await h.call('GET', signUploadPath(`/uploads/${name}`).replace(name, `%2e%2e%2f${name}`));
  assert.equal(traversal.status, 403);
  // and a validly signed link to a traversal path is still refused
  const sneaky = signUploadPath('/uploads/../package.json');
  const sneakyRes = await h.call('GET', sneaky.replace('/uploads/../', '/uploads/%2e%2e%2f'));
  assert.equal(sneakyRes.status, 403);
});

test('API responses sign file_url values', async () => {
  const { signFileUrls } = require('../src/utils/ApiResponse');
  const out = signFileUrls({ items: [{ file_url: '/uploads/a.png', certificate_file_url: '/uploads/certificates/c.pdf', other: '/uploads/x' }] });
  assert.match(out.items[0].file_url, /^\/uploads\/a\.png\?exp=\d+&sig=[0-9a-f]{64}$/);
  assert.match(out.items[0].certificate_file_url, /\?exp=\d+&sig=/);
  assert.equal(out.items[0].other, '/uploads/x');
});

test('CORS only allows configured origins; security headers are set', async () => {
  const allowed = await h.call('GET', '/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const denied = await h.call('GET', '/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal(denied.headers.get('x-frame-options'), 'DENY');
  assert.equal(denied.headers.get('x-powered-by'), null);
});

test('login is rate limited per IP and email', async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    const email = `${h.unique('rl')}@test.local`;
    let last;
    for (let i = 0; i < 12; i++) {
      last = await h.call('POST', '/api/auth/login', { body: { email, password: 'bad-password-1' } });
    }
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
});

test('uploads outside the allowed types / with wrong content are rejected', async () => {
  const owner = await h.createUser('INSTRUMENT_OWNER');
  const form = new FormData();
  form.append('file', new Blob(['not really a png']), 'evidence.png');
  form.append('category', 'PHOTOGRAPH');
  const res = await fetch(`${await h.start()}/api/attachments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${owner.token}` },
    body: form,
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /does not match/);

  const form2 = new FormData();
  form2.append('file', new Blob(['MZ...']), 'tool.exe');
  const res2 = await fetch(`${await h.start()}/api/attachments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${owner.token}` },
    body: form2,
  });
  assert.equal(res2.status, 400);
});
