// Phase 4: offline sync API (idempotent push with client UUIDs, delta pull).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const h = require('./helpers');
const { createActors, newApplication, assignTo, ok } = require('./workflow');

let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  await h.stop();
});

// An application assigned to `officer` with the assignment already accepted.
async function acceptedAssignment(officer = actors.lmo) {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, officer);
  await ok(
    h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token: officer.token, body: { status: 'ACCEPTED' } }),
    200,
    'accept assignment'
  );
  return { application, assignment };
}

const uuid = () => crypto.randomUUID();
const push = (token, verifications) => h.call('POST', '/api/sync/push', { token, body: { verifications } });

function offlineInspection({ application, assignment }, extra = {}) {
  return {
    clientId: uuid(),
    applicationId: application.id,
    assignmentId: assignment.id,
    location: 'Shop 7',
    latitude: 18.52,
    longitude: 73.85,
    startedAt: '2030-01-15T04:30:00.000Z',
    observations: [{ clientId: uuid(), observationType: 'SEAL', observedValue: 'intact' }],
    readings: [
      { clientId: uuid(), readingType: 'ACCURACY', expectedValue: 10, observedValue: 10.01, unit: 'kg', tolerance: 0.05 },
    ],
    ...extra,
  };
}

test('push creates the whole inspection, computes PASS/FAIL and finalises it', async () => {
  const work = await acceptedAssignment();
  const item = offlineInspection(work, { result: { decision: 'PASS', remarks: 'ok' } });

  const res = await push(actors.lmo.token, [item]);
  assert.equal(res.status, 200, res.text);
  const [report] = res.body.data.results;
  assert.equal(report.status, 'APPLIED');
  assert.equal(report.observations[0].status, 'APPLIED');
  assert.equal(report.readings[0].status, 'APPLIED');
  assert.equal(report.result.status, 'APPLIED');

  const { rows } = await h.pool.query(
    'SELECT status, client_id, client_started_at FROM verifications WHERE id = $1',
    [report.serverId]
  );
  assert.equal(rows[0].status, 'COMPLETED');
  assert.equal(rows[0].client_id, item.clientId);
  assert.equal(rows[0].client_started_at.toISOString(), item.startedAt);

  const reading = await h.pool.query('SELECT result FROM verification_readings WHERE client_id = $1', [item.readings[0].clientId]);
  assert.equal(reading.rows[0].result, 'PASS'); // |10.01-10| <= 0.05, decided by the server
});

test('retrying the same push is idempotent (nothing duplicated)', async () => {
  const work = await acceptedAssignment();
  const item = offlineInspection(work, { result: { decision: 'PASS' } });

  const first = (await push(actors.lmo.token, [item])).body.data.results[0];
  const again = (await push(actors.lmo.token, [item])).body.data.results[0];

  assert.equal(first.status, 'APPLIED');
  assert.equal(again.status, 'DUPLICATE');
  assert.equal(again.serverId, first.serverId);
  assert.equal(again.observations[0].status, 'DUPLICATE');
  assert.equal(again.readings[0].status, 'DUPLICATE');
  assert.equal(again.result.status, 'DUPLICATE');

  const { rows } = await h.pool.query('SELECT count(*)::int n FROM verifications WHERE client_id = $1', [item.clientId]);
  assert.equal(rows[0].n, 1);
});

test('an interrupted upload can be completed later (readings first, result in a later push)', async () => {
  const work = await acceptedAssignment();
  const item = offlineInspection(work);

  const first = (await push(actors.lmo.token, [item])).body.data.results[0];
  assert.equal(first.status, 'APPLIED');
  assert.equal(first.result, null);

  const extra = { clientId: uuid(), readingType: 'REPEATABILITY', expectedValue: 5, observedValue: 5, unit: 'kg', tolerance: 0.1 };
  const second = (await push(actors.lmo.token, [{ ...item, readings: [...item.readings, extra], result: { decision: 'PASS' } }])).body.data.results[0];
  assert.equal(second.status, 'DUPLICATE');
  assert.deepEqual(second.readings.map((r) => r.status), ['DUPLICATE', 'APPLIED']);
  assert.equal(second.result.status, 'APPLIED');
});

test('server rules still apply: a PASS with a failed reading is rejected, others in the batch go through', async () => {
  const bad = offlineInspection(await acceptedAssignment(), {
    readings: [{ clientId: uuid(), readingType: 'ACCURACY', expectedValue: 10, observedValue: 11, unit: 'kg', tolerance: 0.05 }],
    result: { decision: 'PASS' },
  });
  const good = offlineInspection(await acceptedAssignment(), { result: { decision: 'PASS' } });

  const { results } = (await push(actors.lmo.token, [bad, good])).body.data;
  assert.equal(results[0].result.status, 'REJECTED');
  assert.equal(results[1].result.status, 'APPLIED');
});

test('conflicts: another officer, a second inspection for the same assignment, a different final result', async () => {
  const work = await acceptedAssignment();
  const item = offlineInspection(work, { result: { decision: 'PASS' } });
  await push(actors.lmo.token, [item]);

  // a different device/clientId for an assignment that is already finished
  const r0 = (await push(actors.lmo.token, [offlineInspection(work)])).body.data.results[0];
  assert.equal(r0.status, 'REJECTED');

  // ... and for one whose inspection is still in progress on the server
  const open = await acceptedAssignment();
  await push(actors.lmo.token, [offlineInspection(open)]);
  const r1 = (await push(actors.lmo.token, [offlineInspection(open)])).body.data.results[0];
  assert.equal(r1.status, 'REJECTED');
  assert.match(r1.error, /already exists/);

  // someone else's inspection
  const other = await h.createUser('LMO');
  const r2 = (await push(other.token, [item])).body.data.results[0];
  assert.equal(r2.status, 'REJECTED');

  // sealed result cannot be changed by a later upload
  const r3 = (await push(actors.lmo.token, [{ ...item, result: { decision: 'FAIL' } }])).body.data.results[0];
  assert.equal(r3.result.status, 'REJECTED');
});

test('push validates input and is restricted to officers', async () => {
  const noId = (await push(actors.lmo.token, [{ applicationId: uuid(), assignmentId: uuid() }])).body.data.results[0];
  assert.equal(noId.status, 'REJECTED');

  const bad = await h.call('POST', '/api/sync/push', { token: actors.lmo.token, body: { verifications: 'x' } });
  assert.equal(bad.status, 400);

  const owner = await push(actors.owner.token, []);
  assert.equal(owner.status, 403);
  const anon = await h.call('POST', '/api/sync/push', { body: { verifications: [] } });
  assert.equal(anon.status, 401);
});

test('pull returns the officer\'s work and then only what changed', async () => {
  const officer = await h.createUser('LMO');
  const work = await acceptedAssignment(officer);

  const full = await ok(h.call('GET', '/api/sync/pull', { token: officer.token }), 200, 'full pull');
  assert.equal(full.assignments.length, 1);
  assert.equal(full.assignments[0].assignment_id, work.assignment.id);
  assert.ok(full.assignments[0].instrument_name);
  assert.ok(full.serverTime);

  // nothing changed since the cursor
  const none = await ok(h.call('GET', `/api/sync/pull?since=${encodeURIComponent(full.serverTime)}`, { token: officer.token }), 200, 'empty delta');
  assert.equal(none.assignments.length, 0);

  // a schedule created by the admin shows up in the next delta
  await ok(
    h.call('POST', '/api/schedules', {
      token: actors.admin.token,
      body: { applicationId: work.application.id, assignmentId: work.assignment.id, scheduledDate: '2030-02-01', verificationLocation: 'Depot' },
    }),
    201,
    'schedule'
  );
  const delta = await ok(h.call('GET', `/api/sync/pull?since=${encodeURIComponent(full.serverTime)}`, { token: officer.token }), 200, 'delta');
  assert.equal(delta.assignments.length, 1);
  assert.equal(delta.assignments[0].verification_location, 'Depot');

  // an uploaded inspection is reported back with its clientId mapping
  const item = offlineInspection(work, { result: { decision: 'PASS' } });
  await push(officer.token, [item]);
  const after = await ok(h.call('GET', `/api/sync/pull?since=${encodeURIComponent(delta.serverTime)}`, { token: officer.token }), 200, 'after push');
  assert.equal(after.inspections[0].client_id, item.clientId);

  // other officers never see this work
  const stranger = await h.createUser('LMO');
  const theirs = await ok(h.call('GET', '/api/sync/pull', { token: stranger.token }), 200, 'stranger');
  assert.equal(theirs.assignments.length, 0);

  assert.equal((await h.call('GET', '/api/sync/pull?since=nope', { token: officer.token })).status, 400);
});
