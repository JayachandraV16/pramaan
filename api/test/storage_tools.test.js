// Checkpoint 6: image validation and metadata on upload, cleanup of refused uploads, and the storage tools
// (driver listing, audit, cleanup, migration to an S3-compatible store).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');

const { Jimp } = require('jimp');

const h = require('./helpers');
const config = require('../src/config');
const storage = require('../src/utils/storage');
const tools = require('../src/storage/tools');
const { sha256Hex } = require('../src/utils/integrity');
const { readExifOrientation, describeImage } = require('../src/utils/imageTools');
const { createActors, newApplication, ok } = require('./workflow');

// In-memory S3 with listing (two objects per page, to exercise pagination).
class FakeS3 {
  constructor() {
    this.objects = new Map();
    this.corruptOnPut = false;
    this.failPutFor = null;
  }
  async send(command) {
    const name = command.constructor.name;
    const input = command.input;
    if (name === 'PutObjectCommand') {
      if (this.failPutFor && input.Key.endsWith(this.failPutFor)) throw new Error('simulated network failure');
      const body = Buffer.from(input.Body);
      this.objects.set(input.Key, { body: this.corruptOnPut ? Buffer.concat([body, Buffer.from('x')]) : body, modified: new Date() });
      return {};
    }
    if (name === 'GetObjectCommand') {
      const o = this.objects.get(input.Key);
      if (!o) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      return { Body: Readable.from([o.body]), ContentLength: o.body.length };
    }
    if (name === 'DeleteObjectCommand') {
      this.objects.delete(input.Key);
      return {};
    }
    if (name === 'ListObjectsV2Command') {
      const keys = [...this.objects.keys()].filter((k) => k.startsWith(input.Prefix || '')).sort();
      const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
      const page = keys.slice(start, start + 2);
      const more = start + 2 < keys.length;
      return {
        Contents: page.map((Key) => ({ Key, Size: this.objects.get(Key).body.length, LastModified: this.objects.get(Key).modified })),
        IsTruncated: more,
        NextContinuationToken: more ? String(start + 2) : undefined,
      };
    }
    throw new Error(`unexpected command ${name}`);
  }
}

// a JPEG with a camera-orientation tag (100 x 50 pixels as stored)
async function jpegWithOrientation(orientation, little = false) {
  const jpg = await new Jimp({ width: 100, height: 50, color: 0x336699ff }).getBuffer('image/jpeg');
  const o = Buffer.alloc(2);
  if (little) o.writeUInt16LE(orientation); else o.writeUInt16BE(orientation);
  const tiff = little
    ? Buffer.concat([Buffer.from('II'), Buffer.from([0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0]), o, Buffer.from([0, 0, 0, 0, 0, 0])])
    : Buffer.concat([Buffer.from('MM'), Buffer.from([0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1]), o, Buffer.from([0, 0, 0, 0, 0, 0])]);
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
  return Buffer.concat([jpg.subarray(0, 2), segment, jpg.subarray(2)]);
}

let actors;
test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  storage.setDriver(null);
  await h.stop();
});

const plainPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function upload(token, fields, bytes, name, type) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(`${await h.start()}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const storedKeys = async () => (await storage.list()).map((f) => f.key);
const metaRow = async (key) => (await h.pool.query('SELECT * FROM stored_files WHERE key = $1', [key])).rows[0];

test('camera orientation is read from JPEG metadata (both byte orders) and nothing is invented', async () => {
  for (const little of [false, true]) {
    for (const o of [1, 3, 6, 8]) assert.equal(readExifOrientation(await jpegWithOrientation(o, little)), o, `order ${little ? 'II' : 'MM'} value ${o}`);
  }
  assert.equal(readExifOrientation(await new Jimp({ width: 4, height: 4, color: 0xffffffff }).getBuffer('image/jpeg')), null, 'no EXIF');
  assert.equal(readExifOrientation(plainPng), null, 'not a JPEG');
  assert.equal(readExifOrientation(Buffer.from('nonsense')), null);
  assert.equal(readExifOrientation(await jpegWithOrientation(9)), null, 'out of range value ignored');
  const info = await describeImage(await jpegWithOrientation(6));
  assert.deepEqual(info, { width: 100, height: 50, orientation: 6 }, 'stored size, not the turned size');
});

test('uploads: a picture must really decode; metadata is written to PostgreSQL; the bytes are not changed', async () => {
  const { application } = await newApplication(actors);
  const fields = { applicationId: application.id, category: 'PHOTOGRAPH' };
  const before = (await storedKeys()).length;

  const damaged = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGF5CsEAJT8Af/Tz+cvAAAAAElFTkSuQmCC', 'base64');
  const bad = await upload(actors.owner.token, fields, damaged, 'x.png', 'image/png');
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  assert.match(bad.body.message, /damaged/);
  assert.equal((await storedKeys()).length, before, 'a refused picture leaves no file');

  const huge = Buffer.from(plainPng);
  huge.writeUInt32BE(30000, 16);
  huge.writeUInt32BE(30000, 20);
  assert.equal((await upload(actors.owner.token, fields, huge, 'huge.png', 'image/png')).status, 400, 'absurd dimensions');
  assert.equal((await storedKeys()).length, before);

  const photo = await jpegWithOrientation(6);
  const good = await upload(actors.owner.token, fields, photo, 'phone.jpg', 'image/jpeg');
  assert.equal(good.status, 201, JSON.stringify(good.body));
  const key = good.body.data.file_url.split('?')[0].replace('/uploads/', '');
  const row = await metaRow(key);
  assert.equal(row.kind, 'IMAGE');
  assert.equal(row.mime_type, 'image/jpeg');
  assert.equal(row.width, 100);
  assert.equal(row.height, 50);
  assert.equal(row.exif_orientation, 6);
  assert.equal(Number(row.size_bytes), photo.length);
  assert.equal(row.sha256, sha256Hex(photo));
  assert.equal(row.uploaded_by_id, actors.owner.id);
  assert.equal(good.body.data.file_sha256, row.sha256, 'the fingerprint shown to people is the stored one');
  const stored = fs.readFileSync(path.join(config.uploadDir, key));
  assert.ok(stored.equals(photo), 'the stored file is byte-for-byte what was uploaded (the evidence hash stays valid)');

  const pdf = await upload(actors.owner.token, { applicationId: application.id, category: 'DOCUMENT' }, Buffer.from('%PDF-1.4\n%%EOF\n'), 'a.pdf', 'application/pdf');
  assert.equal(pdf.status, 201);
  const pdfRow = await metaRow(pdf.body.data.file_url.split('?')[0].replace('/uploads/', ''));
  assert.equal(pdfRow.kind, 'PDF');
  assert.equal(pdfRow.width, null);
});

test('uploads: a request that is then refused leaves no file and no metadata behind', async () => {
  const { application } = await newApplication(actors);
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const files = (await storedKeys()).length;
  const rows = (await h.pool.query('SELECT count(*)::int n FROM stored_files')).rows[0].n;

  const refused = await upload(stranger.token, { applicationId: application.id, category: 'PHOTOGRAPH' }, plainPng, 'p.png', 'image/png');
  assert.equal(refused.status, 403);
  await new Promise((r) => setTimeout(r, 300)); // the clean-up runs when the response has been sent
  assert.equal((await storedKeys()).length, files, 'no stray file');
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM stored_files')).rows[0].n, rows, 'no stray metadata row');

  const missingOwner = await upload(actors.owner.token, { category: 'PHOTOGRAPH' }, plainPng, 'p.png', 'image/png');
  assert.equal(missingOwner.status, 400);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await storedKeys()).length, files);
});

test('drivers list their files: local walks folders, S3 follows pagination and strips the prefix', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-list-'));
  const local = storage.createLocalDriver(root);
  await local.put('b.png', Buffer.from('b'));
  await local.put('certificates/c.pdf', Buffer.from('cc'));
  fs.writeFileSync(path.join(root, '.hidden'), 'x'); // not a valid key: ignored
  assert.deepEqual((await local.list()).map((f) => [f.key, f.size]), [['b.png', 1], ['certificates/c.pdf', 2]]);
  assert.deepEqual(await storage.createLocalDriver(path.join(root, 'nothing-here')).list(), []);

  const client = new FakeS3();
  const s3 = storage.createS3Driver({ client, bucket: 'b', prefix: 'pramaan/' });
  for (const key of ['a.png', 'b.png', 'certificates/c.pdf', 'd.jpg', 'e.jpg']) await s3.put(key, Buffer.from(key));
  client.objects.set('other/ignored.png', { body: Buffer.from('x'), modified: new Date() }); // outside the prefix
  const listed = await s3.list();
  assert.deepEqual(listed.map((f) => f.key), ['a.png', 'b.png', 'certificates/c.pdf', 'd.jpg', 'e.jpg'], 'five objects over three pages, prefix removed');
  assert.equal(listed[2].size, 'certificates/c.pdf'.length);
  assert.throws(() => storage.driverFromSettings({ driver: 's3', s3: { bucket: '' } }), /S3_BUCKET/);
});

test('audit and cleanup: orphans, missing files and missing metadata are found; only old unreferenced files are deleted', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-audit-'));
  const driver = storage.createLocalDriver(root);
  const { application } = await newApplication(actors);

  const keep = `audit-keep-${h.unique('k')}.png`;
  const oldOrphan = `audit-old-${h.unique('o')}.png`;
  const youngOrphan = `audit-young-${h.unique('y')}.png`;
  const gone = `audit-gone-${h.unique('g')}.png`;
  await driver.put(keep, plainPng);
  await driver.put(oldOrphan, plainPng);
  await driver.put(youngOrphan, plainPng);
  const longAgo = new Date(Date.now() - 3 * 86400000);
  fs.utimesSync(path.join(root, oldOrphan), longAgo, longAgo);
  fs.utimesSync(path.join(root, keep), longAgo, longAgo);

  // the database refers to `keep` (present) and `gone` (absent from storage)
  for (const key of [keep, gone]) {
    await h.pool.query(
      `INSERT INTO attachments (application_id, uploaded_by_id, category, file_name, file_url) VALUES ($1, $2, 'PHOTOGRAPH', $3, $4)`,
      [application.id, actors.owner.id, key, `/uploads/${key}`]
    );
  }
  await h.pool.query(
    `INSERT INTO stored_files (key, kind, mime_type, size_bytes, sha256) VALUES ($1, 'IMAGE', 'image/png', 1, $2)`,
    [`ghost-${h.unique('m')}.png`, 'a'.repeat(64)]
  );

  const report = await tools.audit({ pool: h.pool, driver, minAgeHours: 24 });
  assert.equal(report.files, 3);
  assert.deepEqual(report.orphans.map((o) => o.key), [oldOrphan], 'the young unreferenced file may still be mid-upload, so it is not an orphan yet');
  // (files other tests uploaded are in another folder, so they are "missing" from this temporary driver too: look at ours)
  const ours = report.missing.filter((m) => m.key.startsWith('audit-'));
  assert.deepEqual(ours.map((m) => m.key), [gone]);
  assert.deepEqual(ours[0].referencedBy, ['attachments.file_url']);
  assert.equal(report.withoutMetadata, 3);
  assert.equal(report.metadataWithoutFile.length >= 1, true);

  // backfill writes the metadata rows (hash, size, picture size) for files that have none
  const filled = await tools.audit({ pool: h.pool, driver, minAgeHours: 24, backfill: true });
  assert.equal(filled.backfilled, 3);
  assert.equal(filled.withoutMetadata, 0);
  const row = await metaRow(keep);
  assert.equal(row.sha256, sha256Hex(plainPng));
  assert.equal(row.width, 1);

  // cleanup: dry run first
  const dry = await tools.cleanup({ pool: h.pool, driver, minAgeHours: 24 });
  assert.equal(dry.dryRun, true);
  assert.deepEqual(dry.candidates.map((c) => c.key), [oldOrphan]);
  assert.ok(fs.existsSync(path.join(root, oldOrphan)), 'a dry run deletes nothing');

  const applied = await tools.cleanup({ pool: h.pool, driver, minAgeHours: 24, apply: true });
  assert.deepEqual(applied.removed, [oldOrphan]);
  assert.equal(fs.existsSync(path.join(root, oldOrphan)), false);
  assert.ok(fs.existsSync(path.join(root, keep)), 'referenced files are never deleted');
  assert.ok(fs.existsSync(path.join(root, youngOrphan)), 'young files are never deleted');
  assert.equal(await metaRow(oldOrphan), undefined, 'its metadata row is gone too');
  assert.ok(await metaRow(keep), 'metadata of kept files stays');
});

test('migration to S3: dry run copies nothing; apply copies and verifies; a second run is a no-op; conflicts and bad copies are reported, the source never changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-migrate-'));
  const source = storage.createLocalDriver(root);
  const files = { 'one.png': plainPng, 'two.jpg': await jpegWithOrientation(1), 'certificates/CERT-1.pdf': Buffer.from('%PDF-1.4 sample') };
  for (const [key, bytes] of Object.entries(files)) await source.put(key, bytes);
  const snapshot = async () => Object.fromEntries(await Promise.all((await source.list()).map(async (f) => [f.key, sha256Hex(fs.readFileSync(path.join(root, f.key)))])));
  const sourceBefore = await snapshot();

  const client = new FakeS3();
  const target = storage.createS3Driver({ client, bucket: 'archive', prefix: 'pramaan/' });

  const dry = await tools.migrate({ source, target });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.total, 3);
  assert.equal(dry.copied.length, 3, 'reports what it would copy');
  assert.equal(client.objects.size, 0, 'but copies nothing');

  const real = await tools.migrate({ source, target, apply: true });
  assert.deepEqual([real.copied.length, real.alreadyThere.length, real.conflicts.length, real.failed.length], [3, 0, 0, 0]);
  assert.equal(client.objects.size, 3);
  for (const [key, bytes] of Object.entries(files)) {
    assert.ok(client.objects.get(`pramaan/${key}`).body.equals(bytes), `${key} arrived intact`);
  }
  assert.equal((await target.open('certificates/CERT-1.pdf')) !== null, true);

  const again = await tools.migrate({ source, target, apply: true });
  assert.deepEqual([again.copied.length, again.alreadyThere.length], [0, 3], 'running it again changes nothing');

  // the target already holds a DIFFERENT file under one name: reported, never overwritten
  client.objects.set('pramaan/one.png', { body: Buffer.from('someone else'), modified: new Date() });
  const conflict = await tools.migrate({ source, target, apply: true });
  assert.deepEqual(conflict.conflicts.map((c) => c.key), ['one.png']);
  assert.equal(client.objects.get('pramaan/one.png').body.toString(), 'someone else');

  // a failing transfer and a copy that does not read back identically
  const flaky = new FakeS3();
  flaky.failPutFor = 'two.jpg';
  const partial = await tools.migrate({ source, target: storage.createS3Driver({ client: flaky, bucket: 'b' }), apply: true });
  assert.deepEqual(partial.failed.map((f) => f.key), ['two.jpg']);
  assert.match(partial.failed[0].error, /simulated network failure/);
  assert.equal(partial.copied.length, 2, 'the other files still go across');

  const corrupt = new FakeS3();
  corrupt.corruptOnPut = true;
  const bad = await tools.migrate({ source, target: storage.createS3Driver({ client: corrupt, bucket: 'b' }), apply: true });
  assert.equal(bad.failed.length, 3);
  assert.match(bad.failed[0].error, /did not read back identically/);
  assert.equal(corrupt.objects.size, 0, 'bad copies are removed from the target');

  assert.deepEqual(await snapshot(), sourceBefore, 'the source is exactly as it was');

  // and back again: S3 -> local
  const back = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-back-'));
  const restored = await tools.migrate({ source: target, target: storage.createLocalDriver(back), apply: true });
  assert.equal(restored.failed.length, 0);
  assert.ok(fs.readFileSync(path.join(back, 'two.jpg')).equals(files['two.jpg']));
});

test('command line: audit prints a report; migrate refuses without an S3 bucket', () => {
  const run = (...args) => spawnSync(process.execPath, ['src/storage/cli.js', ...args], { cwd: path.join(__dirname, '..'), env: { ...process.env, S3_BUCKET: '' }, encoding: 'utf8' });
  const audit = run('audit', '--json');
  assert.ok([0, 2].includes(audit.status), audit.stderr);
  const report = JSON.parse(audit.stdout);
  assert.equal(report.driver, 'local');
  assert.ok(Array.isArray(report.orphans) && Array.isArray(report.missing));
  const migrate = run('migrate', '--from=local', '--to=s3');
  assert.equal(migrate.status, 1);
  assert.match(migrate.stderr, /S3_BUCKET is not set/);
  const same = run('migrate', '--from=local', '--to=local');
  assert.equal(same.status, 1);
  assert.match(same.stderr, /two different drivers/);
});
