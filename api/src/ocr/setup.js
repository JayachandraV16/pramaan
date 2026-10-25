// Downloads the English "fast" Tesseract model (about 4 MB, Apache-2.0) into api/ocr-data/
// so nameplate reading works with no internet at run time.
//
//   npm run ocr:setup

const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.env.OCR_LANG_PATH || path.join(__dirname, '..', '..', 'ocr-data'));
const file = path.join(dir, 'eng.traineddata');
const url = process.env.OCR_MODEL_URL || 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata';

(async () => {
  if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000 && !process.argv.includes('--force')) {
    console.log(`OCR model already present: ${file} (use --force to download again)`);
    return;
  }
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  // a proper model is a few MB of binary data; an HTML error page is not
  if (bytes.length < 1_000_000 || bytes.subarray(0, 64).toString('latin1').includes('<html')) {
    throw new Error('the downloaded file does not look like a Tesseract model');
  }
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.part`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, file);
  console.log(`Saved ${file} (${(bytes.length / 1e6).toFixed(1)} MB). Nameplate reading is ready.`);
})().catch((err) => {
  console.error('ocr:setup failed:', err.message);
  process.exitCode = 1;
});
