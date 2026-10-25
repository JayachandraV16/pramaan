// api/src/utils/csv.js
//
// Minimal RFC 4180 CSV writer for report exports.
//  - values containing commas, quotes or line breaks are quoted
//  - cells that start with = + - @ (or tab/CR) are prefixed with an apostrophe
//    so spreadsheets cannot execute them as formulas ("CSV injection")
//  - a UTF-8 byte-order mark is added so Excel reads non-ASCII text correctly

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCell(raw) {
  let text = formatValue(raw);
  // Real numbers (e.g. -5 days) are not formulas; only text needs the guard.
  if (typeof raw === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// columns: [[key, header], ...]; rows: array of plain objects
function toCsv(columns, rows) {
  const lines = [columns.map(([, header]) => escapeCell(header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map(([key]) => escapeCell(row[key])).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

module.exports = { toCsv, escapeCell };
