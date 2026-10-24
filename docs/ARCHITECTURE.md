# Pramaan architecture

Pramaan is the online verification and digital certification system for weighing and measuring instruments under the Legal Metrology Act, 2009 (SIH problem statement 26036). This document covers the software architecture, the security framework and the deployment method.

## 1. System overview

```
 Browser (React SPA)  ─┐                           ┌─► PostgreSQL (data, audit log, schema_migrations)
 Mobile app (Expo)*   ─┼─ HTTPS / JSON ─► Express API ─┤
 Public QR scanners   ─┘   (JWT, RBAC)      │        └─► Upload directory (photos, certificate PDFs)
                                            └─► Background jobs (expiry sweep, reminders)
```
\* The Expo app lives on the `pushkar-mobile-auth` branch and is not part of `develop` yet.

| Part | Technology | Location |
|---|---|---|
| API | Node.js (CommonJS), Express 5, `pg` (raw SQL), `jsonwebtoken`, `bcrypt`, `multer`, `pdfkit`, `qrcode` | `api/` |
| Web | React 18, Vite, TypeScript, Tailwind, react-router, recharts | `web/` |
| Database | PostgreSQL 14+ with `pgcrypto`, `citext` (tested on 18) | `api/src/db` |
| Tests | Node's built-in test runner against a throw-away embedded PostgreSQL | `api/test` |

## 2. Backend structure

```
api/src/
  server.js app.js pool.js         bootstrap, express app, the single pg Pool
  migrate.js seed.js reset.js      DB scripts (npm run migrate | seed | reset)
  config/                          env parsing (index.js), role names (roles.js)
  middleware/                      authMiddleware, rbacMiddleware, security (headers, CORS, rate limit),
                                   upload (multer + content check), validate, errorHandler, notFound
  modules/<feature>/               routes → controller → service → repository (+ validation)
      auth users instruments applications assignments schedules verifications
      certificates qr-auth attachments notifications fees queries reports
  jobs/                            certificateLifecycle, expiryReminders, scheduler, run
  utils/                           integrity, certificateIntegrity, audit, applicationStatus, notify,
                                   db (withTransaction), listQuery, csv, measurement, verificationSeal, …
  db/migrations, db/seeds          001…022 SQL, idempotent seed
```

Layer rules: **routes** declare authentication, role guard and body validation; **controllers** are thin; **services** hold business rules and ownership checks and throw `ApiError`; **repositories** hold parameterised SQL only. Anything that changes more than one row runs inside `withTransaction`, together with its audit entry and notifications.

## 3. Domain workflow

```
 owner registers instrument ──► files application (fees computed, status SUBMITTED)
        ▲                                   │ ADMIN verifies payment (optional gate), assigns LMO/GATC
        │ re-verification due               ▼
   expiry reminders ◄── certificate ◄── ADMIN issues ◄── PASS result (sealed)  ◄── field verification
   (30/15/7/1 days)     (PDF + QR)                        readings computed server-side, evidence attached
        │                    │
        └────────────────────┴──► public QR / certificate-number check, PDF hash check, revocation
```

Application status machine (single implementation in `utils/applicationStatus.js`, every change recorded in `application_status_history`):
`SUBMITTED → UNDER_REVIEW (assigned) → SCHEDULED → COMPLETED`; `REJECTED` (ADMIN) and `CANCELLED` (applicant/ADMIN) from any open state; the three end states are final.

## 4. Security framework

| Layer | Controls |
|---|---|
| Identity | bcrypt (cost 12) password hashes; password policy (8–128 chars, letter + digit); login compares against a dummy hash when the account does not exist (no timing/enumeration signal) and discloses account state only after a correct password; JWT (HS256, 8 h) |
| Accounts | Self-registration only for owners/public users. LMO/GATC register online but stay `PENDING_APPROVAL` until an ADMIN approves; ADMIN accounts are never self-registrable. The account's **current** status and role are re-read from the database on every request, so suspension takes effect immediately |
| Access control | Route-level role guards (`rbacMiddleware`) plus service-level ownership/assignment checks; list endpoints and reports are scoped per role |
| Input | Body validation, parameterised SQL everywhere, JSON body limit 1 MB, upload type checked by extension **and** magic bytes, 10 MB limit, random server-side file names |
| Transport/browser | Security headers (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, restrictive CSP, HSTS in production), CORS allow-list from `FRONTEND_URL` / `CORS_ORIGINS`, no `X-Powered-By` |
| Abuse | In-memory rate limits on login, registration, password change and the public verification endpoints (use Redis or the DB if the API is scaled horizontally) |
| Files | `/uploads` is not public: links are HMAC-signed with an expiry (`INTEGRITY_SECRET`), path traversal is rejected, responses are `nosniff` |
| Certificate integrity | See §5 |
| Evidence integrity | Server-side SHA-256 of every upload; GPS and capture time stored; verification result sealed (§5); readings/observations/results locked by triggers once the verification finishes |
| Accountability | Append-only, hash-chained `audit_log` (§5) for issue, revoke, status changes, approvals, assignments, results, fee changes |
| Secrets | Only via environment variables; production start-up refuses weak/missing `JWT_SECRET` or `INTEGRITY_SECRET`; `.env` is git-ignored (`api/.env.example` documents all variables) |
| Privacy | The public verification result masks the owner's personal name; personal contact details are never returned publicly |

Known limitations: JWTs cannot be individually revoked before expiry (account status checks mitigate this); the rate limiter is per-process; email/SMS delivery of notifications is not implemented (in-app only); uploaded files are stored on local disk.

## 5. Tamper evidence: where SHA-256 / HMAC are used

| What | Mechanism | Purpose |
|---|---|---|
| Certificate PDF | SHA-256 stored at issue (`pdf_sha256`); public `POST /api/qr-auth/check-document` hashes an uploaded file and looks it up | A printed/e-mailed copy that was edited or forged does not match |
| Certificate record | SHA-256 over number, verification, instrument, issue/valid dates and QR token (`record_sha256`), recomputed on **every** public verification; immutable columns also guarded by a trigger | Detects direct database edits |
| QR link | `…/verify-public?q=<token>&s=<HMAC-SHA256(secret, token‖number) truncated to 128 bit>`, compared in constant time | An edited or fabricated QR URL is rejected and logged as `TAMPER_DETECTED` |
| Verification result | SHA-256 seal over decision + all readings + all observations (`result_sha256`) | Proves the evidence behind a PASS/FAIL was not changed afterwards |
| Uploads | SHA-256 of each file (`attachments.file_sha256`) | Detect corruption/replacement of evidence |
| Audit log | `hash = SHA-256(previous hash ‖ actor ‖ action ‖ entity ‖ details ‖ time)`; `UPDATE`/`DELETE` blocked by trigger; `verifyChain()` recomputes | Edited or removed history breaks every later hash |
| File links | HMAC-SHA256 over path + expiry | Short-lived access to private files |

SHA-256 detects change; HMAC proves a value was produced by the server; neither replaces access control. A legally recognised signature on the PDF (PAdES with a Digital Signature Certificate / eSign) is a production step that is **not** implemented.

## 6. Background jobs

`jobs/index.js → runDailyJobs()`: (1) mark `ACTIVE` certificates past `valid_until` as `EXPIRED` (audited, owner notified); (2) send expiry reminders at 30, 15, 7 and 1 days (`reminder_log` makes it idempotent). Triggered by the in-process scheduler (`JOBS_INTERVAL_MINUTES`, default 360, `0` disables; a PostgreSQL advisory lock keeps multiple API instances from running it simultaneously) or externally with `npm run jobs:run`.

## 7. Testing

`cd api && npm test` starts a temporary PostgreSQL (the `embedded-postgres` dev dependency), applies every migration and seed, and runs the suites in `api/test` with `node --test`: security & accounts, certificates & tamper detection, workflow & state machine, reports & exports, lists & profile, reminders / fees / queries. It never connects to any configured database. Frontend: `cd web && npx tsc --noEmit && npx vite build` (no UI test framework yet).

## 8. Deployment method

**Environment variables (API)** — full list in `api/.env.example`:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` or `DB_HOST/PORT/USER/PASSWORD/NAME` | yes | PostgreSQL (use `sslmode=require` for managed services such as Neon) |
| `JWT_SECRET` | yes | ≥ 32 random characters in production |
| `INTEGRITY_SECRET` | production | ≥ 32 random characters; different from `JWT_SECRET`. Rotating it invalidates existing QR signatures and file links |
| `NODE_ENV=production` | yes | enables HSTS and strict secret checks |
| `FRONTEND_URL`, `CORS_ORIGINS` | yes | public web origin (used in QR links and CORS) |
| `TRUST_PROXY=true` | behind a proxy | so rate limits use the real client IP |
| `UPLOAD_DIR` | recommended | persistent storage path for photos/PDFs |
| `JOBS_INTERVAL_MINUTES`, `MIN_EVIDENCE_FOR_PASS`, `REQUIRE_PAYMENT_BEFORE_ASSIGNMENT`, `FILE_URL_TTL_SECONDS`, `BCRYPT_SALT_ROUNDS`, `LOG_LEVEL` | optional | tuning |

**Steps**

1. Provision PostgreSQL 14+ (extensions `pgcrypto`, `citext`). Create an empty database and a least-privilege application user.
2. API: `cd api && npm ci --omit=dev`, set the variables, `npm run migrate`, `npm run seed` (creates roles, instrument types and **development** users — remove or change those accounts in production), `npm start` behind an HTTPS reverse proxy (TLS termination, `TRUST_PROXY=true`).
3. Create the first real ADMIN directly in the database (or adapt the seed), then create LMO/GATC accounts from the admin console or approve their registrations.
4. Web: `cd web && npm ci && VITE_API_BASE_URL=https://api.example.gov.in/api npm run build`, serve `web/dist` as static files (SPA fallback to `index.html`) from the origin in `FRONTEND_URL`.
5. Persist `UPLOAD_DIR` (volume or object-storage mount) and include it in backups together with the database; certificate PDFs are referenced by `pdf_sha256`, so a restored file can always be verified.
6. Configure fee rules (`POST /api/fees/rules`) and per-type validity (`PATCH /api/instruments/types/:id`) from the State's notification before accepting applications.
7. Backups: nightly `pg_dump`; test restores. Monitor `/health`, 5xx rate, and the `TAMPER_DETECTED` audit entries.

Migrations are append-only and applied in filename order inside a transaction each (`schema_migrations` records them). Never edit an applied migration; add the next number.

## Phase 5 components

- **Enforcement** (`modules/enforcement`): cases, timeline, `repeat_offenders` view, admin dashboard figures.
- **Localisation** (`utils/i18n.js`, `web/src/i18n`): per-user language; server-written notifications and the certificate PDF in English and Hindi.
- **Delivery** (`utils/delivery.js`, `notification_deliveries`): outbox → SMTP / SMS gateway worker with retries; started by the scheduler when `DELIVERY_MODE` is not off.
- **Storage** (`utils/storage.js`): local or S3-compatible; every file read/write goes through it.
- **Signing** (`utils/pdfSigner.js`): signs the certificate PDF and verifies embedded signatures.
- **Start-up guard** (`utils/startupChecks.js`): production refuses to run with dev/demo accounts.
