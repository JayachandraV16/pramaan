# Implementation plan: checkpoints 1–6

## Status

| Checkpoint | Status | Evidence |
|---|---|---|
| 0. OCR nameplate check | **DONE**, committed `5723091` | 157 API tests passed at the time; see `docs/TEST_REPORT.md` 4b |
| 1. Map-based location | **DONE**: automated and real-browser checks PASS (see `docs/TEST_REPORT.md` 4c) | map tests 5/5, API suite 162/162, web and mobile type-check, web build, 26/26 headless-Edge checks. NOT TESTED: touch/phone input, real GPS hardware, mobile map |
| 2. OCR review visibility | **DONE**: tests PASS (see `docs/TEST_REPORT.md` 4d) | API suite 166/166, 17/17 browser checks. Migration 031 (evidence kind). Upload at registration not built |
| 3. Application queries | **DONE**: tests PASS (see `docs/TEST_REPORT.md` 4e) | API suite 170/170, 15/15 browser checks. Migration 032. Not built: Hindi text for new messages, unread badges |
| 4. Certificate ID v2 | **DONE**: tests PASS (see `docs/TEST_REPORT.md` 4f) | API suite 174/174, 13/13 browser checks. Migration 033. Scheme stays `legacy` until `CERT_ID_SCHEME=v2` is set. The full record fingerprint is on the PDF, the certificate page and the public page (from Checkpoint 5's scope) |
| 5. Hash wording and physical-copy check | NOT STARTED | |
| 6. Storage hardening | NOT STARTED | |

Approved decisions
- **Certificate IDs:** the PRM format with office code `IND` by default, behind a configuration switch (`CERT_ID_SCHEME`, default `legacy`) until tested.
- **Maps:** OpenStreetMap raster tiles are acceptable for the prototype.
- **Physical-copy verification:** public and rate-limited, with clear warnings that OCR alone cannot prove authenticity.
- **Storage:** local development storage now, S3-compatible migration support later (no AWS integration now).

Ground rules for every checkpoint: reuse existing modules; keep current workflows, authorization and data integrity intact; no checkpoint changes issued certificates, signatures or audit records; add tests with each change; run the full API suite, web and mobile type-checks and the web build before committing; one commit per checkpoint with a verified file list; update `docs/TEST_REPORT.md` with PASS / FAIL / NOT TESTED; stop and explain if a checkpoint exposes a significant architectural problem.

Verification tooling: besides the API tests, UI behaviour is checked in a real browser engine (headless Microsoft Edge or Chrome driven by `puppeteer-core`, kept outside the repository) against an isolated stack: a throw-away embedded PostgreSQL, the API and the Vite dev server. The developer's own database is never used. Anything that needs a physical phone, a printed paper copy or a real provider stays NOT TESTED.

Migration numbers: 031 is used by Checkpoint 2 (evidence kind); Checkpoint 3 uses 032 and Checkpoint 4 uses 033.

Dependencies added overall: `leaflet` and `@types/leaflet` (web), `jsqr` (api, QR from images), `jimp` moved from dev to runtime dependency (api, image preparation and QR pixel access). Nothing else; OCR (`tesseract.js`) is already in place.

## Checkpoint 1: map-based location

Goal: choose an instrument's location by clicking or dragging a pin on an OpenStreetMap map; coordinates are captured automatically; no invented coordinates.

Root cause: the registration form pre-fills every instrument with Mumbai coordinates (19.0760, 72.9980); there is no map; the API range-checks coordinates only on update.

Architecture
- `web/src/utils/coordinates.ts`: pure helpers (parse, validate, India bounding-box warning, "old default" detection), unit-tested from the API suite (types stripped by Node, as for the mobile engine).
- `web/src/components/maps/LocationPicker.tsx`: Leaflet map in a React component (plain Leaflet, no wrapper library); click or drag sets the pin; "Use my current location" (browser geolocation, needs HTTPS or localhost); numeric fields stay visible and in sync; "Clear location"; default view of India that is **never saved**; tile layer from `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` with the OpenStreetMap attribution; a notice if tiles cannot load, with manual entry still working. Custom CSS pin, so no bundled marker images.
- Used on: registration (`NewInstrumentPage`), instrument editing (`InstrumentManage`), and a read-only map on `InstrumentDetailPage`.
- API: `POST /instruments` validates coordinates like the update path (both or neither, valid ranges).
- Mobile: keeps the "use my current location" GPS capture; no interactive map (a native map module needs a different build). Invented defaults are not used.

Dependencies and migrations: `leaflet`, `@types/leaflet`; no migration.
Existing data: instruments sitting at exactly the old default coordinates are probably wrong; the detail page shows a "confirm this location on the map" notice. Nothing is changed automatically.

Acceptance
- Registering without touching the map stores **no** coordinates.
- Clicking the map fills latitude and longitude; dragging the pin updates them; typing in the fields moves the pin; clearing removes the location.
- Out-of-range or half-filled coordinates are rejected by the API (tests).
- Works with tiles unreachable (fields still usable).
- Browser test passes in headless Edge/Chrome; type-check and build pass.

## Checkpoint 2: OCR review visibility

Goal: authorised users see the nameplate photo, extracted text, field comparison and status on the admin and LMO dashboards; photos actually display.

Root cause: the nameplate check is reachable only from the instrument page and appears on no dashboard; the photo is a text link (never an `<img>`) with a signed link that expires after 30 minutes; nameplates cannot be uploaded during registration; phone photos are often rotated or huge and are sent to OCR as they are.

Architecture
- API: `GET /nameplate/queue?status=` (ADMIN: all; LMO/GATC: assigned instruments) and counts for dashboard cards.
- Web: `NameplateCheckCard` extracted from `NameplateCheck` and reused by a new `/nameplate` review page and the instrument page; `SecureImage` component (inline preview, click to enlarge, re-fetches a fresh signed link if the old one expired); dashboard card "Nameplate checks waiting" for ADMIN, LMO and GATC; optional nameplate upload step after instrument registration.
- OCR preparation (`utils/imagePrep.js`): EXIF orientation, size cap for OCR, contrast; the original stays untouched and hashed. Header-based dimension limit (decompression-bomb guard) before decoding.
- Authorisation unchanged: owners upload, a different admin/assigned officer decides.

Dependencies and migrations: `jimp` becomes a runtime dependency; no migration.

Acceptance
- A pending check appears in the admin and LMO queues with the image visible, OCR text, comparison table and status.
- An expired photo link recovers by itself.
- Rotated and oversized images are handled (tests); extreme dimensions are rejected.
- Unassigned officers and strangers cannot see other people's checks (tests).
- Browser test: upload, see image and result, decide.

## Checkpoint 3: application queries

Goal: officials raise queries, request clarification or specific documents, applicants answer, with status and history.

Root cause: the feature exists but is reachable only inside the application page, has no inbox, no "request documents" type, no attachments on replies and no history of status changes.

Architecture and migration 031 (additive only)
- `application_queries.kind` (`CLARIFICATION` / `DOCUMENT_REQUEST`, default `CLARIFICATION`), `requested_document_types TEXT[]`, `due_date`.
- `application_query_events` (opened, document requested, closed, reopened: actor and time) for the history.
- `application_query_message_files(message_id, attachment_id)`: replies reference attachments uploaded to the application (existing upload rules apply; the attachment must belong to the same application and uploader).
- API: inbox filters (`awaiting=me`, `status`, `kind`), `PATCH /:id/reopen` (department or ADMIN), document-request progress in the thread.
- Web: `/queries` inbox with an "awaiting you" badge, a "Raise query" shortcut on the officer's assignment list, document request form (choose document types), file attach in replies, history panel.
- Existing threads keep working (defaults).

Acceptance
- An officer requests documents; the applicant sees the request, uploads, replies; progress shows N of M; the officer closes; history lists every step with who and when.
- Authorization: only participants; owners cannot reopen; closed threads accept no replies until reopened by the department.
- Existing query tests still pass.

## Checkpoint 4: certificate ID scheme v2

Goal: deterministic, unique, typo-detecting and forgery-resistant certificate numbers.

Format: `PRM-YY-OOO-NNNNNNN-C-TTTT`, for example `PRM-26-IND-0000142-7-K3QX`
- `YY` issue year, `OOO` office code (3 letters or digits, default `IND`), `NNNNNNN` 7-digit sequence.
- `C` check character: ISO/IEC 7064 MOD 37,36 over the characters before it. Public algorithm; catches every single-character error and adjacent swap, so typing mistakes are reported as such, not as "no such certificate".
- `TTTT` keyed tag: first 4 characters (ambiguity-free alphabet) of HMAC-SHA256 with `INTEGRITY_SECRET` over `v2|PRM…C`. Without the server secret nobody can produce a valid-looking number for a certificate that was never issued, or fix up the checksum after altering a printed number. (The check character alone cannot do this: it is public.)
- Uniqueness: counters per (office, year) incremented inside the issuing transaction (the existing pattern), plus the existing unique constraint; sequence overflow is an error, never a wrap.

Compatibility and migration 032
- `CERT_ID_SCHEME=legacy|v2`, `CERT_OFFICE_CODE=IND`. Default `legacy`: nothing changes until switched.
- Legacy numbers (`CERT-YYYY-NNNNNN`) stay valid forever and are recognised by prefix. `certificate_number` column and unique constraint are unchanged; a counter table `certificate_id_counters(office, year, last_sequence)` is added.
- QR signature and record fingerprint already include the number, so they work unchanged.
- Verification validates structure, check character and tag before any database lookup, and reports "check the number for a typing error" separately from "not found".

Acceptance
- Property tests: every single-character substitution and adjacent transposition of a valid number is detected; round trip; tag fails when any character changes.
- 50 concurrent issuances give 50 distinct, valid numbers.
- With `legacy` nothing changes; with `v2` new certificates use PRM numbers; old numbers still verify.
- The PDF, file name, QR page and lookups handle both schemes.

## Checkpoint 5: certificate hash wording and physical-copy verification

Goal: users understand what the hash proves; scanned or photographed copies can be checked, never trusted on OCR alone.

Facts that drive the design
- A PDF **cannot contain its own SHA-256** (adding the hash changes the file). The PDF therefore prints the full 64-character **record fingerprint** (hash of the certificate data) prominently; the **file hash** is shown on the certificate page, in the issue notification and on the verify page.
- A hash proves integrity (no change since issue). It is **not a digital signature**: it does not say who issued the file. The PDF digital signature, when a CA-issued key is configured, does that. All screens say so.

Physical-copy workflow: `POST /api/qr-auth/check-copy` (public, rate-limited, JPG/PNG up to 10 MB, image not stored)
1. Prepare the image; decode a QR code if present (`jsqr`).
2. OCR the printed text; extract certificate number (using the check character to correct look-alike OCR slips), instrument serial, issue and expiry dates.
3. Resolve the official record by QR token (strong evidence, signature verified by the existing verifier) or else by the OCR'd number.
4. Compare each printed field with the record. Report revocation and expiry from the database.
5. Verdicts (never "authentic" from OCR alone):
   - `QR_VERIFIED_TEXT_CONSISTENT`: the QR is genuine and the printed details agree.
   - `QR_VERIFIED_TEXT_DIFFERS`: the QR is genuine but the printed details differ: warn of an altered copy.
   - `TEXT_ONLY_CONSISTENT`: no usable QR; details agree with the record; explicitly **not proof**.
   - `TEXT_ONLY_MISMATCH`, `NOT_FOUND`, `UNREADABLE`.
6. Every response carries the limitations: a photocopy of a genuine certificate would also pass; only the original signed file or a QR check against the registry establishes authenticity; OCR can misread.
Logged in `qr_authentications` with `access_source = 'PUBLIC_COPY_CHECK'`.

Dependencies and migrations: `jsqr`; no migration (the access source is free text). Layout: the PDF footer is rebuilt with computed positions; a test reads positions back from the PDF to ensure nothing overlaps or leaves the page.

Acceptance
- Genuine QR plus matching text → consistent; genuine QR with altered serial or date → differs warning; text only → "not proof"; no QR and unreadable → clear message.
- No code path returns an authenticity claim without a verified QR signature.
- Rate limit enforced; non-images rejected; images are not retained.
- The explanatory wording appears on the PDF (both pages), the certificate page and the verify page.

## Checkpoint 6: storage architecture hardening

Finding: the object-storage abstraction already exists (local and S3-compatible drivers behind one interface; file metadata, hash and reference in PostgreSQL; magic-byte checks; size limit; ownership checks; signed expiring links).

Work
- `docs/STORAGE_ARCHITECTURE.md`: evaluation, access-control matrix, threat model, retention, and the migration procedure.
- `list()` on both drivers; `npm run storage:audit` (read-only report of database references without a file and files without a reference).
- `npm run storage:migrate -- --to s3 --dry-run`: copies referenced files to the target driver, verifies SHA-256 after copy, never deletes the source. Tested with the fake S3 client only; real S3 remains NOT TESTED.
- Image size and dimension limits shared with checkpoint 2; configurable image size limit.
- Documented decision on EXIF: originals are kept as evidence and are visible only to authorised users.

Dependencies and migrations: none.
Acceptance: audit finds planted orphans and missing files; migration copies and verifies in tests (local to local, local to fake S3), refuses on hash mismatch, and leaves the source intact.

## Risk register

| Risk | Checkpoint | Mitigation |
|---|---|---|
| OSM tiles need internet; tile policy limits heavy use | 1 | configurable tile URL; manual entry still works; attribution shown |
| Browser geolocation requires HTTPS or localhost | 1 | clear message; fields remain |
| OCR accuracy on real photos is unmeasured | 2, 5 | human review; never authenticate on OCR; mark NOT TESTED until real photos are tried |
| Certificate ID change affects QR, PDFs, lookups | 4 | switch defaults to `legacy`; legacy numbers always valid; property tests |
| Keyed tag depends on `INTEGRITY_SECRET` | 4 | secret rotation would invalidate v2 tags: document; keep secret stable |
| Physical-copy check mistaken for proof of originality | 5 | fixed warning text; verdict names; tests forbid authenticity claims without a verified QR |
| Public OCR endpoint is CPU-heavy | 5 | rate limit, size and dimension limits, queue, timeouts |
| Layout regressions in the PDF | 5 | position-based test |
| Wide changes in one go | all | one checkpoint per commit, full suite each time |

## Commit plan

0 `feat: OCR-assisted nameplate check` (done) · 1 map · 2 OCR review visibility · 3 queries · 4 certificate ID v2 · 5 physical-copy verification and hash wording · 6 storage hardening. Each: code, tests, docs, TEST_REPORT update; nothing pushed without approval.
