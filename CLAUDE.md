# CLAUDE.md

Guidance for Claude Code in this repository. Background and audit: `docs/context.md`. Priorities and progress: `docs/feature-roadmap.md`. Technical reference: `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, `docs/DB_SCHEMA.md`, `docs/DECISIONS.md`.

## Project

**Pramaan** — online verification and digital certification of weighing and measuring instruments under the Legal Metrology Act, 2009 (SIH problem statement **26036**, team "Fulcrum"). Owners register instruments and apply for (re-)verification; an admin assigns and schedules an LMO/GATC officer; the officer records a field verification; an admin issues a PDF certificate with a QR code that anyone can validate publicly.

## Branch / git state

- Work on **`develop`**. Never modify `main` (`0eff1fc`). **Do not commit or push unless asked.** Always run `git status` and `git log origin/develop..develop` first: the state changes between sessions (at the last review `origin/develop` was at the Phase 5 baseline and later commits were still local).
- `api/node_modules`, `.env`, uploads, signing keys and the OCR model are untracked and git-ignored; keep it that way.
- **Commit hygiene (learned the hard way):** stage explicit paths with `git add -A -- <paths>` and use a plain `git commit`. Do **not** use `git commit --only -- <directory>` to commit staged deletions: git re-reads the files from disk and silently undoes them. After every commit run `git show --stat HEAD` and check the file list.
- Other remote branches: `pushkar-mobile-auth` (the mobile app was copied from its `pramaan1/` folder into `mobile/`; its separate `api1/` backend is not used) and `deploy` ("Ready for neonDB"). Both still contain old `.env` files in history.
- **Credentials:** the old `api/.env` values are in git history on GitHub (public). The old local DB password has been rotated and is rejected. **The old Neon `DATABASE_URL` (on `origin/deploy`) was still ACTIVE at the last check and must be rotated in the Neon console.** Never print secret values; to re-check run a connect-only test and report only accepted/rejected.

## Stack

Node.js (CommonJS) · Express 5 · PostgreSQL via `pg` (raw SQL) · JWT + bcrypt · multer · pdfkit + qrcode · embedded-postgres (tests only). Web: React 18 + Vite 6 + TypeScript + Tailwind + react-router 6 + recharts. Mobile: Expo SDK 54 + Expo Router in `mobile/` (imported from `pushkar-mobile-auth`/`pramaan1`).

## Commands

```bash
# API  (cd api)
npm install
npm run dev | npm start        # nodemon / node src/server.js (starts the background jobs)
npm run migrate | seed         # apply new migrations / seed roles, instrument types, dev users
npm run reset                  # DEV ONLY – drops everything in the public schema
npm run db:setup               # reset + migrate + seed
npm run jobs:run               # expire lapsed certificates + send expiry reminders once
npm run demo:users             # DEV ONLY: create demo.admin/owner/lmo@pramaan.local, prints a password once
npm run signing:dev-cert       # DEV ONLY: self-signed PDF signing key in api/signing/ (git-ignored)
npm run ocr:setup              # downloads the local OCR model into api/ocr-data (git-ignored); ocr:demo-plate makes a sample plate image
npm test                       # throw-away embedded PostgreSQL, applies all migrations, runs api/test/*.test.js
npm test -- test/workflow.test.js   # one file

# Web  (cd web)
npm install
npm run dev                    # http://localhost:5173
npx tsc --noEmit && npx vite build   # type-check + production build (no UI tests yet)
```

Config: copy `api/.env.example` → `api/.env` and `web/.env.example` → `web/.env`. `JWT_SECRET` is required; in production `INTEGRITY_SECRET` (≥32 chars, different from the JWT secret) is required too. `npm test` never reads `.env` and never touches a configured database (it uses a fresh embedded PostgreSQL 18 with a UTF8 cluster, needed for Hindi text). The seeded `dev.*@pramaan.local` users, including an ADMIN, all use the publicly known password `DevPassword123!`; `npm run demo:users` creates `demo.*@pramaan.local` accounts with a printed password. Both are development only: with `NODE_ENV=production` the API refuses to start while any `*@pramaan.local` account is ACTIVE (`utils/startupChecks.js`). The login page's demo quick-fill is development-build only. The database must be UTF8.

## Architecture (see docs/ARCHITECTURE.md)

```
api/src/
  server.js app.js pool.js            bootstrap, express app, the ONE pg Pool
  config/ middleware/ utils/          env, auth/RBAC/security/upload, shared helpers
  modules/<feature>/                  routes → controller → service → repository (+ validation)
     auth users instruments applications assignments schedules verifications
     certificates qr-auth attachments notifications fees queries reports sync enforcement documents nameplate
  jobs/                               expiry sweep, reminders, scheduler (advisory-lock guarded)
  db/migrations (001–032), db/seeds
api/test/                             run.js (temp Postgres), helpers.js, workflow.js, *.test.js
mobile/services/offline/              syncCore.ts (pure model), syncEngine.ts (push/pull via injected Http), OfflineContext.tsx (storage + auto-sync)
mobile/app/inspector/offline/         Field work list + inspection form (works without a connection)
web/src/{api,pages,components,context,types}
```

Rules the code follows (keep following them):
- Routes declare `authenticate` + `authorize(...)` + `validateBody(...)`; **services hold business rules and ownership checks**; repositories hold parameterised SQL only.
- Anything that changes more than one row runs in `withTransaction` (`utils/db.js`) together with its `audit.record(...)` and `notify(...)`.
- **Application status only changes through `utils/applicationStatus.transition`** (state machine + history).
- Certificates, verification evidence/results and `audit_log` are protected by database triggers; do not work around them in code.
- SQL `DATE` columns are returned as `YYYY-MM-DD` strings (see `pool.js`); don't convert to `Date` objects for JSON.
- File URLs returned by the API are signed automatically (`utils/ApiResponse`); never serve `/uploads` statically.
- Add roles only in `config/roles.js` AND the `role_name` enum. New feature = new `modules/<name>/` folder, registered in `modules/index.js`.
- Migrations: append-only, next number is **033**, never edit an applied one, name `NNN_description.sql`, constraints/indexes/triggers named `uq_/ck_/idx_/trg_<table>_…`. `ALTER TYPE … ADD VALUE` cannot be used in the same migration that adds it.
- Tests: add a case in `api/test/*.test.js` for every behaviour change; tests must use unique emails/serials (`h.unique`) because all files share one database.

## Domain flow (as implemented)

`POST /applications` (fees computed from `fee_rules`, status SUBMITTED) → *(optional)* admin `payment-verified` → admin **assigns** an LMO/GATC (UNDER_REVIEW) → officer accepts → admin **schedules** (SCHEDULED, no double-booking) → officer **starts verification** (GPS) → observations + readings (**server computes PASS/FAIL**) → evidence uploads (SHA-256, GPS, capture time) → **result** (sealed, one transaction, application COMPLETED) → admin **issues certificate** (PASS only; PDF + signed QR; hashes stored; default validity from the instrument type) → public check by QR/number/PDF hash; admin can **revoke** (permanent). Daily jobs expire lapsed certificates and send 30/15/7/1-day reminders. Officers and owners exchange **queries** on an application.

## Do not

- Do not commit or push without being asked; do not touch `main`.
- Do not run `npm run reset` / `db:setup` against a database you have not confirmed is disposable.
- Do not rewrite or force-push history, delete committed files, or rotate/replace secrets without explicit approval — explain the risk first. (Untracking `api/node_modules` and removing the scraped `emaap` assets were already approved and done.)
- Do not use database IDs or invented defaults in client code (an old hard-coded instrument-type list caused "Invalid or inactive instrument type").
- Do not weaken the integrity rules: no un-revoking, no editing issued certificates, no client-supplied PASS/FAIL for computable readings.

## More rules (keep following them)

- Instrument edit/deactivate/decommission goes through `modules/instruments/instruments.lifecycle.js`; "first verification or renewal?" is decided only by `utils/renewal.js`; required documents live in `modules/documents`.
- OCR output (`modules/nameplate`) is advice only: it must never change an instrument, certificate or case, and a person other than the uploader decides.
- Write PASS/FAIL/NOT TESTED honestly in `docs/TEST_REPORT.md`; do not claim browser, device or real-provider (SMTP, SMS, S3, CA signature) behaviour that was not actually run.

## Where to look

`docs/TEST_REPORT.md` (what passed / was not tested), `docs/PPT_DEMO.md` (demo script and pitch), `docs/PHASE6_PLAN.md` (ranked next features), `docs/DESIGN_ED25519_QR.md` (offline QR design, not built), `docs/feature-roadmap.md` (progress table).

## Known gaps (details in `docs/context.md` §13 and the roadmap)

OCR nameplate reading is proven on generated images only (accuracy on real photographs unmeasured; English only); the mobile offline flow has never run on a device or emulator; offline photo queue and offline assignment-accept in the mobile app (structured inspection data syncs); the older online screens in `mobile/app` (written for the separate `api1` backend) are unverified against `api/`; Hindi covers navigation, landing, sign-in, public verification, notifications and server-written messages/PDF (other screens are English; no other Indian languages); e-mail/SMS are built and tested with fakes but untried against a real SMTP server or SMS gateway (DLT registration needed in India); S3 storage is tested with a fake client only, and existing files are not migrated between drivers; the PDF signature is PKCS#7 with a self-signed dev key (no PAdES profile, no timestamp, no CA trust evaluation, needs a CA-issued DSC); frontend tests; PDFs/UI not yet looked at in a browser.
