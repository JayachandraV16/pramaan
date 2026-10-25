// Phase 5: object storage (local and S3-compatible drivers) and signed file serving.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const h = require('./helpers');
const { createActors, runVerification, ok } = require('./workflow');
const config = require('../src/config');
const storage = require('../src/utils/storage');
const { sha256Hex } = require('../src/utils/integrity');

// Minimal in-memory S3: understands the three commands the driver sends.
class FakeS3 {
  constructor() {
    this.objects = new Map();
    this.sent = [];
  }
  async send(command) {
    const name = command.constructor.name;
    const input = command.input;
    this.sent.push({ name, input });
    if (name === 'PutObjectCommand') {
      this.objects.set(input.Key, { body: Buffer.from(input.Body), type: input.ContentType });
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
    throw new Error(`unexpected command ${name}`);
  }
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

test('keys: only plain relative paths are accepted', () => {
  for (const ok of ['a.png', 'certificates/CERT-2026-000001.pdf', '1700000-ab12.jpg']) assert.equal(storage.assertKey(ok), ok);
  for (const bad of ['', '../x.png', 'a/../b.png', '/etc/passwd', 'a//b.png', '.hidden', 'a/.b', 'a\\b.png', 'x'.repeat(301), null, 42]) {
    assert.throws(() => storage.assertKey(bad), /Invalid storage key/, String(bad));
  }
  assert.equal(storage.contentTypeFor('x.PDF'), 'application/pdf');
  assert.equal(storage.contentTypeFor('x.bin'), 'application/octet-stream');
});

test('local driver stores, streams and removes; traversal is impossible', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-store-'));
  const driver = storage.createLocalDriver(root);
  try {
    await driver.put('certificates/a.pdf', Buffer.from('%PDF-1 hello'));
    const file = await driver.open('certificates/a.pdf');
    assert.equal(file.size, 12);
    const chunks = [];
    for await (const c of file.stream) chunks.push(c);
    assert.equal(Buffer.concat(chunks).toString(), '%PDF-1 hello');

    const src = path.join(root, 'staged.png');
    fs.writeFileSync(src, 'png-bytes');
    await driver.put('moved.png', src); // from a file path
    assert.equal(fs.readFileSync(path.join(root, 'moved.png'), 'utf8'), 'png-bytes');

    assert.equal(await driver.open('nope.pdf'), null);
    await driver.remove('certificates/a.pdf');
    await driver.remove('certificates/a.pdf'); // already gone: fine
    assert.equal(await driver.open('certificates/a.pdf'), null);
    await assert.rejects(driver.put('../escape.txt', Buffer.from('x')), /Invalid storage key/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('S3 driver sends the right commands (bucket, prefixed key, content type, encryption)', async () => {
  const client = new FakeS3();
  const driver = storage.createS3Driver({ client, bucket: 'pramaan-prod', prefix: 'files/', serverSideEncryption: 'AES256' });
  await driver.put('certificates/c.pdf', Buffer.from('%PDF-1'));
  const put = client.sent[0];
  assert.equal(put.name, 'PutObjectCommand');
  assert.deepEqual(
    { Bucket: put.input.Bucket, Key: put.input.Key, ContentType: put.input.ContentType, ServerSideEncryption: put.input.ServerSideEncryption },
    { Bucket: 'pramaan-prod', Key: 'files/certificates/c.pdf', ContentType: 'application/pdf', ServerSideEncryption: 'AES256' }
  );

  const got = await driver.open('certificates/c.pdf');
  assert.equal(got.size, 6);
  assert.equal(await driver.open('certificates/none.pdf'), null);
  await driver.remove('certificates/c.pdf');
  assert.equal(client.objects.size, 0);
  await assert.rejects(driver.put('../x', Buffer.from('x')), /Invalid storage key/);
});

test('with the S3 driver: certificates and uploads go to the bucket and are served by signed links only', async () => {
  const client = new FakeS3();
  const previousDriver = config.storage.driver;
  storage.setDriver(storage.createS3Driver({ client, bucket: 'b' }));
  config.storage.driver = 's3';
  try {
    // certificate PDF
    const flow = await runVerification(actors);
    const cert = await ok(
      h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
      201,
      'issue certificate'
    );
    const key = `certificates/${cert.certificate_number}.pdf`;
    assert.ok(client.objects.has(key), 'PDF is in the bucket');
    assert.equal(fs.existsSync(path.join(config.uploadDir, key)), false, 'and not on local disk');
    const stored = client.objects.get(key).body;
    assert.equal(sha256Hex(stored), cert.pdf_sha256);

    // served through the signed link
    const detail = await ok(h.call('GET', `/api/certificates/${cert.id}`, { token: actors.owner.token }), 200, 'detail');
    const link = detail.certificate_file_url;
    assert.ok(link, 'certificate has a signed link');
    const res = await fetch(`${await h.start()}${link}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), stored);

    // no signature, tampered signature, traversal, unknown file
    const base = await h.start();
    assert.equal((await fetch(`${base}/uploads/${key}`)).status, 403);
    assert.equal((await fetch(`${base}${link.replace(/sig=[^&]+/, 'sig=deadbeef')}`)).status, 403);
    assert.equal((await fetch(`${base}/uploads/..%2f..%2fpackage.json`)).status, 403);

    // evidence upload (staged in a temp dir, verified, then moved to the bucket)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('file', new Blob([png]), 'seal.png');
    form.append('category', 'PHOTOGRAPH');
    form.append('verificationId', flow.verification.id);
    const up = await fetch(`${base}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${actors.lmo.token}` }, body: form });
    assert.equal(up.status, 201, await up.clone().text());
    const attachment = (await up.json()).data;
    const attachmentKey = attachment.file_url.replace(/^\/uploads\//, '').split('?')[0];
    assert.ok(client.objects.has(attachmentKey), 'evidence is in the bucket');
    assert.equal(sha256Hex(client.objects.get(attachmentKey).body), sha256Hex(png));
    assert.equal(fs.existsSync(path.join(config.uploadDir, attachmentKey)), false);
    const staged = fs.readdirSync(os.tmpdir()).filter((f) => f === attachmentKey);
    assert.equal(staged.length, 0, 'temporary copy is removed');
  } finally {
    config.storage.driver = previousDriver;
    storage.setDriver(null);
  }
});

test('with the local driver nothing changes: PDFs land under the upload directory', async () => {
  const flow = await runVerification(actors);
  const cert = await ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
    201,
    'issue certificate'
  );
  assert.equal(storage.driverName(), 'local');
  assert.ok(fs.existsSync(path.join(config.uploadDir, 'certificates', `${cert.certificate_number}.pdf`)));
});
