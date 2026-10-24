// Search / filter / sort / pagination on list endpoints, and profile management.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, runVerification, newApplication, ok } = require('./workflow');
const { applyListQuery } = require('../src/utils/listQuery');

const items = [
  { id: 1, name: 'Alpha Scale', status: 'ACTIVE', n: 3 },
  { id: 2, name: 'Beta Balance', status: 'INACTIVE', n: 1 },
  { id: 3, name: 'Gamma Scale', status: 'ACTIVE', n: 2 },
  { id: 4, name: null, status: 'ACTIVE', n: null },
];
const opts = { searchFields: ['name'], filters: { status: 'status' }, sortFields: ['n', 'name'] };

test('applyListQuery: no paging params returns the plain array (backward compatible)', () => {
  assert.equal(applyListQuery(items, {}, opts), items);
  assert.deepEqual(applyListQuery(items, { status: 'active' }, opts).map((i) => i.id), [1, 3, 4]);
  assert.deepEqual(applyListQuery(items, { status: 'active,inactive' }, opts).length, 4);
  assert.deepEqual(applyListQuery(items, { search: 'SCALE' }, opts).map((i) => i.id), [1, 3]);
  assert.deepEqual(applyListQuery(items, { search: 'nothing' }, opts), []);
});

test('applyListQuery: sorting only on allowed fields, nulls last', () => {
  assert.deepEqual(applyListQuery(items, { sort: 'n', order: 'asc' }, opts).map((i) => i.id), [2, 3, 1, 4]);
  assert.deepEqual(applyListQuery(items, { sort: 'n', order: 'desc' }, opts).map((i) => i.id), [1, 3, 2, 4]);
  assert.equal(applyListQuery(items, { sort: 'password' }, opts)[0].id, 1, 'unknown sort field ignored');
});

test('applyListQuery: pagination envelope, clamping and defaults', () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ id: i }));
  const p1 = applyListQuery(many, { page: '1', limit: '20' }, {});
  assert.deepEqual({ ...p1, items: p1.items.length }, { items: 20, total: 45, page: 1, limit: 20, totalPages: 3 });
  assert.equal(applyListQuery(many, { page: '3', limit: '20' }, {}).items.length, 5);
  assert.equal(applyListQuery(many, { page: '99', limit: '20' }, {}).page, 3, 'page clamped');
  assert.equal(applyListQuery(many, { limit: '1000' }, {}).limit, 100, 'limit capped');
  assert.equal(applyListQuery(many, { page: 'abc' }, {}).limit, 20, 'default limit');
});

let actors;
test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(() => h.stop());

test('applications list: filter, search and paginate through the API', async () => {
  const a = await newApplication(actors);
  const b = await newApplication(actors);
  await ok(h.call('POST', `/api/applications/${b.application.id}/cancel`, { token: actors.owner.token, body: {} }), 200, 'cancel');

  const plain = await ok(h.call('GET', '/api/applications', { token: actors.owner.token }), 200, 'plain');
  assert.ok(Array.isArray(plain));
  assert.ok(plain.length >= 2);

  const cancelled = await ok(h.call('GET', '/api/applications?status=cancelled', { token: actors.owner.token }), 200, 'filter');
  assert.ok(cancelled.length >= 1 && cancelled.every((x) => x.status === 'CANCELLED'));

  const found = await ok(
    h.call('GET', `/api/applications?search=${encodeURIComponent(a.application.application_number)}`, { token: actors.owner.token }),
    200,
    'search'
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].id, a.application.id);

  const paged = await ok(h.call('GET', '/api/applications?page=1&limit=1&sort=created_at&order=asc', { token: actors.owner.token }), 200, 'paged');
  assert.equal(paged.items.length, 1);
  assert.equal(paged.total, plain.length);
  assert.equal(paged.totalPages, plain.length);

  // results stay scoped to the caller
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const theirs = await ok(h.call('GET', `/api/applications?search=${a.application.application_number}`, { token: stranger.token }), 200, 'scoped');
  assert.deepEqual(theirs, []);
});

test('certificates and instruments lists support search and paging', async () => {
  const flow = await runVerification(actors);
  const cert = await ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
    201,
    'issue'
  );

  const certs = await ok(
    h.call('GET', `/api/certificates?search=${cert.certificate_number.toLowerCase()}&status=active`, { token: actors.owner.token }),
    200,
    'cert search'
  );
  assert.equal(certs.length, 1);

  const pagedCerts = await ok(h.call('GET', '/api/certificates?page=1&limit=5', { token: actors.admin.token }), 200, 'cert paged');
  assert.ok(pagedCerts.total >= 1 && pagedCerts.items.length <= 5);

  const instruments = await ok(
    h.call('GET', `/api/instruments?search=${flow.instrument.serial_number}`, { token: actors.owner.token }),
    200,
    'instrument search'
  );
  assert.equal(instruments.length, 1);

  const verifications = await ok(h.call('GET', '/api/verifications?status=completed&limit=5', { token: actors.admin.token }), 200, 'verifications');
  assert.ok(verifications.items.every((v) => v.status === 'COMPLETED'));
});

test('profile management: edit own profile and change password', async () => {
  const user = await h.createUser('INSTRUMENT_OWNER', { password: 'Oldpass123' });

  const edited = await ok(
    h.call('PATCH', '/api/users/me', {
      token: user.token,
      body: { fullName: 'Renamed Owner', phone: '9876543210', organizationName: 'New Traders', address: '12 MG Road' },
    }),
    200,
    'profile'
  );
  assert.equal(edited.full_name, 'Renamed Owner');
  assert.equal(edited.organization_name, 'New Traders');
  assert.equal(edited.role, 'INSTRUMENT_OWNER');

  // role / status / email cannot be changed through the profile endpoint
  const sneaky = await ok(
    h.call('PATCH', '/api/users/me', { token: user.token, body: { fullName: 'Still Owner', role: 'ADMIN', status: 'ACTIVE', email: 'x@y.z' } }),
    200,
    'sneaky'
  );
  assert.equal(sneaky.role, 'INSTRUMENT_OWNER');
  assert.equal(sneaky.email, user.email);

  const change = (body) => h.call('POST', '/api/users/me/password', { token: user.token, body });
  assert.equal((await change({ currentPassword: 'wrong-password-1', newPassword: 'Newpass456' })).status, 401);
  assert.equal((await change({ currentPassword: 'Oldpass123', newPassword: 'short1' })).status, 400);
  assert.equal((await change({ currentPassword: 'Oldpass123', newPassword: 'Oldpass123' })).status, 400);
  assert.equal((await change({ currentPassword: 'Oldpass123', newPassword: 'Newpass456' })).status, 200);

  assert.equal((await h.call('POST', '/api/auth/login', { body: { email: user.email, password: 'Oldpass123' } })).status, 401);
  assert.equal((await h.call('POST', '/api/auth/login', { body: { email: user.email, password: 'Newpass456' } })).status, 200);

  const { rows } = await h.pool.query(
    "SELECT 1 FROM audit_log WHERE action = 'PASSWORD_CHANGED' AND entity_id = $1",
    [user.id]
  );
  assert.equal(rows.length, 1);
});
