// Phase 6, feature 1: OCR-assisted nameplate check with human review.
// The machine reads and suggests; a person decides; nothing else changes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const h = require('./helpers');
const { createActors, assignTo, ok } = require('./workflow');
const config = require('../src/config');
const ocr = require('../src/modules/nameplate/ocrEngine');
const { sha256Hex } = require('../src/utils/integrity');
const { parseNameplate } = require('../src/modules/nameplate/nameplate.parse');
const { compareToRegistered, compareText, compareCapacity, compareClass, advise } = require('../src/modules/nameplate/nameplate.compare');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const MODEL_PRESENT = fs.existsSync(path.join(config.ocr.langPath, `${config.ocr.lang}.traineddata`));

let actors;
let fakeText = '';
let fakeConfidence = 92;

test.before(async () => {
  await h.start();
  actors = await createActors();
  ocr.setEngine(async () => ({ text: fakeText, confidence: fakeConfidence, engine: 'fake-ocr 1.0' }));
});
test.after(async () => {
  ocr.setEngine(null);
  await ocr.shutdown();
  await h.stop();
});

const plateFor = (serial, extra = {}) =>
  [
    `MANUFACTURER: ${extra.manufacturer ?? 'ACME WEIGHING SYSTEMS'}`,
    `MODEL: ${extra.model ?? 'PS-500'}`,
    `SERIAL NO: ${serial}`,
    `MAX CAPACITY: ${extra.capacity ?? '500 kg'}`,
    `ACCURACY CLASS: ${extra.cls ?? 'III'}`,
    'YEAR OF MFG: 2024',
  ].join('\n');

// ---------------------------------------------------------------- parsing
test('parser: reads labelled fields from clean and noisy plates, invents nothing', () => {
  const clean = parseNameplate(plateFor('AW2024-001178')).fields;
  assert.equal(clean.manufacturer, 'ACME WEIGHING SYSTEMS');
  assert.equal(clean.model, 'PS-500');
  assert.equal(clean.serialNumber, 'AW2024-001178');
  assert.deepEqual(clean.capacity, { value: 500, unit: 'kg', raw: '500 kg' });
  assert.equal(clean.accuracyClass, 'III');
  assert.equal(clean.year, '2024');

  const noisy = parseNameplate('Mfd. by : Acme Weighing\nS.No. AW2O24-OO1178\nType: PS 500\nCap. 0.5 t\nClass lll\nPattern Approval No. IND/09/2020/123').fields;
  assert.equal(noisy.manufacturer, 'Acme Weighing');
  assert.equal(noisy.serialNumber, 'AW2O24-OO1178');
  assert.equal(noisy.model, 'PS 500');
  assert.deepEqual([noisy.capacity.value, noisy.capacity.unit], [0.5, 't']);
  assert.equal(noisy.accuracyClass, 'lll');
  assert.equal(noisy.approvalNumber, 'IND/09/2020/123');

  assert.deepEqual(parseNameplate('Sr. No: 77\nMake - Sartorius').fields, { serialNumber: '77', manufacturer: 'Sartorius' });
  assert.deepEqual(parseNameplate('Max 1,000 kg').fields.capacity, { value: 1000, unit: 'kg', raw: '1,000 kg' });
  assert.deepEqual(parseNameplate('Capacity: 2,5 litres').fields.capacity.value, 2.5);
  assert.equal(parseNameplate('CAPACITY 20 LTR').fields.capacity.unit, 'l');

  // nothing recognisable -> nothing reported
  assert.deepEqual(parseNameplate('').fields, {});
  assert.deepEqual(parseNameplate(null).fields, {});
  assert.deepEqual(parseNameplate('hello world\n!!!\n12345 random text').fields, {});
  assert.equal(parseNameplate('SNOWMAN 123').fields.serialNumber, undefined, '"SN" inside a word is not a label');
});

// ---------------------------------------------------------------- comparison
test('comparison: match, look-alike slips, mismatches, units and classes', () => {
  assert.equal(compareText('AW2024-001178', 'aw2024 001178').status, 'MATCH');
  assert.equal(compareText('AW2O24-OO1178', 'AW2024-001178').status, 'CLOSE');
  assert.equal(compareText('AW2024-001179', 'AW2024-001178').status, 'CLOSE'); // one digit off, long enough to be an OCR slip
  assert.equal(compareText('ZZ9999-777777', 'AW2024-001178').status, 'MISMATCH');
  assert.equal(compareText('123', '124').status, 'MISMATCH', 'short strings must match exactly');
  assert.equal(compareText('', 'X').status, 'NOT_READ');
  assert.equal(compareText('ACME WEIGHING SYSTEMS', 'Acme', { allowContains: true }).status, 'MATCH');
  assert.equal(compareText('A123456', '123456', { allowContains: false }).status, 'CLOSE'); // serials are never "contained"

  assert.equal(compareCapacity({ value: 500, unit: 'kg' }, 500, 'kg').status, 'MATCH');
  assert.equal(compareCapacity({ value: 0.5, unit: 't' }, 500, 'kg').status, 'MATCH');
  assert.equal(compareCapacity({ value: 500, unit: 'g' }, 500, 'kg').status, 'MISMATCH');
  assert.equal(compareCapacity({ value: 500, unit: 'l' }, 500, 'kg').status, 'MISMATCH');
  assert.equal(compareCapacity({ value: 2, unit: 'l' }, 2000, 'ml').status, 'MATCH');
  assert.equal(compareCapacity(undefined, 500, 'kg').status, 'NOT_READ');

  assert.equal(compareClass('III', 'Class III (Medium Accuracy)').status, 'MATCH');
  assert.equal(compareClass('lll', 'Class III').status, 'MATCH');
  assert.equal(compareClass('3', 'III').status, 'MATCH');
  assert.equal(compareClass('II', 'Class III').status, 'MISMATCH');

  const registered = { serial_number: 'AW2024-001178', manufacturer: 'Acme', model: null, capacity: 500, capacity_unit: 'kg', accuracy_class: 'Class III' };
  const c = compareToRegistered(parseNameplate(plateFor('AW2024-001178')).fields, registered);
  assert.equal(c.fields.serialNumber.status, 'MATCH');
  assert.equal(c.fields.model.status, 'NOT_REGISTERED', 'no registered model to compare with');
  assert.deepEqual(c.extra, { year: '2024' }, 'year is shown, never compared');
  const blankPlate = compareToRegistered({}, registered);
  assert.equal(blankPlate.fields.serialNumber.status, 'NOT_READ');
});

test('advisory: a suggestion with clear thresholds', () => {
  const registered = { serial_number: 'AW2024-001178', manufacturer: 'Acme Weighing Systems', model: 'PS-500', capacity: 500, capacity_unit: 'kg', accuracy_class: 'III' };
  const run = (text, confidence) => advise(compareToRegistered(parseNameplate(text).fields, registered), confidence).advisory;

  assert.equal(run(plateFor('AW2024-001178'), 95), 'ALL_MATCH');
  assert.equal(run(plateFor('AW2024-001178'), 60), 'NEEDS_REVIEW', 'low OCR confidence is never "all match"');
  assert.equal(run(plateFor('AW2O24-OO1178'), 95), 'NEEDS_REVIEW');
  assert.equal(run(plateFor('ZZ9999-777777'), 95), 'LIKELY_MISMATCH');
  assert.equal(run(plateFor('AW2024-001178', { capacity: '50 kg' }), 95), 'LIKELY_MISMATCH');
  assert.equal(run('', 90), 'UNREADABLE');
  assert.equal(run(plateFor('AW2024-001178'), 20), 'UNREADABLE');
});

// ---------------------------------------------------------------- API (fake engine)
async function registeredInstrument(owner = actors.owner) {
  const types = await ok(h.call('GET', '/api/instruments/types', { token: owner.token }), 200, 'types');
  return ok(
    h.call('POST', '/api/instruments', {
      token: owner.token,
      body: { instrumentTypeId: types[0].id, instrumentName: 'Platform Scale', serialNumber: h.unique('AW'), manufacturer: 'Acme Weighing Systems', model: 'PS-500', capacity: 500, capacityUnit: 'kg', accuracyClass: 'Class III' },
    }),
    201,
    'instrument'
  );
}
async function upload(token, instrumentId, { bytes = png, name = 'plate.png', type = 'image/png' } = {}) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${await h.start()}/api/nameplate/instruments/${instrumentId}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const instrumentRow = async (id) => (await h.pool.query('SELECT * FROM instruments WHERE id = $1', [id])).rows[0];
const review = (token, id, body) => h.call('POST', `/api/nameplate/${id}/review`, { token, body });

test('API: upload reads the plate, stores evidence, compares, and leaves the instrument untouched', async () => {
  const inst = await registeredInstrument();
  fakeText = plateFor(inst.serial_number);
  const before = await instrumentRow(inst.id);

  const res = await upload(actors.owner.token, inst.id);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const check = res.body.data;
  assert.equal(check.status, 'PENDING_REVIEW');
  assert.equal(check.advisory, 'ALL_MATCH');
  assert.equal(check.engine, 'fake-ocr 1.0');
  assert.equal(check.file_sha256, sha256Hex(png));
  assert.equal(check.comparison.fields.serialNumber.status, 'MATCH');
  assert.equal(check.comparison.fields.capacity.status, 'MATCH');
  assert.equal(check.extracted.serialNumber, inst.serial_number);
  assert.equal(check.registered_snapshot.serial_number, inst.serial_number);
  assert.match(check.raw_text, /SERIAL NO/);
  assert.match(check.disclaimer, /person must confirm/);
  assert.equal(check.reviewed_by_id, null);

  // the photo is stored privately (signed link works, bare path does not)
  const base = await h.start();
  assert.equal((await fetch(`${base}${check.file_url}`)).status, 200);
  assert.equal((await fetch(`${base}${check.file_url.split('?')[0]}`)).status, 403);

  assert.deepEqual(await instrumentRow(inst.id), before, 'OCR must not change the instrument');
  const audit = await h.pool.query("SELECT details FROM audit_log WHERE action = 'NAMEPLATE_CHECK_CREATED' AND entity_id = $1", [check.id]);
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].details.advisory, 'ALL_MATCH');

  const list = await ok(h.call('GET', `/api/nameplate/instruments/${inst.id}`, { token: actors.owner.token }), 200, 'list');
  assert.equal(list.length, 1);
  assert.equal((await ok(h.call('GET', `/api/nameplate/${check.id}`, { token: actors.admin.token }), 200, 'detail')).id, check.id);
  assert.equal((await ok(h.call('GET', '/api/nameplate/status', { token: actors.owner.token }), 200, 'status')).available, true);
});

test('API: a wrong serial number or an unreadable photo is flagged, never auto-resolved', async () => {
  const inst = await registeredInstrument();
  fakeText = plateFor('ZZ9999-777777');
  const bad = (await upload(actors.owner.token, inst.id)).body.data;
  assert.equal(bad.advisory, 'LIKELY_MISMATCH');
  assert.equal(bad.comparison.fields.serialNumber.status, 'MISMATCH');
  assert.equal(bad.status, 'PENDING_REVIEW');
  assert.match(bad.advisory_summary, /serial number/);

  fakeText = '';
  fakeConfidence = 8;
  const blank = (await upload(actors.owner.token, inst.id)).body.data;
  fakeConfidence = 92;
  assert.equal(blank.advisory, 'UNREADABLE');
  assert.equal(blank.status, 'PENDING_REVIEW');
});

test('API: input and access rules', async () => {
  const inst = await registeredInstrument();
  fakeText = plateFor(inst.serial_number);

  assert.equal((await upload(null, inst.id)).status, 401);
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await upload(stranger.token, inst.id)).status, 403);
  assert.equal((await upload(actors.lmo.token, inst.id)).status, 403, 'an officer not assigned to the instrument');
  assert.equal((await upload(actors.owner.token, 'not-an-id')).status, 404);
  assert.equal((await upload(actors.owner.token, '00000000-0000-4000-8000-000000000000')).status, 404);

  const pdf = await upload(actors.owner.token, inst.id, { bytes: Buffer.from('%PDF-1.4 test'), name: 'plate.pdf', type: 'application/pdf' });
  assert.equal(pdf.status, 400);
  assert.match(pdf.body.message, /JPG or PNG/);
  const fake = await upload(actors.owner.token, inst.id, { bytes: Buffer.from('this is not a png'), name: 'plate.png' });
  assert.equal(fake.status, 400, 'content must match the extension');
  assert.equal((await h.pool.query('SELECT 1 FROM nameplate_checks WHERE instrument_id = $1', [inst.id])).rowCount, 0, 'rejected uploads leave no record');

  // a check is private to people with access to the instrument
  const good = (await upload(actors.owner.token, inst.id)).body.data;
  assert.equal((await h.call('GET', `/api/nameplate/${good.id}`, { token: stranger.token })).status, 403);
  assert.equal((await h.call('GET', `/api/nameplate/instruments/${inst.id}`, { token: stranger.token })).status, 403);

  // engine not available -> clear message, no record, no stored photo
  const flag = config.ocr.enabled;
  ocr.setEngine(null);
  config.ocr.enabled = false;
  try {
    const down = await upload(actors.owner.token, inst.id);
    assert.equal(down.status, 503);
    assert.match(down.body.message, /not set up/);
    assert.equal((await ok(h.call('GET', '/api/nameplate/status', { token: actors.owner.token }), 200, 'status')).available, false);
  } finally {
    config.ocr.enabled = flag;
    ocr.setEngine(async () => ({ text: fakeText, confidence: fakeConfidence, engine: 'fake-ocr 1.0' }));
  }
  assert.equal((await h.pool.query('SELECT 1 FROM nameplate_checks WHERE instrument_id = $1', [inst.id])).rowCount, 1);
});

test('API: only a different, authorised person can decide; the decision is audited and the instrument still untouched', async () => {
  const inst = await registeredInstrument();
  // assign the officer to this instrument through a real application
  const app = await ok(h.call('POST', '/api/applications', { token: actors.owner.token, body: { instrumentId: inst.id, applicationType: 'VERIFICATION', division: 'PUNE' } }), 201, 'application');
  await assignTo(actors, app.id, actors.lmo);

  fakeText = plateFor('ZZ9999-777777'); // wrong serial: the machine suggests LIKELY_MISMATCH
  const before = await instrumentRow(inst.id);
  const check = (await upload(actors.owner.token, inst.id)).body.data;
  const officerPhoto = (await upload(actors.lmo.token, inst.id)).body.data; // an assigned officer may upload too

  // who may not decide
  assert.equal((await review(actors.owner.token, check.id, { decision: 'CONFIRMED_MATCH' })).status, 403, 'owners cannot decide');
  assert.equal((await review(actors.lmo.token, officerPhoto.id, { decision: 'CONFIRMED_MISMATCH', note: 'my own photo' })).status, 409, 'not the uploader');
  const otherOfficer = await h.createUser('LMO');
  assert.equal((await review(otherOfficer.token, check.id, { decision: 'CONFIRMED_MATCH' })).status, 403, 'not assigned to this instrument');

  // invalid requests
  assert.equal((await review(actors.lmo.token, check.id, { decision: 'LOOKS_GOOD' })).status, 400);
  assert.equal((await review(actors.lmo.token, check.id, {})).status, 400);
  assert.equal((await review(actors.lmo.token, check.id, { decision: 'CONFIRMED_MISMATCH' })).status, 400, 'a mismatch needs a note');
  assert.equal((await review(actors.lmo.token, check.id, { decision: 'CONFIRMED_MATCH', values: 'x' })).status, 400);

  // the assigned officer decides AGAINST the machine's wording only with a reason; here they agree
  const done = await ok(
    review(actors.lmo.token, check.id, { decision: 'CONFIRMED_MISMATCH', note: 'Plate serial differs from the register', values: { serialNumber: 'ZZ9999-777777' } }),
    200, 'review'
  );
  assert.equal(done.status, 'CONFIRMED_MISMATCH');
  assert.equal(done.reviewed_by_id, actors.lmo.id);
  assert.ok(done.reviewed_at);
  assert.deepEqual(done.reviewer_values, { serialNumber: 'ZZ9999-777777' });
  assert.equal(done.advisory, 'LIKELY_MISMATCH', 'the machine suggestion is preserved next to the decision');

  assert.equal((await review(actors.admin.token, check.id, { decision: 'CONFIRMED_MATCH' })).status, 409, 'decided only once');

  const audit = await h.pool.query("SELECT details FROM audit_log WHERE action = 'NAMEPLATE_CHECK_REVIEWED' AND entity_id = $1", [check.id]);
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].details.machineAdvisory, 'LIKELY_MISMATCH');
  assert.equal(audit.rows[0].details.humanDecision, 'CONFIRMED_MISMATCH');
  assert.equal(audit.rows[0].details.agreedWithMachine, true);

  const notes = await ok(h.call('GET', '/api/notifications', { token: actors.owner.token }), 200, 'owner notifications');
  assert.ok(notes.some((n) => n.title === 'Nameplate check reviewed' && /do not match/.test(n.message)));

  // a confirmed mismatch changes nothing by itself: no edit, no revocation, no enforcement case
  assert.deepEqual(await instrumentRow(inst.id), before);
  const cases = await h.pool.query('SELECT 1 FROM enforcement_cases WHERE instrument_id = $1', [inst.id]);
  assert.equal(cases.rowCount, 0);

  // a human can disagree with the machine; that is recorded too
  fakeText = plateFor(inst.serial_number);
  const clean = (await upload(actors.owner.token, inst.id)).body.data;
  assert.equal(clean.advisory, 'ALL_MATCH');
  await ok(review(actors.admin.token, clean.id, { decision: 'UNREADABLE', note: 'Plate is partly covered by tape' }), 200, 'admin review');
  const disagreed = await h.pool.query("SELECT details FROM audit_log WHERE action = 'NAMEPLATE_CHECK_REVIEWED' AND entity_id = $1", [clean.id]);
  assert.equal(disagreed.rows[0].details.agreedWithMachine, false);
});

test('database: machine output is immutable evidence, a decision is final, and nothing is deleted', async () => {
  const inst = await registeredInstrument();
  fakeText = plateFor(inst.serial_number);
  const check = (await upload(actors.owner.token, inst.id)).body.data;

  await assert.rejects(h.pool.query("UPDATE nameplate_checks SET advisory = 'LIKELY_MISMATCH' WHERE id = $1", [check.id]), /evidence/);
  await assert.rejects(h.pool.query("UPDATE nameplate_checks SET raw_text = 'edited' WHERE id = $1", [check.id]), /evidence/);
  await assert.rejects(h.pool.query("UPDATE nameplate_checks SET status = 'CONFIRMED_MATCH' WHERE id = $1", [check.id]), /ck_nameplate_checks_review_complete/, 'a decision needs a reviewer');
  await assert.rejects(
    h.pool.query("UPDATE nameplate_checks SET status = 'CONFIRMED_MATCH', reviewed_by_id = uploaded_by_id, reviewed_at = now() WHERE id = $1", [check.id]),
    /ck_nameplate_checks_reviewer_not_uploader/
  );
  await assert.rejects(h.pool.query('DELETE FROM nameplate_checks WHERE id = $1', [check.id]), /cannot be deleted/);

  await ok(review(actors.admin.token, check.id, { decision: 'CONFIRMED_MATCH' }), 200, 'review');
  await assert.rejects(h.pool.query("UPDATE nameplate_checks SET review_note = 'rewritten' WHERE id = $1", [check.id]), /already been decided/);
});

// ---------------------------------------------------------------- real OCR engine
test('real OCR engine reads a generated nameplate and the comparison catches a wrong serial', { skip: !MODEL_PRESENT && 'OCR model not installed (run: npm run ocr:setup)' }, async () => {
  ocr.setEngine(null); // use tesseract.js for real
  const jimp = require('jimp');
  const fonts = require('jimp/fonts');
  const font = await jimp.loadFont(fonts.SANS_32_BLACK);
  const render = async (serial) => {
    const lines = plateFor(serial).split('\n');
    const img = new jimp.Jimp({ width: 1000, height: 120 + lines.length * 56, color: 0xffffffff });
    lines.forEach((line, i) => img.print({ font, x: 30, y: 30 + i * 56, text: line }));
    return img.getBuffer('image/png');
  };

  const inst = await registeredInstrument();
  const good = await upload(actors.owner.token, inst.id, { bytes: await render(inst.serial_number) });
  assert.equal(good.status, 201, JSON.stringify(good.body));
  const g = good.body.data;
  assert.match(g.engine, /^tesseract\.js /);
  assert.ok(Number(g.ocr_confidence) > 60, `confidence ${g.ocr_confidence}`);
  assert.equal(g.comparison.fields.serialNumber.status, 'MATCH', `read "${g.extracted.serialNumber}"`);
  assert.equal(g.comparison.fields.capacity.status, 'MATCH');
  assert.equal(g.comparison.fields.accuracyClass.status, 'MATCH');
  assert.equal(g.advisory, 'ALL_MATCH');
  assert.equal(g.status, 'PENDING_REVIEW', 'even a perfect read waits for a person');

  const bad = await upload(actors.owner.token, inst.id, { bytes: await render('QQ0000-123456') });
  assert.equal(bad.status, 201);
  assert.equal(bad.body.data.comparison.fields.serialNumber.status, 'MISMATCH');
  assert.equal(bad.body.data.advisory, 'LIKELY_MISMATCH');
});
