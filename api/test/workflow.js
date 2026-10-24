// api/test/workflow.js
//
// Drives the real HTTP API through the verification workflow so tests start
// from realistic data: instrument -> application -> assignment -> accepted ->
// schedule -> verification -> readings -> result.

const assert = require('node:assert/strict');
const h = require('./helpers');

async function ok(promise, expectedStatus, label) {
  const res = await promise;
  assert.equal(res.status, expectedStatus, `${label}: ${res.status} ${res.text}`);
  return res.body.data;
}

async function createActors() {
  return {
    admin: await h.createUser('ADMIN'),
    owner: await h.createUser('INSTRUMENT_OWNER'),
    lmo: await h.createUser('LMO'),
  };
}

// Smaller building blocks for tests that stop part-way through the workflow.
async function newApplication(actors, { typeName } = {}) {
  const { owner } = actors;
  const { rows } = await h.pool.query(
    typeName
      ? 'SELECT id FROM instrument_types WHERE name = $1'
      : 'SELECT id FROM instrument_types ORDER BY name LIMIT 1',
    typeName ? [typeName] : []
  );
  const instrument = await ok(
    h.call('POST', '/api/instruments', {
      token: owner.token,
      body: { instrumentTypeId: rows[0].id, instrumentName: 'Test Scale', serialNumber: h.unique('SN'), capacity: 100, capacityUnit: 'kg' },
    }),
    201,
    'create instrument'
  );
  const application = await ok(
    h.call('POST', '/api/applications', {
      token: owner.token,
      body: { instrumentId: instrument.id, applicationType: 'VERIFICATION', division: 'PUNE' },
    }),
    201,
    'create application'
  );
  return { instrument, application };
}

async function assignTo(actors, applicationId, officer) {
  return ok(
    h.call('POST', '/api/assignments', {
      token: actors.admin.token,
      body: { applicationId, assignedToId: officer.id },
    }),
    201,
    'create assignment'
  );
}

// Runs the workflow up to a COMPLETED verification with the given decision.
async function runVerification(actors, { decision = 'PASS', typeName } = {}) {
  const { admin, owner, lmo } = actors;

  const { rows } = await h.pool.query(
    typeName
      ? 'SELECT id FROM instrument_types WHERE name = $1'
      : 'SELECT id FROM instrument_types ORDER BY name LIMIT 1',
    typeName ? [typeName] : []
  );
  const instrumentTypeId = rows[0].id;

  const instrument = await ok(
    h.call('POST', '/api/instruments', {
      token: owner.token,
      body: {
        instrumentTypeId,
        instrumentName: 'Test Scale',
        serialNumber: h.unique('SN'),
        manufacturer: 'Acme',
        model: 'A-1',
        capacity: 100,
        capacityUnit: 'kg',
      },
    }),
    201,
    'create instrument'
  );

  const application = await ok(
    h.call('POST', '/api/applications', {
      token: owner.token,
      body: { instrumentId: instrument.id, applicationType: 'VERIFICATION', division: 'PUNE' },
    }),
    201,
    'create application'
  );

  const assignment = await ok(
    h.call('POST', '/api/assignments', {
      token: admin.token,
      body: { applicationId: application.id, assignedToId: lmo.id },
    }),
    201,
    'create assignment'
  );

  await ok(
    h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token: lmo.token, body: { status: 'ACCEPTED' } }),
    200,
    'accept assignment'
  );

  const schedule = await ok(
    h.call('POST', '/api/schedules', {
      token: admin.token,
      body: {
        applicationId: application.id,
        assignmentId: assignment.id,
        scheduledDate: '2030-01-15',
        verificationLocation: 'Shop 12',
      },
    }),
    201,
    'create schedule'
  );

  const verification = await ok(
    h.call('POST', '/api/verifications', {
      token: lmo.token,
      body: {
        applicationId: application.id,
        assignmentId: assignment.id,
        scheduleId: schedule.id,
        location: 'Shop 12',
      },
    }),
    201,
    'start verification'
  );

  const passing = decision === 'PASS';
  await ok(
    h.call('POST', `/api/verifications/${verification.id}/readings`, {
      token: lmo.token,
      body: {
        readingType: 'Load point 1',
        expectedValue: 50,
        observedValue: passing ? 50.01 : 51.5,
        unit: 'kg',
        tolerance: 0.05,
        result: passing ? 'PASS' : 'FAIL',
      },
    }),
    201,
    'add reading'
  );

  await ok(
    h.call('POST', `/api/verifications/${verification.id}/result`, {
      token: lmo.token,
      body: { decision },
    }),
    200,
    'submit result'
  );

  return { instrument, application, assignment, schedule, verification };
}

module.exports = { createActors, runVerification, newApplication, assignTo, ok };
