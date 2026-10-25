// api/src/modules/nameplate/ocrEngine.js
//
// Local, open-source OCR (tesseract.js, Apache-2.0, runs as WebAssembly in a worker
// thread). Images never leave this server. The English "fast" model lives in
// OCR_LANG_PATH (default api/ocr-data, created by `npm run ocr:setup`); without it
// the feature reports "not set up" and the manual process continues.
//
// recognize(buffer) -> { text, confidence (0-100), engine }
// Jobs run one at a time (one worker), each with a time limit.

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');

let override = null; // tests inject a fake: setEngine(async (buffer) => ({ text, confidence, engine }))
let workerPromise = null;
let queue = Promise.resolve();

const modelFile = () => path.join(config.ocr.langPath, `${config.ocr.lang}.traineddata`);

function engineName() {
  let version = 'unknown';
  try {
    version = require('tesseract.js/package.json').version;
  } catch {
    /* optional dependency missing */
  }
  return `tesseract.js ${version} (${config.ocr.lang}, fast model)`;
}

function isAvailable() {
  if (override) return true;
  return config.ocr.enabled && fs.existsSync(modelFile());
}

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = require('tesseract.js');
    workerPromise = createWorker(config.ocr.lang, 1, {
      langPath: config.ocr.langPath,
      cachePath: config.ocr.langPath,
      gzip: false, // the model is stored uncompressed
      logger: () => {},
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

async function resetWorker() {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) {
    try {
      await (await pending).terminate();
    } catch {
      /* already gone */
    }
  }
}

function recognize(buffer) {
  if (override) return Promise.resolve().then(() => override(buffer));
  if (!isAvailable()) {
    return Promise.reject(new ApiError(503, 'The OCR engine is not set up on this server (run "npm run ocr:setup"). Check the nameplate manually.'));
  }

  const job = queue.then(async () => {
    const worker = await getWorker();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ApiError(504, 'Reading the image took too long. Try a smaller or clearer photo.')), config.ocr.timeoutMs);
    });
    try {
      const { data } = await Promise.race([worker.recognize(buffer), timeout]);
      return { text: data.text || '', confidence: Number(data.confidence) || 0, engine: engineName() };
    } catch (err) {
      if (err instanceof ApiError) await resetWorker(); // a stuck job: start fresh next time
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
  queue = job.catch(() => undefined); // one failure must not block later jobs
  return job;
}

module.exports = {
  recognize,
  isAvailable,
  engineName,
  shutdown: resetWorker,
  setEngine: (fn) => {
    override = fn;
  },
};
