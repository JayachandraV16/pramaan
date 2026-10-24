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
