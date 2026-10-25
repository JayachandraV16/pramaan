// Decodes an uploaded photo before anything else touches it. A corrupt or hostile image is refused
// with a clear 400 instead of reaching a native/WebAssembly decoder, and large photos are scaled down.
// Used by the OCR engine; also the place for orientation and size rules shared by other image features.

const { Jimp } = require('jimp');
const ApiError = require('./ApiError');

const MAX_PIXELS = 40 * 1000 * 1000; // refuse absurd dimensions before decoding fully
const MAX_SIDE = 2400; // longest side handed to the OCR engine

function peekSize(buffer) {
  // PNG: IHDR at byte 16; JPEG: scan for a SOF marker. Returns null when unknown.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) { i += 1; continue; }
      const marker = buffer[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** @returns {Promise<{ buffer: Buffer, width: number, height: number }>} a clean, upright, size-limited PNG */
async function normalizeImage(buffer, { maxSide = MAX_SIDE } = {}) {
  const peek = peekSize(buffer);
  if (peek && peek.width * peek.height > MAX_PIXELS) {
    throw ApiError.badRequest('The photo has too many pixels. Use a smaller photo (for example 12 megapixels or less).');
  }
  let image;
  try {
    image = await Jimp.fromBuffer(buffer); // applies the JPEG orientation tag
  } catch {
    throw ApiError.badRequest('The photo could not be read: the file is damaged or is not a JPG/PNG image.');
  }
  const longest = Math.max(image.width, image.height);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    image.resize({ w: Math.round(image.width * scale), h: Math.round(image.height * scale) });
  }
  const out = await image.getBuffer('image/png');
  return { buffer: out, width: image.width, height: image.height };
}

module.exports = { normalizeImage, peekSize, MAX_PIXELS, MAX_SIDE };
