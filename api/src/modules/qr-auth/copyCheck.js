// api/src/modules/qr-auth/copyCheck.js
//
// Public check of a PHYSICAL certificate copy: a photograph, a scan, or a scanned PDF.
//
//   1. exact file      a PDF that is byte-for-byte one Pramaan issued is recognised by its SHA-256
//   2. QR code         the picture is searched for a QR code (jsQR); the link inside is only PARSED,
//                      never fetched, and must point at this portal; the record it names is looked up
//                      with the normal public verification (signature, record fingerprint, status)
//   3. printed text    local OCR reads the certificate number, instrument, serial number and dates;
//                      they are compared one by one with the registry record
//
// What the result means (and does not):
//   * The REGISTRY is the authority. This check never says "authentic". It says what the registry
//     holds and whether the printed details agree with it.
//   * OCR is approximate. A match from text alone proves nothing; a mismatch may be a misreading.
//   * A copy of a genuine certificate looks the same as the original: agreement shows the paper is
//     consistent with the record, not that it is the original paper.
// The uploaded file is processed in memory and not stored.

const ApiError = require('../../utils/ApiError');
const { sha256Hex } = require('../../utils/integrity');
const { verifyPdfSignature } = require('../../utils/pdfSigner');
const { decodeImage } = require('../../utils/imageTools');
const certificateId = require('../../utils/certificateId');
const config = require('../../config');
const ocr = require('../nameplate/ocrEngine');
const { compareText } = require('../nameplate/nameplate.compare');
const repo = require('./qr-auth.repository');
const service = require('./qr-auth.service');

const MAX_CONCURRENT = 3; // the OCR engine works one image at a time; do not let a queue build up
let inFlight = 0;

const LIMITS = [
  'Text read from a photograph is approximate: a match is not proof, and a difference may be a reading mistake.',
  'Pramaan never decides authenticity from a photograph. The registry record is the authority.',
  'A copy of a genuine certificate looks exactly like the original. Agreement with the record does not show that this is the original paper.',
];

// ---------------------------------------------------------------- printed text

const MONTHS = { JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12 };

function isoDate(day, monthName, year) {
  const m = MONTHS[String(monthName).toUpperCase()] || MONTHS[Object.keys(MONTHS).find((k) => k.startsWith(String(monthName).toUpperCase().slice(0, 3)) && String(monthName).length >= 3)];
  const d = Number(day);
  const y = Number(year);
  if (!m || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function findDate(text, label) {
  const re = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d{1,2})\\s+([A-Za-z]{3,9})\\.?,?\\s+(\\d{4})`, 'i');
  const m = re.exec(text);
  if (m) return isoDate(m[1], m[2], m[3]);
  const numeric = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})`, 'i').exec(text);
  if (numeric) {
    const iso = `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
    return Number(numeric[2]) >= 1 && Number(numeric[2]) <= 12 ? iso : null;
  }
  return null;
}

function lineAfter(text, labelPattern) {
  const m = new RegExp(`${labelPattern}[ \\t]*[:\\-]?[ \\t]*([^\\n]+)`, 'i').exec(text);
  if (!m) return null;
  const value = m[1].replace(/\s{2,}.*/, '').trim(); // stop at a wide gap (the next column)
  return value.length >= 1 && value.length <= 80 ? value : null;
}

/** Fields printed on a Pramaan certificate, as read by OCR. Nothing is invented: a field that is not found is null. */
function parseCertificateText(raw) {
  const text = String(raw || '').replace(/[–—−]/g, '-');
  const upper = text.toUpperCase();

  let certificateNumber = null;
  const v2 = /P\s*R\s*M\s*-\s*(\d{2})\s*-\s*([A-Z]{3})\s*-\s*(\d{7})\s*-\s*([0-9A-Z])\s*-\s*([0-9A-Z]{4})/.exec(upper);
  if (v2) certificateNumber = `PRM-${v2[1]}-${v2[2]}-${v2[3]}-${v2[4]}-${v2[5]}`;
  else {
    const legacy = /C\s*E\s*R\s*T\s*-\s*(\d{4})\s*-\s*(\d{3,})/.exec(upper);
    if (legacy) certificateNumber = `CERT-${legacy[1]}-${legacy[2]}`;
  }

  return {
    certificateNumber,
    instrumentName: lineAfter(text, '(?:^|\\n)\\s*INSTRUMENT'),
    manufacturer: lineAfter(text, 'MANUFACTURER'),
    model: lineAfter(text, '(?:^|\\n)\\s*MODEL'),
    serialNumber: lineAfter(text, 'SERIAL\\s*NO\\.?'),
    validFrom: findDate(text, 'VALID\\s*FROM'),
    validUntil: findDate(text, 'VALID\\s*UNTIL'),
  };
}

// ---------------------------------------------------------------- QR code

let jsQR = null;
function loadJsQr() {
  if (!jsQR) jsQR = require('jsqr');
  return jsQR;
}

/** Looks for a QR code at a few scales and contrasts. Returns the text inside, or null. */
function findQr(image) {
  const decode = loadJsQr();
  const attempts = [];
  const base = image.clone();
  attempts.push(base);
  if (Math.max(image.width, image.height) > 1400) {
    const half = image.clone();
    half.resize({ w: Math.round(image.width / 2), h: Math.round(image.height / 2) });
    attempts.push(half);
  }
  const grey = image.clone();
  grey.greyscale().contrast(0.4);
  attempts.push(grey);

  for (const candidate of attempts) {
    const { data, width, height } = candidate.bitmap;
    const code = decode(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;
  }
  return null;
}

/** The QR is only parsed. It must be a link to this portal's verification page. */
function interpretQr(payload) {
  let url;
  try {
    url = new URL(payload);
  } catch {
    return { usable: false, reason: 'NOT_A_LINK', text: String(payload).slice(0, 120) };
  }
  if (!/^https?:$/.test(url.protocol)) return { usable: false, reason: 'NOT_A_LINK', text: String(payload).slice(0, 120) };
  const portal = new URL(config.frontendUrl);
  const q = url.searchParams.get('q');
  const s = url.searchParams.get('s');
  const sameHost = url.host.toLowerCase() === portal.host.toLowerCase();
  return {
    usable: sameHost && !!q && /^\/verify-public\/?$/.test(url.pathname),
    reason: !sameHost ? 'FOREIGN_HOST' : !q ? 'NO_IDENTIFIER' : !/^\/verify-public\/?$/.test(url.pathname) ? 'OTHER_PAGE' : null,
    host: url.host,
    identifier: q,
    signature: s,
  };
}

// ---------------------------------------------------------------- PDFs

/** The largest JPEG picture inside a PDF (what most scanners embed), or null. Flate-only page images are not read. */
function embeddedJpeg(pdf) {
  let best = null;
  let from = 0;
  while (from < pdf.length) {
    const start = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), from);
    if (start < 0) break;
    const end = pdf.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
    if (end < 0) break;
    const length = end + 2 - start;
    if (length > 5000 && (!best || length > best.length)) best = pdf.subarray(start, end + 2);
    from = end + 2;
  }
  return best;
}

// ---------------------------------------------------------------- comparison

const FIELDS = [
  ['certificateNumber', 'Certificate number', 'certificateNumber', (a, b) => compareText(a, b)],
  ['serialNumber', 'Serial number', 'serialNumber', (a, b) => compareText(a, b)],
  ['instrumentName', 'Instrument', 'instrumentName', (a, b) => compareText(a, b, { allowContains: true })],
  ['manufacturer', 'Manufacturer', 'manufacturer', (a, b) => compareText(a, b, { allowContains: true })],
  ['model', 'Model', 'model', (a, b) => compareText(a, b)],
  ['validFrom', 'Valid from', 'validFrom', (a, b) => ({ status: a === String(b).slice(0, 10) ? 'MATCH' : 'MISMATCH' })],
  ['validUntil', 'Valid until', 'validUntil', (a, b) => ({ status: a === String(b).slice(0, 10) ? 'MATCH' : 'MISMATCH' })],
];

function compareFields(printed, registryCertificate) {
  return FIELDS.map(([key, label, regKey, compare]) => {
    const read = printed ? printed[key] : null;
    const reg = registryCertificate ? registryCertificate[regKey] ?? null : null;
    if (!read) return { field: key, label, printed: null, registry: reg == null ? null : String(reg).slice(0, key.startsWith('valid') ? 10 : 200), status: 'NOT_READ' };
    if (reg == null || reg === '') return { field: key, label, printed: read, registry: null, status: 'NOT_ON_RECORD' };
    const result = compare(read, String(reg));
    return { field: key, label, printed: read, registry: String(reg).slice(0, key.startsWith('valid') ? 10 : 200), status: result.status, ...(result.note ? { note: result.note } : {}) };
  });
}

// ---------------------------------------------------------------- conclusion

function conclude({ exactFile, qr, registry, comparison, ocrUsed, numberInfo }) {
  const compared = comparison.filter((c) => c.status !== 'NOT_READ' && c.status !== 'NOT_ON_RECORD');
  const mismatches = compared.filter((c) => c.status === 'MISMATCH');
  const close = compared.filter((c) => c.status === 'CLOSE');
  const agreeing = compared.filter((c) => c.status === 'MATCH' || c.status === 'CLOSE');

  if (qr && qr.found && !qr.usable && qr.reason === 'FOREIGN_HOST') {
    return { code: 'QR_POINTS_ELSEWHERE', level: 'ALERT', text: `The QR code on this paper leads to a different website (${qr.host}), not to the Pramaan portal. Do not scan it or enter details there. Check the certificate number on the Pramaan verification page instead.` };
  }
  if (registry && registry.tampered) {
    return { code: 'TAMPER_SIGNALS', level: 'ALERT', text: 'The registry reports that the QR link or the record does not match what was issued. Do not rely on this certificate and report it to the Legal Metrology office.' };
  }
  if (numberInfo && numberInfo.problem) {
    return { code: numberInfo.problem === 'CHECK_CHARACTER' ? 'NUMBER_TYPO' : 'NUMBER_NOT_ISSUED', level: 'ALERT', text: numberInfo.problem === 'CHECK_CHARACTER' ? 'The certificate number read from the paper fails its check character. It is either misread from the photo or mistyped or invented on the paper. Try a sharper photo, or type the number on the verification page.' : 'The security code of the certificate number read from the paper does not match, so Pramaan did not issue this number (or the photo was misread).' };
  }
  if (!registry || !registry.certificate) {
    if (registry) {
      const how = qr && qr.found && qr.usable ? 'The QR code was read' : 'The certificate number was read from the paper';
      return { code: 'NOT_IN_REGISTRY', level: 'ALERT', text: `${how}, but no such certificate exists in the Pramaan registry.` };
    }
    return { code: 'NOTHING_READABLE', level: 'INFO', text: 'No QR code and no certificate number could be read. Upload a clear, well-lit photograph or scan of the whole certificate, with the QR code visible, or type the number on the verification page.' };
  }
  if (mismatches.length) {
    return { code: 'DETAILS_DISAGREE', level: 'ALERT', text: `The registry holds this certificate, but ${mismatches.map((m) => m.label.toLowerCase()).join(', ')} on the paper ${mismatches.length === 1 ? 'differs' : 'differ'} from the record. Either the photo was misread or the paper was altered. Compare the paper with the registry details shown here.` };
  }
  const status = registry.result;
  if (status === 'REVOKED') return { code: 'REGISTRY_REVOKED', level: 'ALERT', text: 'The registry says this certificate has been revoked. It must not be relied upon.' };
  if (status === 'EXPIRED') return { code: 'REGISTRY_EXPIRED', level: 'WARN', text: 'The registry holds this certificate but its validity has ended. The instrument needs re-verification.' };
  if (status !== 'VALID') return { code: 'REGISTRY_NOT_VALID', level: 'WARN', text: 'The registry holds this certificate but it is not currently valid.' };

  const viaQr = qr && qr.found && qr.usable;
  if (agreeing.length >= 3 && viaQr) {
    return { code: 'REGISTRY_RECORD_AGREES', level: 'INFO', text: `The QR code leads to a valid certificate in the Pramaan registry and ${agreeing.length} printed details agree with it${close.length ? ' (some only closely, check them by eye)' : ''}. This shows the paper is consistent with the record; it does not prove that this is the original paper.` };
  }
  if (viaQr) {
    return { code: 'REGISTRY_RECORD_FOUND', level: 'INFO', text: ocrUsed ? 'The QR code leads to a valid certificate in the Pramaan registry, but too little printed text could be read to compare the details. Compare the paper with the registry details shown here.' : 'The QR code leads to a valid certificate in the Pramaan registry. The printed text was not compared (text reading is not available), so compare the paper with the registry details shown here.' };
  }
  return { code: 'NUMBER_IN_REGISTRY_NO_QR', level: 'WARN', text: `A certificate with the number read from the paper exists in the registry${agreeing.length >= 2 ? ` and ${agreeing.length} printed details agree with it` : ''}, but no readable QR code links this paper to it. Text read from a photograph cannot prove authenticity: confirm the details on the verification page or with the Legal Metrology office.` };
}

// ---------------------------------------------------------------- the check

async function checkCopy(file, metadata = {}) {
  if (inFlight >= MAX_CONCURRENT) throw new ApiError(503, 'The checker is busy. Please try again in a minute.');
  inFlight += 1;
  try {
    return await run(file, metadata);
  } finally {
    inFlight -= 1;
  }
}

async function run({ buffer, mimetype }, metadata) {
  const isPdf = buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
  const result = {
    file: { kind: isPdf ? 'PDF' : 'IMAGE', sha256: sha256Hex(buffer), bytes: buffer.length },
    exactFile: null,
    qr: { found: false },
    registry: null,
    printed: { attempted: false, read: false },
    comparison: [],
    conclusion: null,
    limits: LIMITS,
  };

  // 1. a PDF that is exactly a file we issued
  let imageBuffer = isPdf ? null : buffer;
  if (isPdf) {
    const exact = await service.checkDocument(buffer, { ...metadata, accessSource: 'PUBLIC_COPY_CHECK' });
    result.exactFile = exact.matches ? { matches: true, certificateNumber: exact.certificateNumber, status: exact.status, validUntil: exact.validUntil, signature: exact.signature } : { matches: false, signature: verifyPdfSignature(buffer) };
    imageBuffer = embeddedJpeg(buffer);
    if (!imageBuffer && exact.matches) {
      const outcome = await service.verifyPublic({ identifier: exact.certificateNumber }, { ...metadata, accessSource: 'PUBLIC_COPY_CHECK' });
      result.registry = summariseRegistry(outcome);
      result.conclusion = {
        code: 'EXACT_FILE_ISSUED',
        level: outcome.valid ? 'INFO' : 'WARN',
        text: `This PDF is byte-for-byte identical to the file Pramaan issued as ${exact.certificateNumber}. The registry status is ${outcome.result}. (An identical file can also be a copy passed on by someone else: the status above is what counts.)`,
      };
      return result;
    }
  }
  if (!imageBuffer) {
    result.conclusion = conclude({ exactFile: false, qr: null, registry: null, comparison: [], ocrUsed: false });
    result.conclusion.text = 'This PDF is not a file issued by Pramaan and no scanned page picture could be read from it. Photograph or scan the paper certificate and upload the image (JPG or PNG).';
    return result;
  }

  // 2. the picture
  const image = await decodeImage(imageBuffer);

  // 3. the QR code
  const payload = findQr(image);
  let outcome = null;
  let numberInfo = null;
  if (payload) {
    const interpreted = interpretQr(payload);
    result.qr = { found: true, usable: interpreted.usable, reason: interpreted.reason, host: interpreted.host || null, text: interpreted.text };
    if (interpreted.usable) {
      outcome = await service.verifyPublic({ identifier: interpreted.identifier, signature: interpreted.signature || undefined }, { ...metadata, accessSource: 'PUBLIC_COPY_CHECK' });
    }
  }

  // 4. the printed text
  let printed = null;
  let ocrUsed = false;
  if (ocr.isAvailable()) {
    result.printed.attempted = true;
    try {
      const recognised = await ocr.recognize(imageBuffer);
      ocrUsed = true;
      printed = parseCertificateText(recognised.text);
      result.printed = {
        attempted: true,
        read: Object.values(printed).some(Boolean),
        engine: recognised.engine,
        confidence: Math.round(recognised.confidence),
        fields: printed,
      };
    } catch (err) {
      result.printed = { attempted: true, read: false, error: err.statusCode === 504 ? 'The text could not be read in time.' : 'The text could not be read.' };
    }
  }

  // 5. no usable QR: fall back to the number read from the paper (weaker)
  if (!outcome && printed && printed.certificateNumber) {
    const inspected = certificateId.inspect(printed.certificateNumber);
    if (!inspected.valid) numberInfo = { problem: inspected.reason };
    else outcome = await service.verifyPublic({ identifier: inspected.normalised }, { ...metadata, accessSource: 'PUBLIC_COPY_CHECK' });
  }

  if (outcome) result.registry = summariseRegistry(outcome);
  result.comparison = outcome && outcome.certificate ? compareFields(printed, outcome.certificate) : [];
  result.conclusion = conclude({ exactFile: result.exactFile ? result.exactFile.matches : null, qr: result.qr, registry: outcome, comparison: result.comparison, ocrUsed, numberInfo });
  return result;
}

function summariseRegistry(outcome) {
  return {
    result: outcome.result,
    valid: outcome.valid,
    tampered: outcome.tampered,
    reason: outcome.reason,
    certificate: outcome.certificate,
    integrity: outcome.integrity,
  };
}

module.exports = { checkCopy, parseCertificateText, interpretQr, findQr, embeddedJpeg, compareFields, conclude, LIMITS };
