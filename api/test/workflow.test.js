// Phase 2: application lifecycle, assignment/schedule rules, server-computed
// readings, sealed results, evidence rules and the status history.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, runVerification, newApplication, assignTo, ok } = require('./workflow');
const config = require('../src/config');
const { computeReadingResult } = require('../src/utils/measurement');
const { computeResultSeal } = require('../src/utils/verificationSeal');
const { canTransition } = require('../src/utils/applicationStatus');

let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(() => h.stop());

const statusOf = async (applicationId) =>
  (await h.pool.query('SELECT status FROM verification_applications WHERE id = $1', [applicationId])).rows[0].status;

// ---------------------------------------------------------------------------
// pure rules
// ---------------------------------------------------------------------------

test('reading result: within +/- tolerance passes (inclusive), outside fails, uncomputable is null', () => {
  assert.equal(computeReadingResult({ expectedValue: 50, observedValue: 50.05, tolerance: 0.05 }), 'PASS');
  assert.equal(computeReadingResult({ expectedValue: 50, observedValue: 49.95, tolerance: 0.05 }), 'PASS');
  assert.equal(computeReadingResult({ expectedValue: 50, observedValue: 50.0501, tolerance: 0.05 }), 'FAIL');
  assert.equal(computeReadingResult({ expectedValue: 10, observedValue: 10, tolerance: 0 }), 'PASS');
  assert.equal(computeReadingResult({ expectedValue: 50, observedValue: 50.01 }), null);
  assert.equal(computeReadingResult({ observedValue: 1, tolerance: 1 }), null);
});

test('result seal is deterministic and changes with any reading, observation or decision', () => {
  const base = {
    verificationId: 'v1',
    decision: 'PASS',
    readings: [{ id: 'r1', reading_type: 'L1', expected_value: '50', observed_value: '50.01', unit: 'kg', tolerance: '0.05', result: 'PASS' }],
    observations: [{ id: 'o1', observation_type: 'Seal', observation_description: 'intact', observed_value: 'Good' }],
  };
  const seal = computeResultSeal(base);
  assert.equal(seal, computeResultSeal(JSON.parse(JSON.stringify(base))));
  assert.notEqual(seal, computeResultSeal({ ...base, decision: 'FAIL' }));
  const edited = JSON.parse(JSON.stringify(base));
  edited.readings[0].observed_value = '50.04';
  assert.notEqual(seal, computeResultSeal(edited));
  const obs = JSON.parse(JSON.stringify(base));
  obs.observations[0].observed_value = 'Broken';
  assert.notEqual(seal, computeResultSeal(obs));
});

test('application state machine allows only the documented transitions', () => {
  assert.equal(canTransition('SUBMITTED', 'UNDER_REVIEW'), true);
  assert.equal(canTransition('UNDER_REVIEW', 'SCHEDULED'), true);
  assert.equal(canTransition('SCHEDULED', 'COMPLETED'), true);
  assert.equal(canTransition('SUBMITTED', 'COMPLETED'), false);
  for (const final of ['COMPLETED', 'REJECTED', 'CANCELLED']) {
    for (const to of ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED', 'COMPLETED', 'REJECTED', 'CANCELLED']) {
      assert.equal(canTransition(final, to), false, `${final} -> ${to}`);
    }
  }
});

// ---------------------------------------------------------------------------
// application lifecycle
// ---------------------------------------------------------------------------

test('an instrument cannot have two open applications at once', async () => {
  const { instrument } = await newApplication(actors);
  const second = await h.call('POST', '/api/applications', {
    token: actors.owner.token,
    body: { instrumentId: instrument.id, applicationType: 'VERIFICATION', division: 'PUNE' },
  });
  assert.equal(second.status, 409);
  assert.match(second.body.message, /open application/);
});

test('owner can cancel; cancelled applications are final and have a history', async () => {
  const { application } = await newApplication(actors);

  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal(
    (await h.call('POST', `/api/applications/${application.id}/cancel`, { token: stranger.token, body: {} })).status,
    403
  );

  const cancelled = await ok(
    h.call('POST', `/api/applications/${application.id}/cancel`, {
      token: actors.owner.token,
      body: { reason: 'Instrument sold' },
    }),
    200,
    'cancel'
  );
  assert.equal(cancelled.status, 'CANCELLED');

  // final: cannot be cancelled twice, rejected, or assigned
  assert.equal((await h.call('POST', `/api/applications/${application.id}/cancel`, { token: actors.owner.token, body: {} })).status, 409);
  assert.equal(
    (await h.call('POST', `/api/applications/${application.id}/reject`, { token: actors.admin.token, body: { reason: 'long enough reason' } })).status,
    409
  );
  assert.equal(
    (await h.call('POST', '/api/assignments', { token: actors.admin.token, body: { applicationId: application.id, assignedToId: actors.lmo.id } })).status,
    400
  );

  const history = await ok(h.call('GET', `/api/applications/${application.id}/history`, { token: actors.owner.token }), 200, 'history');
  assert.deepEqual(history.map((r) => r.to_status), ['SUBMITTED', 'CANCELLED']);
  assert.equal(history[1].reason, 'Instrument sold');
  assert.equal(history[1].changed_by_id, actors.owner.id);

  // the instrument can be re-applied for after cancellation
  const again = await h.call('POST', '/api/applications', {
    token: actors.owner.token,
    body: { instrumentId: application.instrument_id, applicationType: 'VERIFICATION', division: 'PUNE' },
  });
  assert.equal(again.status, 201);
});

test('only ADMIN can reject, with a reason; officer and applicant are told; open work is withdrawn', async () => {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  await ok(
    h.call('POST', '/api/schedules', {
      token: actors.admin.token,
      body: { applicationId: application.id, assignmentId: assignment.id, scheduledDate: '2031-03-01', scheduledTime: '10:00' },
    }),
    201,
    'schedule'
  );
  assert.equal(await statusOf(application.id), 'SCHEDULED');

  const path = `/api/applications/${application.id}/reject`;
  assert.equal((await h.call('POST', path, { token: actors.owner.token, body: { reason: 'long enough reason' } })).status, 403);
  assert.equal((await h.call('POST', path, { token: actors.admin.token, body: {} })).status, 400);
  assert.equal((await h.call('POST', path, { token: actors.admin.token, body: { reason: 'too short' } })).status, 400);

  const rejected = await ok(h.call('POST', path, { token: actors.admin.token, body: { reason: 'GRAS challan is invalid' } }), 200, 'reject');
  assert.equal(rejected.status, 'REJECTED');

  const rows = await h.pool.query(
    `SELECT (SELECT status FROM verification_assignments WHERE id = $1) AS assignment,
            (SELECT status FROM verification_schedules WHERE application_id = $2 LIMIT 1) AS schedule`,
    [assignment.id, application.id]
  );
  assert.equal(rows.rows[0].assignment, 'DECLINED');
  assert.equal(rows.rows[0].schedule, 'CANCELLED');

  const notes = await h.pool.query(
    "SELECT recipient_id FROM notifications WHERE related_application_id = $1 AND type = 'APPLICATION_UPDATE' AND message LIKE '%GRAS%'",
    [application.id]
  );
  const recipients = notes.rows.map((r) => r.recipient_id);
  assert.ok(recipients.includes(actors.owner.id), 'applicant notified');
  assert.ok(recipients.includes(actors.lmo.id), 'officer notified');
});

test('an application with a started verification can no longer be cancelled', async () => {
  const flow = await runVerification(actors);
  const res = await h.call('POST', `/api/applications/${flow.application.id}/cancel`, { token: actors.owner.token, body: {} });
  assert.equal(res.status, 409);
});

test('application history is only visible to people who may see the application', async () => {
  const { application } = await newApplication(actors);
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await h.call('GET', `/api/applications/${application.id}/history`, { token: stranger.token })).status, 403);
  assert.equal((await h.call('GET', `/api/applications/${application.id}/history`, { token: actors.admin.token })).status, 200);
});

// ---------------------------------------------------------------------------
// assignments
// ---------------------------------------------------------------------------

test('assigning is audited, notifies the officer and moves the application to UNDER_REVIEW', async () => {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  assert.equal(await statusOf(application.id), 'UNDER_REVIEW');

  const { rows: audits } = await h.pool.query(
    "SELECT 1 FROM audit_log WHERE action = 'ASSIGNMENT_CREATED' AND entity_id = $1",
    [application.id]
  );
  assert.equal(audits.length, 1);
  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND title = 'New verification assigned'",
    [actors.lmo.id, application.id]
  );
  assert.equal(notes.length, 1);
  assert.ok(assignment.id);
});

test('reassigning retires the previous assignment and its schedule', async () => {
  const { application } = await newApplication(actors);
  const second = await h.createUser('GATC');
  const first = await assignTo(actors, application.id, actors.lmo);
  const schedule = await ok(
    h.call('POST', '/api/schedules', {
      token: actors.admin.token,
      body: { applicationId: application.id, assignmentId: first.id, scheduledDate: '2031-04-01' },
    }),
    201,
    'schedule'
  );

  const next = await assignTo(actors, application.id, second);
  const { rows } = await h.pool.query(
    `SELECT (SELECT status FROM verification_assignments WHERE id = $1) AS old_assignment,
            (SELECT status FROM verification_assignments WHERE id = $2) AS new_assignment,
            (SELECT status FROM verification_schedules WHERE id = $3) AS old_schedule`,
    [first.id, next.id, schedule.id]
  );
  assert.equal(rows[0].old_assignment, 'REASSIGNED');
  assert.equal(rows[0].new_assignment, 'ASSIGNED');
  assert.equal(rows[0].old_schedule, 'CANCELLED');

  // the retired assignment cannot be scheduled any more
  const stale = await h.call('POST', '/api/schedules', {
    token: actors.admin.token,
    body: { applicationId: application.id, assignmentId: first.id, scheduledDate: '2031-04-02' },
  });
  assert.equal(stale.status, 400);

  const history = await ok(h.call('GET', `/api/applications/${application.id}/history`, { token: actors.admin.token }), 200, 'history');
  assert.ok(history.some((r) => r.reason === 'Reassigned to another officer'));
});

test('assignment status changes follow the allowed transitions and ownership', async () => {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  const patch = (token, status, remarks) =>
    h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token, body: { status, remarks } });

  const otherOfficer = await h.createUser('LMO');
  assert.equal((await patch(otherOfficer.token, 'ACCEPTED')).status, 403);
  assert.equal((await patch(actors.lmo.token, 'COMPLETED')).status, 409, 'COMPLETED is system-set');
  assert.equal((await patch(actors.lmo.token, 'REASSIGNED')).status, 409);
  assert.equal((await patch(actors.lmo.token, 'ACCEPTED')).status, 200);

  const declined = await patch(actors.lmo.token, 'DECLINED', 'Conflict of interest');
  assert.equal(declined.status, 200);
  assert.equal((await patch(actors.lmo.token, 'ACCEPTED')).status, 409, 'DECLINED is final');

  // the admin who assigned is told
  const { rows } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND title = 'Assignment declined'",
    [actors.admin.id, application.id]
  );
  assert.equal(rows.length, 1);
});

// ---------------------------------------------------------------------------
// schedules
// ---------------------------------------------------------------------------

test('scheduling rejects past dates, bad formats and double-booking an officer', async () => {
  const a = await newApplication(actors);
  const b = await newApplication(actors);
  const asg1 = await assignTo(actors, a.application.id, actors.lmo);
  const asg2 = await assignTo(actors, b.application.id, actors.lmo);
  const schedule = (applicationId, assignmentId, extra) =>
    h.call('POST', '/api/schedules', { token: actors.admin.token, body: { applicationId, assignmentId, ...extra } });

  assert.equal((await schedule(a.application.id, asg1.id, { scheduledDate: '2020-01-01' })).status, 400);
  assert.equal((await schedule(a.application.id, asg1.id, { scheduledDate: '01/02/2031' })).status, 400);

  const ok1 = await schedule(a.application.id, asg1.id, { scheduledDate: '2031-05-05', scheduledTime: '11:30' });
  assert.equal(ok1.status, 201);
  const clash = await schedule(b.application.id, asg2.id, { scheduledDate: '2031-05-05', scheduledTime: '11:30' });
  assert.equal(clash.status, 409);
  // the failed attempt left no trace
  assert.equal(await statusOf(b.application.id), 'UNDER_REVIEW');
  const free = await schedule(b.application.id, asg2.id, { scheduledDate: '2031-05-05', scheduledTime: '14:00' });
  assert.equal(free.status, 201);

  // both parties were told about the first one
  const { rows } = await h.pool.query(
    "SELECT recipient_id FROM notifications WHERE related_application_id = $1 AND type = 'VERIFICATION_SCHEDULED'",
    [a.application.id]
  );
  const ids = rows.map((r) => r.recipient_id);
  assert.ok(ids.includes(actors.owner.id) && ids.includes(actors.lmo.id));
});

test('rescheduling requires a new date, avoids clashes, is audited and notified', async () => {
  const a = await newApplication(actors);
  const asg = await assignTo(actors, a.application.id, actors.lmo);
  const created = await ok(
    h.call('POST', '/api/schedules', {
      token: actors.admin.token,
      body: { applicationId: a.application.id, assignmentId: asg.id, scheduledDate: '2031-06-01', scheduledTime: '09:00' },
    }),
    201,
    'schedule'
  );
  const patch = (body, token = actors.admin.token) =>
    h.call('PATCH', `/api/schedules/${created.id}/status`, { token, body });

  assert.equal((await patch({ status: 'RESCHEDULED' })).status, 400, 'needs a new date');
  assert.equal((await patch({ status: 'RESCHEDULED', scheduledDate: '2020-01-01' })).status, 400);

  const moved = await patch({ status: 'RESCHEDULED', scheduledDate: '2031-06-09', scheduledTime: '15:00' });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.scheduled_date, '2031-06-09');
  assert.equal(moved.body.data.status, 'RESCHEDULED');

  const { rows: audits } = await h.pool.query(
    "SELECT details FROM audit_log WHERE action = 'SCHEDULE_RESCHEDULED' AND entity_id = $1",
    [created.id]
  );
  assert.equal(audits.length, 1);
  assert.equal(audits[0].details.previousDate, '2031-06-01');
  assert.equal(audits[0].details.newDate, '2031-06-09');

  assert.equal((await patch({ status: 'CANCELLED' })).status, 200);
  assert.equal((await patch({ status: 'RESCHEDULED', scheduledDate: '2031-07-01' })).status, 409, 'CANCELLED is final');
});

// ---------------------------------------------------------------------------
// field verification
// ---------------------------------------------------------------------------

async function startVerification(extra = {}) {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  await ok(h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token: actors.lmo.token, body: { status: 'ACCEPTED' } }), 200, 'accept');
  const verification = await ok(
    h.call('POST', '/api/verifications', {
      token: actors.lmo.token,
      body: { applicationId: application.id, assignmentId: assignment.id, ...extra },
    }),
    201,
    'start verification'
  );
  return { application, assignment, verification };
}

const addReading = (verificationId, body, token = actors.lmo.token) =>
  h.call('POST', `/api/verifications/${verificationId}/readings`, { token, body });
const submit = (verificationId, body, token = actors.lmo.token) =>
  h.call('POST', `/api/verifications/${verificationId}/result`, { token, body });

test('the server computes reading PASS/FAIL; the officer cannot override it', async () => {
  const { verification } = await startVerification();

  const lie = await addReading(verification.id, {
    readingType: 'Load 1', expectedValue: 50, observedValue: 51.2, unit: 'kg', tolerance: 0.05, result: 'PASS',
  });
  assert.equal(lie.status, 201);
  assert.equal(lie.body.data.result, 'FAIL', 'claimed PASS but 1.2 kg out of tolerance');

  const honest = await addReading(verification.id, {
    readingType: 'Load 2', expectedValue: 20, observedValue: 20.02, unit: 'kg', tolerance: 0.05, result: 'FAIL',
  });
  assert.equal(honest.body.data.result, 'PASS', 'claimed FAIL but within tolerance');

  // qualitative reading: nothing to compute, so the officer's value is required and used
  assert.equal((await addReading(verification.id, { readingType: 'Zero check', observedValue: 0, unit: 'kg' })).status, 400);
  const qualitative = await addReading(verification.id, { readingType: 'Zero check', observedValue: 0, unit: 'kg', result: 'PASS' });
  assert.equal(qualitative.body.data.result, 'PASS');
});

test('PASS needs readings and cannot be recorded over failed readings', async () => {
  const { verification } = await startVerification();

  const none = await submit(verification.id, { decision: 'PASS' });
  assert.equal(none.status, 400);
  assert.match(none.body.message, /at least one reading/i);

  await addReading(verification.id, { readingType: 'L1', expectedValue: 10, observedValue: 10.5, unit: 'kg', tolerance: 0.1 });
  const failing = await submit(verification.id, { decision: 'PASS' });
  assert.equal(failing.status, 400);
  assert.match(failing.body.message, /outside tolerance/);

  const fail = await submit(verification.id, { decision: 'FAIL' });
  assert.equal(fail.status, 200);
  assert.equal(fail.body.data.decision, 'FAIL');
});

test('FAIL without any failing reading needs an explanation', async () => {
  const { verification } = await startVerification();
  await addReading(verification.id, { readingType: 'L1', expectedValue: 10, observedValue: 10.01, unit: 'kg', tolerance: 0.1 });
  assert.equal((await submit(verification.id, { decision: 'FAIL' })).status, 400);
  assert.equal((await submit(verification.id, { decision: 'FAIL', remarks: 'Seal broken, tampering suspected' })).status, 200);
});

test('a submitted result is sealed, closes the workflow and cannot be altered', async () => {
  const { application, assignment, verification } = await startVerification({ latitude: 18.5204, longitude: 73.8567 });
  await h.call('POST', `/api/verifications/${verification.id}/observations`, {
    token: actors.lmo.token,
    body: { observationType: 'Seal', observedValue: 'Intact' },
  });
  await addReading(verification.id, { readingType: 'L1', expectedValue: 10, observedValue: 10.01, unit: 'kg', tolerance: 0.1 });

  const res = await submit(verification.id, { decision: 'PASS' });
  assert.equal(res.status, 200);
  assert.match(res.body.data.result_sha256, /^[0-9a-f]{64}$/);

  // seal can be recomputed from the stored rows
  const { rows: readings } = await h.pool.query('SELECT * FROM verification_readings WHERE verification_id = $1', [verification.id]);
  const { rows: observations } = await h.pool.query('SELECT * FROM inspection_observations WHERE verification_id = $1', [verification.id]);
  assert.equal(
    computeResultSeal({ verificationId: verification.id, decision: 'PASS', readings, observations }),
    res.body.data.result_sha256
  );

  // everything is closed in one go
  assert.equal(await statusOf(application.id), 'COMPLETED');
  const { rows } = await h.pool.query('SELECT status, start_latitude FROM verifications WHERE id = $1', [verification.id]);
  assert.equal(rows[0].status, 'COMPLETED');
  assert.equal(Number(rows[0].start_latitude), 18.5204);
  const asg = await h.pool.query('SELECT status FROM verification_assignments WHERE id = $1', [assignment.id]);
  assert.equal(asg.rows[0].status, 'COMPLETED');

  // locked: API and database both refuse further changes
  assert.equal((await addReading(verification.id, { readingType: 'late', expectedValue: 1, observedValue: 1, unit: 'kg', tolerance: 1 })).status, 400);
  await assert.rejects(
    h.pool.query("UPDATE verification_readings SET observed_value = 99 WHERE verification_id = $1", [verification.id]),
    /cannot be changed/
  );
  await assert.rejects(
    h.pool.query('DELETE FROM inspection_observations WHERE verification_id = $1', [verification.id]),
    /cannot be changed/
  );
  await assert.rejects(
    h.pool.query("UPDATE verification_results SET decision = 'FAIL' WHERE verification_id = $1", [verification.id]),
    /legal records/
  );
  await assert.rejects(
    h.pool.query('DELETE FROM verification_results WHERE verification_id = $1', [verification.id]),
    /legal records/
  );

  // a second submission is refused, owner told about the outcome, audit written
  assert.equal((await submit(verification.id, { decision: 'FAIL', remarks: 'trying to flip the result' })).status, 400);
  const { rows: notes } = await h.pool.query(
    "SELECT 1 FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND title = 'Verification passed'",
    [actors.owner.id, application.id]
  );
  assert.equal(notes.length, 1);
  const { rows: audits } = await h.pool.query(
    "SELECT details FROM audit_log WHERE action = 'VERIFICATION_RESULT_SUBMITTED' AND entity_id = $1",
    [verification.id]
  );
  assert.equal(audits[0].details.resultSha256, res.body.data.result_sha256);
});

test('two simultaneous result submissions: exactly one wins', async () => {
  const { verification } = await startVerification();
  await addReading(verification.id, { readingType: 'L1', expectedValue: 10, observedValue: 10, unit: 'kg', tolerance: 0.1 });
  const results = await Promise.all([
    submit(verification.id, { decision: 'PASS' }),
    submit(verification.id, { decision: 'PASS' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  const { rows } = await h.pool.query('SELECT count(*)::int AS n FROM verification_results WHERE verification_id = $1', [verification.id]);
  assert.equal(rows[0].n, 1);
});

test('only one verification per assignment; GPS must be a valid pair', async () => {
  const { application, assignment } = await startVerification();
  const again = await h.call('POST', '/api/verifications', {
    token: actors.lmo.token,
    body: { applicationId: application.id, assignmentId: assignment.id },
  });
  assert.equal(again.status, 409);

  const other = await newApplication(actors);
  const asg = await assignTo(actors, other.application.id, actors.lmo);
  await ok(h.call('PATCH', `/api/assignments/${asg.id}/status`, { token: actors.lmo.token, body: { status: 'ACCEPTED' } }), 200, 'accept');
  const start = (extra) =>
    h.call('POST', '/api/verifications', {
      token: actors.lmo.token,
      body: { applicationId: other.application.id, assignmentId: asg.id, ...extra },
    });
  assert.equal((await start({ latitude: 18.5 })).status, 400, 'latitude without longitude');
  assert.equal((await start({ latitude: 95, longitude: 10 })).status, 400, 'out of range');
  assert.equal((await start({ latitude: 18.5, longitude: 73.8 })).status, 201);
});

test('minimum evidence rule (MIN_EVIDENCE_FOR_PASS) blocks PASS until a photo is attached', async () => {
  const { application, verification } = await startVerification();
  await addReading(verification.id, { readingType: 'L1', expectedValue: 10, observedValue: 10, unit: 'kg', tolerance: 0.1 });

  const previous = config.minEvidenceForPass;
  config.minEvidenceForPass = 1;
  try {
    const blocked = await submit(verification.id, { decision: 'PASS' });
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.message, /photograph/);

    // 1x1 PNG, attached with capture metadata
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.append('file', new Blob([png]), 'seal.png');
    form.append('category', 'PHOTOGRAPH');
    form.append('verificationId', verification.id);
    const up = await fetch(`${await h.start()}/api/attachments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${actors.lmo.token}` },
      body: form,
    });
    assert.equal(up.status, 201, await up.clone().text());

    const allowed = await submit(verification.id, { decision: 'PASS' });
    assert.equal(allowed.status, 200);
  } finally {
    config.minEvidenceForPass = previous;
  }
  assert.ok(application.id);
});
