const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '../assets/pramaan_logo_main.png');

const COLORS = {
  border: '#1a3a5c',
  heading: '#1a3a5c',
  text: '#222222',
  muted: '#555555',
  line: '#cccccc',
};

function formatDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function generateCertificatePDF(certificate, qrCodeBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0, // we control spacing manually for precise borders
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

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

      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(10)
        .text('DEPARTMENT OF CONSUMER AFFAIRS', headerTextLeft, y, {
          width: contentWidth - (headerTextLeft - contentLeft),
          align: 'left',
          characterSpacing: 1,
        });

      doc
        .fillColor(COLORS.heading)
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('CERTIFICATE OF VERIFICATION', headerTextLeft, y + 14, {
          width: contentWidth - (headerTextLeft - contentLeft),
          align: 'left',
        });

      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(10)
        .text('Legal Metrology — Weighing & Measuring Instruments', headerTextLeft, y + 42, {
          width: contentWidth - (headerTextLeft - contentLeft),
          align: 'left',
        });

      y += logoSize + 20;

      // ---- Divider ----
      doc
        .moveTo(contentLeft, y)
        .lineTo(contentRight, y)
        .lineWidth(1)
        .strokeColor(COLORS.line)
        .stroke();

      y += 22;

      // ---- Certificate number (top-right style, prominent) ----
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(`Certificate No: `, contentLeft, y, { continued: true })
        .font('Helvetica-Bold')
        .text(certificate.certificate_number || 'N/A');

      y += 26;

      // ---- Body statement ----
      doc
        .font('Helvetica')
        .fontSize(12.5)
        .fillColor(COLORS.text)
        .text(
          'This is to certify that the weighing/measuring instrument described below has been examined and verified in accordance with the applicable Legal Metrology standards, and found to conform to the prescribed requirements of accuracy.',
          contentLeft,
          y,
          { width: contentWidth, align: 'justify', lineGap: 3 }
        );

      y = doc.y + 20;

      // ---- Details table ----
      const rows = [
        ['Instrument', certificate.instrument_name || 'N/A'],
        ['Manufacturer', certificate.manufacturer || 'N/A'],
        ['Model', certificate.model || 'N/A'],
        ['Valid From', formatDate(certificate.valid_from)],
        ['Valid Until', formatDate(certificate.valid_until)],
      ];

      const labelWidth = 150;
      const rowHeight = 26;

      rows.forEach(([label, value], i) => {
        const rowY = y + i * rowHeight;

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(COLORS.muted)
          .text(label.toUpperCase(), contentLeft, rowY, { width: labelWidth });

        doc
          .font('Helvetica')
          .fontSize(12)
          .fillColor(COLORS.text)
          .text(value, contentLeft + labelWidth, rowY, { width: contentWidth - labelWidth - 160 });

        doc
          .moveTo(contentLeft, rowY + 19)
          .lineTo(contentRight - 170, rowY + 19)
          .lineWidth(0.5)
          .strokeColor(COLORS.line)
          .stroke();
      });

      const detailsBottom = y + rows.length * rowHeight;

      // ---- QR code block (right side, aligned with details) ----
      if (qrCodeBuffer) {
        const qrSize = 110;
        const qrX = contentRight - qrSize;
        const qrY = y;

        doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize });

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text('Scan to verify authenticity', qrX, qrY + qrSize + 6, {
            width: qrSize,
            align: 'center',
          });
      }

      // ---- Footer: signature + issue date ----
      const footerY = pageHeight - innerMargin - 70;

      doc
        .moveTo(contentLeft, footerY)
        .lineTo(contentLeft + 180, footerY)
        .lineWidth(0.75)
        .strokeColor(COLORS.text)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.text)
        .text('Authorised Signatory', contentLeft, footerY + 4);

      const issuedText = `Issued on: ${formatDate(certificate.issued_at || new Date())}`;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(issuedText, contentLeft, footerY + 30);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          'This certificate is system-generated and can be verified online using the QR code or certificate number above.',
          contentLeft,
          pageHeight - innerMargin - 20,
          { width: contentWidth, align: 'left' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateCertificatePDF,
};