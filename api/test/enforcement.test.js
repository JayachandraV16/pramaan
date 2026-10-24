// Phase 5: enforcement cases, repeat-offender tracking and case handling.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, newApplication, ok } = require('./workflow');

let actors;
let gatc;

test.before(async () => {
  await h.start();
  actors = await createActors();
  gatc = await h.createUser('GATC');
});
test.after(async () => {
  await h.stop();
});

const register = (token, body) => h.call('POST', '/api/enforcement', { token, body });
const trader = () => `Trader ${h.unique('t')}`;

function offence(subjectName, extra = {}) {
  return {
    source: 'SPOT_CHECK',
    offenceType: 'UNSTAMPED_INSTRUMENT',
    description: 'Platform scale in use without a verification stamp',
    subjectName,
    subjectPhone: '9876543210',
    location: 'Weekly market',
    latitude: 18.52,
    longitude: 73.85,
    ...extra,
  };
}

test('officers register cases; numbers are sequential and the trader is tracked by name', async () => {
  const name = trader();
  const a = await ok(register(actors.lmo.token, offence(name)), 201, 'first case');
  assert.match(a.case_number, /^ENF-\d{4}-\d{6}$/);
  assert.equal(a.status, 'OPEN');
  assert.equal(a.offence_number, 1);
  assert.equal(a.offender_flag, 'FIRST');
  assert.equal(a.detected_by_id, actors.lmo.id);

  const b = await ok(register(gatc.token, offence(name.toUpperCase() + '  ')), 201, 'same trader, different spelling');
  assert.equal(b.offender_key, a.offender_key);
  assert.equal(Number(b.case_number.slice(-6)), Number(a.case_number.slice(-6)) + 1);
});

test('2nd offence in 12 months flags REPEAT, 3rd HABITUAL, and admins are alerted', async () => {
  const name = trader();
  const flags = [];
  for (let i = 0; i < 3; i++) {
    const c = await ok(register(actors.lmo.token, offence(name, { offenceType: i === 1 ? 'SEAL_TAMPERING' : 'UNSTAMPED_INSTRUMENT' })), 201, `case ${i + 1}`);
    flags.push(c.offender_flag);
    assert.equal(c.offence_number, i + 1);
  }
  assert.deepEqual(flags, ['FIRST', 'REPEAT', 'HABITUAL']);

  const alerts = await h.pool.query(
    "SELECT title FROM notifications WHERE recipient_id = $1 AND type = 'ENFORCEMENT_ACTION' ORDER BY created_at",
    [actors.admin.id]
  );
  assert.ok(alerts.rows.some((r) => /Repeat offender/.test(r.title)));
  assert.ok(alerts.rows.some((r) => /Habitual offender/.test(r.title)));

  const list = await ok(h.call('GET', '/api/enforcement/offenders', { token: actors.admin.token }), 200, 'offenders');
  const row = list.find((o) => o.subject_name === name);
  assert.equal(row.flag, 'HABITUAL');
  assert.equal(row.offences_12m, 3);

  const first = await ok(register(actors.lmo.token, offence(trader())), 201, 'new offender');
  const hidden = await ok(h.call('GET', '/api/enforcement/offenders', { token: actors.admin.token }), 200, 'offenders');
  assert.ok(!hidden.some((o) => o.offender_key === first.offender_key), 'first-time offenders are not listed by default');
  const all = await ok(h.call('GET', '/api/enforcement/offenders?all=true', { token: actors.admin.token }), 200, 'all');
  assert.ok(all.some((o) => o.offender_key === first.offender_key));
});

test('a spot check with no offence is closed at once and never counted', async () => {
  const name = trader();
  const clean = await ok(register(actors.lmo.token, offence(name, { offenceType: 'NONE', description: 'All instruments stamped and valid' })), 201, 'clean');
  assert.equal(clean.status, 'RESOLVED');
  assert.equal(clean.offence_number, 0);
  const real = await ok(register(actors.lmo.token, offence(name)), 201, 'first real offence');
  assert.equal(real.offence_number, 1);
  assert.equal(real.offender_flag, 'FIRST');
});

test('cases about a registered owner link to the instrument, notify the owner and stay private to them', async () => {
  const { instrument } = await newApplication(actors);
  const c = await ok(register(actors.lmo.token, offence(undefined, { instrumentId: instrument.id, subjectName: undefined, offenceType: 'EXPIRED_CERTIFICATE' })), 201, 'owner case');
  assert.equal(c.subject_user_id, actors.owner.id);
  assert.equal(c.instrument_id, instrument.id);
  assert.equal(c.offender_key, `user:${actors.owner.id}`);

  const note = await h.pool.query("SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'ENFORCEMENT_ACTION' AND title LIKE $2", [actors.owner.id, `%${c.case_number}%`]);
  assert.equal(note.rowCount, 1);

  const mine = await ok(h.call('GET', '/api/enforcement', { token: actors.owner.token }), 200, 'owner list');
  assert.ok(mine.some((x) => x.id === c.id));
  const other = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await h.call('GET', `/api/enforcement/${c.id}`, { token: other.token })).status, 404);
  assert.equal((await h.call('GET', `/api/enforcement/${c.id}`, { token: actors.owner.token })).status, 200);

  // officers only see what they registered
  const otherOfficer = await h.createUser('LMO');
  const theirs = await ok(h.call('GET', '/api/enforcement', { token: otherOfficer.token }), 200, 'other officer list');
  assert.equal(theirs.length, 0);
});

test('only ADMIN handles cases: valid transitions, required reasons, penalty, timeline', async () => {
  const c = await ok(register(actors.lmo.token, offence(trader())), 201, 'case');
  const patch = (token, body) => h.call('PATCH', `/api/enforcement/${c.id}/status`, { token, body });

  assert.equal((await patch(actors.lmo.token, { status: 'NOTICE_ISSUED' })).status, 403);
  assert.equal((await patch(actors.admin.token, { status: 'PENALTY_IMPOSED' })).status, 400); // amount needed
  assert.equal((await patch(actors.admin.token, { status: 'DISMISSED' })).status, 400); // reason needed
  assert.equal((await patch(actors.admin.token, { status: 'BOGUS' })).status, 400);

  await ok(patch(actors.admin.token, { status: 'NOTICE_ISSUED', note: 'Notice served' }), 200, 'notice');
  const pen = await ok(patch(actors.admin.token, { status: 'PENALTY_IMPOSED', penaltyAmount: 5000, penaltyReference: 'CHALLAN-17' }), 200, 'penalty');
  assert.equal(Number(pen.penalty_amount), 5000);
  assert.equal((await patch(actors.admin.token, { status: 'NOTICE_ISSUED' })).status, 400); // cannot go back
  const done = await ok(patch(actors.admin.token, { status: 'RESOLVED', note: 'Paid' }), 200, 'resolved');
  assert.ok(done.resolved_at);
  assert.equal((await patch(actors.admin.token, { status: 'DISMISSED', note: 'too late for that' })).status, 400); // final

  const detail = await ok(h.call('GET', `/api/enforcement/${c.id}`, { token: actors.admin.token }), 200, 'detail');
  assert.deepEqual(detail.events.map((e) => e.to_status), ['OPEN', 'NOTICE_ISSUED', 'PENALTY_IMPOSED', 'RESOLVED']);

  const audit = await h.pool.query("SELECT count(*)::int n FROM audit_log WHERE entity_id = $1", [c.id]);
  assert.ok(audit.rows[0].n >= 4);
});

test('a dismissed case is not counted against the offender', async () => {
  const name = trader();
  const first = await ok(register(actors.lmo.token, offence(name)), 201, 'first');
  await ok(h.call('PATCH', `/api/enforcement/${first.id}/status`, { token: actors.admin.token, body: { status: 'DISMISSED', note: 'Instrument was exempt' } }), 200, 'dismiss');
  const second = await ok(register(actors.lmo.token, offence(name)), 201, 'second');
  assert.equal(second.offence_number, 1);
  assert.equal(second.offender_flag, 'FIRST');
});

test('case facts are immutable and cases cannot be deleted (database rules)', async () => {
  const c = await ok(register(actors.lmo.token, offence(trader())), 201, 'case');
  await assert.rejects(h.pool.query("UPDATE enforcement_cases SET offence_type = 'NONE' WHERE id = $1", [c.id]), /cannot be changed/);
  await assert.rejects(h.pool.query("UPDATE enforcement_cases SET detected_on = detected_on - 400 WHERE id = $1", [c.id]), /cannot be changed/);
  await assert.rejects(h.pool.query('DELETE FROM enforcement_cases WHERE id = $1', [c.id]), /cannot be deleted/);
  await h.pool.query("UPDATE enforcement_cases SET status = 'NOTICE_ISSUED' WHERE id = $1", [c.id]); // handling status may change
});

test('validation, permissions and the dashboard', async () => {
  assert.equal((await register(actors.owner.token, offence(trader()))).status, 403);
  assert.equal((await register(actors.lmo.token, offence(trader(), { offenceType: 'MADE_UP' }))).status, 400);
  assert.equal((await register(actors.lmo.token, offence(trader(), { source: 'RUMOUR' }))).status, 400);
  assert.equal((await register(actors.lmo.token, offence(trader(), { latitude: 95, longitude: 10 }))).status, 400);
  assert.equal((await register(actors.lmo.token, offence(trader(), { detectedOn: '2999-01-01' }))).status, 400);
  assert.equal((await register(actors.lmo.token, { source: 'SPOT_CHECK', offenceType: 'OTHER', description: 'x' })).status, 400); // no subject
  assert.equal((await h.call('GET', '/api/enforcement')).status, 401);

  assert.equal((await h.call('GET', '/api/enforcement/summary', { token: actors.lmo.token })).status, 403);
  const s = await ok(h.call('GET', '/api/enforcement/summary', { token: actors.admin.token }), 200, 'summary');
  assert.ok(s.totals.open_cases >= 1);
  assert.ok(Array.isArray(s.byType) && s.byType.length > 0);
  assert.ok(s.offenderFlags.some((f) => f.flag === 'HABITUAL'));

  const filtered = await ok(h.call('GET', '/api/enforcement?status=OPEN&page=1&limit=2', { token: actors.admin.token }), 200, 'paged');
  assert.ok(filtered.items.length <= 2 && filtered.total >= 1);
});
