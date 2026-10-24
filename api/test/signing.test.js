// Phase 5: digitally signed certificate PDFs and independent signature verification.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');

const h = require('./helpers');
const { createActors, runVerification, ok } = require('./workflow');
const config = require('../src/config');
const { sha256Hex } = require('../src/utils/integrity');
const { verifyPdfSignature, isConfigured } = require('../src/utils/pdfSigner');

let actors;
let dir;
const original = { ...config.signing };

// Throw-away self-signed identity (what `npm run signing:dev-cert` creates).
function makeIdentity(commonName) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0a1b';
  cert.validity.notBefore = new Date(Date.now() - 60000);
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const subject = [{ name: 'commonName', value: commonName }, { name: 'organizationName', value: 'Pramaan Test' }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' })).getBytes();
  const file = path.join(dir, `${commonName.replace(/\W/g, '')}.p12`);
  fs.writeFileSync(file, Buffer.from(der, 'binary'));
  return file;
}

test.before(async () => {
  await h.start();
  actors = await createActors();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-sign-'));
});
test.after(async () => {
  Object.assign(config.signing, original);
  fs.rmSync(dir, { recursive: true, force: true });
  await h.stop();
});

async function issue() {
  const flow = await runVerification(actors);
  return ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
    201,
    'issue certificate'
  );
}
const storedPdf = (cert) => fs.readFileSync(path.join(config.uploadDir, 'certificates', `${cert.certificate_number}.pdf`));

test('without a signing identity the PDF is issued unsigned and says so', async () => {
  config.signing.p12Path = '';
  assert.equal(isConfigured(), false);
  const cert = await issue();
  assert.equal(cert.pdf_signed, false);
  assert.equal(cert.signature_subject, null);
  assert.deepEqual(verifyPdfSignature(storedPdf(cert)), { signed: false });
});

test('with an identity the issued PDF is signed, hashed as signed, and verifies on its own', async () => {
  config.signing.p12Path = makeIdentity('Pramaan Test Signer');
  config.signing.passphrase = 'pw';
  assert.equal(isConfigured(), true);

  const cert = await issue();
  assert.equal(cert.pdf_signed, true);
  assert.match(cert.signature_subject, /Pramaan Test Signer/);
  assert.match(cert.signature_fingerprint, /^[0-9a-f]{64}$/);
  assert.ok(cert.signed_at);

  const pdf = storedPdf(cert);
  assert.equal(sha256Hex(pdf), cert.pdf_sha256, 'stored hash is of the signed file');
  assert.match(pdf.toString('latin1'), /NotoSansDevanagari/, 'the bilingual PDF is what gets signed');

  const sig = verifyPdfSignature(pdf);
  assert.equal(sig.signed, true);
  assert.equal(sig.valid, true);
  assert.equal(sig.digestMatches, true);
  assert.equal(sig.coversWholeFile, true);
  assert.match(sig.subject, /Pramaan Test Signer/);
  assert.equal(sig.selfSigned, true);
  assert.equal(sig.chainTrusted, null, 'no CA trust store is evaluated');
  assert.ok(sig.signedAt instanceof Date);
});

test('tampering with the signed document is detected; appended content is flagged', async () => {
  config.signing.p12Path = makeIdentity('Pramaan Test Signer');
  config.signing.passphrase = 'pw';
  const cert = await issue();
  const pdf = storedPdf(cert);

  const edited = Buffer.from(pdf);
  edited[200] = edited[200] ^ 0xff; // flip a byte inside the signed range
  const bad = verifyPdfSignature(edited);
  assert.equal(bad.signed, true);
  assert.equal(bad.valid, false);
  assert.equal(bad.digestMatches, false);

  const appended = Buffer.concat([pdf, Buffer.from('\n% extra revision\n')]);
  const later = verifyPdfSignature(appended);
  assert.equal(later.valid, true, 'the original signed bytes are still intact');
  assert.equal(later.coversWholeFile, false, 'but the file has content the signature does not cover');

  assert.deepEqual(verifyPdfSignature(Buffer.from('%PDF-1.4\nnot signed\n%%EOF')), { signed: false });
});

test('public verification reports the signature, by certificate and by uploaded file', async () => {
  config.signing.p12Path = makeIdentity('Pramaan Test Signer');
  config.signing.passphrase = 'pw';
  const cert = await issue();

  const byNumber = await ok(h.call('GET', `/api/qr-auth/${cert.certificate_number}`), 200, 'public lookup');
  assert.equal(byNumber.integrity.pdfSigned, true);
  assert.match(byNumber.integrity.signerSubject, /Pramaan Test Signer/);

  const check = async (buffer) => {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'certificate.pdf');
    const res = await fetch(`${await h.start()}/api/qr-auth/check-document`, { method: 'POST', body: form });
    assert.equal(res.status, 200, await res.clone().text());
    return (await res.json()).data;
  };

  const genuine = await check(storedPdf(cert));
  assert.equal(genuine.matches, true);
  assert.equal(genuine.signature.valid, true);

  const forged = Buffer.from(storedPdf(cert));
  forged[300] = forged[300] ^ 0x55;
  const fake = await check(forged);
  assert.equal(fake.matches, false);
  assert.equal(fake.signature.signed, true);
  assert.equal(fake.signature.valid, false);
});

test('signature details are write-once in the database', async () => {
  config.signing.p12Path = makeIdentity('Pramaan Test Signer');
  config.signing.passphrase = 'pw';
  const cert = await issue();
  await assert.rejects(h.pool.query('UPDATE verification_certificates SET pdf_signed = false WHERE id = $1', [cert.id]), /write-once/);
  await assert.rejects(h.pool.query("UPDATE verification_certificates SET signature_subject = 'forged' WHERE id = $1", [cert.id]), /write-once/);
});
