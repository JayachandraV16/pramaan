# Pramaan API contracts

Base URL: `http://localhost:5000` in development. Everything is JSON under `/api` except file downloads and CSV exports. Source of truth is the code in `api/src/modules/*/*.routes.js`; the route table below was generated from the running Express app.

## Conventions

**Success envelope**

```json
{ "success": true, "message": "…", "data": <payload> }
```

**Error envelope** (HTTP 4xx/5xx)

```json
{ "success": false, "message": "Human readable reason", "details": ["field errors, when validation fails"] }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed / business rule violated |
| 401 | Missing, malformed or expired token; wrong credentials |
| 403 | Authenticated but not allowed (role, ownership, suspended or unapproved account) |
| 404 | Not found |
| 409 | Conflict with current state (duplicate, illegal status change, already revoked) |
| 413 | Upload larger than 10 MB |
| 429 | Rate limit exceeded (see `Retry-After`) |

**Authentication.** `Authorization: Bearer <JWT>`. The token proves identity; the account's current status and role are re-read from the database on every request, so a suspended user is locked out immediately.

**Roles.** `INSTRUMENT_OWNER`, `LMO`, `GATC`, `ADMIN`, `PUBLIC_USER`. Data visibility is scoped: owners see their own instruments/applications/certificates, LMO/GATC see work assigned to them, ADMIN sees everything.

**Dates.** SQL `DATE` values are plain strings `YYYY-MM-DD`; timestamps are ISO-8601 UTC.

**Lists.** List endpoints return a plain array. Add `page` and/or `limit` (max 100) to get `{ items, total, page, limit, totalPages }`. Also supported: `search=` (case-insensitive over the main text fields), `status=` (comma separated = any of), `sort=<field>&order=asc|desc`. Applies to instruments, applications, certificates, verifications.

**Files.** Any `file_url` / `certificate_file_url` in a response is a **signed, short-lived** link (`/uploads/…?exp=…&sig=…`, default 30 min). Without a valid signature `/uploads/*` returns 403. Re-fetch the resource to get a fresh link.

**Rate limits** (per IP, in memory): login 10 / 15 min per IP+email; register 20 / h; public verification 60 / min; change password 10 / 15 min.

## Auth — `/api/auth`

| Method & path | Who | Body / notes |
|---|---|---|
| `POST /register` | public | `{ fullName, password, role, email?, phone?, organizationName?, address?, lcrNumber?, applicantType? }` (email or phone required). Password: 8–128 chars with a letter and a digit. `INSTRUMENT_OWNER` / `PUBLIC_USER` → 201 with `{user, token}`. `LMO` / `GATC` → 201 with `{user, token:null, pendingApproval:true}`; they cannot log in until an ADMIN approves. `ADMIN` → 403. |
| `POST /login` | public | `{ email, password }` → `{ user, token }`. 403 "awaiting administrator approval" / "account is suspended" is only revealed after a correct password. |
| `GET /me` | any | current profile |

## Users — `/api/users`

| Method & path | Who | Notes |
|---|---|---|
| `GET /` | ADMIN | `?status=PENDING_APPROVAL|ACTIVE|SUSPENDED|INACTIVE&role=&search=&page=&limit=` → `{items,total,page,limit}` |
| `POST /` | ADMIN | create an account of any role (active immediately) |
| `GET /:id` | ADMIN | |
| `PATCH /:id/status` | ADMIN | `{ status }` approve / suspend / reactivate; cannot change own status; audited |
| `PATCH /me` | any | `{ fullName?, phone?, organizationName?, address? }` (role, email, status cannot be changed here) |
| `POST /me/password` | any | `{ currentPassword, newPassword }` |

## Instruments — `/api/instruments`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | OWNER, ADMIN | `{ instrumentTypeId, instrumentName, serialNumber, manufacturer?, model?, capacity?, capacityUnit?, accuracyClass?, locationAddress?, locationLat?, locationLng? }` |
| `GET /` | OWNER (own), ADMIN (all), LMO/GATC (assigned) | list + search/paging |
| `GET /types` | any role above | instrument types (owners: active only) incl. `default_validity_months` |
| `PATCH /types/:id` | ADMIN | `{ defaultValidityMonths? (1–120), isActive?, description?, defaultUnit? }` |
| `GET /due` | OWNER, ADMIN, LMO, GATC | re-verification tracking: per instrument `verification_state` (`NEVER_VERIFIED`, `VALID`, `DUE_SOON` ≤30 days, `OVERDUE`, `REVOKED`), `next_due_date`, `days_until_due`. `?state=&withinDays=` |
| `GET /:id` | OWNER (own), ADMIN, LMO/GATC (assigned) | |

## Applications — `/api/applications`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | OWNER (own instrument), ADMIN | `{ instrumentId, applicationType: VERIFICATION|RE_VERIFICATION, division, purpose?, remarks?, submissionOffice?, instrumentOrigin?, grasChallanNumber?, grasChallanDate?, conveyanceFee?, quarterJumpFee?, lastCertificateId? }`. `RE_VERIFICATION` needs `lastCertificateId` of the same instrument. 409 if the instrument already has an open application. Fees are computed from the fee rules (see `/api/fees`); where a rule matches, the server amount replaces the client figure. Number format `LM/{year}/{DIVISION}/{000001}`. Created as `SUBMITTED`. |
| `GET /` | role-scoped | list + search/paging; `?type=&division=` filters |
| `GET /:id` | owner / ADMIN / assigned officer | |
| `GET /:id/history` | same as above | status timeline `[ {from_status,to_status,reason,changed_at,changed_by_name} ]` |
| `POST /:id/cancel` | applicant or ADMIN | `{ reason? }`; only before any verification has started; withdraws open assignments/schedules |
| `POST /:id/reject` | ADMIN | `{ reason }` (≥10 chars); notifies applicant and officers |
| `POST /:id/payment-verified` | ADMIN | confirms the GRAS challan; needs `gras_challan_number`. When `REQUIRE_PAYMENT_BEFORE_ASSIGNMENT=true` assignment is blocked until this is done |

Status machine: `SUBMITTED → UNDER_REVIEW → SCHEDULED → COMPLETED`, with `REJECTED` / `CANCELLED` from any open state. `COMPLETED`, `REJECTED`, `CANCELLED` are final; an owner files a new application (e.g. re-verification) afterwards.

## Assignments — `/api/assignments`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | ADMIN | `{ applicationId, assignedToId, remarks? }` – assignee must be an active LMO/GATC. Re-assigning retires the previous assignment (`REASSIGNED`) and cancels its schedules. Not allowed once a verification started. Moves the application to `UNDER_REVIEW`, notifies the officer. |
| `GET /` | ADMIN (all), LMO/GATC (own) | |
| `GET /available-officers` | ADMIN | active LMO/GATC users |
| `GET /:id` | ADMIN / assignee | |
| `PATCH /:id/status` | assignee or ADMIN | `{ status: ACCEPTED|DECLINED, remarks? }`. `ASSIGNED→ACCEPTED|DECLINED`, `ACCEPTED→DECLINED`; `COMPLETED`/`REASSIGNED` are system-set. A decline notifies the assigning admin. |

## Schedules — `/api/schedules`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | ADMIN | `{ applicationId, assignmentId, scheduledDate: YYYY-MM-DD (not past), scheduledTime? HH:MM, verificationLocation?, remarks? }`. 409 if the officer already has that date+time. Sets application `SCHEDULED`; notifies applicant and officer. |
| `GET /`, `GET /:id` | ADMIN / assignee | |
| `PATCH /:id/status` | ADMIN / assignee | `{ status: RESCHEDULED|COMPLETED|CANCELLED, scheduledDate?, scheduledTime?, remarks? }`. `RESCHEDULED` requires a new future `scheduledDate`; old/new values are audited. `COMPLETED` / `CANCELLED` are final. |

## Verifications — `/api/verifications` (ADMIN, LMO, GATC)

| Method & path | Notes |
|---|---|
| `POST /` | start: `{ applicationId, assignmentId, scheduleId?, location?, latitude?, longitude?, remarks? }`. Assignment must be `ACCEPTED` and belong to the caller; one verification per assignment (409). GPS must be a valid pair. |
| `GET /`, `GET /:id`, `GET /:id/result` | scoped to the officer (ADMIN: all) |
| `POST /:id/observations` | `{ observationType, observationDescription?, observedValue?, remarks? }` while `IN_PROGRESS` |
| `POST /:id/readings` | `{ readingType, observedValue, unit, expectedValue?, tolerance?, result?, remarks? }`. **The server decides PASS/FAIL** (`|observed−expected| ≤ tolerance`) whenever expected value and tolerance are given and ignores any client `result`. Without them `result` (PASS/FAIL) is required. |
| `POST /:id/result` | `{ decision: PASS|FAIL, remarks? }` → 200. PASS needs ≥1 reading, no failed readings, and (if `MIN_EVIDENCE_FOR_PASS` > 0) enough photo/evidence attachments. FAIL without a failed reading needs `remarks` (≥10 chars). One transaction: stores the result with a SHA-256 seal (`result_sha256`), completes the verification, assignment, schedule and application, audits, notifies the applicant. Readings, observations and the result are then immutable (database triggers). |

## Certificates — `/api/certificates`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | ADMIN | `{ verificationId, instrumentId?, validFrom?, validUntil? }`. Only for a completed **PASS** verification, once. `instrumentId` is derived from the verification (a different value → 400). Dates default to today + the instrument type's `default_validity_months`; explicit validity max 10 years. Generates number `CERT-{year}-{000001}`, PDF with QR, stores `pdf_sha256` and `record_sha256`, audits, notifies the applicant. |
| `GET /` | OWNER (own), ADMIN, LMO, GATC | list + search/paging |
| `GET /:id` | OWNER (own only), ADMIN, LMO, GATC | |
| `PATCH /:id/status` | ADMIN | `{ status: REVOKED|EXPIRED, reason }`. `REVOKED` needs a reason ≥10 chars and is permanent (no reactivation, enforced in API and database); notifies the applicant; audited. |
| `GET /verify/:qrToken` | **public** | legacy alias of the unified verification below; `?s=<signature>` |

## Public verification — `/api/qr-auth` (no login, rate limited)

| Method & path | Notes |
|---|---|
| `GET /:identifier?s=<signature>` | `identifier` = QR token **or** certificate number (legacy `CERT-2026-000123`, or structured `PRM-26-IND-0000123-K-7QXM`; a structured number is checked for typing mistakes and its keyed tag before the registry is asked). `s` is the signature carried by the QR link (optional for manual lookups). |
| `POST /check-document` | multipart `file` (PDF ≤10 MB): is this exact file a certificate Pramaan issued (SHA-256 lookup)? |
| `POST /check-copy` | multipart `file` (JPG, PNG or PDF ≤10 MB): a photograph, scan or scanned PDF of a **paper** certificate. Reads the QR code (parsed, never fetched; must point at this portal), looks the record up, reads the printed text locally (OCR) and compares it field by field. Rate limited (6 per minute, 40 per hour per address). Never says "authentic": see below. |

Verification response (`data`):

```json
{
  "result": "VALID | INVALID | EXPIRED | REVOKED",
  "valid": true,
  "tampered": false,
  "reason": null,
  "certificate": { "certificateNumber": "…", "validFrom": "…", "validUntil": "…", "status": "ACTIVE",
                   "instrumentName": "…", "serialNumber": "…", "ownerName": "R***** S*****", "…": "…" },
  "integrity": { "signature": "VALID|INVALID|NOT_PROVIDED", "recordHash": "MATCH|MISMATCH|UNAVAILABLE",
                 "pdfSha256": "64 hex", "recordFingerprint": "64 hex" },
  "verifiedAt": "ISO timestamp"
}
```

`reason` is one of `NOT_FOUND`, `NUMBER_CHECK_FAILED` (typing mistake in a structured number), `NUMBER_TAG_MISMATCH` (not issued by this server), `SIGNATURE_MISMATCH`, `RECORD_HASH_MISMATCH`, `REVOKED`, `EXPIRED`, `NOT_YET_VALID`. A failed signature or record hash sets `tampered:true`, `result:"INVALID"`, and writes a `TAMPER_DETECTED` audit entry. Every lookup of a known certificate is logged in `qr_authentications`.

Document-check response: `{ matches, sha256, certificateNumber?, status?, validUntil?, message }`.

Copy-check response (`data`): `{ file: { kind, sha256, bytes }, exactFile, qr: { found, usable, reason, host }, registry, printed: { attempted, read, engine, confidence, fields }, comparison: [{ field, label, printed, registry, status: MATCH|CLOSE|MISMATCH|NOT_READ|NOT_ON_RECORD, note? }], conclusion: { code, level: INFO|WARN|ALERT, text }, limits: [..] }`. Conclusion codes: `EXACT_FILE_ISSUED`, `REGISTRY_RECORD_AGREES`, `REGISTRY_RECORD_FOUND`, `NUMBER_IN_REGISTRY_NO_QR` (warning: text alone), `DETAILS_DISAGREE`, `REGISTRY_REVOKED`, `REGISTRY_EXPIRED`, `REGISTRY_NOT_VALID`, `TAMPER_SIGNALS`, `QR_POINTS_ELSEWHERE`, `NUMBER_TYPO`, `NUMBER_NOT_ISSUED`, `NOT_IN_REGISTRY`, `NOTHING_READABLE`. OCR is approximate and a copy of a genuine certificate looks like the original, so no code means "this paper is authentic"; the registry record is the authority. The upload is processed in memory and not stored.

## Attachments — `/api/attachments` (authenticated; access = ADMIN, applicant/owner, or assigned officer of the parent application)

| Method & path | Notes |
|---|---|
| `POST /` | multipart `file` (jpg/jpeg/png/pdf ≤10 MB, content is checked against the extension) + exactly one of `applicationId`, `verificationId`, `certificateId`, plus `category` (`PHOTOGRAPH`, `DOCUMENT`, `INSPECTION_EVIDENCE`, `OTHER`), optional `description`, `capturedAt` (ISO, not future), `latitude` + `longitude`. The server stores `file_sha256`. |
| `GET /:id`, `GET /application/:id`, `GET /verification/:id`, `GET /certificate/:id` | |
| `DELETE /:id` | uploader or ADMIN |

## Notifications — `/api/notifications` (authenticated)

`POST /` (ADMIN) create · `GET /` mine · `PATCH /read-all` · `GET /:id` · `PATCH /:id/read`. Notification types: `APPLICATION_UPDATE`, `VERIFICATION_SCHEDULED`, `CERTIFICATE_ISSUED`, `CERTIFICATE_EXPIRING`, `CERTIFICATE_EXPIRED`, `CERTIFICATE_REVOKED`, `QUERY_MESSAGE`. The system creates most of them automatically (assignment, scheduling, result, certificate issue/revoke, payment verified, query messages, expiry reminders).

## Offline sync — `/api/sync` (LMO, GATC, ADMIN)

For the officer app. Every record the device creates carries a client-generated UUID (`clientId`), which makes uploads idempotent.

| Method | Path | Notes |
|---|---|---|
| POST | `/sync/push` | Body `{ verifications: [{ clientId, applicationId, assignmentId, scheduleId?, location?, latitude?, longitude?, startedAt?, remarks?, observations: [{ clientId, observationType, … }], readings: [{ clientId, readingType, observedValue, unit, expectedValue?, tolerance? }], result?: { decision, remarks? } }] }` (max 50 inspections, 200 observations/readings each). Returns 200 with `{ serverTime, results: [{ clientId, serverId, status, error?, observations[], readings[], result }] }`. Each item is processed independently; status is `APPLIED`, `DUPLICATE` (already stored, safe retry) or `REJECTED` (with `error`). |
| GET | `/sync/pull?since=<ISO>` | The caller's assignments (with application, instrument, latest schedule) and inspections changed since `since`; without `since` the full working set (ASSIGNED/ACCEPTED). Returns `{ serverTime, assignments, inspections }`; store `serverTime` as the next cursor. |

Conflict rules: the server wins. One inspection per assignment (a second `clientId` is rejected), nothing can be added to a finalised inspection, the same final decision is a duplicate and a different one is rejected. Business rules are the normal verification rules (server-computed PASS/FAIL, evidence rule, ownership). Evidence photos are still uploaded separately through `/attachments` (not yet queued offline).

## Queries (clarification threads) — `/api/queries` (OWNER, LMO, GATC, ADMIN)

`POST /` `{ applicationId, subject, message, kind?, requestedItems? }` (`kind` CLARIFICATION by default; DOCUMENT_REQUEST is department-only and lists 1-10 `requestedItems`) · `GET /?applicationId=&status=OPEN|CLOSED&kind=&awaiting=me` (also the inbox: rows carry application number, instrument and opener; `awaiting=me` keeps threads where the next move is yours) · `GET /:id` (thread + messages with their `attachments`, `history` from the audit log, `awaiting: APPLICANT|DEPARTMENT|null`) · `POST /:id/messages` `{ body }` as JSON, or multipart with `body` and an optional `file` (JPG/PNG/PDF; stored with SHA-256 and attached to the application) · `PATCH /:id/close` and `PATCH /:id/reopen` (ADMIN or the officer **currently** assigned to the application; applicants, including the person who opened the thread, get 403; reopening notifies the others). Threads carry `can_close` for the caller. Participants: ADMIN, applicant/owner, and officers currently assigned (an assignment that was declined or reassigned no longer counts). When no officer is assigned, an applicant's new query or reply notifies the active administrators. Closed threads accept no messages.

## Fees — `/api/fees`

`GET /quote?instrumentId=&applicationType=&conveyance=&quarterJump=` (OWNER, ADMIN) → `{ verificationFee, conveyanceFee, quarterJumpFee, total, configured, rules, … }` · `GET /rules` · `POST /rules` `{ feeKind: VERIFICATION|CONVEYANCE|QUARTER_JUMP, amount, instrumentTypeId?, applicationType?, minCapacity?, maxCapacity?, effectiveFrom?, effectiveTo?, description? }` · `PATCH /rules/:id` `{ amount?, description?, effectiveTo?, isActive? }` (ADMIN). Rules are never deleted. No amounts are shipped: configure them from the State's fee notification. Specificity: instrument type (4) > application type (2) > capacity band (1); latest `effective_from` breaks ties.

## Dashboards and reports (OWNER, LMO, GATC, ADMIN; always role-scoped)

| Method & path | Notes |
|---|---|
| `GET /api/dashboard/stats` | counters (`totalInstruments`, `activeCertificates`, `pendingApplications`, `completedVerifications`, `passRatePercentage`, `avgTurnaround`, `recentActivity`) + `expiringIn30Days`, `overdueInstruments`, `awaitingAssignment`, `applicationsByStatus` |
| `GET /api/reports/category-wise-approvals` | certificates by instrument type, chart-ready |
| `GET /api/reports/monthly-trends` | last 6 months: `submitted`, `approved`, `rejected`, `passRate` |
| `GET /api/reports/summary` | pendency age buckets, by division, officer workload, 12-month expiry forecast, instrument verification states, public scan stats (ADMIN only) |
| `GET /api/reports/export/:dataset[.csv]` | CSV download; datasets `applications`, `certificates`, `verifications`, `instruments-due`; `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Cells starting with `= + - @` are neutralised against spreadsheet formula injection. |

## Other

`GET /health` → `{ status: "ok" }` · `GET /uploads/<path>?exp&sig` signed file access.

## Enforcement — `/api/enforcement`

| Method & path | Who | Notes |
|---|---|---|
| `POST /` | ADMIN, LMO, GATC | Register a case: `{ source: SPOT_CHECK\|COMPLAINT\|ROUTINE_INSPECTION, offenceType: NONE\|UNVERIFIED_INSTRUMENT\|EXPIRED_CERTIFICATE\|UNSTAMPED_INSTRUMENT\|SEAL_TAMPERING\|FALSE_WEIGHT_OR_MEASURE\|OTHER, description, subjectUserId? \| instrumentId? \| subjectName (+ subjectPhone, subjectOrganization), location?, latitude?, longitude?, detectedOn?, certificateId? }`. A registered owner is found from `instrumentId`/`subjectUserId`; otherwise the trader is identified by normalised name (+ phone). `NONE` (compliant spot check) is closed at once and never counted. Returns the case with `offence_number`, `offender_flag` and `offender_offences_12m`. The owner is notified; admins are notified for REPEAT/HABITUAL. |
| `GET /` | all roles | Cases you may see: ADMIN all, officers the ones they registered, owners their own (excluding `NONE`). Supports `?status=&offence_type=&source=&flag=&search=&sort=&page=&limit=`. |
| `GET /offenders` | ADMIN, LMO, GATC | Repeat-offender view. Default REPEAT + HABITUAL; `?flag=FIRST\|REPEAT\|HABITUAL` or `?all=true`. Flag = offences in the last 12 months (2 → REPEAT, 3+ → HABITUAL; dismissed cases and `NONE` do not count). |
| `GET /summary` | ADMIN | `byStatus`, `byType`, `bySource`, `monthly`, `totals` (open cases, compliant spot checks, penalties), `offenderFlags`. |
| `GET /:id` | all roles (scoped) | Case with its status timeline. |
| `PATCH /:id/status` | ADMIN | `{ status, note?, penaltyAmount?, penaltyReference? }`. Allowed: OPEN → NOTICE_ISSUED \| PENALTY_IMPOSED \| RESOLVED \| DISMISSED; NOTICE_ISSUED → PENALTY_IMPOSED \| RESOLVED \| DISMISSED; PENALTY_IMPOSED → RESOLVED. DISMISSED needs a reason (≥ 5 chars), PENALTY_IMPOSED an amount > 0. The recorded facts of a case are immutable (database trigger); cases are never deleted. |

## Language, e-mail and SMS

- `PATCH /api/users/me` also accepts `preferredLanguage` (`en`\|`hi`), `notifyEmail`, `notifySms` (booleans); `GET /api/auth/me` returns them.
- Notifications the server generates (certificate issued/expiring/expired/revoked, assignment, payment, verification result, enforcement) are written in the recipient's language (`api/src/utils/i18n.js`). Text typed by users is not translated.
- With `DELIVERY_MODE=log|live` every notification also queues an e-mail and, for important types (certificate events, schedules, enforcement), an SMS in `notification_deliveries`; a background worker sends them with retries (5 attempts, exponential backoff). `off` (default) queues nothing.

## Files, certificates and signatures

- Files live in the configured storage (`STORAGE_DRIVER=local|s3`). The API still returns `/uploads/<key>` links, signed and expiring; the bucket stays private.
- The certificate PDF has an English page and a Hindi page. When a signing identity is configured (`SIGNING_P12_PATH`) it is digitally signed (PKCS#7 detached) before its SHA-256 is stored; certificates carry `pdf_signed`, `signature_subject`, `signature_fingerprint`, `signed_at`.
- Public verification (`GET /api/qr-auth/:identifier`) adds `integrity.pdfSigned`, `signerSubject`, `signedAt`. `POST /api/qr-auth/check-document` adds `signature` — the uploaded file's own embedded signature checked independently: `{ signed, valid, digestMatches, coversWholeFile, subject, issuer, selfSigned, signedAt, chainTrusted: null }` (`chainTrusted` is null: no CA trust store is evaluated).

## Instrument lifecycle and renewal — `/api/instruments`

| Method & path | Who | Notes |
|---|---|---|
| `PATCH /:id` | owner of the instrument, ADMIN | Any of `instrumentName, manufacturer, model, capacity, capacityUnit, accuracyClass, locationAddress, locationLat, locationLng, serialNumber, instrumentTypeId`. While an application is open only the name and location can change; serial number and type are fixed once the instrument has had any application (also a database trigger). Audited with before/after values. |
| `POST /:id/deactivate` | owner, ADMIN | `{ reason? }` REGISTERED/ACTIVE → INACTIVE. Refused while an application is open. Inactive instruments cannot be applied for and drop out of the due list and reports. |
| `POST /:id/reactivate` | owner, ADMIN | INACTIVE → REGISTERED. |
| `POST /:id/decommission` | owner, ADMIN | `{ reason }` (≥ 10 chars). Final: the record is frozen (trigger), no edits or applications. Refused while an application is open. If an admin does it the owner is notified. |
| `GET /:id/renewal` | owner, ADMIN | What to apply for now: `{ canApply, suggestedType: VERIFICATION\|RE_VERIFICATION\|null, code, reason, opensOn, daysUntilExpiry, windowDays, latestCertificate }`. Codes: `FIRST_VERIFICATION, NOT_DUE, RENEWAL_WINDOW, LAPSED, OPEN_APPLICATION, INACTIVE, DECOMMISSIONED`. |

Renewal rules (also enforced by `POST /api/applications`): no certificate yet → only `VERIFICATION`; valid certificate with more than `RENEWAL_WINDOW_DAYS` (default 60) left → refused (409) with the date renewal opens; inside the window or after expiry/revocation → only `RE_VERIFICATION`, whose `lastCertificateId` is filled in automatically.

## Required documents — `/api/documents`

| Method & path | Who | Notes |
|---|---|---|
| `GET /requirements` | ADMIN | all requirements |
| `POST /requirements` | ADMIN | `{ documentType (e.g. MODEL_APPROVAL), label, labelHi?, applicationType?, instrumentOrigin?, applicantType? }`; omitted scope fields mean "any". Duplicate scope → 409. |
| `PATCH /requirements/:id` | ADMIN | `{ label?, labelHi?, isActive? }` (never deleted) |
| `GET /checklist/:applicationId` | owner, assigned officer, ADMIN | `{ items: [{ documentType, label, labelHi, satisfied, attachmentId, fileName }], missing, complete }` |

Uploads are tagged with `POST /api/attachments` field `documentType` (application documents only). `POST /api/assignments` returns 409 listing the missing documents until the checklist is complete. With no requirements defined (the default) nothing changes.

## Nameplate check (OCR-assisted) — `/api/nameplate`

The machine **reads and suggests; a person decides.** Nothing here changes the instrument, its certificates or enforcement cases. The OCR runs locally (tesseract.js); photos are not sent anywhere.

| Method & path | Who | Notes |
|---|---|---|
| `GET /status` | any internal role | `{ available, engine }`; `available` is false until `npm run ocr:setup` has downloaded the model |
| `POST /instruments/:instrumentId` | owner of the instrument, ADMIN, assigned LMO/GATC | multipart `file` (JPG or PNG; extension, magic bytes and 10 MB limit are checked). Stores the photo, reads it, compares with the registered data, returns the check with `status: PENDING_REVIEW`. 503 when OCR is not set up, 504 on timeout. Rate-limited (30 per hour per user). |
| `GET /instruments/:instrumentId` | same | all checks for the instrument |
| `GET /queue?status=` | ADMIN (all), LMO/GATC (instruments assigned to them) | review queue with instrument, serial and owner on each row; `status` PENDING_REVIEW (default), CONFIRMED_MATCH, CONFIRMED_MISMATCH, UNREADABLE or ALL. `file_url` is a signed link, so the photo can be shown inline. |
| `GET /:id` | same | one check |
| `POST /:id/review` | ADMIN, assigned LMO/GATC, **not the uploader** | `{ decision: CONFIRMED_MATCH\|CONFIRMED_MISMATCH\|UNREADABLE, note?, values? }`. A note (≥ 5 characters) is required for MISMATCH and UNREADABLE. A check is decided once. The owner is notified. |

Check fields: `extracted`, `comparison.fields.{serialNumber, manufacturer, model, capacity, accuracyClass}` each `{ read, registered, status: MATCH|CLOSE|MISMATCH|NOT_READ|NOT_REGISTERED, note? }`, `comparison.extra` (year, approval number: shown, never compared), `registered_snapshot`, `raw_text`, `ocr_confidence`, `engine`, `file_sha256`, `advisory` (ALL_MATCH, NEEDS_REVIEW, LIKELY_MISMATCH, UNREADABLE) and `advisory_summary`. The machine fields are immutable (database trigger); the audit log records the machine's advice next to the human decision and whether they agreed.

## Inspection photos (verification evidence)

`POST /api/attachments` multipart with `category=INSPECTION_EVIDENCE`, `verificationId`, optional `evidenceKind` = `READING | TEST_WEIGHT | SEAL | CONDITION | OTHER` (JPG/PNG only; the inspecting officer or an administrator; owners get 403) and optional `capturedAt`, `latitude`, `longitude`. `GET /api/attachments/verification/:id` returns the photos with `evidence_kind`, `file_sha256` and a signed `file_url`. Every upload, of any kind, must decode as a real picture (damaged files and absurd pixel counts are 400) and is recorded in `stored_files`; the stored bytes are never altered.

## Command HQ — `/api/hq` (ADMIN only; 401 anonymous, 403 everyone else)

| Method & path | Notes |
|---|---|
| `GET /overview` | `tiles` (every counter), `instrumentStates`, `pendency`, `byDivision`, `officerWorkload`, `expiryForecast`, `monthlyTrends`, `enforcement` summary, `attention` (the first 5 records of six watch-lists with their totals) and `metrics` (the catalogue of drill-down metrics). Reuses `/reports/summary`, `/reports/monthly-trends` and `/enforcement/summary`. |
| `GET /map?state=` | `{ instruments: [{ id, instrument_name, serial_number, lat, lng, state, certificate_number, next_due_date, owner_name }], cases: [...], truncated }`. Only instruments with coordinates; at most 2000 (then `truncated`). `state` = NEVER_VERIFIED, VALID, DUE_SOON, OVERDUE or REVOKED. |
| `GET /drill/:metric?division=&limit=&offset=` | The records behind a number: `{ metric, title, entity, total, limit, offset, rows: [{ id, entity, reference, title, status, at, responsible, responsible_id, link }] }`. `limit` is 1-100 (default 25). Metrics: `applications-open`, `applications-stuck`, `applications-unassigned` (these three accept `division`), `certificates-active`, `certificates-expiring`, `certificates-revoked`, `certificates-expired`, `instruments-overdue`, `instruments-due-soon`, `instruments-never-verified`, `verifications-failed`, `enforcement-open`, `queries-awaiting-department`, `nameplate-pending`. A tile's number always equals the `total` of its list. |
| `GET /evidence/certificates/:id` | Evidence pack: certificate (number, ID, validity, status, record and PDF SHA-256 with the record fingerprint recomputed and compared, signature, issued by, revocation), instrument and owner, application, verification (officer, times, start GPS, decision, result seal, who decided), readings, inspection photos (ID, kind, SHA-256, capture time, GPS, uploader, signed link), nameplate checks, audit trail (action, time, person, hash chain). Logged as `HQ_EVIDENCE_VIEWED`. |
| `GET /evidence/enforcement/:id` | The same for an enforcement case: facts, GPS, events with actors, linked certificate hashes, audit trail. |
| `GET /evidence/certificates.csv?status=&from=&to=` | Evidence report, one row per certificate (at most 5000; `X-Report-Truncated` when cut): IDs, fingerprints, result seal, photo count and `kind:ID:SHA-256` list, officer, issuer, decider, nameplate state, revocation. Logged as `HQ_EVIDENCE_EXPORTED`. |
