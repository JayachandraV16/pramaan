# Pramaan

A Unified Digital Platform for Legal Metrology Verification and Certification (SIH problem statement 26036).

**Team:** Fulcrum

Owners register weighing/measuring instruments and apply for (re-)verification; an administrator assigns and schedules an LMO/GATC officer; the officer records the field verification; the administrator issues a PDF certificate whose QR code anyone can validate online. Expiring certificates trigger reminders.

## Repository structure

- `api/` — Express + PostgreSQL backend (`npm test` runs the full test suite against a temporary database)
- `web/` — React + Vite + TypeScript web application
- `mobile/` — Expo mobile application (work in progress on the `pushkar-mobile-auth` branch)
- `docs/` — architecture & security framework, API contracts, database schema, decisions, context and roadmap

## Quick start (development)

Requirements: Node.js 20+ and PostgreSQL 14+ (with the `pgcrypto` and `citext` extensions).

```bash
# 1. API
cd api
cp .env.example .env            # fill in DB settings and two long random secrets
npm install
npm run db:setup                # DEV ONLY: reset + migrate + seed an empty database
npm run dev                     # http://localhost:5000  (GET /health)

# 2. Web (second terminal)
cd web
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

`npm run db:setup` deletes everything in the database it points at — use a database you can lose. On an existing database use `npm run migrate` instead.

The seed creates one development user per role (`dev.admin@pramaan.local`, `dev.owner@…`, `dev.lmo@…`, `dev.gatc@…`, `dev.public@…`). Their password hash is shared and the password is not documented; create your own accounts for testing and **remove the seeded users before any real deployment**. New LMO/GATC accounts that register online must be approved on the admin "User Accounts" page.

## Demo accounts and walkthrough

```bash
cd api && npm run demo:users      # creates demo.admin@ / demo.owner@ / demo.lmo@pramaan.local, prints a password once
```

Development only (refuses to run when `NODE_ENV=production`); it never modifies other users. Use `-- --reset-password` to set a new password on the demo accounts, or `DEMO_PASSWORD=...` to choose one. Delete the accounts before a real deployment.

Owner-to-certificate demo (three browser windows or profiles, or log out and in):
1. **Owner:** *Instruments → Add*, then *Applications → New application* for it.
2. **Admin:** open the application, *assign* the officer (`demo.lmo`), then *schedule* a date (the owner and officer get notifications).
3. **Officer:** *My Assigned Applications* → accept → start the inspection, add readings (PASS/FAIL is computed from expected value and tolerance), upload a photo, submit the PASS result.
4. **Admin:** open the completed application → *Issue certificate* (PDF + QR are generated).
5. **Anyone (no login):** *Verify documents* → enter the certificate number or upload the PDF. Then, as admin, revoke the certificate and verify again to see the revoked verdict.

## Mobile app (Expo, officers)

`mobile/` is the Expo Router app imported from the `pushkar-mobile-auth` branch (its `pramaan1` folder; that branch's separate `api1` backend is not used - the app talks to `api/`).

```bash
cd mobile
cp .env.example .env     # EXPO_PUBLIC_API_URL; for a physical phone use your PC's LAN address, e.g. http://192.168.1.20:5000/api
npm install
npx expo start
```

**Field work (works offline)** - officer home screen -> *Field work*: the phone caches assigned jobs, the officer records GPS, readings and observations without a connection, and saves a PASS/FAIL result. Drafts upload automatically (on app start, on return to the foreground, every minute while something is waiting, or with *Sync now*) through `POST /api/sync/push`; `GET /api/sync/pull` refreshes the jobs. Every record has a client UUID so retries never duplicate. The accept step and photo upload still need a connection.

## Optional services (all off by default)

Set in `api/.env` (see `api/.env.example`):

| Feature | Settings |
|---|---|
| E-mail / SMS notifications | `DELIVERY_MODE=log` (writes to the log) or `live` with `SMTP_URL`, `EMAIL_FROM`, `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `SMS_SENDER_ID` |
| S3-compatible file storage | `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (MinIO/R2), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` |
| Signed certificate PDFs | `cd api && npm run signing:dev-cert`, then add the printed `SIGNING_P12_PATH` / `SIGNING_P12_PASSPHRASE` lines. A self-signed key is for development only; production needs a CA-issued Digital Signature Certificate |

The database must be **UTF8** (Hindi text). With `NODE_ENV=production` the API refuses to start while any `*@pramaan.local` account (the seeded `dev.*` and the `demo.*` ones) is active.

## Tests

```bash
cd api && npm test              # starts a throw-away PostgreSQL, applies all migrations, runs ~90 tests (includes the mobile offline engine against the real API)
cd web && npx tsc --noEmit && npx vite build
```

## Documentation

- `docs/ARCHITECTURE.md` — components, workflow, security framework, tamper-evidence (SHA-256/HMAC), deployment method
- `docs/API_CONTRACTS.md` — every endpoint, roles, request/response notes
- `docs/DB_SCHEMA.md`, `docs/DECISIONS.md`
- `docs/context.md` — project analysis, PS 26036 audit and implementation record
- `docs/feature-roadmap.md` — progress and next steps
- `CLAUDE.md` — working rules for AI-assisted development
