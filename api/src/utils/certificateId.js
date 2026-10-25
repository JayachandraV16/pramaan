// api/src/utils/certificateId.js
//
// Certificate numbers.
//
//   legacy   CERT-2026-000123                 (kept valid forever; issued by default until v2 is switched on)
//   v2       PRM-26-IND-0000123-K-7QXM
//            |   |  |   |       | |
//            |   |  |   |       | +-- tag: 4 characters of an HMAC-SHA256 over the rest, keyed with INTEGRITY_SECRET
//            |   |  |   |       +---- check character: ISO 7064 MOD 37,36 over "26IND0000123"
//            |   |  |   +------------ serial, counted per year and office
//            |   |  +---------------- issuing office (CERT_OFFICE_CODE, three letters)
//            |   +------------------- year
//            +----------------------- Pramaan
//
// What each part is for (and what it is not):
//   * The check character catches typing and reading mistakes: every single wrong character and
//     every swap of two neighbouring characters is detected. It is not secret.
//   * The tag is a keyed value that only this server can produce. It makes an invented number
//     fail before the database is even asked, and stops a person from guessing the next number from
//     the one on their own certificate. Four characters are 20 bits: it is a guard against guessing and
//     typing, NOT proof of authenticity. A certificate is authentic only if the registry holds it
//     (and its QR signature and record fingerprint agree).

const config = require('../config');
const { hmacHex } = require('./integrity');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 36 characters for MOD 37,36
const TAG_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 characters, no I L O U
const TAG_LENGTH = 4;

const V2_PATTERN = /^PRM-(\d{2})-([A-Z]{3})-(\d{7})-([0-9A-Z])-([0-9A-Z]{4})$/;
const LEGACY_PATTERN = /^CERT-\d{4}-\d{3,}$/;

// ---- ISO 7064 MOD 37,36 (hybrid system, alphanumeric) ----------------------

const valueOf = (ch) => ALPHABET.indexOf(ch);

function runMod3736(text) {
  let p = 36;
  for (const ch of text) {
    const v = valueOf(ch);
    if (v < 0) throw new Error(`Character "${ch}" is not allowed in a certificate number`);
    let s = (p + v) % 36;
    if (s === 0) s = 36;
    p = (s * 2) % 37;
  }
  return p;
}

/** The check character for `body` (digits and capital letters). */
function checkCharacter(body) {
  const p = runMod3736(body);
  return ALPHABET[(((19 - p) % 36) + 36) % 36];
}

/** True when `bodyWithCheck` (body followed by its check character) is consistent. */
function checkIsValid(bodyWithCheck) {
  try {
    return runMod3736(bodyWithCheck) === 1;
  } catch {
    return false;
  }
}

// ---- keyed tag -------------------------------------------------------------

function tagFor(bodyWithCheck, secret) {
  const digest = hmacHex(`certid|${bodyWithCheck}`, secret); // hex
  let bits = BigInt('0x' + digest.slice(0, 8)); // 32 bits is plenty for 20
  let out = '';
  for (let i = 0; i < TAG_LENGTH; i += 1) {
    out = TAG_ALPHABET[Number(bits & 31n)] + out;
    bits >>= 5n;
  }
  return out;
}

// ---- building and reading ---------------------------------------------------

function build({ year, office, sequence, secret = config.integritySecret }) {
  const yy = String(year % 100).padStart(2, '0');
  if (!/^[A-Z]{3}$/.test(office)) throw new Error('The office code must be three capital letters');
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999999) throw new Error('Certificate serial out of range (1 to 9,999,999 per year and office)');
  const body = `${yy}${office}${String(sequence).padStart(7, '0')}`;
  const check = checkCharacter(body);
  const tag = tagFor(`${body}${check}`, secret);
  return `PRM-${yy}-${office}-${String(sequence).padStart(7, '0')}-${check}-${tag}`;
}

/**
 * Looks at a typed or scanned number without touching the database.
 * @returns {{ scheme: 'legacy'|'v2'|null, valid: boolean, reason: null|'FORMAT'|'CHECK_CHARACTER'|'TAG', normalised: string|null }}
 */
function inspect(value, secret = config.integritySecret) {
  const text = String(value || '').trim().toUpperCase();
  if (LEGACY_PATTERN.test(text)) return { scheme: 'legacy', valid: true, reason: null, normalised: text };
  const m = V2_PATTERN.exec(text);
  if (!m) return { scheme: null, valid: false, reason: 'FORMAT', normalised: null };
  const [, yy, office, seq, check, tag] = m;
  const body = `${yy}${office}${seq}`;
  if (!checkIsValid(`${body}${check}`)) return { scheme: 'v2', valid: false, reason: 'CHECK_CHARACTER', normalised: text };
  if (tagFor(`${body}${check}`, secret) !== tag) return { scheme: 'v2', valid: false, reason: 'TAG', normalised: text };
  return { scheme: 'v2', valid: true, reason: null, normalised: text };
}

const looksLikeCertificateNumber = (value) => LEGACY_PATTERN.test(String(value || '').trim().toUpperCase()) || V2_PATTERN.test(String(value || '').trim().toUpperCase());

// ---- the next number (inside the issuing transaction) ----------------------

async function nextLegacy(client, year) {
  const { rows } = await client.query(
    `INSERT INTO certificate_number_counters (year, last_sequence)
     VALUES ($1, 1)
     ON CONFLICT (year)
     DO UPDATE SET last_sequence = certificate_number_counters.last_sequence + 1
     RETURNING last_sequence`,
    [year]
  );
  return `CERT-${year}-${String(rows[0].last_sequence).padStart(6, '0')}`;
}

async function nextV2(client, year, office) {
  const { rows } = await client.query(
    `INSERT INTO certificate_id_counters (year, office_code, last_sequence)
     VALUES ($1, $2, 1)
     ON CONFLICT (year, office_code)
     DO UPDATE SET last_sequence = certificate_id_counters.last_sequence + 1
     RETURNING last_sequence`,
    [year, office]
  );
  return build({ year, office, sequence: rows[0].last_sequence });
}

/** Next certificate number under the configured scheme (CERT_ID_SCHEME). Call inside the issuing transaction. */
async function nextCertificateNumber(client, year, { scheme = config.certificateIds.scheme, office = config.certificateIds.officeCode } = {}) {
  return scheme === 'v2' ? nextV2(client, year, office) : nextLegacy(client, year);
}

module.exports = { build, inspect, checkCharacter, checkIsValid, tagFor, looksLikeCertificateNumber, nextCertificateNumber, V2_PATTERN, LEGACY_PATTERN };
