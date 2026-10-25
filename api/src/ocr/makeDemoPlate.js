// DEMO/TEST helper: renders a nameplate-style PNG so the OCR check can be shown without a physical plate.
//
//   npm run ocr:demo-plate -- --serial AW2024-001178 [--manufacturer "ACME WEIGHING SYSTEMS"] [--model PS-500]
//                            [--capacity "500 kg"] [--class III] [--out ocr-data/demo-nameplate.png]
//
// Uses jimp (a development dependency). Photographs of real plates are harder to read than this
// clean image, so a successful demo here says nothing about accuracy on real plates.

const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

(async () => {
  const jimp = require('jimp');
  const fonts = require('jimp/fonts');
  const font = await jimp.loadFont(fonts.SANS_32_BLACK);

  const lines = [
    `MANUFACTURER: ${arg('manufacturer', 'ACME WEIGHING SYSTEMS')}`,
    `MODEL: ${arg('model', 'PS-500')}`,
    `SERIAL NO: ${arg('serial', 'AW2024-001178')}`,
    `MAX CAPACITY: ${arg('capacity', '500 kg')}`,
    `ACCURACY CLASS: ${arg('class', 'III')}`,
    `YEAR OF MFG: ${arg('year', '2024')}`,
  ];
  const img = new jimp.Jimp({ width: 1000, height: 120 + lines.length * 56, color: 0xffffffff });
  lines.forEach((text, i) => img.print({ font, x: 30, y: 30 + i * 56, text }));

  const out = path.resolve(process.cwd(), arg('out', path.join('ocr-data', 'demo-nameplate.png')));
  require('fs').mkdirSync(path.dirname(out), { recursive: true });
  await img.write(out);
  console.log(`Wrote ${out}`);
})().catch((err) => {
  console.error('ocr:demo-plate failed:', err.message);
  process.exitCode = 1;
});
