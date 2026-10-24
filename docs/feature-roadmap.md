# Pramaan — Feature Roadmap (proposed)

_Originally written against `develop` @ `4f21754`. Effort: S ≈ hours, M ≈ 1–2 days, L ≈ several days. Issue numbers refer to `docs/context.md` §8. **Progress is tracked in the next section; the tier tables further down are the original plan and are annotated where done.**_

## Progress (updated after implementing phases 0–3 in the working tree)

Status key: ✅ done and covered by tests (`cd api && npm test` → 88 passing) · 🟡 backend done, UI missing · ⏳ not started · ⚠️ needs an owner decision.

| Phase | Item | Status | Notes |
|---|---|---|---|
| UI | Landing page (original content, verify box, no scraped assets), footer, notifications centre with unread bell | ✅ (type-check + build) | `pages/LandingPage.tsx`, `components/common/Footer.tsx`, `pages/NotificationsPage.tsx`, `NotificationBell.tsx` |
| Ops | `npm run demo:users` safe demo accounts; env quoting note; Vite port 5173 | ✅ | `api/src/demoUsers.js`, `api/.env.example` |
| UI | Application page: status history, reject (reason), payment verification, query threads; `/fees`, `/reports` (+CSV), `/due`, `/profile` | ✅ (type-check + build; not yet clicked through in a browser) | `web/src/components/applications/ApplicationExtras.tsx`, `pages/admin/FeeRulesPage.tsx`, `pages/reports`, `pages/instruments/DueListPage.tsx`, `pages/ProfilePage.tsx`, `api/workflow.api.ts` |
| 4 | Offline sync API: client UUIDs, idempotent batch push, delta pull, server-wins conflict rules | ✅ | `modules/sync`, migration 023, `api/test/sync.test.js` |
| 0 | Close open registration (ADMIN never self-registers; LMO/GATC need approval) + admin approval screen | ✅ | `modules/users`, `web/src/pages/admin/UsersPage.tsx` |
| 0 | Uploads private (signed expiring links), content check, one upload dir | ✅ | `app.js`, `middleware/upload.js` |
| 0 | Security headers, CORS allow-list, rate limits, password policy, live account-status check | ✅ | `middleware/security.js`, `authMiddleware.js` |
| 0 | `.env.example` files, `.gitignore` negations | ✅ | |
| 0 | Rotate leaked credentials (`api/.env` is in git history) | ⚠️ | Human action; history rewrite needs team approval |
| 0 | Untrack `api/node_modules` (2,861 files), generated PDFs, `web/.vite` | ⚠️ | `git rm --cached` – changes every branch; not done |
| 0 | Remove `web/src/emaap_extracted_resources` | ⚠️ | No longer imported (landing page and footer rewritten, build is ~20 image files lighter). Only the 15 MB folder deletion is left; needs the owner's approval. |
| 0 | Remove the sample-certificate fallback / invented values from the web verify page | ✅ | |
| 1 | Unified public verification (token **or** certificate number), signed QR, record + PDF hashes, tamper detection, PDF check | ✅ | |
| 1 | Revocation (reason, permanent, audited, owner notified) | ✅ | 🟡 revoke button on certificate page only; no revoked-certificates list |
| 1 | Expiry sweep, re-verification due dates (`/instruments/due`) | ✅ | 🟡 no UI for the due list |
| 1 | Hash-chained audit log | ✅ | 🟡 no UI to browse it / run `verifyChain` |
| 2 | State machine + history, cancel / reject, duplicate-application guard | ✅ | 🟡 cancel button only; reject, history, payment-verify have no UI |
| 2 | Assignment & schedule rules, conflicts, reschedule | ✅ | 🟡 no reschedule UI |
| 2 | Server-computed readings, sealed result, locked evidence, GPS/hash/capture time, min-evidence option | ✅ | |
| 2 | Profile edit / password change, search + paging, dashboard & report endpoints, CSV export | ✅ | 🟡 no profile page; list pages still filter client-side; export buttons missing |
| 3 | Reminders (30/15/7/1) + scheduler + `jobs:run` | ✅ | in-app only |
| 3 | Fee rules, quote, server-side fee computation, payment verification gate | ✅ | 🟡 no admin UI; ⚠️ fee amounts must be entered from the State notification |
| 3 | Instrument-type validity admin API | ✅ | 🟡 no UI |
| 3 | Officer–owner query threads | ✅ | 🟡 no UI |
| 3 | Technical documentation (architecture, security, deployment, API, schema, decisions) | ✅ | team review needed |
| 4 | Offline field inspection + sync, mobile app integration | ⏳ | next major item |
| 5 | Enforcement + repeat-offender tracking; multilingual; e-mail/SMS; object storage; PAdES signature | ⏳ | |

### Suggested next steps (in order)
1. **Decide the ⚠️ items** above (rotate secrets, untrack `node_modules`, landing-page assets) – small effort, high value.
2. **Review and commit** the working tree in logical commits (security → certificates → workflow → reports/fees/queries → docs → web); then merge/rebase `pushkar-mobile-auth` and `deploy` onto it.
3. **UI for the finished endpoints:** done for reject, payment verification, status history, queries, fee rules + default validity, reports + CSV export, due list and profile (see the table). Still missing: frontend tests and a recorded browser walk-through of the demo flow (steps are in the README).
4. **Phase 4 offline sync:** server side is done (client UUIDs, idempotent `POST /api/sync/push`, delta `GET /api/sync/pull`). Remaining: reconcile `pushkar-mobile-auth`, then the Expo client (local queue, camera + GPS, offline photo upload with `clientId`).
5. **Phase 5**: enforcement module, Hindi/regional-language support, e-mail/SMS provider, object storage, PAdES.

## Already built before this work (for reference)

Auth + RBAC, instruments, applications with generated numbers and domain fields, assignments, schedules, field verifications (observations, readings, result), certificate issuance with QR + PDF, public QR check with scan log, attachments upload, manual notifications, 18 migrations + seed + migrate/reset/seed scripts, and the React web app from `web-frontend`.

## SIH PS 26036 gap summary

Full evidence is in `docs/context.md` §11. Status on `develop`: **Implemented** — none of the 13 audited features fully; **Partial** — QR verification, tamper detection, revocation, application→certificate workflow, scheduling/assignment, expiry reminders (data layer only), inspection evidence; **Missing** — offline inspection + sync, configurable fees/validity, officer–owner queries, enforcement/repeat-offender tracking, multilingual support, automated reports. Nothing is N/A. The "PS-N" items below map these gaps into the existing tiers; PS rank follows impact × effort.

| PS rank | Item (feature #) | Impact | Effort | Lands in |
|---|---|---|---|---|
| PS-1 | Certificate integrity: HMAC/signature in QR, stored SHA-256 of PDF + record, single unified verify endpoint, env-based base URL (#1, #2) | Very high | S–M | P1 (items 10–12) |
| PS-2 | Revocation: reason / `revoked_at` / `revoked_by`, enforced transitions, owner notification, audit table (#3) | High | S | P1 (item 13) |
| PS-3 | Expiry job: auto ACTIVE→EXPIRED + deduplicated 30/15/7-day reminders + delivery worker (#7) | High | M | P2 (item 17) |
| PS-4 | Application lifecycle: submit/edit/cancel/reject/review + FAIL/re-test path + status history (#5) | High | M | P1 (item 9) / P2 (item 15) |
| PS-5 | Fee rules + default validity per instrument type, computed server-side (#8) | High | M | P2 (item 18) |
| PS-6 | Evidence: device timestamp, GPS, SHA-256, magic-byte check, minimum-evidence rule before result (#12) | High | M | P1/P2 |
| PS-7 | Reports & exports: pass rate, turnaround, pending by division, expiry forecast; CSV/PDF (#13) | Med–high | M | P2 (item 20) |
| PS-8 | Scheduling: conflict checks, reschedule history, workload view, notify on assign (#6) | Medium | M | P2 |
| PS-9 | Officer–owner query threads with notifications (#9) | Medium | M | P2 (new) |
| PS-10 | Enforcement: offence records, repeat-offender counters/flags, field "spot check" inspections (#10) | High (differentiator) | M–L | P2 (new), after PS-2 and PS-7 |
| PS-11 | Offline inspection + sync: client-generated UUIDs accepted, idempotency keys, batch push / delta pull, conflict rules (#4) | Very high for field use | L | P2 (item 21) + P4 (item 29) |
| PS-12 | Multilingual: message catalogue, user language preference, localised PDF and QR page (#11) | Medium | M | P4 (item 30) |

Prerequisite: P0 (open ADMIN registration, public uploads, committed secrets) must be done before any of the above is demonstrated.

**Update (frontend merged into `develop`, emaap resources removed):** the web app exists, so remaining work is mostly backend endpoints it already expects plus fixing its trust problems. PS requirements newly flagged by the pasted problem statement (see `docs/context.md` §12.3): **re-verification due-date tracking** (Missing), **search/retrieval** (Partial), **profile management** (Partial), **dashboard backend** (`/dashboard/stats`, `/reports/*` — Missing), **technical documentation** (Missing, explicit deliverable). The public verify page also falls back to hard-coded sample certificates (`web/src/api/certificates.api.ts`) — remove this first.

## Where to use SHA-256 and other cryptography

All of this uses Node's built-in `crypto` module; no new dependency is required. Keep keys in environment variables (later a secrets manager), never in the repo.

| # | Where | Mechanism | Purpose / notes |
|---|---|---|---|
| C1 | **Certificate PDF** at issue time (`certificates.service.createCertificate`) | SHA-256 of the PDF bytes → new column `pdf_sha256` | Lets anyone check a printed/emailed copy against the registry (verify page shows the hash; optional "upload PDF to check" box). Detects altered PDFs, which a QR lookup alone cannot |
| C2 | **Certificate record** (number, instrument id, serial, verification id, issue/valid dates, result) | SHA-256 over a canonical JSON/field string → `record_sha256`, recomputed on every public verify | Detects direct database edits (e.g. someone extending `valid_until`) |
| C3 | **QR payload** (`utils/qrGenerator.js`) | **HMAC-SHA256** (server secret) over `qr_token` + certificate number, appended as `sig`; compare with `crypto.timingSafeEqual` | Forged or edited QR URLs are rejected before any DB lookup. Use HMAC if verification is always online; **Ed25519** signatures instead if officers must verify offline on the mobile app (public key is shipped, private key stays on the server) |
| C4 | **Inspection evidence** (`attachments`) | Server-side SHA-256 of each uploaded file → `file_sha256`; mobile also sends its own hash and the server compares | Proves the photo/document was not changed after capture or in sync; add capture timestamp and GPS next to it |
| C5 | **Verification result seal** (`verifications.service.submitResult`) | SHA-256 over observations + readings + decision → `result_sha256`; DB trigger blocks edits to readings/observations once the verification is COMPLETED | Makes the PASS/FAIL record tamper-evident |
| C6 | **Audit log** (new table for revocation, status changes, role changes, certificate issue) | Hash chain: `hash = SHA-256(prev_hash ‖ canonical_row)` | Tamper-evident history for enforcement and legal disputes |
| C7 | **Passwords** | Keep **bcrypt** (raise `BCRYPT_SALT_ROUNDS` to 12); do **not** replace with SHA-256 | Plain/fast SHA-256 is unsuitable for passwords |
| C8 | **Password-reset / refresh / email-verification tokens** (when added) | Random 32-byte token from `crypto.randomBytes`; store only its SHA-256 in the DB | A database leak does not expose usable tokens. (Do **not** hash the certificate `qr_token`: it is public by design and is looked up directly) |
| C9 | **JWT** | Keep HS256 only with a long random secret (≥ 32 bytes); shorter access token (15–60 min) + rotating refresh token (C8); add `iss`/`aud`; consider a token-version column so revoked/suspended users are cut off | Today: 8h, no revocation |
| C10 | **Offline sync batches** (mobile) | Per-record content hash + client-generated UUID idempotency key; optionally HMAC/Ed25519 signature per device | Detects corrupted or replayed batches |
| C11 | **Transport and storage** | HTTPS + HSTS, `helmet`, DB TLS (`sslmode=require` for Neon), uploads outside web root served via authenticated route, file type by magic bytes | Baseline for the PS "security framework" document |
| C12 | **Optional production step** | PAdES/PKCS#7 digital signature on the PDF (DSC / eSign) | Legally recognised signature; SHA-256 + HMAC above give integrity, not legal non-repudiation |

Rule of thumb: SHA-256 detects change; HMAC/signature proves it came from the server; neither replaces access control.

## Build plan (phased, hackathon-friendly)

Order = trust first, then the workflow the PS names, then field/mobile, then differentiators. Each phase ends in something demonstrable. Estimates assume 2–3 developers.

**Phase 0 — Safe foundation (≈ 1 day)**
- Rotate DB/JWT secrets; untrack `.env`, `api/node_modules`, uploads, `web/.vite`; real `.gitignore`; `.env.example` for `api` and `web`.
- Close open registration (frontend role picker limited to owner/public; staff accounts created by ADMIN); authenticated file serving.
- Remove emaap leftovers and the sample-certificate fallback from the web app; one root README with run steps (API + web).
- Exit check: fresh clone → `npm run db:setup` → API + web start; no secrets in git.

**Phase 1 — Trustworthy certificates (≈ 2–3 days)** — PS core "QR + authentication"
- One verify service (public endpoint by QR token **and** by certificate number), always logging scans; remove client-side validity computation.
- C1–C3 (hashes + signed QR), complete revocation (reason, who, when, allowed transitions, audit row C6), auto-EXPIRED job.
- Add instrument/certificate **next-due date** so re-verification is trackable.
- Exit check: tamper a PDF or DB row → verify page flags it; revoke → public result REVOKED.

**Phase 2 — Workflow completeness the PS lists (≈ 4–5 days)**
- Application submit/cancel/reject/review + FAIL/re-test path, transactional state machine, status history.
- Profile management (edit profile, change password), admin approval of LMO/GATC accounts.
- Search + pagination server-side for instruments, applications, certificates; export (CSV/PDF) of lists and reports.
- Backend `/dashboard/stats` and `/reports/*` the web app already calls (status counts, pendency, expiry forecast, pass rate).
- Evidence rules: GPS/timestamp/hash (C4), minimum photos before result, readings PASS/FAIL computed server-side + C5.
- Exit check: the full owner → admin → officer → certificate → public verification demo runs without manual DB edits.

**Phase 3 — Alerts and fees (≈ 2–3 days)**
- Scheduler (e.g. node-cron or a DB-driven job): 30/15/7-day expiry reminders, de-duplicated, with in-app delivery (email/SMS adapter behind a simple interface).
- `fee_rules` + default validity per instrument type; compute fees server-side; officer-owner query threads.

**Phase 4 — Field/mobile (≈ 5+ days; start API contract earlier)**
- Reconcile `pushkar-mobile-auth` (`api1/` vs `api/`) into this repo before writing more mobile code.
- Officer app: assigned jobs, inspection form, camera + GPS, offline queue with client UUIDs, idempotent batch push / delta pull (C10), conflict rules.

**Phase 5 — Differentiators and documentation (continuous; finish ≥ 2 days before submission)**
- Enforcement module: offence records, repeat-offender counters/flags, spot-check inspections, enforcement dashboard.
- Multilingual (English + Hindi first; message catalogue and UI strings, localised PDF).
- **Technical documentation required by the PS:** architecture, security framework (use the C-table above), deployment (Neon/Postgres, API host, static web host, env vars). Fill the empty `docs/*.md` as each phase lands rather than at the end.

**Cut line if time is short:** Phases 0–2 plus the expiry reminder from Phase 3 and the documentation make a complete, defensible submission; Phase 4 offline sync and Phase 5 enforcement/multilingual are stretch goals unless the mobile app is already working.

## P0 — Security and repo hygiene (do first)

| # | Item | Fixes | Effort |
|---|---|---|---|
| 1 | Rotate the DB password and `JWT_SECRET` that are in the committed `api/.env`; remove `.env` from tracking; add `.env.example` | issue 1 | S |
| 2 | Real `.gitignore` (`node_modules`, `.env`, uploads, generated PDFs, OS/editor files); untrack `api/node_modules`, uploads and PDFs (coordinate with other branches first — history rewrite affects them) | 2 | S–M |
| 3 | Lock down registration: public sign-up limited to `INSTRUMENT_OWNER`/`PUBLIC_USER`; ADMIN creates LMO/GATC/ADMIN accounts | 3 | S |
| 4 | Serve uploads through an authenticated route (ownership check via `ensureApplicationAccess`) instead of public `express.static`; certificates remain downloadable by owner/admin and via the QR page | 4 | M |
| 5 | Basic hardening: helmet, restricted CORS origins, rate limit on login and public QR endpoints, password policy, validate MIME/magic bytes, map multer errors to 400 | 5, 6 | M |
| 6 | Decide branch strategy: reconcile `web-frontend`, `pushkar-mobile-auth` (`api1`), `deploy` into `develop` one at a time, resolving the `api`/`api1` split | §2 | M |

## P1 — Correctness of the core workflow

| # | Item | Fixes | Effort |
|---|---|---|---|
| 7 | Wrap each multi-step write in a DB transaction (repository helpers accepting a `client`): assign, schedule, submit result, issue certificate | 8 | M |
| 8 | Compute reading PASS/FAIL server-side from expected/observed/tolerance; reject a PASS decision when any reading failed (or require a remark) | 7 | S–M |
| 9 | Explicit status state machine (application, assignment, schedule, verification) in one module, used by all services; complete assignment + schedule when result submitted; FAIL result → application `REJECTED`/re-test path instead of `COMPLETED`; one active verification per assignment | 9 | M |
| 10 | Derive `instrumentId` for certificates from the verification's application; DB-backed certificate-number sequence (like `application_number_counters`) | 10 | S |
| 11 | Unify QR/certificate validation into one service (VALID/EXPIRED/REVOKED using both dates), always log scans; scheduled job to flip `ACTIVE` → `EXPIRED` | 11 | M |
| 12 | `PUBLIC_BASE_URL` env var for QR links; one port default; single upload directory constant shared by multer, static serving and the certificate writer | 12, 13 | S |
| 13 | Migration 019: unique phone (or drop phone-as-identifier), drop duplicate indexes, trigger that the applicant owns the instrument, audit-log table (who changed which status when), `ON DELETE` review for notifications | 14 | M |
| 14 | Allow login by phone for LMO/GATC (noted in `auth.validation.js` as a known future need) | — | S |

## P2 — Missing backend features

| # | Item | Effort |
|---|---|---|
| 15 | Application lifecycle endpoints: submit draft, edit while draft, cancel, reject with reason, review/approve; validation that required documents exist per `applicant_type` and `instrument_origin` | M |
| 16 | Instrument update/deactivate/decommission; search, filter and pagination on all list endpoints | M |
| 17 | Automatic notifications (application status change, assignment, schedule, certificate issued, 30/15/7-day expiry) via a scheduled job; email/SMS delivery behind the existing `notification_status` | L |
| 18 | Fee handling: validate GRAS challan fields, compute conveyance/quarter-jump fees, payment status | M |
| 19 | Certificate renewal flow using `last_certificate_id`; revoke with reason; re-download endpoint with access control | M |
| 20 | Officer workload views: use `schedules_today` / `pending_applications` views for dashboards; admin reports (pass rate, turnaround, expiries by division) | M |
| 21 | Idempotency/client-generated IDs for offline field sync (schema already uses UUIDs) | L |
| 22 | Object storage (S3-compatible) for attachments/PDFs, to match the Neon/`deploy` direction where local disk is ephemeral | M |

## P3 — Developer experience and quality

| # | Item | Effort |
|---|---|---|
| 23 | Tests: unit (services, tolerance logic, state machine) + API integration against a throwaway Postgres; CI running lint, tests, migrate on a clean DB | L |
| 24 | OpenAPI spec generated or hand-written into `docs/API_CONTRACTS.md`; fill `ARCHITECTURE.md`, `DB_SCHEMA.md` (ER diagram), `DECISIONS.md` | M |
| 25 | Update README with real setup steps; document seed credentials (or print them in `seed.js`); Dockerfile + `docker-compose` (api + Postgres) | S–M |
| 26 | ESLint + Prettier; consistent response helper usage; request-ID logging; TypeScript migration (optional) | M |
| 27 | ~~Remove `web/src/emaap_extracted_resources`~~ — done (staged deletion on `develop`, commit pending) | — |

## P4 — Clients

| # | Item | Effort |
|---|---|---|
| 28 | Web (React + Vite, **already on `develop`**): finish admin console actions (review, schedule UI, revoke), remove sample-certificate fallback in the public verify page, wire to the new dashboard/report endpoints, search/pagination, i18n | M–L |
| 29 | Mobile (Expo): officer login, assigned jobs, offline-capable verification form (readings, camera attachments, GPS), sync — start from `pushkar-mobile-auth` | L |
| 30 | Multi-language UI (the reference site ships locale JSONs), accessibility pass | M |

## P5 — Nice to have

- Map view of instruments and inspector routing using stored lat/lng.
- Bulk instrument import (CSV) for large owners.
- Re-verification reminders that auto-create draft applications.
- Dashboards with charts (expiry forecast, workload by division).
- Digital signature on certificate PDFs and signed QR tokens.

## Suggested order

1. **P0 (1–6)** in one cleanup PR series — nothing else should build on exposed credentials or open registration.
2. **P1 (7–14)** — make the existing flow trustworthy before adding surface area.
3. **P2 15–17, 19** with tests (**23**) as features land.
4. Merge client branches (**28–29**) once the API contracts are documented (**24**).
