// api/test/helpers.js
//
// Shared helpers for API tests. Tests run against the throwaway database
// started by test/run.js (DATABASE_URL is injected by the runner).

const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const pool = require('../src/pool');
const app = require('../src/app');

let server;
let baseUrl;

async function start() {
  if (server) return baseUrl;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stop() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
  await pool.end();
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON (file, html) response
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

const unique = (prefix = 'u') => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;

// Inserts an ACTIVE user directly (bypasses the public registration rules)
// and returns { id, email, token }.
async function createUser(role, overrides = {}) {
  const email = overrides.email || `${unique(role.toLowerCase())}@test.local`;
  const password = overrides.password || 'Passw0rd!test';
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    `INSERT INTO users (role_id, full_name, email, password_hash, status)
     SELECT r.id, $2, $3, $4, $5 FROM roles r WHERE r.name = $1
     RETURNING id`,
    [role, overrides.fullName || `Test ${role}`, email, hash, overrides.status || 'ACTIVE']
  );
  const login = await call('POST', '/api/auth/login', { body: { email, password } });
  return { id: rows[0].id, email, password, token: login.body?.data?.token };
}

module.exports = { start, stop, call, createUser, unique, pool };
