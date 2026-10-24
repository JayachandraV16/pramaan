// api/src/utils/storage.js
//
// Where uploaded evidence and generated certificates live. One small
// interface, two drivers:
//   local  files under UPLOAD_DIR (default; fine for one server)
//   s3     any S3-compatible bucket - AWS S3, MinIO, Cloudflare R2 ...
//          (STORAGE_DRIVER=s3, S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID,
//           S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE, S3_PREFIX)
//
// Objects are addressed by a relative key such as "certificates/CERT-2026-000001.pdf".
// The database keeps "/uploads/<key>" and the API serves that path with a signed,
// expiring link (app.js), so the bucket itself can stay private.

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Letters, digits, dot, dash, underscore; "/" between segments; no leading dot
// in a segment, so ".." and hidden files can never be addressed.
const KEY_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/;

const CONTENT_TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function assertKey(key) {
  if (typeof key !== 'string' || key.length > 300 || !KEY_RE.test(key)) {
    const err = new Error('Invalid storage key');
    err.code = 'INVALID_KEY';
    throw err;
  }
  return key;
}

const contentTypeFor = (key) => CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';

const bodyOf = (body) => (Buffer.isBuffer(body) ? body : fs.readFileSync(body)); // Buffer or a file path

function createLocalDriver(root) {
  const resolve = (key) => {
    const abs = path.resolve(root, assertKey(key));
    if (!abs.startsWith(path.resolve(root) + path.sep)) throw Object.assign(new Error('Invalid storage key'), { code: 'INVALID_KEY' });
    return abs;
  };
  return {
    name: 'local',
    async put(key, body) {
      const abs = resolve(key);
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      if (Buffer.isBuffer(body)) await fs.promises.writeFile(abs, body);
      else if (path.resolve(body) !== abs) await fs.promises.copyFile(body, abs);
    },
    async open(key) {
      const abs = resolve(key);
      try {
        const stat = await fs.promises.stat(abs);
        if (!stat.isFile()) return null;
        return { stream: fs.createReadStream(abs), size: stat.size };
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
    async remove(key) {
      await fs.promises.unlink(resolve(key)).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
      });
    },
  };
}

// `client` is an S3Client (or anything with .send(command)); injected in tests.
function createS3Driver({ client, bucket, prefix = '', serverSideEncryption }) {
  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const objectKey = (key) => `${prefix}${assertKey(key)}`;
  const missing = (err) => err && (err.name === 'NoSuchKey' || err.name === 'NotFound' || (err.$metadata && err.$metadata.httpStatusCode === 404));
  return {
    name: 's3',
    async put(key, body) {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: objectKey(key), Body: bodyOf(body), ContentType: contentTypeFor(key),
        ...(serverSideEncryption ? { ServerSideEncryption: serverSideEncryption } : {}),
      }));
    },
    async open(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
        return { stream: res.Body, size: res.ContentLength };
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
    },
  };
}

function driverFromConfig() {
  const { driver, s3 } = config.storage;
  if (driver !== 's3') return createLocalDriver(config.uploadDir);
  const { S3Client } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: s3.region,
    ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
    forcePathStyle: s3.forcePathStyle,
    ...(s3.accessKeyId ? { credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey } } : {}),
  });
  return createS3Driver({ client, bucket: s3.bucket, prefix: s3.prefix, serverSideEncryption: s3.serverSideEncryption });
}

let current = null;
const driver = () => current || (current = driverFromConfig());

module.exports = {
  put: (key, body) => driver().put(key, body),
  open: (key) => driver().open(key),
  remove: (key) => driver().remove(key),
  driverName: () => driver().name,
  setDriver: (d) => { current = d; }, // tests; pass null to reset to the configured driver
  assertKey,
  contentTypeFor,
  createLocalDriver,
  createS3Driver,
};
