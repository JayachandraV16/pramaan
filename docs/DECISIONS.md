# Technical decisions

Short records of choices that are not obvious from the code. Newest last.

## D1 — UUID primary keys, native ENUMs, one users table (from the original schema)
Public identifiers (QR tokens, certificate/application numbers) must not be guessable, and the mobile app may create records offline. Status lists are ENUM types rather than lookup tables, per the project scope rules. One `users` table holds every stakeholder, distinguished by role.

## D2 — Raw SQL with `pg`, no ORM
The schema relies on triggers, views and `ON CONFLICT` counters; hand-written parameterised SQL keeps these visible. Repositories contain SQL only; services contain rules.

## D3 — Certificate trust = server lookup + hashes + signed QR (not a bare random token)
A random QR token already makes forgery hard, but cannot detect an edited PDF or a changed database row. Therefore: SHA-256 of the PDF and of the immutable record, an HMAC in the QR link, and one verification service shared by every public endpoint. HMAC (symmetric) was chosen over Ed25519 because verification is always online through the API; switch to Ed25519 if the mobile app must verify offline. A PAdES/DSC signature is the next step for legal non-repudiation.

## D4 — Immutable, append-only legal records enforced in the database
API checks can be bypassed by a bug or by direct SQL, so certificates, verification evidence/results and the audit log are protected by triggers. The audit log is hash-chained so that even a privileged edit is detectable.

## D5 — The server decides PASS/FAIL for readings
`|observed − expected| ≤ tolerance` is computed by the API; the officer's own claim is ignored when both numbers are present. A PASS decision is rejected if any reading failed.

## D6 — LMO/GATC self-registration requires approval
The problem statement asks for online registration of officers and test centres, but an unvetted account must not gain officer powers. They register as `PENDING_APPROVAL`; only an ADMIN activates them. ADMIN cannot be self-registered. Account status and role are read from the database on each request so suspension is immediate.

## D7 — One state machine for applications
All status changes go through `utils/applicationStatus.js`, which enforces allowed transitions and writes `application_status_history`. A FAIL result still completes the application; the owner files a new (re-)verification application. Cancellation/rejection withdraws open assignments and schedules and is refused once a verification has started.

## D8 — Files are private; links are signed
`/uploads` is not a public static folder. The API signs every file URL it returns (HMAC + expiry) so the web app keeps using plain links while access is time-limited. Object storage with pre-signed URLs is the production equivalent.

## D9 — Fees are data, not code
`fee_rules` holds fees by instrument type / application type / capacity band with validity dates; the most specific active rule wins and rules are end-dated rather than deleted. No amounts are shipped because they differ by State. Where no rule matches, the client-supplied figure is kept so existing deployments keep working.

## D10 — Date-only columns are strings
`pg` converts SQL `DATE` to a local `Date`, which serialises to the previous day in timezones ahead of UTC. The pool returns `DATE` as `YYYY-MM-DD` strings; the PDF and web UI format them in UTC.

## D11 — In-process scheduler guarded by an advisory lock
Expiry and reminder jobs are idempotent and run from the API process (no extra infrastructure); a PostgreSQL advisory lock prevents duplicate runs across instances. They can also run from cron via `npm run jobs:run`.

## D12 — List filtering/paging is in memory
Role-scoped result sets are small for a district/state deployment; `applyListQuery` adds search, filters, sort and paging without changing the default array response. Move it into SQL if a single user can see tens of thousands of rows.

## D13 — Tests run against a real, temporary PostgreSQL
Triggers, enums and views cannot be exercised by mocks. `embedded-postgres` gives every test run a fresh database with no Docker and without touching any configured database.

## D14 — Open items
Email/SMS delivery, object storage for uploads, offline field sync, multilingual UI/PDF, enforcement/repeat-offender tracking and a PAdES-signed PDF are not implemented; see `docs/feature-roadmap.md`.

## D15 — Enforcement facts are immutable; handling is a separate, audited status
A case records what an officer found (offender, offence, date, officer). Those facts cannot be edited or deleted (trigger); only the handling status moves, through a fixed set of transitions, each stored in `enforcement_case_events` and the audit log. Repeat-offender flags are computed by a view over cases (not stored), so dismissing a case immediately lowers the count. Unregistered traders are matched by normalised name (+ phone); this can miss a trader who gives different details each time — officers should link the instrument or owner when they can.

## D16 — Hindi: server message catalogue, per-user language, bilingual PDF
Text the server writes for people goes through `utils/i18n.js` (functions per key, English fallback) in the recipient's `preferred_language`, so in-app, e-mail and SMS agree. The certificate PDF carries an English page and a Hindi page (Noto Sans Devanagari, SIL OFL, bundled) instead of one crowded bilingual page. The web app keeps English text inline and looks Hindi up by key, so untranslated screens still work. The database must be UTF8 (the test runner now creates its cluster as UTF8).

## D17 — E-mail and SMS through an outbox
Deliveries are queued in the same transaction as the notification and sent by a worker with retries, so a provider outage never loses or duplicates a message and never blocks a request. SMTP via nodemailer; SMS through a generic JSON gateway (adapt the body for the chosen provider). SMS is limited to important event types, and users can opt out per channel. Indian SMS needs DLT sender/template registration, which is outside the code.

## D18 — Object storage behind a small driver interface
`local` and `s3` (any S3-compatible service) implement put/open/remove over relative keys. The database keeps `/uploads/<key>` and the API serves those paths with signed links, so switching drivers needs no data migration and the bucket stays private. Uploads are staged in the OS temp directory, verified (extension, magic bytes, SHA-256) and then stored. Existing files are not moved automatically when switching drivers.

## D19 — PDF signature: PKCS#7 detached now, PAdES and a CA-issued key later
The PDF is signed with a PKCS#12 identity and the stored `pdf_sha256` is of the signed file. An independent verifier checks the embedded signature (document digest and RSA signature) so a copy can be validated without trusting the database. Not done: PAdES profiles, RFC 3161 timestamps, long-term validation, and any CA trust evaluation. A self-signed key (`npm run signing:dev-cert`) proves nothing to a third party; production needs a Digital Signature Certificate from a licensed Certifying Authority, ideally in an HSM.

## D20 — Production refuses to start with development accounts
The seed and `npm run demo:users` create `*@pramaan.local` accounts whose passwords are in the repository (including an ADMIN). With `NODE_ENV=production` the API checks at start-up and exits if any is active.

## D21 — Instrument types are data, never constants in the client
The web form once carried a list of instrument types with IDs copied from another developer's database, so every instrument creation failed with "Invalid or inactive instrument type" on any other database. IDs are generated per database; the client now reads `GET /api/instruments/types`. The backend validation (type must exist and be active) is unchanged. Rule: no database IDs in client code.

## D22 — One decision function for "verification or renewal?"
`utils/renewal.js` decides whether an instrument can be (re-)verified and as what; it is used both when an application is filed and by the `/renewal` endpoint the form calls, so the form and the server cannot disagree. A renewal always records the certificate it renews. The window (default 60 days) is configuration. Known limit: the old certificate stays ACTIVE until it expires; there is no "superseded" state.

## D23 — Required documents are defined by the department, not shipped
Which documents an application needs depends on State rules, so none are seeded. Requirements are scoped (application type, origin, applicant category) and enforced at the point an officer is assigned, which keeps the owner's flow unblocked while paperwork is gathered. Uploads are matched to a requirement by `document_type`.

## D24 — Instrument lifecycle
Edit, deactivate (reversible) and decommission (final) are separate, audited actions. Decommissioning is blocked while an application is open and freezes the row in the database. Out-of-service instruments leave the due list and reports. Their existing certificates are not revoked automatically; revocation stays a deliberate admin action.

## D25 — OCR is advice, never a decision
The nameplate reading is stored as immutable evidence (photo hash, raw text, what was extracted, what it was compared with, the machine's suggestion) and always starts as `PENDING_REVIEW`. Only a person can set the outcome; the audit log records the machine's advice beside the human decision. OCR never edits an instrument, revokes a certificate or opens an enforcement case. A "perfect" read still waits for a person.

## D26 — Four eyes on the review
The reviewer must be an administrator or an officer assigned to the instrument, and cannot be the person who uploaded the photo (also a database CHECK). Owners can upload but cannot decide.

## D27 — Local, open-source OCR
tesseract.js (Apache-2.0, WebAssembly, no native build) with the English "fast" model kept on the server (`npm run ocr:setup`). No paid or cloud AI service, nothing leaves the server, and the feature degrades to "check the plate by eye" when the model is missing. Known limits: English only; accuracy on real photos (glare, angle, embossed or worn plates) is unmeasured; the OCR library processes uploaded images, so uploads stay restricted (type, magic bytes, size limit, time limit, rate limit) and run in a worker thread.

## D28 — Certificate numbers: a check character and a keyed tag, legacy kept
New numbers look like `PRM-26-IND-0000123-K-7QXM`. The check character (ISO 7064 MOD 37,36) catches every single wrong character and every swap of neighbours; the 4-character HMAC tag (20 bits, keyed with `INTEGRITY_SECRET`) stops invented numbers and guessing from a neighbour's number before the database is asked. Neither is proof: a certificate is authentic only if the registry holds it and its QR signature and record fingerprint agree. `CERT_ID_SCHEME` defaults to `legacy`; `CERT-` numbers stay valid for ever. Changing `INTEGRITY_SECRET` invalidates the tags of already-issued structured numbers, so rotate it with care.

## D29 — A paper copy is never declared authentic
The copy check reports what the registry holds and whether the printed details agree. OCR is approximate, and a photocopy of a genuine certificate looks like the original, so the strongest statement is "consistent with the record". Without a readable QR code the best outcome is a warning. A QR code that leads to another website is flagged and never followed. The upload is processed in memory.

## D30 — Originals are kept; metadata lives in PostgreSQL
Evidence photos are fingerprinted at upload, so they are stored byte-for-byte. Rotation is not baked in: the camera orientation is recorded (`stored_files.exif_orientation`), browsers display the photo upright, and the OCR and QR paths turn it themselves. Pictures must decode and have a sane pixel count. Files that no request ends up using are removed when the request fails, and `npm run storage:audit/cleanup` finds the rest.

## D31 — Storage migration copies, verifies and never deletes
`npm run storage:migrate` copies every file to the other driver, reads each copy back and compares SHA-256, never overwrites a different file on the target, and never touches the source. Switching `STORAGE_DRIVER` is a separate, deliberate step after a clean report.

## D32 — Command HQ: one definition per number, administrators only
Every figure on the HQ page is defined once (`hq.repository.js`, `DRILL`) and the same definition produces the tile and the list behind it, so they cannot disagree; a test compares each tile with its list and with the database. The routes require ADMIN and the service checks it again. Evidence packs recompute the record fingerprint instead of only repeating the stored one, so a record changed behind the application's back shows up. Looking at evidence and exporting the report are themselves audit-logged. The map draws at most 2000 instruments (no clustering yet) and says when it has cut the list; instruments without coordinates are counted, never invented onto the map.
