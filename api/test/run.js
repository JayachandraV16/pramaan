// api/test/run.js
//
// Test runner. Boots a THROWAWAY embedded PostgreSQL (temp dir, random port,
// deleted afterwards), applies every migration + seed from src/db, then runs
// `node --test` against the test files with DATABASE_URL pointing at it.
//
// It never touches any database configured in api/.env — the env vars below
// are set explicitly for the child process only.
//
//   npm test                   run everything
//   npm test -- test/foo.test.js   run selected files

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');

const SRC_DB = path.join(__dirname, '..', 'src', 'db');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function applySqlDir(client, dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      throw new Error(`${path.basename(dir)}/${file}: ${err.message}`);
    }
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-pg-'));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  let exitCode = 1;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('pramaan_test');

    const url = `postgres://postgres:postgres@127.0.0.1:${port}/pramaan_test`;
    const client = new Client({ connectionString: url });
    await client.connect();
    await applySqlDir(client, path.join(SRC_DB, 'migrations'));
    await applySqlDir(client, path.join(SRC_DB, 'seeds'));
    await client.end();

    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pramaan-uploads-'));
    const args = ['--test', '--test-concurrency=1'];
    const requested = process.argv.slice(2);
    if (requested.length) args.push(...requested);
    else args.push('test/*.test.js');

    exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: url,
          JWT_SECRET: 'test-secret-test-secret-test-secret-32b',
          INTEGRITY_SECRET: 'test-integrity-secret-test-integrity-32b',
          UPLOAD_DIR: uploadDir,
          LOG_LEVEL: 'error',
          BCRYPT_SALT_ROUNDS: '4',
          FRONTEND_URL: 'http://localhost:5173',
        },
      });
      child.on('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    await pg.stop().catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Test runner failed:', err.message);
  process.exit(1);
});
