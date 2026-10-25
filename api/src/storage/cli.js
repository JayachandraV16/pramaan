// api/src/storage/cli.js
//
//   npm run storage:audit   [-- --min-age-hours=24 --backfill --json]
//   npm run storage:cleanup [-- --min-age-hours=24 --apply]
//   npm run storage:migrate -- --from=local --to=s3 [--apply]
//
// audit    lists stored files against what the database refers to: unreferenced files (orphans), referenced
//          files that are missing, and files without a metadata row (--backfill adds the rows). Changes nothing else.
// cleanup  deletes orphans older than --min-age-hours. A dry run unless --apply is given.
// migrate  copies every file from one driver to the other and checks each copy by SHA-256. A dry run unless
//          --apply is given. The source is never changed or deleted: switch STORAGE_DRIVER only after a clean report.
//
// Exit code 0 = nothing to worry about, 2 = a problem was found (missing files, conflicts, failed copies).

process.env.DOTENV_CONFIG_QUIET = 'true'; // keep the output (and --json) clean
require('dotenv').config({ quiet: true });
const config = require('../config');
const pool = require('../pool');
const storage = require('../utils/storage');
const tools = require('./tools');

const args = process.argv.slice(2);
const command = args.shift();
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

async function main() {
  const json = flag('json');
  const out = (data, text) => console.log(json ? JSON.stringify(data, null, 2) : text);
  let problems = 0;

  if (command === 'audit') {
    const report = await tools.audit({ pool, minAgeHours: Number(value('min-age-hours', 24)), backfill: flag('backfill') });
    problems = report.missing.length;
    out(report, [
      `Storage driver: ${report.driver}`,
      `Files: ${report.files} (${mb(report.bytes)}); referenced by the database: ${report.referenced}`,
      `Unreferenced files older than ${value('min-age-hours', 24)} h (orphans): ${report.orphans.length}`,
      ...report.orphans.slice(0, 20).map((o) => `  ${o.key}  ${o.size} bytes  ${o.ageHours} h old`),
      `Referenced but MISSING from storage: ${report.missing.length}`,
      ...report.missing.slice(0, 20).map((m) => `  ${m.key}  (${m.referencedBy.join(', ')})`),
      `Files without a metadata row: ${report.withoutMetadata}${report.backfilled ? ` (+${report.backfilled} just added)` : report.withoutMetadata ? '  (run with --backfill to add them)' : ''}`,
      `Metadata rows without a file: ${report.metadataWithoutFile.length}`,
    ].join('\n'));
  } else if (command === 'cleanup') {
    const report = await tools.cleanup({ pool, minAgeHours: Number(value('min-age-hours', 24)), apply: flag('apply') });
    out(report, [
      report.dryRun ? 'DRY RUN: nothing was deleted (add --apply to delete).' : `Deleted ${report.removed.length} file(s), ${mb(report.bytesFreed)}.`,
      `Unreferenced files older than ${report.minAgeHours} h: ${report.candidates.length}`,
      ...report.candidates.slice(0, 50).map((o) => `  ${o.key}  ${o.size} bytes`),
      `Stale metadata rows ${report.dryRun ? 'that would be' : ''} removed: ${report.staleMetadata}`,
    ].join('\n'));
  } else if (command === 'migrate') {
    const from = value('from', config.storage.driver);
    const to = value('to', from === 'local' ? 's3' : 'local');
    if (!['local', 's3'].includes(from) || !['local', 's3'].includes(to) || from === to) {
      throw new Error('Give --from=local|s3 and --to=local|s3 (two different drivers)');
    }
    const source = storage.driverFromSettings({ driver: from });
    const target = storage.driverFromSettings({ driver: to });
    const report = await tools.migrate({ source, target, apply: flag('apply') });
    problems = report.conflicts.length + report.failed.length;
    out(report, [
      report.dryRun ? `DRY RUN ${from} -> ${to}: nothing was copied (add --apply to copy).` : `Migrated ${from} -> ${to}.`,
      `Files in the source: ${report.total}`,
      `${report.dryRun ? 'Would copy' : 'Copied'}: ${report.copied.length} (${mb(report.bytes)})`,
      `Already on the target with identical content: ${report.alreadyThere.length}`,
      `Conflicts (different content already on the target, left untouched): ${report.conflicts.length}`,
      ...report.conflicts.slice(0, 20).map((c) => `  ${c.key}`),
      `Failed: ${report.failed.length}`,
      ...report.failed.slice(0, 20).map((f) => `  ${f.key}: ${f.error}`),
      report.dryRun ? '' : `The source was not changed. When this report is clean, set STORAGE_DRIVER=${to} and restart; keep the source until you have checked the application.`,
    ].join('\n'));
  } else {
    console.log('Usage: storage audit|cleanup|migrate  (see the header of src/storage/cli.js)');
    problems = 1;
  }
  return problems;
}

main()
  .then((problems) => pool.end().then(() => process.exit(problems ? 2 : 0)))
  .catch((err) => {
    console.error(`Storage tool failed: ${err.message}`);
    pool.end().finally(() => process.exit(1));
  });
