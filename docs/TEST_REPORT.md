# Test report: prototype readiness for the SIH PPT round

Scope: what was actually run, with the result, and what was **not** run. Nothing here is estimated.

- Code: `develop` at `2d8345d` plus the Checkpoint 2 changes described in 4d.
- Automated tests run against a **throw-away embedded PostgreSQL 18** (UTF8), created fresh for every run, with all 31 migrations applied. No real or production data is used.
- Your local development database was used only for read-only smoke checks (health, instrument types, login, production start-up guard).
- Reproduce: `cd api && npm test` (about 60 s) · `cd web && npx tsc --noEmit && npx vite build` · `cd mobile && npx tsc --noEmit`.

## Summary

| Check | Result |
|---|---|
| API automated tests | **PASS: 166 of 166** (0 failed; two consecutive full runs) |
| Web type-check and production build | **PASS** |
| Mobile type-check | **PASS** |
| End-to-end workflow (16 narrated steps, `api/test/e2e_demo.test.js`) | **PASS: 16 of 16** |
| Map location picker in a real browser (headless Microsoft Edge, 4c) | **PASS: 26 of 26** |
| Nameplate review queue and inspection photos in a real browser (4d) | **PASS: 17 of 17** |
| Every other page in a real browser, mobile app on a device | **NOT TESTED** (see the last section) |

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

## 4b. Phase 6, feature 1: OCR-assisted nameplate check

| Item | Evidence | Result |
|---|---|---|
| Local OCR engine starts and reads a generated nameplate (0.4 s start-up, about 0.3 s per image, every field parsed) | `nameplate.test.js` real-engine test; feasibility run | PASS |
| Field parsing: clean and noisy plates, several label styles and units, nothing invented from garbage | unit test | PASS |
| Comparison with registered data: match, look-alike characters (O/0), unit conversion (0.5 t = 500 kg), mass vs volume, class III = 3 = "lll", not registered, not read | unit tests | PASS |
| Advisory thresholds (low OCR confidence is never "all match") | unit test | PASS |
| Upload through the API: evidence stored with SHA-256, private signed link, audit entry; instrument row unchanged | API test | PASS |
| Wrong serial number flagged as LIKELY_MISMATCH; blank photo as UNREADABLE; none are auto-resolved | API test | PASS |
| Access and input rules (anonymous, stranger, unassigned officer, PDF, fake image, malformed ids, engine not set up → 503 and no record) | API test | PASS |
| Human decision: owners cannot decide, uploader cannot decide, unassigned officer cannot decide, one decision only, note required for mismatch/unreadable, owner notified, machine advice recorded beside the decision, no side effects on instrument or enforcement | API test | PASS |
| Machine output immutable, decision final, no deletes (database triggers and CHECK constraints) | database test | PASS |
| Accuracy on **real photographs** (angle, glare, embossed or worn plates, handwriting) | | **NOT TESTED** |
| Hindi or other-script plates; PDF documents; phone-camera capture in a browser | | **NOT TESTED / not supported** |
| The upload and review screens in a browser | type-check and build only | **NOT TESTED** |
| Robustness against malicious images in the OCR library (limits are in place: type, magic bytes, 10 MB, 60 s, rate limit, worker thread) | no security review | **NOT TESTED** |
| Behaviour with many simultaneous uploads (jobs are queued one at a time) | | **NOT TESTED** |

## 4c. Checkpoint 1: map-based location

Browser checks ran in headless Microsoft Edge driven by `puppeteer-core`, against an isolated stack (throw-away PostgreSQL, the real API, the Vite dev server); the harness is outside the repository. Your own database was not used.

| Item | Evidence | Result |
|---|---|---|
| Coordinate rules (both or neither, ranges, rounding to 6 places), India warning, detection of the old Mumbai default | `map.test.js` (2 unit tests) | PASS |
| Registration without a location stores NULL (no invented default) | `map.test.js` | PASS |
| Picked location stored; half-given, out-of-range, text or null coordinates refused on create and nothing saved | `map.test.js` | PASS |
| Location corrected or cleared on update, never left half-set; a stranger gets 403 | `map.test.js` | PASS |
| Full API suite after the change | `npm test` | PASS: 162 of 162 |
| Web `tsc --noEmit`, `vite build`, mobile `tsc --noEmit` | commands | PASS |
| Map renders; OpenStreetMap tiles load; attribution shown | browser | PASS |
| Latitude and longitude start empty, no pin before a choice | browser | PASS |
| Click fills coordinates (in India) and shows a pin; dragging the pin updates them; typing moves the pin | browser | PASS |
| Impossible latitude shows an error; submit blocked while invalid | browser | PASS |
| Valid pick saved exactly; detail page shows a read-only map and pin | browser | PASS |
| Registering without a map choice stores no coordinates; detail page says none recorded | browser | PASS |
| Existing instrument at the old default shows the "confirm this location" notice; clearing it in the edit form removes the location | browser | PASS |
| Tiles blocked: a notice appears and typed coordinates still place the pin | browser | PASS |
| "Use my current location" with a simulated GPS fix fills 12.971600, 77.594600; "Clear location" empties; permission denied gives a clear message | browser (simulated geolocation) | PASS |
| No browser errors on the pages tested | browser | PASS |
| Touch and phone input; real GPS hardware; other browsers than Edge | | **NOT TESTED** |
| Interactive map in the mobile app (mobile keeps GPS capture only) | | **NOT BUILT** |
| OpenStreetMap tile usage under heavy traffic (their policy suits a prototype; production needs a tile provider) | | **NOT TESTED** |

Observations, not fixed here: instruments without a capacity display "0 kg" (existing web mapper default); Leaflet raised the web bundle to about 627 kB (Vite chunk-size warning); the instrument web page is only open to owners and admins, which matters for Checkpoint 2.

## 4d. Checkpoint 2: OCR review queue and inspection photos

Same browser method as 4c (headless Edge, isolated stack, real OCR engine with the English model).

| Item | Evidence | Result |
|---|---|---|
| Root cause of "photos not visible": the photo was only a "View photo" link inside the instrument page, which officers cannot open; there was no queue | code review | fixed: inline image, queue page |
| `GET /nameplate/queue?status=`: ADMIN sees all, an officer only instruments assigned to them, owners get 403, bad status 400, decided checks move between tabs | `inspection.test.js` | PASS |
| Queue rows carry instrument, serial, owner and a signed photo link | `inspection.test.js` | PASS |
| Inspection photos with a kind (reading, test weight, seal, condition, other): stored with SHA-256, images only, owners and unassigned officers refused, kind only on verification evidence, evidence without a kind still works (migration 031) | `inspection.test.js` | PASS |
| Damaged image with valid header used to **crash the whole API process** (found in the browser run: uncaught error in the OCR worker). Images are now decoded and re-encoded before OCR; damaged files give 400, absurd pixel counts are refused, large photos scaled to 2400 px | `inspection.test.js` (unit and real-engine API test) | fixed, PASS |
| Browser: officer queue shows only the assigned instrument; image decoded and visible; advisory, comparison and status shown; decision from the queue moves the check to its tab with the note | browser | PASS |
| Browser: admin sees every instrument; owner is redirected away from the queue; owner sees the photo inline on the instrument page | browser | PASS |
| Browser: officer uploads four photos (reading, test weight, seal, condition) on the verification page; they display and are stored with their kinds | browser | PASS |
| No browser errors on the pages tested | browser | PASS |
| Photo upload at instrument registration; phone camera capture; EXIF rotation of real phone photos | | **NOT BUILT / NOT TESTED** (orientation is applied by the image library on load, not verified with a real photo) |

## 5. Defects found and fixed during this work

| Defect | How it was found | Status |
|---|---|---|
| Web form used instrument-type IDs hard-coded from another database | user report, traced through the request, the backend check and the database | fixed |
| Web mapper invented a default accuracy class that the new edit form would have written into the database | code review while building the edit form | fixed |
| Migration 029 used a non-immutable enum cast in an index (failed to apply) | applying it | fixed |
| Document checklist queried a column that does not exist | regression run | fixed |
| Earlier "untrack node_modules / PDF" commits were no-ops | audit before pushing | fixed (commit `46cfa51`) |
| A JPG/PNG with a damaged body crashed the API through an uncaught OCR worker error | real-browser run (Checkpoint 2) | fixed: decode first, 400 |

## 6. NOT TESTED (be explicit in the PPT)

- OCR accuracy on real nameplate photographs, and the nameplate screens in a browser (see 4b).
- Web pages in a real browser other than the map pages in 4c (the instrument manage card, renewal banner, document checklist, enforcement, notifications, Hindi switcher, nameplate screens); only type-check, build and API tests were run for them.
- Visual layout of the English/Hindi certificate PDF; QR scanning from a printed copy with a phone camera.
- The mobile app on a device or emulator (offline inspection logic is covered by contract tests against the API only).
- Real SMTP e-mail and SMS gateway delivery (tested with fakes and a local stub); real S3/MinIO (tested with a fake client).
- Behaviour of the signed PDF in Adobe Reader or other third-party viewers.
- Load, performance and long-running behaviour; accessibility; cross-browser; HTTPS/HSTS in a deployment; backup and restore.
- Any penetration test or third-party security review.
