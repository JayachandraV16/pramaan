// Prototype hardening: instrument types (the "Invalid or inactive instrument type" bug),
// instrument edit / deactivate / decommission, certificate renewal rules,
// required-document validation.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, assignTo, runVerification, ok } = require('./workflow');
const config = require('../src/config');
const { evaluate, checkRequestedType } = require('../src/utils/renewal');

let actors;
let types;

test.before(async () => {
  await h.start();
  actors = await createActors();
  types = await ok(h.call('GET', '/api/instruments/types', { token: actors.owner.token }), 200, 'types');
});
test.after(async () => {
  await h.pool.query('DELETE FROM document_requirements');
  await h.stop();
});

const call = (m, p, token, body) => h.call(m, p, { token, body });
const newInstrument = async (owner = actors.owner, extra = {}) =>
  ok(
    call('POST', '/api/instruments', owner.token, {
      instrumentTypeId: types[0].id, instrumentName: 'Counter Scale', serialNumber: h.unique('SN'), capacity: 30, capacityUnit: 'kg', ...extra,
    }),
    201,
    'create instrument'
  );
const apply = (instrument, body = {}, token = actors.owner.token) =>
  call('POST', '/api/applications', token, { instrumentId: instrument.id, applicationType: 'VERIFICATION', division: 'PUNE', ...body });

// ---------------------------------------------------------------- Stage 1
test('instrument types: the form must use the database\'s own ids; unknown or inactive types stay rejected', async () => {
  // what the web form used to send: an id copied from another database
  const stale = await call('POST', '/api/instruments', actors.owner.token, {
    instrumentTypeId: 'da5a9371-422d-4056-9359-ac0618451a0a', instrumentName: 'Stale', serialNumber: h.unique('SN'),
  });
  assert.equal(stale.status, 400);
  assert.equal(stale.body.message, 'Invalid or inactive instrument type');

  // every id the API publishes works for an owner
  assert.ok(types.length >= 1);
  for (const t of types) {
    const res = await call('POST', '/api/instruments', actors.owner.token, { instrumentTypeId: t.id, instrumentName: t.name, serialNumber: h.unique('SN') });
    assert.equal(res.status, 201, `${t.name}: ${res.text}`);
  }

  // a deactivated type disappears from the owner's list and is refused
  const spare = types[types.length - 1];
  await ok(call('PATCH', `/api/instruments/types/${spare.id}`, actors.admin.token, { isActive: false }), 200, 'deactivate type');
  try {
    const list = await ok(call('GET', '/api/instruments/types', actors.owner.token), 200, 'types for owner');
    assert.ok(!list.some((t) => t.id === spare.id));
    const res = await call('POST', '/api/instruments', actors.owner.token, { instrumentTypeId: spare.id, instrumentName: 'x', serialNumber: h.unique('SN') });
    assert.equal(res.status, 400);
  } finally {
    await ok(call('PATCH', `/api/instruments/types/${spare.id}`, actors.admin.token, { isActive: true }), 200, 'reactivate type');
  }
});

// ---------------------------------------------------------------- instrument lifecycle
test('editing: owner and admin only, validated, audited; serial/type fixed once an application exists', async () => {
  const inst = await newInstrument();
  const other = await h.createUser('INSTRUMENT_OWNER');
  const patch = (token, body, id = inst.id) => call('PATCH', `/api/instruments/${id}`, token, body);

  assert.equal((await patch(other.token, { instrumentName: 'Stolen' })).status, 403);
  assert.equal((await patch(actors.lmo.token, { instrumentName: 'Officer edit' })).status, 403);
  assert.equal((await patch(actors.owner.token, { capacity: -5 })).status, 400);
  assert.equal((await patch(actors.owner.token, { instrumentName: '   ' })).status, 400);
  assert.equal((await patch(actors.owner.token, { locationLat: 95, locationLng: 10 })).status, 400);
  assert.equal((await patch(actors.owner.token, { locationLat: 18.5 })).status, 400, 'lat without lng');
  assert.equal((await call('PATCH', '/api/instruments/not-an-id', actors.owner.token, { instrumentName: 'x' })).status, 404);

  const edited = await ok(patch(actors.owner.token, { instrumentName: 'Counter Scale 2', capacity: 50, locationAddress: 'Shop 4', locationLat: 18.52, locationLng: 73.85 }), 200, 'edit');
  assert.equal(edited.instrument_name, 'Counter Scale 2');
  assert.equal(Number(edited.capacity), 50);
  assert.equal(edited.location_address, 'Shop 4');
  assert.equal((await ok(patch(actors.admin.token, { model: 'M-9' }), 200, 'admin edit')).model, 'M-9');

  const log = await h.pool.query("SELECT details FROM audit_log WHERE action = 'INSTRUMENT_UPDATED' AND entity_id = $1 ORDER BY id", [inst.id]);
  assert.equal(log.rowCount, 2);
  assert.equal(log.rows[0].details.after.instrumentName, 'Counter Scale 2');
  assert.equal(log.rows[0].details.before.instrumentName, 'Counter Scale');

  // serial number: unique, and fixed after the first application
  const sibling = await newInstrument();
  assert.equal((await patch(actors.owner.token, { serialNumber: sibling.serial_number })).status, 409);
  const reserialed = await ok(patch(actors.owner.token, { serialNumber: h.unique('NEW') }), 200, 'serial before any application');
  assert.ok(reserialed.serial_number.startsWith('NEW'));

  const application = await ok(apply(inst), 201, 'application');
  const locked = await patch(actors.owner.token, { serialNumber: h.unique('LATE') });
  assert.equal(locked.status, 409);
  assert.match(locked.body.message, /open|application/i);
  await assert.rejects(h.pool.query("UPDATE instruments SET serial_number = 'HACK' WHERE id = $1", [inst.id]), /fixed once an application exists/);

  // while the application is open only name and location can change
  assert.equal((await patch(actors.owner.token, { capacity: 99 })).status, 409);
  assert.equal((await ok(patch(actors.owner.token, { instrumentName: 'Renamed while open' }), 200, 'rename while open')).instrument_name, 'Renamed while open');

  await ok(call('POST', `/api/applications/${application.id}/cancel`, actors.owner.token, { reason: 'changed my mind' }), 200, 'cancel');
  assert.equal(Number((await ok(patch(actors.owner.token, { capacity: 99 }), 200, 'edit after cancel')).capacity), 99);
  assert.equal((await patch(actors.owner.token, { serialNumber: h.unique('STILL') })).status, 409, 'still fixed: an application existed');
});

test('deactivate / reactivate: reversible, blocked by open applications, removes the instrument from due lists', async () => {
  const inst = await newInstrument();
  const act = (a, token = actors.owner.token, body = {}) => call('POST', `/api/instruments/${inst.id}/${a}`, token, body);

  const app = await ok(apply(inst), 201, 'application');
  assert.equal((await act('deactivate')).status, 409, 'open application blocks it');
  await ok(call('POST', `/api/applications/${app.id}/cancel`, actors.owner.token, { reason: 'not now' }), 200, 'cancel');

  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await act('deactivate', stranger.token)).status, 403);
  assert.equal((await act('deactivate', actors.lmo.token)).status, 403);

  const off = await ok(act('deactivate', actors.owner.token, { reason: 'Seasonal shop closed' }), 200, 'deactivate');
  assert.equal(off.status, 'INACTIVE');
  assert.equal(off.status_reason, 'Seasonal shop closed');
  assert.equal((await act('deactivate')).status, 409, 'already inactive');

  const refused = await apply(inst);
  assert.equal(refused.status, 409);
  assert.match(refused.body.message, /inactive/);
  const due = await ok(call('GET', '/api/instruments/due', actors.owner.token), 200, 'due list');
  assert.ok(!due.some((d) => d.instrument_id === inst.id), 'inactive instruments are not "due"');

  const back = await ok(act('reactivate'), 200, 'reactivate');
  assert.equal(back.status, 'REGISTERED');
  assert.equal((await act('reactivate')).status, 409, 'only inactive ones can be reactivated');
  await ok(apply(inst), 201, 'application after reactivation');
});

test('decommission: final, needs a reason, freezes the record (also in the database), admin action notifies the owner', async () => {
  const inst = await newInstrument();
  const decommission = (token, body) => call('POST', `/api/instruments/${inst.id}/decommission`, token, body);

  assert.equal((await decommission(actors.owner.token, {})).status, 400);
  assert.equal((await decommission(actors.owner.token, { reason: 'short' })).status, 400);
  assert.equal((await decommission(actors.lmo.token, { reason: 'Officers cannot do this' })).status, 403);

  const done = await ok(decommission(actors.admin.token, { reason: 'Scrapped after fire damage' }), 200, 'decommission');
  assert.equal(done.status, 'DECOMMISSIONED');
  assert.equal(done.status_reason, 'Scrapped after fire damage');
  assert.equal(done.status_changed_by_id, actors.admin.id);

  assert.equal((await call('PATCH', `/api/instruments/${inst.id}`, actors.owner.token, { instrumentName: 'Zombie' })).status, 409);
  assert.equal((await call('POST', `/api/instruments/${inst.id}/reactivate`, actors.owner.token)).status, 409);
  assert.equal((await decommission(actors.owner.token, { reason: 'Twice is not possible' })).status, 409);
  const refused = await apply(inst);
  assert.equal(refused.status, 409);
  assert.match(refused.body.message, /decommissioned/);
  await assert.rejects(h.pool.query("UPDATE instruments SET instrument_name = 'x' WHERE id = $1", [inst.id]), /decommissioned/);

  const notes = await ok(call('GET', '/api/notifications', actors.owner.token), 200, 'notifications');
  assert.ok(notes.some((n) => /decommissioned/i.test(n.title) && n.message.includes(inst.serial_number)));
  const audit = await h.pool.query("SELECT 1 FROM audit_log WHERE action = 'INSTRUMENT_DECOMMISSIONED' AND entity_id = $1", [inst.id]);
  assert.equal(audit.rowCount, 1);
});

// ---------------------------------------------------------------- renewal
test('renewal rules: pure decision table', () => {
  const instrument = { status: 'REGISTERED' };
  const cert = (over) => ({ id: 'c1', certificate_number: 'CERT-2026-000001', status: 'ACTIVE', valid_until: '2027-06-30', ...over });
  const run = (over) => evaluate({ instrument, latest: null, open: null, today: '2027-01-01', windowDays: 60, ...over });

  assert.equal(run({}).suggestedType, 'VERIFICATION');
  const notDue = run({ latest: cert() }); // 180 days left
  assert.equal(notDue.canApply, false);
  assert.equal(notDue.code, 'NOT_DUE');
  assert.equal(notDue.opensOn, '2027-05-01');
  assert.equal(run({ latest: cert({ valid_until: '2027-03-02' }) }).code, 'RENEWAL_WINDOW'); // exactly 60 days
  assert.equal(run({ latest: cert({ valid_until: '2027-03-03' }) }).code, 'NOT_DUE'); // 61 days
  assert.equal(run({ latest: cert({ valid_until: '2027-01-01' }) }).suggestedType, 'RE_VERIFICATION'); // last day
  assert.equal(run({ latest: cert({ valid_until: '2026-12-31' }) }).code, 'LAPSED');
  assert.equal(run({ latest: cert({ status: 'EXPIRED' }) }).code, 'LAPSED');
  assert.equal(run({ latest: cert({ status: 'REVOKED' }) }).suggestedType, 'RE_VERIFICATION');
  assert.equal(run({ open: { application_number: 'A-1', status: 'SUBMITTED' } }).code, 'OPEN_APPLICATION');
  assert.equal(evaluate({ instrument: { status: 'INACTIVE' }, latest: null, open: null, today: '2027-01-01', windowDays: 60 }).code, 'INACTIVE');
  assert.equal(evaluate({ instrument: { status: 'DECOMMISSIONED' }, latest: cert(), open: null, today: '2027-01-01', windowDays: 60 }).code, 'DECOMMISSIONED');

  assert.equal(checkRequestedType(run({}), 'VERIFICATION'), null);
  assert.equal(checkRequestedType(run({}), 'RE_VERIFICATION').status, 400);
  assert.equal(checkRequestedType(run({ latest: cert({ status: 'EXPIRED' }) }), 'VERIFICATION').status, 400);
  assert.equal(checkRequestedType(run({ latest: cert() }), 'RE_VERIFICATION').status, 409);
});

test('renewal over the API: first verification, not-yet-due, renewal window with auto-linked certificate, lapsed', async () => {
  const fresh = await newInstrument();
  const info = await ok(call('GET', `/api/instruments/${fresh.id}/renewal`, actors.owner.token), 200, 'renewal info');
  assert.equal(info.canApply, true);
  assert.equal(info.suggestedType, 'VERIFICATION');
  const wrongType = await apply(fresh, { applicationType: 'RE_VERIFICATION' });
  assert.equal(wrongType.status, 400);
  assert.match(wrongType.body.message, /no previous certificate/);
  assert.equal((await call('GET', `/api/instruments/${fresh.id}/renewal`, (await h.createUser('INSTRUMENT_OWNER')).token)).status, 403);

  // certified instrument
  const flow = await runVerification(actors);
  const cert = await ok(call('POST', '/api/certificates', actors.admin.token, { verificationId: flow.verification.id }), 201, 'certificate');
  const instrumentId = flow.instrument.id;
  const existing = { id: instrumentId };

  const notDue = await ok(call('GET', `/api/instruments/${instrumentId}/renewal`, actors.owner.token), 200, 'info after certificate');
  assert.equal(notDue.latestCertificate.number, cert.certificate_number);
  assert.equal(notDue.code, 'NOT_DUE');
  assert.ok(notDue.opensOn);
  assert.equal((await apply(existing, { applicationType: 'RE_VERIFICATION' })).status, 409);
  const dup = await apply(existing, { applicationType: 'VERIFICATION' });
  assert.equal(dup.status, 409, 'an initial verification is not possible while a valid certificate exists');

  // renewal window opens: the application is linked to the certificate it renews
  const previous = config.renewalWindowDays;
  config.renewalWindowDays = 5000;
  try {
    assert.equal((await apply(existing, { applicationType: 'VERIFICATION' })).status, 400, 'must be filed as a re-verification');
    const renewal = await ok(apply(existing, { applicationType: 'RE_VERIFICATION' }), 201, 'renewal');
    assert.equal(renewal.application_type, 'RE_VERIFICATION');
    const row = await h.pool.query('SELECT last_certificate_id FROM verification_applications WHERE id = $1', [renewal.id]);
    assert.equal(row.rows[0].last_certificate_id, cert.id);
    await ok(call('POST', `/api/applications/${renewal.id}/cancel`, actors.owner.token, { reason: 'test' }), 200, 'cancel');
  } finally {
    config.renewalWindowDays = previous;
  }

  // a lapsed certificate can always be renewed, whatever the window
  await ok(call('PATCH', `/api/certificates/${cert.id}/status`, actors.admin.token, { status: 'EXPIRED' }), 200, 'expire');
  const lapsed = await ok(call('GET', `/api/instruments/${instrumentId}/renewal`, actors.owner.token), 200, 'lapsed info');
  assert.equal(lapsed.code, 'LAPSED');
  assert.equal(lapsed.suggestedType, 'RE_VERIFICATION');
  await ok(apply(existing, { applicationType: 'RE_VERIFICATION' }), 201, 'renewal of a lapsed certificate');
});

// ---------------------------------------------------------------- required documents
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function uploadDocument(token, applicationId, documentType) {
  const form = new FormData();
  form.append('file', new Blob([png]), 'document.png');
  form.append('category', 'DOCUMENT');
  form.append('applicationId', applicationId);
  if (documentType) form.append('documentType', documentType);
  const res = await fetch(`${await h.start()}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('required documents: admin-defined, scoped, checklist, upload by type, assignment blocked until complete', async () => {
  const admin = actors.admin.token;
  const owner = actors.owner.token;
  assert.equal((await call('POST', '/api/documents/requirements', owner, { documentType: 'X_DOC', label: 'x' })).status, 403);
  assert.equal((await call('POST', '/api/documents/requirements', admin, { documentType: 'bad type!', label: 'x' })).status, 400);
  assert.equal((await call('POST', '/api/documents/requirements', admin, { documentType: 'ID_PROOF', label: '' })).status, 400);
  assert.equal((await call('POST', '/api/documents/requirements', admin, { documentType: 'ID_PROOF', label: 'x', applicationType: 'NOPE' })).status, 400);

  await ok(call('POST', '/api/documents/requirements', admin, { documentType: 'id proof', label: 'Identity proof of the owner', labelHi: 'स्वामी का पहचान प्रमाण' }), 201, 'general requirement');
  await ok(call('POST', '/api/documents/requirements', admin, { documentType: 'MODEL_APPROVAL', label: 'Model approval certificate', instrumentOrigin: 'IMPORTED' }), 201, 'imported-only requirement');
  assert.equal((await call('POST', '/api/documents/requirements', admin, { documentType: 'ID_PROOF', label: 'dup' })).status, 409);

  // LOCAL instrument: only the identity proof is needed
  const local = await ok(apply(await newInstrument(), { instrumentOrigin: 'LOCAL' }), 201, 'local application');
  let list = await ok(call('GET', `/api/documents/checklist/${local.id}`, owner), 200, 'checklist');
  assert.deepEqual(list.items.map((i) => i.documentType), ['ID_PROOF']);
  assert.equal(list.complete, false);
  assert.equal(list.items[0].labelHi, 'स्वामी का पहचान प्रमाण');

  const blocked = await call('POST', '/api/assignments', admin, { applicationId: local.id, assignedToId: actors.lmo.id });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /Identity proof of the owner/);

  assert.equal((await uploadDocument(owner, local.id, 'bad type!')).status, 400);
  assert.equal((await uploadDocument((await h.createUser('INSTRUMENT_OWNER')).token, local.id, 'ID_PROOF')).status, 403);
  const untyped = await uploadDocument(owner, local.id, null);
  assert.equal(untyped.status, 201);
  list = await ok(call('GET', `/api/documents/checklist/${local.id}`, owner), 200, 'still incomplete');
  assert.equal(list.complete, false, 'an untyped upload does not satisfy a requirement');
  const typed = await uploadDocument(owner, local.id, 'id_proof');
  assert.equal(typed.status, 201, JSON.stringify(typed.body));
  list = await ok(call('GET', `/api/documents/checklist/${local.id}`, owner), 200, 'complete');
  assert.equal(list.complete, true);
  assert.equal(list.items[0].satisfied, true);
  await assignTo(actors, local.id, actors.lmo);

  // IMPORTED instrument: both documents are needed
  const imported = await ok(apply(await newInstrument(), { instrumentOrigin: 'IMPORTED' }), 201, 'imported application');
  list = await ok(call('GET', `/api/documents/checklist/${imported.id}`, owner), 200, 'imported checklist');
  assert.deepEqual(list.items.map((i) => i.documentType).sort(), ['ID_PROOF', 'MODEL_APPROVAL']);
  await uploadDocument(owner, imported.id, 'ID_PROOF');
  const stillBlocked = await call('POST', '/api/assignments', admin, { applicationId: imported.id, assignedToId: actors.lmo.id });
  assert.equal(stillBlocked.status, 409);
  assert.match(stillBlocked.body.message, /Model approval certificate/);
  assert.doesNotMatch(stillBlocked.body.message, /Identity proof/);

  // switching a requirement off removes it from the checklist
  const reqs = await ok(call('GET', '/api/documents/requirements', admin), 200, 'requirements');
  const model = reqs.find((r) => r.document_type === 'MODEL_APPROVAL');
  await ok(call('PATCH', `/api/documents/requirements/${model.id}`, admin, { isActive: false }), 200, 'deactivate requirement');
  await assignTo(actors, imported.id, actors.lmo);

  // documentType only makes sense on application documents (clear the requirements so the helper flow is not blocked)
  await h.pool.query('DELETE FROM document_requirements');
  const flow = await runVerification(actors);
  const form = new FormData();
  form.append('file', new Blob([png]), 'evidence.png');
  form.append('category', 'PHOTOGRAPH');
  form.append('verificationId', flow.verification.id);
  form.append('documentType', 'ID_PROOF');
  const res = await fetch(`${await h.start()}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${actors.lmo.token}` }, body: form });
  assert.equal(res.status, 400);
});
