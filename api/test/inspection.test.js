// Checkpoint 2: OCR review queue for officers and administrators, and inspection photos with a kind.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, newApplication, assignTo, ok } = require('./workflow');
const ocr = require('../src/modules/nameplate/ocrEngine');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
  ocr.setEngine(async () => ({ text: 'SERIAL NO: ZZ-NOT-THIS-ONE', confidence: 90, engine: 'fake-ocr 1.0' }));
});
test.after(async () => {
  ocr.setEngine(null);
  await ocr.shutdown();
  await h.stop();
});

async function post(path, token, fields, name = 'x.png', type = 'image/png', bytes = png) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  for (const [k, v] of Object.entries(fields || {})) form.append(k, v);
  const res = await fetch(`${await h.start()}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function startedVerification() {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  await ok(h.call('PATCH', `/api/assignments/${assignment.id}/status`, { token: actors.lmo.token, body: { status: 'ACCEPTED' } }), 200, 'accept');
  const verification = await ok(
    h.call('POST', '/api/verifications', { token: actors.lmo.token, body: { applicationId: application.id, assignmentId: assignment.id } }),
    201,
    'start'
  );
  return { application, verification };
}

test('API: the review queue shows an officer only their instruments, an administrator everything', async () => {
  const { application } = await startedVerification();
  const mine = await post(`/api/nameplate/instruments/${application.instrument_id}`, actors.owner.token);
  assert.equal(mine.status, 201, JSON.stringify(mine.body));
  const other = await ok(
    h.call('POST', '/api/instruments', { token: actors.owner.token, body: { instrumentTypeId: (await h.pool.query('SELECT id FROM instrument_types LIMIT 1')).rows[0].id, instrumentName: 'Other', serialNumber: h.unique('Q') } }),
    201,
    'other instrument'
  );
  const theirs = await post(`/api/nameplate/instruments/${other.id}`, actors.owner.token);
  assert.equal(theirs.status, 201);

  const officer = await ok(h.call('GET', '/api/nameplate/queue', { token: actors.lmo.token }), 200, 'officer queue');
  const ids = officer.map((c) => c.id);
  assert.ok(ids.includes(mine.body.data.id), 'assigned instrument is in the officer queue');
  assert.ok(!ids.includes(theirs.body.data.id), 'an instrument not assigned to the officer is not');
  assert.ok(officer[0].instrument_name && officer[0].owner_name, 'queue rows say which instrument and owner');
  assert.match(officer.find((c) => c.id === mine.body.data.id).file_url, /sig=|\?/, 'the photo link is signed so it can be shown');

  const admin = await ok(h.call('GET', '/api/nameplate/queue', { token: actors.admin.token }), 200, 'admin queue');
  assert.ok(admin.some((c) => c.id === theirs.body.data.id) && admin.some((c) => c.id === mine.body.data.id));

  assert.equal((await h.call('GET', '/api/nameplate/queue', { token: actors.owner.token })).status, 403, 'owners have no queue');
  assert.equal((await h.call('GET', '/api/nameplate/queue?status=BOGUS', { token: actors.admin.token })).status, 400);
  // deciding removes it from the pending queue and shows it under its status
  await ok(h.call('POST', `/api/nameplate/${mine.body.data.id}/review`, { token: actors.lmo.token, body: { decision: 'CONFIRMED_MISMATCH', note: 'Serial differs on the plate' } }), 200, 'review');
  const pending = await ok(h.call('GET', '/api/nameplate/queue', { token: actors.lmo.token }), 200, 'pending');
  assert.ok(!pending.some((c) => c.id === mine.body.data.id));
  const decided = await ok(h.call('GET', '/api/nameplate/queue?status=CONFIRMED_MISMATCH', { token: actors.lmo.token }), 200, 'decided');
  assert.ok(decided.some((c) => c.id === mine.body.data.id));
});

test('API: officers add inspection photos of readings, test weights, seals and condition', async () => {
  const { verification } = await startedVerification();
  for (const kind of ['READING', 'TEST_WEIGHT', 'SEAL', 'CONDITION']) {
    const up = await post('/api/attachments', actors.lmo.token, { category: 'INSPECTION_EVIDENCE', verificationId: verification.id, evidenceKind: kind, description: `photo of ${kind}` });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.equal(up.body.data.evidence_kind, kind);
    assert.ok(up.body.data.file_sha256, 'fingerprinted by the server');
  }
  const list = await ok(h.call('GET', `/api/attachments/verification/${verification.id}`, { token: actors.admin.token }), 200, 'list');
  assert.deepEqual(list.map((a) => a.evidence_kind).sort(), ['CONDITION', 'READING', 'SEAL', 'TEST_WEIGHT']);

  const bad = (fields, token = actors.lmo.token, type = 'image/png') => post('/api/attachments', token, { category: 'INSPECTION_EVIDENCE', verificationId: verification.id, ...fields }, type === 'application/pdf' ? 'x.pdf' : 'x.png', type);
  assert.equal((await bad({ evidenceKind: 'SELFIE' })).status, 400, 'unknown kind');
  assert.equal((await bad({ evidenceKind: 'SEAL' }, actors.lmo.token, 'application/pdf')).status, 400, 'images only');
  const ownerTry = await bad({ evidenceKind: 'SEAL' }, actors.owner.token);
  assert.equal(ownerTry.status, 403, JSON.stringify(ownerTry.body));
  const other = await h.createUser('LMO');
  assert.equal((await bad({ evidenceKind: 'SEAL' }, other.token)).status, 403, 'an unassigned officer');
  const onApp = await post('/api/attachments', actors.lmo.token, { category: 'DOCUMENT', applicationId: verification.application_id, evidenceKind: 'SEAL' });
  assert.equal(onApp.status, 400, 'a kind only belongs on verification evidence');

  // evidence without a kind (earlier behaviour) still works
  assert.equal((await bad({})).status, 201);
});

// ---- a damaged image used to crash the whole server (found in the browser run): it is refused up front now
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { normalizeImage } = require('../src/utils/imageTools');
const damaged = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGF5CsEAJT8Af/Tz+cvAAAAAElFTkSuQmCC', 'base64');

test('images: damaged files are refused with a 400, valid ones are normalised and big ones scaled down', async () => {
  await assert.rejects(normalizeImage(damaged), (e) => e.statusCode === 400 && /damaged/.test(e.message));
  await assert.rejects(normalizeImage(Buffer.from('not an image at all')), (e) => e.statusCode === 400);
  const small = await normalizeImage(png);
  assert.deepEqual([small.width, small.height], [1, 1]);
  assert.equal(small.buffer.subarray(1, 4).toString(), 'PNG');
  const { Jimp } = require('jimp');
  const big = new Jimp({ width: 3000, height: 1000, color: 0xffffffff });
  const scaled = await normalizeImage(await big.getBuffer('image/png'));
  assert.equal(scaled.width, 2400);
  assert.equal(scaled.height, 800);
  // a PNG header that claims a gigantic picture is refused before decoding
  const huge = Buffer.from(png);
  huge.writeUInt32BE(30000, 16);
  huge.writeUInt32BE(30000, 20);
  await assert.rejects(normalizeImage(huge), (e) => e.statusCode === 400 && /too many pixels/.test(e.message));
});

test('API with the real OCR engine: a damaged photo is a 400 and the server keeps working', { skip: !fs.existsSync(path.join(config.ocr.langPath, `${config.ocr.lang}.traineddata`)) && 'OCR model not installed' }, async () => {
  ocr.setEngine(null);
  try {
    const inst = await ok(h.call('POST', '/api/instruments', { token: actors.owner.token, body: { instrumentTypeId: (await h.pool.query('SELECT id FROM instrument_types LIMIT 1')).rows[0].id, instrumentName: 'Dmg', serialNumber: h.unique('DMG') } }), 201, 'instrument');
    const res = await post(`/api/nameplate/instruments/${inst.id}`, actors.owner.token, {}, 'plate.png', 'image/png', damaged);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.message, /damaged/);
    assert.equal((await h.pool.query('SELECT 1 FROM nameplate_checks WHERE instrument_id = $1', [inst.id])).rowCount, 0);
    // the process is still alive and answering (the damaged file never reached the OCR worker, which
    // also keeps this file from sharing the model cache with nameplate.test.js)
    assert.equal((await h.call('GET', '/api/nameplate/status', { token: actors.owner.token })).status, 200);
  } finally {
    ocr.setEngine(async () => ({ text: 'SERIAL NO: ZZ-NOT-THIS-ONE', confidence: 90, engine: 'fake-ocr 1.0' }));
  }
});
