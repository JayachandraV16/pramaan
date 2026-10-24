// Contract test: the Expo app's offline engine (mobile/services/offline/*.ts)
// running against the real API. Node strips the TypeScript types on import.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const h = require('./helpers');
const { createActors, newApplication, assignTo, ok } = require('./workflow');

let actors;
let core;
let engine;

test.before(async () => {
  await h.start();
  actors = await createActors();
  core = await import('../../mobile/services/offline/syncCore.ts');
  engine = await import('../../mobile/services/offline/syncEngine.ts');
});
test.after(async () => {
  await h.stop();
});

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// The Http adapter the app uses, backed by the test client.
function httpFor(token) {
  const unwrap = (res, path) => {
    if (res.status >= 400) throw Object.assign(new Error(res.body?.message || `HTTP ${res.status} ${path}`), { status: res.status });
    return res.body.data;
  };
  return {
    get: async (path) => unwrap(await h.call('GET', `/api${path}`, { token }), path),
    post: async (path, body) => unwrap(await h.call('POST', `/api${path}`, { token, body }), path),
  };
}

const offlineHttp = {
  get: async () => { throw Object.assign(new Error('Cannot reach the server'), { offline: true }); },
  post: async () => { throw Object.assign(new Error('Cannot reach the server'), { offline: true }); },
};

async function acceptedJob(officer) {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, officer);
  await ok(h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token: officer.token, body: { status: 'ACCEPTED' } }), 200, 'accept');
  await ok(
    h.call('POST', '/api/schedules', {
      token: actors.admin.token,
      body: { applicationId: application.id, assignmentId: assignment.id, scheduledDate: '2030-03-01', verificationLocation: 'Market yard' },
    }),
    201,
    'schedule'
  );
  return { application, assignment };
}

function fillDraft(job, { observed = 10.01, decision = 'PASS', force = false } = {}) {
  let d = core.newDraft(job, uuid, now);
  d = { ...d, latitude: 18.52, longitude: 73.85 };
  d = core.addReading(d, { clientId: uuid(), readingType: 'Accuracy', expectedValue: 10, observedValue: observed, unit: 'kg', tolerance: 0.05 }, now());
  d = core.addObservation(d, { clientId: uuid(), observationType: 'Seal', observedValue: 'intact' }, now());
  if (!force) assert.deepEqual(core.validateForSubmit(d, decision), []);
  return core.markReady(d, decision, 'field note', now());
}

test('pull brings the officer\'s accepted job onto the device', async () => {
  const officer = await h.createUser('LMO');
  const work = await acceptedJob(officer);

  const pulled = await engine.pullChanges(core.emptyState(), httpFor(officer.token), now);
  assert.equal(pulled.offline, false);
  const job = pulled.state.jobs[work.assignment.id];
  assert.ok(job, 'job cached locally');
  assert.equal(job.assignment_status, 'ACCEPTED');
  assert.equal(job.verification_location, 'Market yard');
  assert.ok(pulled.state.cursor);
});

test('record offline, fail to upload, then sync when back online (and retry is idempotent)', async () => {
  const officer = await h.createUser('LMO');
  const work = await acceptedJob(officer);
  const http = httpFor(officer.token);

  let state = (await engine.pullChanges(core.emptyState(), http, now)).state;
  const draft = fillDraft(state.jobs[work.assignment.id]);
  state = { ...state, drafts: { [draft.clientId]: draft } };
  assert.equal(core.pendingDrafts(state).length, 1);

  // no connection: nothing lost, still waiting
  const offline = await engine.syncAll(state, offlineHttp, now);
  assert.equal(offline.offline, true);
  assert.equal(offline.state.drafts[draft.clientId].state, 'READY');

  // connection back
  const online = await engine.syncAll(offline.state, http, now);
  assert.equal(online.offline, false);
  assert.equal(online.synced, 1);
  const synced = online.state.drafts[draft.clientId];
  assert.equal(synced.state, 'SYNCED');
  assert.ok(synced.serverId);

  const { rows } = await h.pool.query('SELECT status, client_id FROM verifications WHERE id = $1', [synced.serverId]);
  assert.equal(rows[0].status, 'COMPLETED');
  assert.equal(rows[0].client_id, draft.clientId);

  // the app crashed before saving the result: the same draft is pushed again
  const again = await engine.pushDrafts({ ...online.state, drafts: { [draft.clientId]: { ...synced, state: 'READY' } } }, http, now);
  assert.equal(again.state.drafts[draft.clientId].state, 'SYNCED');
  const count = await h.pool.query('SELECT count(*)::int n FROM verifications WHERE client_id = $1', [draft.clientId]);
  assert.equal(count.rows[0].n, 1);

  // the finished job no longer appears as active work after the next pull
  const after = await engine.pullChanges(online.state, http, now);
  assert.equal(after.state.jobs[work.assignment.id], undefined);
});

test('a result the server refuses ends up as NEEDS_ATTENTION with the reason', async () => {
  const officer = await h.createUser('LMO');
  const work = await acceptedJob(officer);
  const http = httpFor(officer.token);

  let state = (await engine.pullChanges(core.emptyState(), http, now)).state;
  // reading outside tolerance but a PASS decision (bypassing the on-device check)
  const draft = fillDraft(state.jobs[work.assignment.id], { observed: 11, decision: 'PASS', force: true });
  assert.ok(core.validateForSubmit(draft, 'PASS').length > 0, 'the app itself would have blocked this');
  state = { ...state, drafts: { [draft.clientId]: draft } };

  const report = await engine.syncAll(state, http, now);
  assert.equal(report.needAttention, 1);
  const bad = report.state.drafts[draft.clientId];
  assert.equal(bad.state, 'NEEDS_ATTENTION');
  assert.match(bad.error, /./);

  // the officer corrects the decision and retries: the readings already on the server are not duplicated
  const fixed = core.markReady(core.retry(bad, now()), 'FAIL', 'out of tolerance', now());
  const retried = await engine.pushDrafts({ ...report.state, drafts: { [draft.clientId]: fixed } }, http, now);
  assert.equal(retried.state.drafts[draft.clientId].state, 'SYNCED');
  const readings = await h.pool.query('SELECT count(*)::int n FROM verification_readings WHERE verification_id = $1', [bad.serverId]);
  assert.equal(readings.rows[0].n, 1);
});
