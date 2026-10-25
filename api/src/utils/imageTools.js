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

/** The EXIF orientation tag (1-8) of a JPEG, or null. 1 = upright; 6 = the camera was turned (needs a 90 degree turn to display). */
function readExifOrientation(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marker = buffer[i + 1];
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end: no EXIF before the picture data
    const length = buffer.readUInt16BE(i + 2);
    if (marker === 0xe1 && buffer.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const tiff = i + 10;
      const little = buffer.toString('latin1', tiff, tiff + 2) === 'II';
      const u16 = (o) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
      const u32 = (o) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));
      if (tiff + 8 > buffer.length || u16(tiff + 2) !== 0x2a) return null;
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > buffer.length) return null;
      const entries = u16(ifd);
      for (let e = 0; e < entries; e += 1) {
        const at = ifd + 2 + e * 12;
        if (at + 12 > buffer.length) return null;
        if (u16(at) === 0x0112) {
          const value = u16(at + 8);
          return value >= 1 && value <= 8 ? value : null;
        }
      }
      return null;
    }
    i += 2 + length;
  }
  return null;
}

/**
 * Checks that an uploaded photo really is a readable picture of a sane size and describes it.
 * The file itself is NOT changed (its SHA-256 is part of the evidence); orientation is recorded so a viewer
 * can turn it, and the OCR / QR code paths turn it themselves (decodeImage applies the tag).
 * @returns {Promise<{ width: number, height: number, orientation: number|null }>} width / height as stored in the file
 */
async function describeImage(buffer) {
  const image = await decodeImage(buffer, { maxSide: Infinity }); // throws a 400 for damaged or oversized pictures
  const peek = peekSize(buffer);
  const orientation = readExifOrientation(buffer);
  // decodeImage returns the upright picture; the stored size is the one in the file
  const turned = orientation && orientation >= 5;
  const width = peek ? peek.width : turned ? image.height : image.width;
  const height = peek ? peek.height : turned ? image.width : image.height;
  return { width, height, orientation };
}

/** Decodes and size-limits a photo; returns the Jimp image (upright, longest side at most `maxSide`). */
async function decodeImage(buffer, { maxSide = MAX_SIDE } = {}) {
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
  return image;
}

/** @returns {Promise<{ buffer: Buffer, width: number, height: number }>} a clean, upright, size-limited PNG */
async function normalizeImage(buffer, options) {
  const image = await decodeImage(buffer, options);
  return { buffer: await image.getBuffer('image/png'), width: image.width, height: image.height };
}

module.exports = { decodeImage, normalizeImage, describeImage, readExifOrientation, peekSize, MAX_PIXELS, MAX_SIDE };
