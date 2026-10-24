# Pramaan — Project Context

_Analysis of branch `develop` @ `4f21754` ("feat: add legal metrology domain fields"), 17 commits ahead of `main` (`0eff1fc`). Derived from reading the source; items marked **(inferred)** are deductions, not stated in the repo. Last updated 2026-10-24. This supersedes the earlier `main`-only analysis (which described a schema-only scaffold)._

## 1. What it is

Pramaan: "A Unified Digital Platform for Legal Metrology Verification and Certification" (team **Fulcrum**). It digitises the periodic verification of weighing/measuring instruments used in trade. Roles: `INSTRUMENT_OWNER`, `LMO` (Legal Metrology Officer, field work), `GATC` (Government Approved Test Centre user), `ADMIN`, `PUBLIC_USER`. Domain fields (LCR number, applicant type, GRAS challan, conveyance/quarter-jump fees, division/submission office) point at the Indian eMaap/Legal Metrology process; the repo even contains a saved copy of emaap.gov.in as design reference.

## 2. Branches

| Branch | vs `develop` | Notes |
|---|---|---|
| `main` | 26 behind | Schema scaffold only. Untouched. |
| **`develop`** (current) | — | Backend + 18 migrations **+ React web app** (local fast-forward to `web-frontend` @ `2e6880d`; 9 commits ahead of `origin/develop`, **not pushed**). The 47 `emaap_extracted_resources` files are deleted in the index (staged, not committed). |
| `web-frontend` | 0 (fully contained in local `develop`) | Same repo, separate branch; this is where the frontend was built. It also touched `api/` (officer access to instruments, `FRONTEND_URL`-based QR link, +423 lines in `verifications.repository.js`). Its own ref still carries `api/node_modules` and the emaap files. |
| `pushkar-mobile-auth` | +8 | Mobile auth work; restructures into `api1/`, `pramaan1/` (commit says to use those, not `api/`/`pramaan/`). Not inspected. |
| `deploy` | +1 | "Ready for neonDB" (Neon Postgres deployment prep). Not inspected. |

Merging these will need a plan, especially the `api` vs `api1` fork.

## 3. Tech stack (from `api/package.json` and source)

- Runtime: Node.js, CommonJS. No TypeScript, no lint/format config.
- Web framework: **Express ^5.2.1**, `cors` (open, no options), `dotenv ^17`.
- DB: **PostgreSQL** through `pg ^8.23` with raw parameterised SQL (no ORM). Extensions `pgcrypto`, `citext`.
- Auth: `jsonwebtoken ^9` (HS256 shared secret, 8h default, payload `{id, role}`), `bcrypt ^6`.
- Files/docs: `multer ^2.2` (disk storage in `api/src/uploads`, jpg/jpeg/png/pdf, 10 MB), `pdfkit ^0.20` (certificate PDF), `qrcode ^1.5` (QR PNG).
- Dev: `nodemon`. **No test framework.**
- `web/`: **React 18 + Vite 6 + TypeScript 5.7 + Tailwind 3.4**, `react-router-dom` 6, `recharts`, `lucide-react` (`web/package.json`). No test framework, no i18n library. API base URL from `VITE_API_BASE_URL` (default `http://localhost:5000/api`).
- `mobile/` (Expo) is declared in README only: empty `.gitkeep` folders on `develop` (work is on `pushkar-mobile-auth`, not inspected).
- The saved emaap.gov.in copy (`web/src/emaap_extracted_resources/`, 47 files) was reference material only and has been removed from the index.

## 4. Repository layout (`develop`)

```
README.md                  stale: folder list + stray "- testing"
.gitignore                 EMPTY
api/
  .env                     TRACKED (DB_*, PORT, JWT_SECRET)
  node_modules/            TRACKED (2,861 files)
  package.json, package-lock.json
  uploads/certificates/    2 committed PDFs (CERT-2026-000002/3)
  src/
    server.js app.js pool.js migrate.js seed.js reset.js
    assets/pramaan_logo_main.png          used by PDF generator
    uploads/                              1 committed test .jpg (multer's actual dir)
    config/ middleware/ utils/ db/{migrations,seeds}/
    modules/{auth,instruments,applications,assignments,schedules,verifications,certificates,attachments,notifications,qr-auth}/
web/                       Vite app: src/{api,components/common,context,pages/*,types}, App.tsx (17 routes), tailwind/ts configs
                           (note: web/.vite/deps cache is tracked)
mobile/src/                empty folders
docs/                      API_CONTRACTS, ARCHITECTURE, DB_SCHEMA, DECISIONS — all empty; context.md, feature-roadmap.md
```

Note two upload locations: multer writes to `api/src/uploads` (resolved from `__dirname`) while `/uploads` static serving and certificate PDFs use `process.cwd()/uploads` (i.e. `api/uploads` when run from `api/`). Attachment URLs (`/uploads/<file>`) therefore point at a directory they are not stored in unless the two are the same path — see issue 13.

## 5. Backend architecture

Request path: `app.js` → `cors`, `express.json`, `/uploads` static, `GET /health`, `/api` → `modules/index.js` → module router → `authenticate` (Bearer JWT) → `authorize(...roles)` → `validateBody(rules)` → controller → service → repository (`pool.query`). `notFound` then `errorHandler` close the chain (`ApiError` operational errors return their message; others return "Something went wrong", with stack in development).

Per module: `routes / controller / service / repository / validation`. Services own business rules; repositories own SQL. `config/roles.js` is the single role list. `pool.js` is deliberately independent of `config/` so migrate/seed/reset don't need `JWT_SECRET`.

### API surface (all under `/api`)

| Module | Endpoints | Who |
|---|---|---|
| auth | `POST /auth/register`, `POST /auth/login` (email only), `GET /auth/me` | register/login public |
| instruments | `POST/GET /instruments`, `GET /instruments/:id` | OWNER, ADMIN (owners see own) |
| applications | `POST/GET /applications`, `GET /applications/:id` | create: OWNER, ADMIN; list: owner own, ADMIN/GATC all |
| assignments | `POST`, `GET`, `GET /:id`, `PATCH /:id` (status) | create: ADMIN; assignee/ADMIN update |
| schedules | `POST`, `GET`, `GET /:id`, `PATCH /:id` | create: ADMIN |
| verifications | `POST /` (start), `GET`, `GET /:id`, `GET /:id/result`, `POST /:id/observations`, `POST /:id/readings`, `POST /:id/result` | ADMIN, LMO, GATC (own) |
| certificates | `POST` (issue), `GET`, `GET /:id`, `PATCH /:id` (status) — ADMIN; **public** `GET /certificates/verify/:qrToken` | |
| qr-auth | **public** `GET /qr-auth/:token` (logs scan to `qr_authentications`) | |
| attachments | `POST` (multipart upload), `GET /:id`, `GET /application/:id`, `/verification/:id`, `/certificate/:id`, `DELETE /:id` | any authenticated user with access to the parent application |
| notifications | `POST` (ADMIN), `GET` mine, `PATCH /read-all`, `GET /:id`, `PATCH /:id/read` | authenticated |

Exact attachment/notification sub-paths should be confirmed in the route files; the table is summarised from route comments.

## 6. Database

Migrations `001`–`018` in `api/src/db/migrations/` (the earlier `03_` misnaming was fixed to `003_`; 008/009 are now populated). Applied by a custom runner (`migrate.js`: sorted `.sql` files, one transaction each, `schema_migrations` tracking table). Seed `001_initial_data.sql` is idempotent (`ON CONFLICT DO NOTHING`).

**Enums (17):** the 15 from `main` plus `applicant_type` (MANUFACTURER/DEALER/USER/HAWKER) and `instrument_origin` (LOCAL/IMPORTED).

**Tables:** `roles`, `users` (+ `lcr_number` unique-when-set, `applicant_type`), `instrument_types`, `instruments`, `verification_applications` (+ division, submission_office, instrument_origin, GRAS challan no./date, conveyance & quarter-jump fees, `last_certificate_id`), `verification_assignments`, `verification_schedules`, `verifications`, `inspection_observations`, `verification_readings`, `verification_results` (1:1 with verification), `verification_certificates` (random `qr_token`, unique number, validity window), `attachments` (exactly one of application/verification/certificate FK, CHECK-enforced), `qr_authentications` (scan log with IP/UA), `notifications`, `application_number_counters`, `schema_migrations`.

**Views:** `active_certificates`, `certificates_expiring_soon` (30 days), `certificates_past_due`, `pending_applications`, `schedules_today`.

**Triggers/functions:** `set_updated_at` on mutable tables; `check_assignee_role` (assignee must be LMO/GATC); `check_certificate_requires_pass` (certificate insert requires a PASS result).

```
roles 1─* users 1─* instruments *─1 instrument_types
users 1─* applications *─1 instruments ;  application 1─* assignments 1─* schedules
assignment 1─* verifications 1─* {observations, readings} ; verification 1─1 result ; verification 1─1 certificate
certificate 1─* qr_authentications ; application/verification/certificate 1─* attachments ; users 1─* notifications
```

Seeds: 5 roles, 6 instrument types, 5 dev users (one per role), 1 instrument (`SN-DEV-0001`).

## 7. Key workflows (as implemented)

1. **Register/login** — `register` hashes the password (bcrypt), looks up the role id, returns user + JWT. LCR number/applicant type are stored only for owners. Login is by email; inactive/suspended accounts are rejected.
2. **Instrument** — owner creates; list is scoped by role.
3. **Application** — requires type, `division` (uppercased into the number), valid origin; `RE_VERIFICATION` requires `lastCertificateId`, which must exist and belong to the same instrument; owners can only apply for their own instruments. Number `LM/{year}/{DIV}/{6-digit seq}` is generated inside a transaction using `application_number_counters`.
4. **Assignment** — ADMIN assigns an LMO/GATC (active user; application not terminal) and the application becomes `UNDER_REVIEW`. Assignee (or ADMIN) updates assignment status.
5. **Schedule** — ADMIN schedules against an assignment (not DECLINED/COMPLETED); application becomes `SCHEDULED`.
6. **Verification** — the assigned officer can start only when the assignment is `ACCEPTED` (and any referenced schedule is active). While `IN_PROGRESS` they add observations and readings; `POST …/result` stores PASS/FAIL, sets verification `COMPLETED` and application `COMPLETED`.
7. **Certificate** — ADMIN issues for a COMPLETED, PASS verification (one per verification). Generates number `CERT-{year}-{seq}`, QR PNG of `http://localhost:5000/api/certificates/verify/{qr_token}`, a PDF (pdfkit, logo) saved to `uploads/certificates/`, and stores its path.
8. **Public verification** — two endpoints exist: `certificates/verify/:token` (no scan log) and `qr-auth/:token` (returns VALID/INVALID/EXPIRED/REVOKED and logs the scan).
9. **Attachments** — multipart upload, access allowed for ADMIN, the application's owner, or an assigned officer.
10. **Notifications** — only manually created by ADMIN; users can list/read their own. No automatic generation.

## 8. Issues and risks

**Security**
1. `api/.env` is committed (DB host/user/password + JWT secret). Treat those credentials as exposed; rotate them and remove from history. (Values deliberately not reproduced here.)
2. `api/node_modules/` (2,861 files), uploaded images and generated PDFs are committed; `.gitignore` is empty.
3. `POST /auth/register` is public and honours any `role` → anyone can create an `ADMIN`, `LMO` or `GATC` account.
4. `/uploads` is served by `express.static` with no auth — attachments (photos/documents) and certificate PDFs are readable by anyone who has/guesses the URL (names are random-ish for attachments, predictable `CERT-YYYY-NNNNNN.pdf` for certificates).
5. `cors()` is fully open; no rate limiting, helmet, or login throttling; no password policy; JWT cannot be revoked; seed users share a known-hash password.
6. Upload filter checks extension only (not MIME/magic bytes); multer errors from the filter are plain `Error`s (likely 500s).

**Correctness / data integrity**
7. Reading `result` (PASS/FAIL) is accepted from the client; nothing computes it from `expected_value`/`tolerance`, and the final `decision` isn't checked against readings.
8. Multi-step writes aren't transactional: assignment create + application status; schedule create + status; result insert + verification complete + application complete; certificate insert + PDF write + file-url update.
9. Application becomes `COMPLETED` even when the decision is FAIL; assignment/schedule rows are not moved to `COMPLETED` when verification finishes. No rule prevents multiple verifications per assignment.
10. `createCertificate` takes `instrumentId` from the request instead of deriving it from the verification's application — a mismatched instrument can be certified. Certificate number uses `COUNT(*)+1` (race → unique violation or reuse after deletion).
11. Certificate/QR logic is duplicated and inconsistent: `verifyCertificate` checks `valid_from ≤ today ≤ valid_until`, `qr-auth` checks only `today > valid_until`; neither updates status to EXPIRED. No status sweep despite `certificates_past_due` view.
12. QR URL is hardcoded to `http://localhost:5000` (broken in any deployed environment); `server.js` defaults to port 5000 while `config/index.js` defaults to 4000.
13. Multer saves into `api/src/uploads`, while static serving and certificates use `process.cwd()/uploads`; attachment links work only if those resolve to the same folder.
14. Schema: `users.phone` not unique and login is email-only; duplicate indexes on already-unique columns (e.g. `users.email`, `certificate_number`, `qr_token`); no ownership trigger (applicant owns instrument); no DB-level status-transition rules; no audit-log table; certificate-number generator not DB-backed.
15. `application_number_counters` is incremented inside the create transaction (good), but `pending_applications` etc. use `SELECT *`-style views that will not pick up later column changes.

**Project hygiene**
16. No tests, CI, lint, `.env.example` (referenced in error messages), Docker, or API docs; all four `docs/*.md` placeholders are empty; README is stale (still says "testing", no setup).
17. `web/` carries ~50 files of a third-party government site (possible licensing/attribution concern) that are unrelated to Pramaan's own UI.
18. Inconsistent code style (indentation) in a few services; verbose comments referencing teammates and "Stage 0/Section 7" docs that are not in the repo.

## 9. Setup (verified from scripts; not executed)

1. Install Node.js and PostgreSQL (with contrib for `pgcrypto`, `citext`); create an empty database.
2. `cd api && npm install` (or rely on the committed `node_modules` — avoid; it is platform-specific, e.g. `bcrypt` binaries).
3. Create `api/.env` with `JWT_SECRET`, `PORT`, and `DATABASE_URL` or `DB_*`. (A committed `.env` exists — **replace its values with your own local ones and don't commit them**.)
4. `npm run db:setup` (destructive reset + migrate + seed) or `npm run migrate && npm run seed` on a fresh DB.
5. `npm run dev`; check `GET http://localhost:<PORT>/health`.
6. Log in as a seeded user (e.g. `dev.admin@pramaan.local`); the shared dev password is not documented.

## 10. Open questions

- Which branch is the source of truth for the web UI and mobile app, and what is the plan for `api` vs `api1` / `pramaan1` in `pushkar-mobile-auth`?
- Target deployment (Neon Postgres per `deploy` branch? where do uploads/PDFs live — local disk won't survive serverless/ephemeral hosts)?
- Who may register as officers/admins — seeded/admin-created only?
- Certificate validity rules (default period per instrument type) and who verifies fees/GRAS challan payments?
- Is the emaap reference material allowed to stay in the repo?

## 11. SIH PS 26036 feature audit (develop @ 4f21754)

_Problem statement: Online Verification System for Weighing and Measuring Instruments. Audited 2026-10-24 by reading `api/` source, migrations and seeds on `develop`. The official PS text and competitor products were **not** available to me; the 13 criteria below are the ones you listed, and "competitor features" are not benchmarked against any specific product. UI evidence: this section was written **before** the frontend was brought onto `develop`; where the web app changes a verdict see §12. `mobile/` has no UI on `develop` (`pushkar-mobile-auth` not inspected). Tests: none exist (no `*.test.*`/`*.spec.*`, no test script in `api/package.json`), so nothing below is test-verified; "Implemented" means the code path exists._

Paths are relative to `api/src/`. Status key: **I** Implemented, **P** Partially Implemented, **M** Missing, **N/A** Not Applicable.

| # | Feature | Status | Evidence (what exists) | Gap |
|---|---|---|---|---|
| 1 | Digital certificate + public QR verification | **P** | Random 24-byte `qr_token` default (`db/migrations/013`); QR PNG built in `utils/qrGenerator.js`; PDF embeds it (`utils/certificateGenerator.js` ~L175–190); public `GET /api/certificates/verify/:qrToken` (`modules/certificates/certificates.routes.js` L22) and `GET /api/qr-auth/:token` (`modules/qr-auth/qr-auth.routes.js` L9) that returns VALID/INVALID/EXPIRED/REVOKED and logs to `qr_authentications` (`db/migrations/015`, `qr-auth.service.js`) | QR URL hardcoded `http://localhost:5000` (`qrGenerator.js`); two endpoints with different rules (`certificates.service.verifyCertificate` checks `valid_from`..`valid_until` and does not log; `qr-auth` ignores `valid_from`); no public web/scan page on `develop`; no rate limit; scan log has no geo/device context |
| 2 | Tamper detection | **P** | Forged/guessed tokens fail because validity is a server-side DB lookup of an unguessable token (`qr-auth.service.js`) | No cryptographic integrity: no HMAC/signature in the QR, no content hash of the certificate/PDF stored or shown, PDF is unsigned (footer is a static "Authorised Signatory" label, `certificateGenerator.js` ~L206), and a doctored PDF carrying a genuine QR would pass. Certificate DB fields can be changed by `UPDATE` with no history |
| 3 | Certificate revocation | **P** | `certificate_status` enum has REVOKED (`001`); `PATCH /api/certificates/:id` (ADMIN) → `certificates.repository.updateCertificateStatus`; both public endpoints report REVOKED; `active_certificates` view excludes it (`013`) | No reason, `revoked_at`, `revoked_by`; any status → any status (REVOKED → ACTIVE allowed); no notification to owner; no audit trail; not linked to enforcement; expiry never auto-sets EXPIRED (`certificates_past_due` view in `017` is unused) |
| 4 | Offline field inspection + sync | **M** | Only a design comment: UUID PKs "allow the mobile app to generate records offline" (`001` header). `mobile/src/` empty | Server generates IDs (`gen_random_uuid()` default; create endpoints ignore client IDs); no idempotency keys, no batch/sync endpoint, no `updated_since` delta reads, no conflict rules, no local-first client. (`pushkar-mobile-auth` branch not inspected) |
| 5 | Application → certification workflow | **P** | Happy path exists end to end: application with generated `LM/{year}/{DIV}/{seq}` number (`applications.repository.js`, `018`) → assignment (`assignments.service`) → schedule (`schedules.service`) → verification + observations + readings + result (`verifications.service`) → certificate + PDF (`certificates.service.createCertificate`); DB guard that certificates need a PASS result (`013` trigger) | `DRAFT` state, submit, edit, cancel, reject-with-reason and review endpoints do not exist (status values exist only in the enum); no FAIL/re-test path (application becomes COMPLETED even on FAIL); no transactions; no payment/document-completeness check before assignment; no status-history table |
| 6 | Scheduling + officer assignment | **P** | `verification_assignments`/`verification_schedules` tables + modules; ADMIN-only create; assignee accept/decline/complete (`assignments.service.updateAssignmentStatus`); LMO/GATC role trigger (`007`); `schedules_today` view (`017`) | Manual only: no workload/jurisdiction/availability suggestion, no double-booking or date-in-past checks, no reschedule history (status RESCHEDULED but no old/new date), no auto-reassign on DECLINED, no notification to officer/owner, `division` not tied to officers |
| 7 | Expiry reminders | **P** (data layer only) | `notifications` table, `CERTIFICATE_EXPIRING/EXPIRED` types (`016`, `001`); `certificates_expiring_soon` (30 d) and `certificates_past_due` views (`017`); users can list/read own notifications (`notifications.service`) | Nothing generates reminders: no scheduler/cron, notifications only created manually by ADMIN (`notifications.service.createNotification`); no email/SMS/push delivery (`sent_at`/`status` never advance); no multi-stage (30/15/7), no dedupe; views unused by any code |
| 8 | Configurable fees and validity rules | **M** | Fee *capture* only: `conveyance_fee`, `quarter_jump_fee`, GRAS challan no./date on applications (`018`; `applications.validation.js` L28–29); validity is typed by ADMIN per certificate (`certificates.validation.js` L10–11) | No fee schedule or rule tables, no computation, no payment status/receipt, client-supplied fee numbers are trusted; no default validity per instrument type/class, `instrument_types` has only `default_unit`; no verification-interval rule driving re-verification due dates |
| 9 | Officer ↔ owner queries | **M** | Free-text `remarks` columns only; one-way admin notifications | No query/clarification thread table, endpoints, status (OPEN/ANSWERED), attachments on queries, or notification on reply; owners cannot see why an application is stuck |
| 10 | Enforcement + repeat-offender tracking | **M** | Raw ingredients exist: FAIL decisions in `verification_results`, owner on `instruments`, `qr_authentications` log, REVOKED status | No enforcement/violation/penalty/seizure tables or APIs, no un-registered/expired-instrument reporting by the public or officers, no per-owner/instrument offence counter or flagging, no inspection type for surprise/market checks, no escalation rules |
| 11 | Multilingual support | **M** | Dates formatted `en-IN` in PDF only (`certificateGenerator.js` L19). `web/src/emaap_extracted_resources/locales/en/*` is third-party reference JSON | All API messages hard-coded English; no `Accept-Language`, no translation catalogue, no per-user language preference column; PDF/QR page English only; no web UI to localise on `develop` |
| 12 | Inspection evidence | **P** | `attachments` (`014`) with `PHOTOGRAPH`/`INSPECTION_EVIDENCE` categories linked to a verification; multipart upload via `middleware/upload.js` (jpg/png/pdf ≤10 MB) and `attachments.service` access checks; observations and readings per verification (`010`, `011`) | No capture metadata (device timestamp, GPS lat/lng, EXIF) — `verifications.location` is free text (`verifications.validation.js` L21) while only `instruments` has coordinates; no file hash or immutability; extension-only type check; files public via `/uploads`; stored under two different directories (see §8 item 13); evidence not required before result submission; no seal/before-after photo checklist |
| 13 | Automated reports | **M** | Only automated document is the certificate PDF; SQL views in `017` | No report/analytics/export endpoints (no CSV/PDF/XLSX), no aggregates (pass rate, turnaround, pending by division, expiry forecast), no scheduled report, so dashboards are not possible yet |
| — | Not applicable | **N/A** | None of the 13 are outside scope for this PS. Intentionally out of scope by project rules (not features): separate lookup tables for statuses/types and an organisation/jurisdiction hierarchy (`001`, `003` headers) | Relevant to #6 and #10 if jurisdiction-based routing is wanted |

### Supporting capabilities (checked because they gate the above)

| Capability | Status | Evidence / gap |
|---|---|---|
| Auth, JWT, RBAC per route | **I** | `middleware/authMiddleware.js`, `rbacMiddleware.js`; but public registration accepts any role (`auth.service.register`) |
| Audit trail of status changes | **M** | Only `updated_at`; needed for #3, #5, #10 |
| Instrument registration with type/capacity/location | **P** | `instruments` module, `005`; create/list/get only, no update or decommission endpoints |
| Automated tests / CI | **M** | none |
| Web portal | **P** (see §12) | React app exists on `develop` now |
| Mobile app | **M** on `develop` | empty folders; `pushkar-mobile-auth` not inspected |

### Improvements to existing features (no new modules needed)

1. **QR/certificate verification:** collapse the two public endpoints into one service (`qr-auth`), count `valid_from` too, always log, read base URL from env, return a stable payload (`result`, certificate number, instrument, validity, integrity flag).
2. **Tamper evidence:** store a SHA-256 of the issued PDF and of a canonical certificate record, embed an HMAC (or Ed25519 signature) in the QR payload, and show the hash on the public result page so a printed copy can be compared.
3. **Revocation:** add `revoked_at`, `revoked_by_id`, `revocation_reason`; enforce transitions (ACTIVE→REVOKED/EXPIRED only); notify owner; write an audit row.
4. **Expiry:** daily job that flips ACTIVE→EXPIRED from `certificates_past_due` and inserts deduplicated reminders at 30/15/7 days from `certificates_expiring_soon`.
5. **Workflow:** add submit/cancel/reject/review endpoints and a FAIL path; one transactional state machine; status-history table.
6. **Scheduling:** conflict checks, reschedule history, officer workload query, notify on assign/schedule.
7. **Evidence:** accept `capturedAt`, `latitude`, `longitude` on attachments/verifications, store SHA-256, check magic bytes, require minimum evidence (e.g. instrument photo + seal photo) before `POST …/result`; serve files through an authenticated route.
8. **Fees/validity:** replace trusted client fee numbers with values computed from a `fee_rules` table (by instrument type, capacity band, travel/quarter flag) and default validity by instrument type, still overridable by ADMIN with a reason.
9. **Notifications:** make generation event-driven (service hooks) rather than admin-only, and add a delivery worker so `PENDING` → `SENT`/`FAILED` is real.

### Prioritised missing/partial features (impact × effort)

Impact reflects value to the PS (trust in certificates, field usability, officer productivity); effort assumes the current Express/Postgres stack and one developer.

| Rank | Feature | Impact | Effort | Why this order |
|---|---|---|---|---|
| 1 | Prerequisite fixes (secrets rotated, restricted registration, authenticated uploads) | Critical | S–M | Every other feature is undermined while anyone can self-register as ADMIN or read uploads (§8) |
| 2 | Certificate integrity + unified QR verification (#1, #2) | Very high | S–M | Core of the PS; mostly small code on existing tables |
| 3 | Revocation completion + audit trail (#3) | High | S | Small schema change; needed by #10 |
| 4 | Expiry/status job + reminders (#7) | High | M | Views and tables already exist; mainly a scheduler + generator |
| 5 | Application lifecycle completion + FAIL path (#5) | High | M | Makes the flow usable by real owners; unblocks UI |
| 6 | Configurable fees + validity rules (#8) | High | M | Removes trusted client input; needs rule tables and admin CRUD |
| 7 | Inspection evidence metadata + minimum-evidence rule (#12) | High | M | Strong field-credibility feature; small schema + validation |
| 8 | Automated reports/exports (#13) | Med–high | M | Aggregates over existing tables/views; demo-friendly |
| 9 | Scheduling intelligence (#6) | Medium | M | Conflict checks are cheap; auto-suggest is larger |
| 10 | Officer–owner queries (#9) | Medium | M | New table + a few endpoints; pairs with notifications |
| 11 | Enforcement + repeat-offender tracking (#10) | High (differentiator) | M–L | New domain tables; depends on #3 audit and #13 reports |
| 12 | Offline field inspection + sync (#4) | Very high for field use | L | Needs client-ID contract, batch endpoint, conflict rules and the mobile client; design the API contract early, build once the mobile branch is reconciled |
| 13 | Multilingual (#11) | Medium | M | Message catalogue + user language + PDF/QR page strings; most work is in the clients |

### Audit caveats

- No code was executed; behaviour is judged by reading, not running. Line numbers marked "~" are approximate.
- UI-related verdicts in §11 predate the frontend merge; §12 supersedes them where they differ.
- Competitor expectations come from the criteria list supplied, not from a verified review of competitors' products.

## 12. Update after frontend integration, and PS 26036 requirement mapping

_The team's pasted problem statement is now the reference; the mapping uses its "Key Functional Requirements" and "Expected Solution". The frontend was read from `web/src` after fast-forwarding `develop` to `web-frontend`. Nothing was executed or built._

### 12.1 What the frontend is
Routes (`web/src/App.tsx`): landing, login, register, dashboard, instruments (list/new/detail), applications (list/new/detail), assignments, verifications (list/detail), certificates (list/detail), `/verify-public`. API clients are in `web/src/api/*.api.ts`; auth in `context/AuthContext.tsx` (token in `localStorage`). Certificate detail offers PDF download and `window.print()`.

### 12.2 Frontend findings that change earlier verdicts
1. **The public verification page can show a certificate as valid without the backend.** `lookupCertificateByNumberOrQr` (`web/src/api/certificates.api.ts`, ~L289–385) falls back to `getKnownCertificates()`, which returns hard-coded `DEFAULT_SAMPLE_CERTIFICATES` plus whatever was cached in the browser's `localStorage`. Lookup by certificate number or serial therefore works only against that local/demo data, and the page then says the certificate is "officially registered under the Legal Metrology Act, 2009". The backend has **no** number/serial lookup (only `/certificates/verify/:qrToken`). The page also hard-codes `manufacturer: 'Certified OEM'` and `model: 'Standard Model'`, and computes VALID/EXPIRED in the browser. This undermines the core trust feature (§11 #1, #2): remove the fallback and demo data before showing it to evaluators.
2. **Dashboard stats are stubs.** `reportsApi` calls `/api/dashboard/stats`, `/reports/category-wise-approvals` and `/reports/monthly-trends`, which do not exist on the backend; failures are swallowed (`catch {}`), so the UI falls back to empty or client-computed numbers. Dashboards for pendency/enforcement (a PS requirement) are only partly real, and §11 #13 stays **Missing** server-side.
3. **The registration form lets the user pick any role** (`RegisterPage.tsx`), mirroring the open-registration backend flaw.
4. The QR now links to `${FRONTEND_URL || http://localhost:5173}/verify-public?q=<token>` (`api/src/utils/qrGenerator.js`), which fixes the old hard-coded API URL once `FRONTEND_URL` is set.
5. LMO/GATC can now read instruments assigned to them; the verifications repository gained list queries (+423 lines vs `main`).
6. No i18n, offline/service-worker, or CSV/Excel export in the web app (print and PDF download only). Still no tests.

### 12.3 PS 26036 explicit requirements vs. current state

| PS requirement | Status | Evidence / gap |
|---|---|---|
| Online registration + **profile management** for stakeholders | **P** | `POST /auth/register`, `GET /auth/me`, Register page. No profile update, change password, or admin approval of LMO/GATC accounts; State/jurisdiction not modelled |
| Application for verification / re-verification | **P** | `POST /applications`, `NewApplicationPage`; no submit/edit/cancel/reject (§11 #5) |
| Scheduling + allocation to LMO/GATC | **P** | assignments/schedules modules + `AssignmentsListPage` (§11 #6); no schedule page in the UI |
| Digital certificate with QR + authentication | **P** | §11 #1–#3 plus 12.2-1 |
| Record inspection observations and results digitally | **I** | `verifications.service` + `VerificationDetailPage`; PASS/FAIL still client-supplied |
| **Track validity and due dates for re-verification** | **M** | No next-due date or verification interval on instruments/certificates; no "due in N days" list; only the expiry views in migration 017 |
| Alerts/reminders for expiring validity | **P** (data layer only) | §11 #7 |
| Dashboards: status, pendency, **enforcement** | **P** (UI shell; backend endpoints missing) | 12.2-2; no enforcement data model (§11 #10) |
| Mobile integration for field officers | **M** on `develop` | `pushkar-mobile-auth` not inspected; no offline (§11 #4) |
| Photos/supporting documents upload | **P** | attachments API and §11 #12 gaps |
| **Search and retrieval** of records/certificates | **P** | Filtering is client-side in list pages; backend list endpoints have no search/pagination; no public lookup by number/serial |
| **Export and printing** of certificates and reports | **P** | Certificate PDF + print; no report export |
| Role-based secure login | **P** | JWT + RBAC route guards; open role registration |
| **Technical documentation** (architecture, security framework, deployment) | **M** | `docs/ARCHITECTURE.md`, `DB_SCHEMA.md`, `DECISIONS.md`, `API_CONTRACTS.md` are empty. Explicit PS deliverable |
| Digital repository of certificates and instrument records | **I** | Tables + `uploads/` (local disk, not durable) |

### 12.4 Hygiene still outstanding after the merge
**Correction:** `api/.env` is **no longer tracked** on `develop` (removed in `2e6880d`; the root `.gitignore` now ignores `.env*`, `node_modules`, `web/dist`, `web/.vite`), but it is **still in git history**, so its credentials must be treated as exposed and rotated. Still tracked: `api/node_modules/` (2,861 files), `api/src/uploads/*.jpg`, `api/uploads/certificates/*.pdf` and two `web/.vite/deps/*` files.

---

## 13. Implementation record — roadmap phases 0–3 (this working tree, uncommitted)

_Sections 8, 11 and 12 describe the code **before** this work; this section supersedes them where they differ. Verification: `cd api && npm test` → **81 tests, 0 failures** (against a temporary PostgreSQL 18, migrations 001–022 applied from scratch); `cd web && npx tsc --noEmit && npx vite build` pass. No manual browser testing and no run against a real deployment database was done._

### 13.1 What was built

| Phase | Delivered | Where |
|---|---|---|
| **0 Security foundation** | `ADMIN` self-registration closed; LMO/GATC register as `PENDING_APPROVAL` and need admin approval (new `users` module + admin console page); password policy; account status/role re-checked on every request; timing-safe login; security headers, CORS allow-list, rate limits; `/uploads` no longer public (signed, expiring links); upload content checked against extension; one upload directory; hash-chained append-only `audit_log`; `.env.example` files; QR link now `FRONTEND_URL`-based | `middleware/security.js`, `modules/users`, `utils/integrity.js`, `utils/audit.js`, migration 019 |
| **1 Trustworthy certificates** | One public verification service (QR token **or** certificate number, no more duplicate logic); signed QR (`s=` HMAC); SHA-256 of PDF and of the record; tamper detection (`TAMPER_DETECTED` audit); PDF upload check by hash; owner-scoped certificate access; race-free certificate numbers; derived instrument (client value must match); default validity per instrument type; revocation with reason, permanence enforced in API **and** trigger, owner notified; expiry sweep; re-verification due dates (`/instruments/due`); fake sample-certificate fallback and invented placeholder values removed from the web app; new public verify page | `modules/qr-auth`, `modules/certificates`, `utils/certificateIntegrity.js`, `jobs/certificateLifecycle.js`, migrations 019–020, `web/src/pages/verify/PublicVerifyPage.tsx` |
| **2 Core PS workflow** | Transactions + one application state machine with history; cancel / reject (reason) / payment verification; duplicate open-application guard; assign / re-assign / decline rules; scheduling (no past dates, no double booking, reschedule with audit); **server-computed reading PASS/FAIL**; PASS needs readings and no failed readings; sealed result (SHA-256) and database-locked evidence; one verification per assignment; GPS + capture time + file hash on evidence; optional minimum-evidence rule; profile edit / password change; server-side search, filter, sort, paging; dashboard stats + chart endpoints the web app already called; management summary (pendency, workload, divisions, forecast); CSV exports | `utils/applicationStatus.js`, `utils/db.js`, `utils/measurement.js`, `utils/verificationSeal.js`, `modules/reports`, `utils/listQuery.js`, migration 021 |
| **3 Alerts, fees, queries** | Expiry reminders at 30/15/7/1 days, idempotent, with in-process scheduler (advisory lock) and `npm run jobs:run`; configurable fee rules and quote API, fees computed at filing; payment verification (optionally required before assignment); instrument-type validity admin API; officer–owner query threads with notifications | `jobs/`, `modules/fees`, `modules/queries`, migration 022 |
| **Docs** | Architecture + security framework + deployment method, API contracts, DB schema, decision log (were empty) | `docs/ARCHITECTURE.md`, `API_CONTRACTS.md`, `DB_SCHEMA.md`, `DECISIONS.md` |

### 13.2 Re-scored PS 26036 features

| Feature | Before | Now | Remaining gap |
|---|---|---|---|
| QR verification & authentication | Partial | **Implemented** | Public page tested only via type-check/build; no PAdES signature |
| Tamper detection | Partial | **Implemented** (PDF hash, record hash, QR signature, audit chain) | Legal e-signature (DSC/eSign) not implemented |
| Revocation | Partial | **Implemented** | No UI listing of revoked certificates |
| Application → certificate workflow | Partial | **Implemented** (API); web UI has cancel + revoke + admin users; reject, payment-verify, reschedule, history, queries have **no UI** | UI for the new endpoints |
| Scheduling & assignment | Partial | **Implemented** (rules, conflicts, reschedule) | No automatic officer suggestion / workload balancing |
| Expiry reminders | Partial | **Implemented** (in-app) | No email/SMS channel |
| Configurable fees & validity | Missing | **Implemented** (API) | No admin UI; no amounts seeded; no payment gateway (GRAS challan is verified manually) |
| Officer–owner queries | Missing | **Implemented** (API) | No UI; no attachments on messages |
| Inspection evidence | Partial | **Implemented** (hash, GPS, capture time, lock, optional minimum) | Evidence photos not shown in UI by capture metadata |
| Automated reports & export | Missing | **Implemented** (JSON + CSV) | No PDF/XLSX export, no scheduled report e-mail, dashboard UI not extended |
| Dashboards for status/pendency | Partial | **Implemented** (API); existing dashboard now receives real data | `reports/summary` not yet shown in the UI |
| Profile management | Partial | **Implemented** | No profile page in the web app |
| Search & retrieval | Partial | **Implemented** server-side | Web list pages still filter client-side |
| Technical documentation | Missing | **Implemented** | Needs review by the team |
| Offline field inspection + sync / mobile app | Missing | **Missing** | Phase 4: client-generated IDs, idempotent batch API, conflict rules, Expo app |
| Multilingual support | Missing | **Missing** | Message catalogue, language preference, localised PDF/QR page |
| Enforcement & repeat-offender tracking | Missing | **Missing** | Offence records, repeat counters, spot-check inspections, enforcement dashboard |

### 13.3 Behaviour changes other branches/clients must know about

- `POST /auth/register` returns **no token** for LMO/GATC (`pendingApproval: true`); the web app handles this. The register form still lists LMO and GATC, which is intended.
- `result` is optional on readings and **ignored** when `expectedValue` and `tolerance` are sent; PASS decisions can be rejected (400) when readings failed or are missing.
- A second **open** application for the same instrument is refused (409); one verification per assignment.
- `COMPLETED` / `REASSIGNED` assignment statuses can no longer be set by clients.
- Certificate issue: `instrumentId`, `validFrom`, `validUntil` are optional; a mismatching `instrumentId` is rejected.
- File URLs expire (30 min) and must be re-fetched; QR codes issued **before** this work have no `record_sha256`/signature (shown as "Not available (older certificate)") and still verify.
- `DATE` fields are now `YYYY-MM-DD` strings (previously shifted ISO timestamps).
- The default bcrypt cost is 12 (was 10); the API default port is 5000 everywhere.

### 13.4 Still open / needs a decision

1. **Credentials in git history** (`api/.env`): rotate the database password and `JWT_SECRET`; removing them from history is a destructive rewrite of shared branches and needs the team's approval.
2. **`api/node_modules` is tracked** (2,861 files): `git rm -r --cached api/node_modules` would fix it (files stay on disk) but changes every branch's history/diffs; not done without approval.
3. **`web/src/emaap_extracted_resources`** could not be deleted: the landing page and footer import ~20 of its images/icons. Replace them (own assets / `lucide-react` icons) and then delete the folder.
4. Branch reconciliation with `pushkar-mobile-auth` (`api1/`) and `deploy` (Neon) is still pending; those branches predate this work.
5. Production hardening not yet done: HTTPS/reverse proxy, persistent upload storage, e-mail/SMS provider, log shipping, backups, replacing the seeded development users.
6. UI work for the new endpoints (see 13.2) and frontend tests.
