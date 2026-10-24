// Production start-up guard: no development/demo accounts may be active.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { findActiveDevAccounts, assertNoDevAccounts } = require('../src/utils/startupChecks');

test.before(async () => {
  await h.start();
});
test.after(async () => {
  await h.pool.query("DELETE FROM users WHERE email LIKE '%@pramaan.local' AND email LIKE 'guardtest-%'");
  await h.stop();
});

test('development accounts are found, suspended ones are not', async () => {
  const dev = await h.createUser('ADMIN', { email: `guardtest-${h.unique('a')}@pramaan.local` });
  const found = (await findActiveDevAccounts()).map((a) => a.email);
  assert.ok(found.includes(dev.email.toLowerCase()) || found.includes(dev.email));

  await h.pool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [dev.id]);
  const after = (await findActiveDevAccounts()).map((a) => a.email);
  assert.ok(!after.includes(dev.email.toLowerCase()) && !after.includes(dev.email));
});

test('production refuses to start with an active development account; other environments do not care', async () => {
  const dev = await h.createUser('INSTRUMENT_OWNER', { email: `guardtest-${h.unique('b')}@pramaan.local` });

  await assert.rejects(assertNoDevAccounts({ isProduction: true }), /development accounts are active.*guardtest-/);
  await assert.doesNotReject(assertNoDevAccounts({ isProduction: false }));

  await h.pool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [dev.id]);
  // other tests in this database may leave their own *@pramaan.local users; only ours must be gone
  const remaining = (await findActiveDevAccounts()).filter((a) => a.email.startsWith('guardtest-'));
  assert.equal(remaining.length, 0);
});
