const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { PDF_LABELS } = require('./i18n');

const LOGO_PATH = path.join(__dirname, '../assets/pramaan_logo_main.png');
const FONT_DIR = path.join(__dirname, '../assets/fonts');
const HINDI_REGULAR = path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf');
const HINDI_BOLD = path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf');

const COLORS = {
  border: '#1a3a5c',
  heading: '#1a3a5c',
  text: '#222222',
  muted: '#555555',
  line: '#cccccc',
};

function formatDate(d, locale, notAvailable) {
  if (!d) return notAvailable;
  // Date-only strings (YYYY-MM-DD) are calendar dates, not instants: format
  // them in UTC so the server's timezone can never shift the printed day.
  const dateOnly = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

// Draws one page of the certificate in one language.
function drawPage(doc, lang, certificate, qrCodeBuffer) {
  const L = PDF_LABELS[lang];
  const F =
    lang === 'hi'
      ? { regular: 'NotoHi', bold: 'NotoHiBold' }
      : { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  const spacing = lang === 'hi' ? {} : { characterSpacing: 1 }; // letter-spacing breaks Devanagari conjuncts
  const fmt = (d) => formatDate(d, L.locale, L.notAvailable);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const outerMargin = 24;
  const innerMargin = 34;
  const contentLeft = innerMargin + 20;
  const contentRight = pageWidth - innerMargin - 20;
  const contentWidth = contentRight - contentLeft;

  // ---- Borders (outer thin, inner thick) ----
  doc
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .rect(outerMargin, outerMargin, pageWidth - outerMargin * 2, pageHeight - outerMargin * 2)
    .stroke();

  doc
    .lineWidth(2)
    .strokeColor(COLORS.border)
    .rect(innerMargin, innerMargin, pageWidth - innerMargin * 2, pageHeight - innerMargin * 2)
    .stroke();

  let y = innerMargin + 28;

  // ---- Header: logo + title ----
  const logoSize = 100;
  let headerTextLeft = contentLeft;

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, contentLeft, y - 10, { width: logoSize });
    headerTextLeft = contentLeft + logoSize + 20;
  }
  const headerWidth = contentWidth - (headerTextLeft - contentLeft);

  doc.fillColor(COLORS.muted).font(F.regular).fontSize(10).text(L.department, headerTextLeft, y, { width: headerWidth, align: 'left', ...spacing });

  doc.fillColor(COLORS.heading).font(F.bold).fontSize(lang === 'hi' ? 22 : 24).text(L.title, headerTextLeft, y + 14, { width: headerWidth, align: 'left' });

  doc.fillColor(COLORS.muted).font(F.regular).fontSize(10).text(L.subtitle, headerTextLeft, y + 44, { width: headerWidth, align: 'left' });

  y += logoSize + 20;

  // ---- Divider ----
  doc.moveTo(contentLeft, y).lineTo(contentRight, y).lineWidth(1).strokeColor(COLORS.line).stroke();

  y += 22;

  // ---- Certificate number ----
  doc
    .font(F.regular)
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(L.certificateNo, contentLeft, y, { continued: true })
    .font(F.bold)
    .text(certificate.certificate_number || L.notAvailable);

  y += 26;

  // ---- Body statement ----
  doc
    .font(F.regular)
    .fontSize(lang === 'hi' ? 12 : 12.5)
    .fillColor(COLORS.text)
    .text(L.statement, contentLeft, y, { width: contentWidth, align: lang === 'hi' ? 'left' : 'justify', lineGap: 3 });

  y = doc.y + 20;

  // ---- Details table ----
  const na = L.notAvailable;
  const rows = [
    [L.instrument, certificate.instrument_name || na],
    [L.manufacturer, certificate.manufacturer || na],
    [L.model, certificate.model || na],
    [L.serialNo, certificate.serial_number || certificate.instrument_serial || na],
    [L.validFrom, fmt(certificate.valid_from)],
    [L.validUntil, fmt(certificate.valid_until)],
  ];

  const labelWidth = 150;
  const rowHeight = 26;

  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowHeight;

    doc.font(F.bold).fontSize(11).fillColor(COLORS.muted).text(label.toUpperCase(), contentLeft, rowY, { width: labelWidth });

    doc.font(F.regular).fontSize(12).fillColor(COLORS.text).text(value, contentLeft + labelWidth, rowY, { width: contentWidth - labelWidth - 160 });

    doc.moveTo(contentLeft, rowY + 19).lineTo(contentRight - 170, rowY + 19).lineWidth(0.5).strokeColor(COLORS.line).stroke();
  });

  // ---- QR code block (right side, aligned with details) ----
  if (qrCodeBuffer) {
    const qrSize = 110;
    const qrX = contentRight - qrSize;
    const qrY = y;

    doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize });

    doc.font(F.regular).fontSize(9).fillColor(COLORS.muted).text(L.scanToVerify, qrX - 10, qrY + qrSize + 6, { width: qrSize + 20, align: 'center' });
  }

  // ---- Footer: signature + issue date ----
  const footerY = pageHeight - innerMargin - 70;

  doc.moveTo(contentLeft, footerY).lineTo(contentLeft + 180, footerY).lineWidth(0.75).strokeColor(COLORS.text).stroke();

  doc.font(F.regular).fontSize(10).fillColor(COLORS.text).text(L.signatory, contentLeft, footerY + 4);

  doc
    .font(F.regular)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`${L.issuedOn}${fmt(certificate.issued_at || new Date())}`, contentLeft, footerY + 30);

  if (certificate.record_sha256) {
    doc
      .font('Courier')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`${lang === 'hi' ? '' : L.fingerprint}${certificate.record_sha256.slice(0, 32)}...`, contentLeft, footerY + 46, { width: contentWidth, align: 'left' });
  }

  doc.font(F.regular).fontSize(8).fillColor(COLORS.muted).text(L.footer, contentLeft, pageHeight - innerMargin - 20, { width: contentWidth, align: 'left' });
}

// languages: pages to include, in order. Default: English page, then Hindi page.
function generateCertificatePDF(certificate, qrCodeBuffer, { languages = ['en', 'hi'] } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0, // we control spacing manually for precise borders
        autoFirstPage: false,
        info: { Title: `Certificate ${certificate.certificate_number || ''}`.trim(), Author: 'Pramaan' },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      if (languages.includes('hi')) {
        doc.registerFont('NotoHi', HINDI_REGULAR);
        doc.registerFont('NotoHiBold', HINDI_BOLD);
      }

      for (const lang of languages) {
        doc.addPage();
        drawPage(doc, lang, certificate, qrCodeBuffer);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateCertificatePDF,
};
