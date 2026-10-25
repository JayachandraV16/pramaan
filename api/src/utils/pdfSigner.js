// api/src/utils/pdfSigner.js
//
// Digital signature on the certificate PDF (PKCS#7 / CMS detached signature,
// the signature type Adobe Reader and other PDF viewers validate), plus an
// independent verifier that checks a PDF's embedded signature without trusting
// the database.
//
// Configure with SIGNING_P12_PATH + SIGNING_P12_PASSPHRASE (a PKCS#12 file
// holding the department's signing key and certificate). For development run
// `npm run signing:dev-cert` to create a self-signed one. A self-signed key is
// NOT legally valid: production needs a Digital Signature Certificate issued by
// a licensed Certifying Authority (e.g. eMudhra, Sify) under the IT Act, ideally
// kept in an HSM. Out of scope here: PAdES profiles (CAdES attributes), trusted
// timestamps (RFC 3161) and long-term validation.

const fs = require('fs');
const crypto = require('crypto');
const forge = require('node-forge');
const { SignPdf } = require('@signpdf/signpdf');
const { plainAddPlaceholder } = require('@signpdf/placeholder-plain');
const { P12Signer } = require('@signpdf/signer-p12');
const { extractSignature } = require('@signpdf/utils');

const config = require('../config');

const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const DIGESTS = {
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
  '1.3.14.3.2.26': 'sha1',
};
const SIGNATURE_PLACEHOLDER_BYTES = 8192;

let cached = null; // { path, p12, passphrase, info }

const dn = (attrs) => attrs.map((a) => `${a.shortName || a.name}=${a.value}`).join(', ');
const certFingerprint = (cert) => crypto.createHash('sha256').update(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary')).digest('hex');

function describeCertificate(cert) {
  const subject = dn(cert.subject.attributes);
  const issuer = dn(cert.issuer.attributes);
  return { subject, issuer, selfSigned: subject === issuer, fingerprint: certFingerprint(cert), notAfter: cert.validity.notAfter };
}

function loadIdentity() {
  const { p12Path, passphrase } = config.signing;
  if (!p12Path) return null;
  if (cached && cached.path === p12Path) return cached;
  const p12 = fs.readFileSync(p12Path);
  const parsed = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12.toString('binary')), passphrase);
  const bag = (parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])[0];
  if (!bag) throw new Error('The signing PKCS#12 file contains no certificate');
  cached = { path: p12Path, p12, passphrase, info: describeCertificate(bag.cert) };
  return cached;
}

const isConfigured = () => !!config.signing.p12Path;

// Returns { pdf, info } - info is what gets stored with the certificate.
async function signPdf(pdfBuffer) {
  const identity = loadIdentity();
  if (!identity) return null;
  const { reason, location, contactInfo, signerName } = config.signing;
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer, reason, location, contactInfo, name: signerName, signatureLength: SIGNATURE_PLACEHOLDER_BYTES,
  });
  const signed = await new SignPdf().sign(withPlaceholder, new P12Signer(identity.p12, { passphrase: identity.passphrase }));
  return { pdf: signed, info: { subject: identity.info.subject, fingerprint: identity.info.fingerprint, selfSigned: identity.info.selfSigned, signedAt: new Date() } };
}

// Checks the first embedded signature of a PDF.
//   signed              the file carries a signature
//   valid               document digest matches AND the RSA signature verifies
//   coversWholeFile     nothing was appended after signing
//   chainTrusted        always null here: no CA trust store is evaluated
function verifyPdfSignature(pdfBuffer) {
  let extracted;
  try {
    extracted = extractSignature(pdfBuffer);
  } catch {
    return { signed: false };
  }

  try {
    // @signpdf/utils returns the raw DER as a binary string (older versions: hex).
    const sig = extracted.signature;
    const der = /^[0-9a-f]+$/i.test(sig) && sig.length % 2 === 0 ? Buffer.from(sig, 'hex') : Buffer.from(sig, 'binary');
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(der.toString('binary')), { strict: false }));
    const cert = p7.certificates && p7.certificates[0];
    const raw = p7.rawCapture;
    if (!cert || !raw || !raw.authenticatedAttributes) return { signed: true, valid: false, reason: 'Unsupported signature structure' };

    const algorithm = DIGESTS[forge.asn1.derToOid(raw.digestAlgorithm)];
    if (!algorithm) return { signed: true, valid: false, reason: 'Unsupported digest algorithm' };

    // 1. the signed attributes must carry the digest of the byte ranges
    let messageDigest = null;
    let signingTime = null;
    for (const attr of raw.authenticatedAttributes) {
      const oid = forge.asn1.derToOid(attr.value[0].value);
      if (oid === OID_MESSAGE_DIGEST) messageDigest = Buffer.from(attr.value[1].value[0].value, 'binary');
      if (oid === OID_SIGNING_TIME) {
        const t = attr.value[1].value[0];
        signingTime = t.type === forge.asn1.Type.UTCTIME ? forge.asn1.utcTimeToDate(t.value) : forge.asn1.generalizedTimeToDate(t.value);
      }
    }
    const documentDigest = crypto.createHash(algorithm).update(extracted.signedData).digest();
    const digestMatches = !!messageDigest && messageDigest.equals(documentDigest);

    // 2. the signature is over the DER of the signed attributes (as a SET)
    const attrSet = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, raw.authenticatedAttributes);
    const md = forge.md[algorithm].create();
    md.update(forge.asn1.toDer(attrSet).getBytes());
    let signatureOk = false;
    try {
      signatureOk = cert.publicKey.verify(md.digest().getBytes(), raw.signature);
    } catch {
      signatureOk = false;
    }

    const lastCovered = extracted.ByteRange[2] + extracted.ByteRange[3];
    return {
      signed: true,
      valid: digestMatches && signatureOk,
      digestMatches,
      coversWholeFile: lastCovered === pdfBuffer.length,
      ...describeCertificate(cert),
      signedAt: signingTime,
      chainTrusted: null,
    };
  } catch (err) {
    return { signed: true, valid: false, reason: `Could not read the signature: ${err.message}` };
  }
}

module.exports = { isConfigured, signPdf, verifyPdfSignature };
