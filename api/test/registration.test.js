// Registration: a valid password is accepted for every self-registrable role, invalid ones are refused with a
// specific message, and the web form applies the same rule as the server (a typo in the form's own check,
// /d/ instead of /\d/, once rejected valid passwords such as "Test12345").

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');

let rules;
test.before(async () => {
  await h.start();
  rules = await import('../../web/src/utils/passwordRules.ts');
});
test.after(async () => {
  await h.stop();
});

const register = (role, password, extra = {}) =>
  h.call('POST', '/api/auth/register', { body: { fullName: 'Reg Test', email: `${h.unique('reg')}@example.com`, phone: '9876543210', role, password, ...extra } });

test('the web form rule accepts and refuses exactly what the server does', async () => {
  const cases = ['Test12345', 'abcdefg1', '12345678a', 'Pass word 1', 'Ünïcode9pass', 'a'.repeat(127) + '1', 'short1', 'onlyletters', '12345678', '', 'a'.repeat(128) + '1', ' '.repeat(10)];
  for (const password of cases) {
    const client = rules.passwordProblem(password) === null;
    const res = await register('INSTRUMENT_OWNER', password);
    assert.equal(client, res.status === 201, `"${password.slice(0, 20)}": web says ${client}, server answered ${res.status} ${res.text.slice(0, 80)}`);
  }
  assert.equal(rules.passwordProblem('Test12345'), null);
  assert.match(rules.passwordProblem('short1'), /between 8 and 128/);
  assert.match(rules.passwordProblem('onlyletters'), /digit/);
  assert.match(rules.passwordProblem('12345678'), /letter/);
});

test('Instrument Owner, LMO and GATC can register with a valid password; LMO and GATC wait for approval', async () => {
  const owner = await register('INSTRUMENT_OWNER', 'Test12345');
  assert.equal(owner.status, 201, owner.text);
  assert.ok(owner.body.data.token, 'an owner is signed in at once');

  for (const role of ['LMO', 'GATC']) {
    const email = `${h.unique(role.toLowerCase())}@example.com`;
    const res = await register(role, 'Test12345', { email });
    assert.equal(res.status, 201, `${role}: ${res.text}`);
    assert.ok(!res.body.data.token, `${role} gets no token before approval`);
    const row = (await h.pool.query('SELECT status FROM users WHERE email = $1', [email])).rows[0];
    assert.equal(row.status, 'PENDING_APPROVAL');
    const login = await h.call('POST', '/api/auth/login', { body: { email, password: 'Test12345' } });
    assert.notEqual(login.status, 200, 'cannot sign in until approved');
  }
});

test('invalid passwords are refused with a clear message and no account is created', async () => {
  for (const [password, message] of [['short1', /between 8 and 128/], ['onlyletters', /letter and one digit/], ['12345678', /letter and one digit/]]) {
    for (const role of ['INSTRUMENT_OWNER', 'LMO', 'GATC']) {
      const email = `${h.unique('bad')}@example.com`;
      const res = await register(role, password, { email });
      assert.equal(res.status, 400, `${role} ${password}`);
      assert.match(res.body.message, message);
      assert.equal((await h.pool.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount, 0);
    }
  }
  assert.equal((await register('ADMIN', 'Test12345')).status, 403, 'administrators cannot self-register');
});
