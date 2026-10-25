// api/src/storage/tools.js
//
// Looking after the stored files: audit what is there against what the database refers to, clean up
// files nothing refers to, and copy everything to another storage driver (for example local -> S3)
// without ever touching the source. The CLI in cli.js wraps these functions; tests call them directly.
//
// None of these functions deletes or overwrites anything unless `apply` is true, and migrate never
// removes or changes a source file.

const { sha256Hex } = require('../utils/integrity');
const { describeImage } = require('../utils/imageTools');
const storage = require('../utils/storage');

const URL_PREFIX = '/uploads/';
const IMAGE_EXTENSIONS = /\.(jpe?g|png)$/i;

// Every table column that holds "/uploads/<key>". Add new file columns here.
const REFERENCES = [
  { table: 'attachments', column: 'file_url' },
  { table: 'nameplate_checks', column: 'file_url' },
  { table: 'verification_certificates', column: 'certificate_file_url' },
];

async function readAll(driver, key) {
  const file = await driver.open(key);
  if (!file) return null;
  const chunks = [];
  for await (const chunk of file.stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** key -> ['attachments.file_url', ...] for every file the database refers to */
async function referencedKeys(pool) {
  const refs = new Map();
  for (const { table, column } of REFERENCES) {
    const { rows } = await pool.query(`SELECT ${column} AS url FROM ${table} WHERE ${column} IS NOT NULL`);
    for (const { url } of rows) {
      if (typeof url !== 'string' || !url.startsWith(URL_PREFIX)) continue;
      const key = url.slice(URL_PREFIX.length).split('?')[0];
      if (!refs.has(key)) refs.set(key, []);
      refs.get(key).push(`${table}.${column}`);
    }
  }
  return refs;
}

/**
 * Compares storage, references and metadata.
 * @returns {{ driver, files, bytes, referenced, orphans, missing, withoutMetadata, metadataWithoutFile, backfilled }}
 */
async function audit({ pool, driver = storage, minAgeHours = 24, backfill = false, now = Date.now() } = {}) {
  const listed = await driver.list();
  const refs = await referencedKeys(pool);
  const { rows: meta } = await pool.query('SELECT key FROM stored_files');
  const hasMeta = new Set(meta.map((r) => r.key));
  const present = new Set(listed.map((f) => f.key));

  const orphans = [];
  for (const file of listed) {
    if (refs.has(file.key)) continue;
    const ageHours = (now - new Date(file.modifiedAt).getTime()) / 3600000;
    // a file nothing refers to YET may belong to an upload that is still being processed
    if (ageHours >= minAgeHours) orphans.push({ key: file.key, size: file.size, ageHours: Math.round(ageHours * 10) / 10 });
  }
  const missing = [...refs.entries()].filter(([key]) => !present.has(key)).map(([key, where]) => ({ key, referencedBy: where }));
  const withoutMetadata = listed.filter((f) => !hasMeta.has(f.key)).map((f) => f.key);
  const metadataWithoutFile = [...hasMeta].filter((key) => !present.has(key));

  let backfilled = 0;
  if (backfill) {
    for (const key of withoutMetadata) {
      const bytes = await readAll(driver, key);
      if (!bytes) continue;
      let image = null;
      if (IMAGE_EXTENSIONS.test(key)) {
        try {
          image = await describeImage(bytes);
        } catch {
          image = null; // a stored picture that no longer decodes still gets its hash and size recorded
        }
      }
      await pool.query(
        `INSERT INTO stored_files (key, kind, mime_type, size_bytes, sha256, width, height, exif_orientation, driver)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (key) DO NOTHING`,
        [key, IMAGE_EXTENSIONS.test(key) ? 'IMAGE' : 'PDF', storage.contentTypeFor(key), bytes.length, sha256Hex(bytes), image && image.width, image && image.height, image && image.orientation, driver.name || 'local']
      );
      backfilled += 1;
    }
  }

  return {
    driver: driver.name || storage.driverName(),
    files: listed.length,
    bytes: listed.reduce((sum, f) => sum + f.size, 0),
    referenced: refs.size,
    orphans,
    missing,
    withoutMetadata: withoutMetadata.length - backfilled,
    metadataWithoutFile,
    backfilled,
  };
}

/** Removes files nothing refers to and that are older than `minAgeHours`. Dry run unless `apply`. */
async function cleanup({ pool, driver = storage, minAgeHours = 24, apply = false, now = Date.now() } = {}) {
  const report = await audit({ pool, driver, minAgeHours, now });
  const removed = [];
  if (apply) {
    for (const orphan of report.orphans) {
      await driver.remove(orphan.key);
      await pool.query('DELETE FROM stored_files WHERE key = $1', [orphan.key]);
      removed.push(orphan.key);
    }
    // stale metadata rows for files that no longer exist
    for (const key of report.metadataWithoutFile) {
      await pool.query('DELETE FROM stored_files WHERE key = $1', [key]);
    }
  }
  return { dryRun: !apply, minAgeHours, candidates: report.orphans, removed, bytesFreed: apply ? report.orphans.reduce((s, o) => s + o.size, 0) : 0, staleMetadata: report.metadataWithoutFile.length };
}

/**
 * Copies every stored file from `source` to `target`, checking each copy by SHA-256.
 *   - a file already on the target with identical content is left alone
 *   - a file on the target with DIFFERENT content is reported as a conflict and never overwritten
 *   - the source is never modified
 * Dry run unless `apply`.
 */
async function migrate({ source, target, apply = false, onProgress = () => {} }) {
  const files = await source.list();
  const result = { dryRun: !apply, total: files.length, copied: [], alreadyThere: [], conflicts: [], failed: [], bytes: 0 };

  for (const file of files) {
    try {
      const bytes = await readAll(source, file.key);
      if (!bytes) {
        result.failed.push({ key: file.key, error: 'listed but could not be read from the source' });
        continue;
      }
      const hash = sha256Hex(bytes);
      const existing = await readAll(target, file.key);
      if (existing) {
        if (sha256Hex(existing) === hash) result.alreadyThere.push(file.key);
        else result.conflicts.push({ key: file.key, reason: 'the target already has a different file with this name' });
        continue;
      }
      if (apply) {
        await target.put(file.key, bytes);
        const back = await readAll(target, file.key);
        if (!back || sha256Hex(back) !== hash) {
          await target.remove(file.key).catch(() => {});
          result.failed.push({ key: file.key, error: 'the copy did not read back identically, so it was removed from the target' });
          continue;
        }
      }
      result.copied.push(file.key);
      result.bytes += bytes.length;
      onProgress(file.key);
    } catch (err) {
      result.failed.push({ key: file.key, error: err.message });
    }
  }
  return result;
}

module.exports = { audit, cleanup, migrate, referencedKeys, REFERENCES };
