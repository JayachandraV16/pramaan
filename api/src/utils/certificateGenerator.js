const PDFDocument = require('pdfkit');

function generateCertificatePDF(certificate, qrCodeBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    doc.on('error', reject);

    // Border
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .stroke();

    // Title
    doc
      .fontSize(30)
      .text('CERTIFICATE OF VERIFICATION', {
        align: 'center',
      });

    doc.moveDown(2);

    doc
      .fontSize(16)
      .text(
        'This is to certify that the following weighing/measuring instrument has been successfully verified.',
        {
          align: 'center',
        }
      );

    doc.moveDown(2);

    // Certificate details
    doc.fontSize(18);

    doc.text(`Certificate Number: ${certificate.certificate_number}`);

    doc.moveDown();

    doc.text(`Instrument: ${certificate.instrument_name}`);

    doc.moveDown();

    doc.text(`Manufacturer: ${certificate.manufacturer || 'N/A'}`);

    doc.moveDown();

    doc.text(`Model: ${certificate.model || 'N/A'}`);

    doc.moveDown();

    doc.text(`Valid From: ${certificate.valid_from}`);

    doc.moveDown();

    doc.text(`Valid Until: ${certificate.valid_until}`);

    // QR Code
    if (qrCodeBuffer) {
      doc.image(
        qrCodeBuffer,
        doc.page.width - 180,
        doc.page.height - 180,
        {
          width: 120,
        }
      );

      doc
        .fontSize(10)
        .text(
          'Scan to verify certificate',
          doc.page.width - 190,
          doc.page.height - 55,
          {
            width: 140,
            align: 'center',
          }
        );
    }

    doc.end();
  });
}

module.exports = {
  generateCertificatePDF,
};