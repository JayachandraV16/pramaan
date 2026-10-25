// api/src/modules/nameplate/nameplate.parse.js
//
// Turns OCR text from an instrument nameplate into labelled fields. Pure code:
// no I/O, so it is tested with plain strings. OCR output is noisy, so the label
// patterns are tolerant (e.g. "Sr. No.", "S.No", "Serial #"), but a field is only
// reported when a recognisable label is present - nothing is guessed.

const UNIT_ALIASES = {
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  mg: 'mg',
  t: 't', ton: 't', tons: 't', tonne: 't', tonnes: 't',
  l: 'l', ltr: 'l', ltrs: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  ml: 'ml',
};

const END = '(?=[\\s:=\\-#.]|$)';
const SEP = '\\s*[:\\-=#.]?\\s*';

const LINE_PATTERNS = {
  manufacturer: new RegExp(`^\\s*(?:manufactured\\s+by|manufacturer|mfd\\.?\\s*by|mfg\\.?\\s*by|mfr\\.?|made\\s+by|maker|make)${END}${SEP}(.+)$`, 'i'),
  model: new RegExp(`^\\s*(?:model(?:\\s*(?:no\\.?|number|#))?|mod\\.?|type)${END}${SEP}(.+)$`, 'i'),
  serialNumber: new RegExp(`^\\s*(?:serial(?:\\s*(?:no\\.?|number|#))?|s\\.?\\s*no\\.?|sr\\.?\\s*no\\.?|sl\\.?\\s*no\\.?|s\\/n|sn)${END}${SEP}(.+)$`, 'i'),
  year: new RegExp(`(?:year(?:\\s*of\\s*(?:mfg|manufacture|manufacturing))?|yr\\.?\\s*of\\s*mfg|mfg\\.?\\s*(?:date|year)|date\\s*of\\s*manufacture)${SEP}(?:[0-9]{1,2}[\\/.\\-])?([12][0-9]{3})\\b`, 'i'),
  approvalNumber: new RegExp(`(?:pattern\\s*approval|model\\s*approval|approval)\\s*(?:no\\.?|number|#)?${SEP}([A-Z0-9][A-Z0-9\\/.\\-]{4,})`, 'i'),
  accuracyClass: /(?:accuracy\s*class|class\s*of\s*accuracy|class)\s*[:\-=]?\s*(?:class\s*)?([IVXLl1|!]{1,4}|[0-9]|[A-Za-z]{1,2})(?![A-Za-z0-9])/i,
};

const CAPACITY_PATTERN = new RegExp(
  '(?:max(?:imum)?\\.?\\s*(?:capacity|cap\\.?|load)?|capacity|cap\\.?)\\s*[:\\-=]?\\s*' +
    '([0-9]+(?:[.,][0-9]+)*)\\s*(kilograms?|kgs?|grams?|gms?|g|mg|tonnes?|tons?|t|litres?|liters?|ltrs?|l|ml)(?![A-Za-z])',
  'i'
);

const clean = (s) =>
  String(s)
    .replace(/[|_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.\-=]+|[\s:;,]+$/g, '')
    .trim();

function parseNumber(raw) {
  let s = String(raw);
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 1,000 or 1,000.5
  else s = s.replace(',', '.'); // 0,5 -> 0.5
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Returns { fields, readFields } where fields is
//   { manufacturer?, model?, serialNumber?, capacity?: {value, unit, raw}, accuracyClass?, year?, approvalNumber? }
function parseNameplate(text) {
  const fields = {};
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const key of ['manufacturer', 'model', 'serialNumber']) {
      if (fields[key]) continue;
      const m = LINE_PATTERNS[key].exec(line);
      if (m) {
        const value = clean(m[1]);
        if (value) fields[key] = value;
      }
    }
  }

  const whole = lines.join('\n');
  const cap = CAPACITY_PATTERN.exec(whole);
  if (cap) {
    const value = parseNumber(cap[1]);
    const unit = UNIT_ALIASES[cap[2].toLowerCase()];
    if (value !== null && unit) fields.capacity = { value, unit, raw: `${cap[1]} ${cap[2]}` };
  }
  for (const key of ['accuracyClass', 'year', 'approvalNumber']) {
    const m = LINE_PATTERNS[key].exec(whole);
    if (m) fields[key] = clean(m[1]);
  }

  return { fields, readFields: Object.keys(fields) };
}

module.exports = { parseNameplate, UNIT_ALIASES };
