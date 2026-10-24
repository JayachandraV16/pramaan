# CLAUDE.md

Guidance for Claude Code in this repository. Background and audit: `docs/context.md`. Priorities and progress: `docs/feature-roadmap.md`. Technical reference: `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, `docs/DB_SCHEMA.md`, `docs/DECISIONS.md`.

## Project

**Pramaan** — online verification and digital certification of weighing and measuring instruments under the Legal Metrology Act, 2009 (SIH problem statement **26036**, team "Fulcrum"). Owners register instruments and apply for (re-)verification; an admin assigns and schedules an LMO/GATC officer; the officer records a field verification; an admin issues a PDF certificate with a QR code that anyone can validate publicly.

## Branch / git state

- Work on **`develop`**. It is a local fast-forward of `web-frontend` and is **ahead of `origin/develop` and unpushed**. Never modify `main`. **Do not commit or push unless asked.**
- Uncommitted work is substantial (security hardening, certificate integrity, workflow rules, reports, fees, queries, tests, docs). Check `git status` before assuming a clean tree.
- Other remote branches: `pushkar-mobile-auth` (Expo mobile + `api1/`, `pramaan1/` folders; not merged, not inspected) and `deploy` ("Ready for neonDB"; not inspected).
- Still tracked in git although they should not be: `api/node_modules/` (~2,860 files) and a few generated files. History also still contains the old `api/.env` — treat those credentials as leaked and rotate them. Untracking needs the owner's approval (see "Do not").

## Stack

Node.js (CommonJS) · Express 5 · PostgreSQL via `pg` (raw SQL) · JWT + bcrypt · multer · pdfkit + qrcode · embedded-postgres (tests only). Web: React 18 + Vite 6 + TypeScript + Tailwind + react-router 6 + recharts. Mobile (Expo): not on this branch.

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
npm test                       # throw-away embedded PostgreSQL, applies all migrations, runs api/test/*.test.js
npm test -- test/workflow.test.js   # one file

# Web  (cd web)
npm install
npm run dev                    # http://localhost:5173
npx tsc --noEmit && npx vite build   # type-check + production build (no UI tests yet)
```

Config: copy `api/.env.example` → `api/.env` and `web/.env.example` → `web/.env`. `JWT_SECRET` is required; in production `INTEGRITY_SECRET` (≥32 chars, different from the JWT secret) is required too. `npm test` never reads `.env` and never touches a configured database. The seeded `*@pramaan.local` users share a development password hash that is not documented; create your own users (admin console or SQL) for manual testing.

## Architecture (see docs/ARCHITECTURE.md)

```
api/src/
  server.js app.js pool.js            bootstrap, express app, the ONE pg Pool
  config/ middleware/ utils/          env, auth/RBAC/security/upload, shared helpers
  modules/<feature>/                  routes → controller → service → repository (+ validation)
     auth users instruments applications assignments schedules verifications
     certificates qr-auth attachments notifications fees queries reports sync
  jobs/                               expiry sweep, reminders, scheduler (advisory-lock guarded)
  db/migrations (001–023), db/seeds
api/test/                             run.js (temp Postgres), helpers.js, workflow.js, *.test.js
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
- Migrations: append-only, next number is **024**, never edit an applied one, name `NNN_description.sql`, constraints/indexes/triggers named `uq_/ck_/idx_/trg_<table>_…`. `ALTER TYPE … ADD VALUE` cannot be used in the same migration that adds it.
- Tests: add a case in `api/test/*.test.js` for every behaviour change; tests must use unique emails/serials (`h.unique`) because all files share one database.

## Domain flow (as implemented)

`POST /applications` (fees computed from `fee_rules`, status SUBMITTED) → *(optional)* admin `payment-verified` → admin **assigns** an LMO/GATC (UNDER_REVIEW) → officer accepts → admin **schedules** (SCHEDULED, no double-booking) → officer **starts verification** (GPS) → observations + readings (**server computes PASS/FAIL**) → evidence uploads (SHA-256, GPS, capture time) → **result** (sealed, one transaction, application COMPLETED) → admin **issues certificate** (PASS only; PDF + signed QR; hashes stored; default validity from the instrument type) → public check by QR/number/PDF hash; admin can **revoke** (permanent). Daily jobs expire lapsed certificates and send 30/15/7/1-day reminders. Officers and owners exchange **queries** on an application.

## Do not

- Do not commit or push without being asked; do not touch `main`.
- Do not run `npm run reset` / `db:setup` against a database you have not confirmed is disposable.
- Do not delete or untrack committed files (e.g. `git rm --cached -r api/node_modules`, history rewrites, secret rotation) without explicit approval — explain the risk first.
- `web/src/emaap_extracted_resources/` is no longer imported by anything (landing page and footer were rewritten with original content). Deleting the folder (15 MB of scraped government assets) still needs the owner's approval.
- Do not weaken the integrity rules: no un-revoking, no editing issued certificates, no client-supplied PASS/FAIL for computable readings.

## Known gaps (details in `docs/context.md` §13 and the roadmap)

Mobile (Expo) client for the offline sync API (`/api/sync` push/pull is built; offline photo queue is not); multilingual UI/PDF; enforcement and repeat-offender tracking; email/SMS delivery (notifications are in-app only); object storage for uploads; PAdES-signed PDFs; e-mail/SMS for notifications; frontend tests; untracking `api/node_modules` and rotating the leaked credentials.
