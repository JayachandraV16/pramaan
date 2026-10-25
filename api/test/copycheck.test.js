// Checkpoint 5: checking a PHYSICAL copy of a certificate (photograph, scan, scanned PDF).
// The text reader is replaced by a fake whose output each test controls, so the tests are about the
// decisions: what is read from the QR code, what is compared, and what may (not) be concluded.

const test = require('node:test');
const assert = require('node:assert/strict');

const QRCode = require('qrcode');
const { Jimp } = require('jimp');
const PDFDocument = require('pdfkit');

const h = require('./helpers');
const config = require('../src/config');
const ocr = require('../src/modules/nameplate/ocrEngine');
const { buildVerificationUrl } = require('../src/utils/qrGenerator');
const { createActors, runVerification, ok } = require('./workflow');
const copy = require('../src/modules/qr-auth/copyCheck');

let actors;
let cert;
let record; // instrument + dates for the printed text
let fakeText = '';

test.before(async () => {
  await h.start();
  actors = await createActors();
  const run = await runVerification(actors);
  cert = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: run.verification.id } }), 201, 'issue');
  const view = await ok(h.call('GET', `/api/qr-auth/${encodeURIComponent(cert.certificate_number)}`, {}), 200, 'registry view');
  record = view.certificate;
  ocr.setEngine(async () => ({ text: fakeText, confidence: 88, engine: 'fake-ocr 1.0' }));
});
test.after(async () => {
  ocr.setEngine(null);
  delete process.env.RATE_LIMIT_IN_TESTS;
  await ocr.shutdown();
  await h.stop();
});

const long = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const printedText = (over = {}) =>
  [
    'DEPARTMENT OF CONSUMER AFFAIRS',
    'CERTIFICATE OF VERIFICATION',
    `Certificate No: ${over.certificateNumber ?? cert.certificate_number}`,
    `INSTRUMENT   ${over.instrumentName ?? record.instrumentName}`,
    `MANUFACTURER   ${over.manufacturer ?? record.manufacturer ?? 'Acme'}`,
    `MODEL   ${over.model ?? record.model ?? 'A-1'}`,
    `SERIAL NO.   ${over.serialNumber ?? record.serialNumber}`,
    `VALID FROM   ${long(over.validFrom ?? record.validFrom)}`,
    `VALID UNTIL   ${long(over.validUntil ?? record.validUntil)}`,
  ].join('\n');

// a synthetic "photo" of a certificate: white page with a QR code (optionally none)
async function photo({ url = buildVerificationUrl(cert.qr_token, cert.certificate_number), withQr = true, jpeg = false, size = 900 } = {}) {
  const page = new Jimp({ width: 1100, height: 1000, color: 0xffffffff });
  if (withQr) {
    const qr = await Jimp.fromBuffer(await QRCode.toBuffer(url, { type: 'png', width: size > 600 ? 420 : 300, margin: 2, errorCorrectionLevel: 'M' }));
    page.composite(qr, 600, 450);
  }
  return page.getBuffer(jpeg ? 'image/jpeg' : 'image/png');
}

async function post(bytes, { name = 'copy.png', type = 'image/png', token } = {}) {
  const form = new FormData();
  if (bytes) form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${await h.start()}/api/qr-auth/check-copy`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const check = async (bytes, text, opts) => {
  fakeText = text;
  const res = await post(bytes, opts);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};

test('parser: reads the printed fields of a Pramaan certificate and invents nothing', () => {
  const p = copy.parseCertificateText(printedText());
  assert.equal(p.certificateNumber, cert.certificate_number);
  assert.equal(p.serialNumber, record.serialNumber);
  assert.equal(p.instrumentName, record.instrumentName);
  assert.equal(p.validFrom, record.validFrom);
  assert.equal(p.validUntil, record.validUntil);
  const empty = copy.parseCertificateText('lorem ipsum dolor sit amet');
  assert.ok(Object.values(empty).every((v) => v === null));
  assert.equal(copy.parseCertificateText('Certificate No: P R M - 26 - IND - 0000007 - K - 7QXM').certificateNumber, 'PRM-26-IND-0000007-K-7QXM', 'spaces from OCR are tolerated');
  assert.equal(copy.parseCertificateText('VALID FROM 5 Mar 2027').validFrom, '2027-03-05');
  assert.equal(copy.parseCertificateText('VALID FROM 31/12/2026').validFrom, '2026-12-31');
  assert.equal(copy.parseCertificateText('VALID FROM 45/45/2026').validFrom, null);
});

test('QR code and printed details agree: the registry record is reported, never "authentic"', async () => {
  const data = await check(await photo(), printedText());
  assert.equal(data.file.kind, 'IMAGE');
  assert.equal(data.qr.found, true);
  assert.equal(data.qr.usable, true);
  assert.equal(data.registry.result, 'VALID');
  assert.equal(data.registry.certificate.certificateNumber, cert.certificate_number);
  const status = Object.fromEntries(data.comparison.map((c) => [c.field, c.status]));
  assert.equal(status.certificateNumber, 'MATCH');
  assert.equal(status.serialNumber, 'MATCH');
  assert.equal(status.validUntil, 'MATCH');
  assert.equal(data.conclusion.code, 'REGISTRY_RECORD_AGREES');
  assert.equal(data.conclusion.level, 'INFO');
  assert.match(data.conclusion.text, /does not prove that this is the original paper/);
  assert.doesNotMatch(JSON.stringify(data), /is authentic|is genuine|authentic certificate/i, 'the checker never calls a paper authentic');
  assert.ok(data.limits.length >= 3 && data.limits.some((l) => /approximate/.test(l)) && data.limits.some((l) => /registry record is the authority/.test(l)));
  assert.equal(data.printed.engine, 'fake-ocr 1.0');

  // a JPEG photo works too
  const jpeg = await check(await photo({ jpeg: true }), printedText(), { name: 'copy.jpg', type: 'image/jpeg' });
  assert.equal(jpeg.conclusion.code, 'REGISTRY_RECORD_AGREES');

  // the scan is recorded like any public check, and the upload itself is not kept
  const { rows } = await h.pool.query("SELECT count(*)::int n FROM qr_authentications WHERE access_source = 'PUBLIC_COPY_CHECK'");
  assert.ok(rows[0].n >= 2);
});

test('a printed detail that differs from the registry is reported as a mismatch', async () => {
  const data = await check(await photo(), printedText({ serialNumber: 'ZZ-9999-FORGED', validUntil: '2099-01-01' }));
  assert.equal(data.conclusion.code, 'DETAILS_DISAGREE');
  assert.equal(data.conclusion.level, 'ALERT');
  const byField = Object.fromEntries(data.comparison.map((c) => [c.field, c]));
  assert.equal(byField.serialNumber.status, 'MISMATCH');
  assert.equal(byField.serialNumber.printed, 'ZZ-9999-FORGED');
  assert.equal(byField.serialNumber.registry, record.serialNumber);
  assert.equal(byField.validUntil.status, 'MISMATCH');
  assert.equal(byField.certificateNumber.status, 'MATCH');
  assert.match(data.conclusion.text, /serial number, valid until/);
});

test('QR found but the text could not be read: the record is shown, nothing is claimed about the paper', async () => {
  const data = await check(await photo(), 'smudged illegible');
  assert.equal(data.conclusion.code, 'REGISTRY_RECORD_FOUND');
  assert.ok(data.comparison.every((c) => c.status === 'NOT_READ'));

  // and when the text reader is not available at all
  ocr.setEngine(null);
  const flag = config.ocr.enabled;
  config.ocr.enabled = false;
  try {
    const res = await post(await photo());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.printed.attempted, false);
    assert.equal(res.body.data.conclusion.code, 'REGISTRY_RECORD_FOUND');
    assert.match(res.body.data.conclusion.text, /not compared/);
  } finally {
    config.ocr.enabled = flag;
    ocr.setEngine(async () => ({ text: fakeText, confidence: 88, engine: 'fake-ocr 1.0' }));
  }
});

test('no QR code: text alone can never give more than a warning', async () => {
  const data = await check(await photo({ withQr: false }), printedText());
  assert.equal(data.qr.found, false);
  assert.equal(data.registry.certificate.certificateNumber, cert.certificate_number, 'the number read from the paper is looked up');
  assert.equal(data.conclusion.code, 'NUMBER_IN_REGISTRY_NO_QR');
  assert.equal(data.conclusion.level, 'WARN');
  assert.match(data.conclusion.text, /cannot prove authenticity/);

  const nothing = await check(await photo({ withQr: false }), 'a photo of a shop counter');
  assert.equal(nothing.conclusion.code, 'NOTHING_READABLE');
  assert.equal(nothing.registry, null);
});

test('numbers read from the paper that cannot have been issued are called out', async () => {
  const blank = await photo({ withQr: false });
  const [prm, yy, off, seq, chk, tag] = (await ok(h.call('GET', `/api/qr-auth/${encodeURIComponent(cert.certificate_number)}`, {}), 200, 'x')).certificate.certificateNumber.split('-');
  if (prm === 'PRM') {
    const typo = await check(blank, printedText({ certificateNumber: [prm, yy, off, seq.slice(0, 6) + ((Number(seq[6]) + 1) % 10), chk, tag].join('-') }));
    assert.equal(typo.conclusion.code, 'NUMBER_TYPO');
    const forged = await check(blank, printedText({ certificateNumber: [prm, yy, off, seq, chk, 'ZZZZ'].join('-') }));
    assert.equal(forged.conclusion.code, 'NUMBER_NOT_ISSUED');
  }
  const cid = require('../src/utils/certificateId');
  const unissued = await check(blank, printedText({ certificateNumber: cid.build({ year: 2026, office: 'IND', sequence: 4242 }) }));
  assert.equal(unissued.conclusion.code, 'NOT_IN_REGISTRY');
  assert.equal(unissued.conclusion.level, 'ALERT');
  const legacyUnissued = await check(blank, printedText({ certificateNumber: 'CERT-2026-987654' }));
  assert.equal(legacyUnissued.conclusion.code, 'NOT_IN_REGISTRY');
});

test('a QR code that leads to another website is flagged and never used', async () => {
  const evil = `https://evil.example/verify-public?q=${cert.qr_token}&s=whatever`;
  const data = await check(await photo({ url: evil }), 'no certificate number can be read here');
  assert.equal(data.qr.found, true);
  assert.equal(data.qr.usable, false);
  assert.equal(data.qr.reason, 'FOREIGN_HOST');
  assert.equal(data.qr.host, 'evil.example');
  assert.equal(data.conclusion.code, 'QR_POINTS_ELSEWHERE');
  assert.equal(data.conclusion.level, 'ALERT');
  assert.equal(data.registry, null, 'the foreign link is not followed or trusted');
  // even when the printed number is a real one, the hostile QR code decides the conclusion
  const withNumber = await check(await photo({ url: evil }), printedText());
  assert.equal(withNumber.conclusion.code, 'QR_POINTS_ELSEWHERE');
  assert.equal(withNumber.conclusion.level, 'ALERT');

  const text = await check(await photo({ url: 'WIFI:T:WPA;S:cafe;P:pass;;' }), 'nothing');
  assert.equal(text.qr.found, true);
  assert.equal(text.qr.reason, 'NOT_A_LINK');
  assert.equal(text.conclusion.code, 'NOTHING_READABLE');
});

test('an edited QR link is reported as tampering; a revoked certificate as revoked', async () => {
  const good = new URL(buildVerificationUrl(cert.qr_token, cert.certificate_number));
  good.searchParams.set('s', '0'.repeat(32));
  const tampered = await check(await photo({ url: good.toString() }), printedText());
  assert.equal(tampered.conclusion.code, 'TAMPER_SIGNALS');
  assert.equal(tampered.conclusion.level, 'ALERT');

  const run = await runVerification(actors);
  const second = await ok(h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: run.verification.id } }), 201, 'second');
  await ok(h.call('PATCH', `/api/certificates/${second.id}/status`, { token: actors.admin.token, body: { status: 'REVOKED', reason: 'Seal found broken at spot check' } }), 200, 'revoke');
  const revoked = await check(await photo({ url: buildVerificationUrl(second.qr_token, second.certificate_number) }), printedText({ certificateNumber: second.certificate_number }));
  assert.equal(revoked.conclusion.code === 'DETAILS_DISAGREE' || revoked.conclusion.code === 'REGISTRY_REVOKED', true);
  assert.equal(revoked.registry.result, 'REVOKED');
  assert.equal(revoked.conclusion.level, 'ALERT');
});

test('PDFs: the exact issued file is recognised, an edited one is not, a scan inside a PDF is read like a photo', async () => {
  const issued = await ok(h.call('GET', `/api/certificates/${cert.id}`, { token: actors.admin.token }), 200, 'detail');
  const file = Buffer.from(await (await fetch(`${await h.start()}${issued.certificate_file_url}`)).arrayBuffer());

  const exact = await check(file, '', { name: 'cert.pdf', type: 'application/pdf' });
  assert.equal(exact.file.kind, 'PDF');
  assert.equal(exact.exactFile.matches, true);
  assert.equal(exact.exactFile.certificateNumber, cert.certificate_number);
  assert.equal(exact.conclusion.code, 'EXACT_FILE_ISSUED');
  assert.match(exact.conclusion.text, /identical file can also be a copy/);

  const edited = Buffer.concat([file, Buffer.from('\n% appended\n')]);
  const notExact = await check(edited, '', { name: 'cert.pdf', type: 'application/pdf' });
  assert.equal(notExact.exactFile.matches, false);
  assert.equal(notExact.conclusion.code, 'NOTHING_READABLE');
  assert.match(notExact.conclusion.text, /not a file issued by Pramaan/);

  // a typical scanner output: a PDF whose page is one JPEG picture of the paper
  const jpeg = await photo({ jpeg: true });
  const scan = await new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.image(jpeg, 0, 0, { width: 595 });
    doc.end();
  });
  const scanned = await check(scan, printedText(), { name: 'scan.pdf', type: 'application/pdf' });
  assert.equal(scanned.exactFile.matches, false);
  assert.equal(scanned.qr.found, true);
  assert.equal(scanned.conclusion.code, 'REGISTRY_RECORD_AGREES');
});

test('input rules: only JPG, PNG or PDF; damaged pictures are a 400; nothing is stored', async () => {
  const attachmentsBefore = (await h.pool.query('SELECT count(*)::int n FROM attachments')).rows[0].n;
  assert.equal((await post(null)).status, 400, 'no file');
  assert.equal((await post(Buffer.from('plain text'), { name: 'a.txt', type: 'text/plain' })).status, 400);
  const damaged = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGF5CsEAJT8Af/Tz+cvAAAAAElFTkSuQmCC', 'base64');
  const bad = await post(damaged);
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  assert.match(bad.body.message, /damaged/);
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM attachments')).rows[0].n, attachmentsBefore);
  // no sign-in needed (public)
  fakeText = printedText();
  assert.equal((await post(await photo())).status, 200);
});

test('rate limits: a handful of checks per minute per address', async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    const bytes = await photo();
    fakeText = printedText();
    const statuses = [];
    for (let i = 0; i < 8; i += 1) statuses.push((await post(bytes)).status);
    assert.deepEqual(statuses.slice(0, 6), [200, 200, 200, 200, 200, 200]);
    assert.ok(statuses.slice(6).every((s) => s === 429), `after six checks in a minute: ${statuses.join(',')}`);
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
});
