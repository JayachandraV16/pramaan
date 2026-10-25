// api/src/modules/nameplate/nameplate.compare.js
//
// Compares what OCR read from a nameplate with the registered instrument data.
// Pure code. The result is ADVISORY: a suggestion shown to a reviewer, never a
// decision. Statuses per field:
//   MATCH           same after normalising case, spacing and punctuation
//   CLOSE           differs only like an OCR slip would (O/0, I/1, 1-2 characters)
//   MISMATCH        clearly different
//   NOT_READ        the registry has a value but OCR found none on the plate
//   NOT_REGISTERED  nothing registered to compare with

const MASS = { mg: 0.001, g: 1, kg: 1000, t: 1000000 };
const VOLUME = { ml: 1, l: 1000 };
const { UNIT_ALIASES } = require('./nameplate.parse');

const CORE_FIELDS = ['serialNumber', 'manufacturer', 'model', 'capacity', 'accuracyClass'];

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// characters OCR commonly swaps
const CONFUSABLE = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' };
const confuse = (s) => s.replace(/[OQDILSBZG]/g, (c) => CONFUSABLE[c]);

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

function compareText(read, registered, { allowContains = false } = {}) {
  const a = norm(read);
  const b = norm(registered);
  if (!a) return { status: 'NOT_READ' };
  if (a === b) return { status: 'MATCH' };
  if (confuse(a) === confuse(b)) return { status: 'CLOSE', note: 'differs only by look-alike characters (such as O and 0)' };
  if (allowContains && Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))) {
    return { status: 'MATCH', note: 'one name contains the other' };
  }
  const sim = similarity(confuse(a), confuse(b));
  if (Math.min(a.length, b.length) >= 6 && sim >= 0.85) return { status: 'CLOSE', note: `${Math.round(sim * 100)}% similar` };
  return { status: 'MISMATCH' };
}

function baseUnits(value, unit) {
  const u = UNIT_ALIASES[String(unit || '').toLowerCase().trim()];
  if (u && MASS[u]) return { family: 'mass', amount: value * MASS[u] };
  if (u && VOLUME[u]) return { family: 'volume', amount: value * VOLUME[u] };
  return null;
}

function compareCapacity(read, registeredValue, registeredUnit) {
  if (!read) return { status: 'NOT_READ' };
  const a = baseUnits(read.value, read.unit);
  const b = baseUnits(Number(registeredValue), registeredUnit);
  if (!a || !b) {
    return Number(registeredValue) === read.value && norm(registeredUnit) === norm(read.unit) ? { status: 'MATCH' } : { status: 'MISMATCH' };
  }
  if (a.family !== b.family) return { status: 'MISMATCH', note: 'different kind of unit (mass vs volume)' };
  const rel = Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount, 1e-9);
  if (rel < 1e-9) return { status: 'MATCH', note: read.unit === UNIT_ALIASES[String(registeredUnit).toLowerCase().trim()] ? undefined : 'same capacity in a different unit' };
  return { status: 'MISMATCH' };
}

const ROMAN = { I: 1, II: 2, III: 3, IIII: 4, IV: 4, V: 5 };
function classToken(value) {
  let s = String(value ?? '').toUpperCase().replace(/\(.*?\)/g, '').replace(/CLASS|ACCURACY|OF/g, '').replace(/[^A-Z0-9|!]/g, '');
  if (/^[IL1|!]+$/.test(s)) s = s.replace(/[L1|!]/g, 'I'); // "lll", "1II" read for "III"
  if (ROMAN[s]) return String(ROMAN[s]);
  return s;
}
function compareClass(read, registered) {
  if (!read) return { status: 'NOT_READ' };
  const a = classToken(read);
  const b = classToken(registered);
  return a && a === b ? { status: 'MATCH' } : { status: 'MISMATCH' };
}

// extracted: output of parseNameplate().fields; registered: the instruments row
function compareToRegistered(extracted, registered) {
  const blank = (v) => v === null || v === undefined || String(v).trim() === '';
  const fields = {};

  const put = (key, readValue, registeredValue, result) => {
    fields[key] = {
      read: readValue === undefined ? null : readValue,
      registered: blank(registeredValue) ? null : registeredValue,
      ...(result.status === 'NOT_READ' && blank(registeredValue) ? { status: 'NOT_REGISTERED' } : result),
    };
  };

  put('serialNumber', extracted.serialNumber, registered.serial_number, blank(registered.serial_number) ? { status: 'NOT_REGISTERED' } : compareText(extracted.serialNumber, registered.serial_number));
  put('manufacturer', extracted.manufacturer, registered.manufacturer, blank(registered.manufacturer) ? { status: 'NOT_REGISTERED' } : compareText(extracted.manufacturer, registered.manufacturer, { allowContains: true }));
  put('model', extracted.model, registered.model, blank(registered.model) ? { status: 'NOT_REGISTERED' } : compareText(extracted.model, registered.model, { allowContains: true }));
  put(
    'capacity',
    extracted.capacity ? `${extracted.capacity.value} ${extracted.capacity.unit}` : undefined,
    blank(registered.capacity) ? null : `${Number(registered.capacity)} ${registered.capacity_unit || ''}`.trim(),
    blank(registered.capacity) ? { status: 'NOT_REGISTERED' } : compareCapacity(extracted.capacity, registered.capacity, registered.capacity_unit)
  );
  put('accuracyClass', extracted.accuracyClass, registered.accuracy_class, blank(registered.accuracy_class) ? { status: 'NOT_REGISTERED' } : compareClass(extracted.accuracyClass, registered.accuracy_class));

  // printed on the plate but not part of the registration: shown for the reviewer, never compared
  const extra = {};
  if (extracted.year) extra.year = extracted.year;
  if (extracted.approvalNumber) extra.approvalNumber = extracted.approvalNumber;

  return { fields, extra };
}

// Machine suggestion for the reviewer. NEVER a decision.
function advise(comparison, ocrConfidence) {
  const compared = CORE_FIELDS.map((k) => comparison.fields[k]).filter((f) => f && f.status !== 'NOT_REGISTERED');
  const read = compared.filter((f) => f.status !== 'NOT_READ');
  const confidence = Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : null;

  if (read.length === 0 || (confidence !== null && confidence < 40)) {
    return { advisory: 'UNREADABLE', summary: 'The plate could not be read well enough to compare. Take a clearer, straight-on photo.' };
  }
  const mismatches = compared.filter((f) => f.status === 'MISMATCH');
  if (mismatches.length) {
    const serialBad = comparison.fields.serialNumber.status === 'MISMATCH';
    return {
      advisory: 'LIKELY_MISMATCH',
      summary: `${mismatches.length} field(s) do not match the registered record${serialBad ? ', including the serial number' : ''}. A person must check the plate.`,
    };
  }
  const uncertain = compared.filter((f) => f.status === 'CLOSE' || f.status === 'NOT_READ');
  if (uncertain.length || (confidence !== null && confidence < 70)) {
    return { advisory: 'NEEDS_REVIEW', summary: 'The plate mostly agrees, but some fields were unclear or only close. A person must confirm.' };
  }
  return { advisory: 'ALL_MATCH', summary: 'All compared fields agree with the registered record. A person must still confirm.' };
}

module.exports = { compareToRegistered, advise, compareText, compareCapacity, compareClass, similarity, CORE_FIELDS };
