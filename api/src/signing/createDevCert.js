// DEVELOPMENT ONLY: creates a self-signed signing identity (PKCS#12) so signed
// certificate PDFs can be tried locally.
//
//   npm run signing:dev-cert
//
// Writes api/signing/dev-signing.p12 (git-ignored) and prints the two env lines to
// put in api/.env. A self-signed key proves nothing to a third party: use a
// Digital Signature Certificate from a licensed CA in production.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

const dir = path.join(__dirname, '..', '..', 'signing');
const file = path.join(dir, 'dev-signing.p12');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to create a development signing key when NODE_ENV=production');
  process.exit(1);
}
if (fs.existsSync(file) && !process.argv.includes('--force')) {
  console.error(`${file} already exists (use --force to replace it; certificates signed with the old key stay valid).`);
  process.exit(1);
}

const passphrase = crypto.randomBytes(12).toString('hex');
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = crypto.randomBytes(8).toString('hex');
cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000);
const subject = [
  { name: 'commonName', value: 'Pramaan Development Signer' },
  { name: 'organizationName', value: 'Pramaan (development only)' },
  { name: 'countryName', value: 'IN' },
];
cert.setSubject(subject);
cert.setIssuer(subject);
cert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
]);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12 = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' })).getBytes();
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, Buffer.from(p12, 'binary'), { mode: 0o600 });

console.log(`Created ${file}\n\nAdd to api/.env:\nSIGNING_P12_PATH=${file}\nSIGNING_P12_PASSPHRASE="${passphrase}"\n`);
