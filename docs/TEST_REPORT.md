# Test report: prototype readiness for the SIH PPT round

Scope: what was actually run, with the result, and what was **not** run. Nothing here is estimated.

- Code: `develop` at `de7156b` plus the uncommitted stage 1–4 changes described below.
- Automated tests run against a **throw-away embedded PostgreSQL 18** (UTF8), created fresh for every run, with all 29 migrations applied. No real or production data is used.
- Your local development database was used only for read-only smoke checks (health, instrument types, login, production start-up guard).
- Reproduce: `cd api && npm test` (about 60 s) · `cd web && npx tsc --noEmit && npx vite build` · `cd mobile && npx tsc --noEmit`.

## Summary

| Check | Result |
|---|---|
| API automated tests | **PASS: 148 of 148** (0 failed) |
| Web type-check and production build | **PASS** |
| Mobile type-check | **PASS** |
| End-to-end workflow (16 narrated steps, `api/test/e2e_demo.test.js`) | **PASS: 16 of 16** |
| Any page opened in a real browser, mobile app on a device | **NOT TESTED** (see the last section) |

## 1. End-to-end workflow: owner → admin → officer → certificate → public verification

| # | Step | Result |
|---|---|---|
| 01 | Owner registers an instrument using the instrument types the API publishes | PASS |
| 02 | Server classifies it as a first verification and refuses a renewal | PASS |
| 03 | Owner applies; status history starts at SUBMITTED | PASS |
| 04 | Admin assigns an officer, officer accepts, admin schedules (past dates refused); owner is notified | PASS |
| 05 | Officer inspects: GPS, readings (server computes PASS/FAIL, overriding the officer's claim), observation, evidence photo fingerprinted | PASS |
| 06 | A PASS cannot be recorded over a failing reading | PASS |
| 07 | Result sealed with SHA-256; readings can no longer be altered | PASS |
| 08 | Admin issues the certificate: PDF stored, SHA-256 and record fingerprint, digitally signed, English and Hindi pages | PASS |
| 09 | Public verification through the real QR link (signed) and by certificate number; owner name masked | PASS |
| 10 | A forged QR signature is flagged as tampering | PASS |
| 11 | Genuine PDF matches; a one-byte edit does not match and its embedded signature is reported invalid | PASS |
| 12 | Editing the certificate row in the database is blocked; if the guard is bypassed the next verification reports `RECORD_HASH_MISMATCH` | PASS |
| 13 | Audit log verifies as an unbroken hash chain; edits and deletes are blocked | PASS |
| 14 | Instrument shows as certified and not yet due; due list, dashboard and CSV export agree | PASS |
| 15 | Admin revokes with a reason: public result REVOKED, owner notified, cannot be un-revoked (API and database) | PASS |
| 16 | Access control: strangers, anonymous callers and officers are refused; bare file paths are not public, signed links work | PASS |

## 2. Cryptographic and integrity features

| Feature | Evidence | Result |
|---|---|---|
| SHA-256 of the issued PDF, stored and re-checkable by upload | steps 08, 11 | PASS |
| Record fingerprint (SHA-256 over immutable fields) detects direct database edits | step 12 | PASS |
| Signed QR link (HMAC-SHA256, 128-bit tag, constant-time compare) rejects edited links | steps 09, 10 | PASS |
| Evidence files hashed by the server at upload | step 05 | PASS |
| Verification result seal (SHA-256) and database locks on readings | step 07 | PASS |
| Hash-chained, append-only audit log | step 13 | PASS |
| Expiring HMAC-signed links for uploaded files | step 16 | PASS |
| Immutable issued certificates and permanent revocation (database triggers) | steps 12, 15 | PASS |
| PDF digital signature (PKCS#7) with independent verification, tamper and appended-content detection | step 08, 11, `signing.test.js` | PASS with a **self-signed development key** |
| Signature accepted as legally valid / trusted by a PDF viewer | needs a CA-issued Digital Signature Certificate | **NOT TESTED** |
| Ed25519 public-key QR signatures | design only (`docs/DESIGN_ED25519_QR.md`) | **NOT IMPLEMENTED** |

## 3. Stage 1–2 changes

| Item | Evidence | Result |
|---|---|---|
| "Invalid or inactive instrument type": root cause found (the web form sent type IDs hard-coded from another database); form now loads types from the API; validation unchanged | `lifecycle.test.js` (stale ID rejected with the exact message, every published ID accepted, deactivated type refused) | PASS at API level |
| Same fix as seen from the web form in a browser | | **NOT TESTED** |
| Instrument edit: owner/admin only, validated, audited; serial and type fixed once an application exists (also a database trigger); measured fields locked while an application is open | `lifecycle.test.js` | PASS |
| Deactivate / reactivate, decommission (reason, final, frozen in the database, admin action notifies the owner); removed from due lists and reports | `lifecycle.test.js` | PASS |
| Renewal rules: first verification vs renewal, renewal window (60 days, configurable), lapsed or revoked certificates, auto-link to the renewed certificate, blocked for inactive/decommissioned/open | `lifecycle.test.js` (decision table plus API) | PASS |
| Required documents: admin-defined, scoped by application type and origin, checklist, typed uploads, assignment blocked until complete | `lifecycle.test.js` | PASS |

## 4. Regression

All 124 tests that existed before stages 1–4 still pass (security, certificates, workflow, reports, lists, enforcement, Hindi, delivery, storage, signing, sync, start-up guard).

## 5. Defects found and fixed during this work

| Defect | How it was found | Status |
|---|---|---|
| Web form used instrument-type IDs hard-coded from another database | user report, traced through the request, the backend check and the database | fixed |
| Web mapper invented a default accuracy class that the new edit form would have written into the database | code review while building the edit form | fixed |
| Migration 029 used a non-immutable enum cast in an index (failed to apply) | applying it | fixed |
| Document checklist queried a column that does not exist | regression run | fixed |
| Earlier "untrack node_modules / PDF" commits were no-ops | audit before pushing | fixed (commit `46cfa51`) |

## 6. NOT TESTED (be explicit in the PPT)

- Every web page in a real browser (including the new instrument manage card, renewal banner, document checklist, enforcement, notifications, Hindi switcher); only type-check, build and API tests were run.
- Visual layout of the English/Hindi certificate PDF; QR scanning from a printed copy with a phone camera.
- The mobile app on a device or emulator (offline inspection logic is covered by contract tests against the API only).
- Real SMTP e-mail and SMS gateway delivery (tested with fakes and a local stub); real S3/MinIO (tested with a fake client).
- Behaviour of the signed PDF in Adobe Reader or other third-party viewers.
- Load, performance and long-running behaviour; accessibility; cross-browser; HTTPS/HSTS in a deployment; backup and restore.
- Any penetration test or third-party security review.
