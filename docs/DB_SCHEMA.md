# Database schema

PostgreSQL. All primary keys are UUIDs (`gen_random_uuid()`), statuses are native ENUM types, and `updated_at` columns are maintained by the `set_updated_at()` trigger. Migrations live in `api/src/db/migrations` and are applied in filename order by `npm run migrate`.

## Migrations

| # | File | Adds |
|---|---|---|
| 001 | extensions_and_enums | `pgcrypto`, `citext`; the enum types |
| 002 | roles | `roles`, `set_updated_at()` |
| 003 | users | `users` |
| 004–005 | instrument_types, instruments | |
| 006–009 | applications, assignments, schedules, verifications | |
| 010–012 | inspection_observations, verification_readings, verification_results | |
| 013 | verification_certificates | PASS-only trigger, `active_certificates` view |
| 014–016 | attachments, qr_authentications, notifications | |
| 017 | expiry views | `certificates_expiring_soon`, `certificates_past_due`, `pending_applications`, `schedules_today` |
| 018 | metrology domain fields | LCR number, applicant type, GRAS challan, fees, `application_number_counters` |
| 019 | security & integrity | `PENDING_APPROVAL` user status; certificate `pdf_sha256`, `record_sha256`, revocation fields and the immutability trigger; `attachments.file_sha256`; `audit_log` (append-only, hash-chained) |
| 020 | numbering, validity, due dates | `certificate_number_counters`; `instrument_types.default_validity_months`; `CERTIFICATE_REVOKED` notification type; view `instrument_verification_status` |
| 021 | workflow integrity & evidence | `application_status_history`; `verification_results.result_sha256`; triggers locking readings/observations/results; GPS + capture time on attachments, start GPS on verifications |
| 023 | offline sync | `client_id` (unique, nullable) on `verifications`, `inspection_observations`, `verification_readings`; `verifications.client_started_at`; index for delta pull |
| 022 | reminders, fees, queries | `reminder_log`; `fee_rules` + `fee_kind`; computed fee and payment-verification columns on applications; `application_queries`, `application_query_messages`; `QUERY_MESSAGE` notification type |

## Entities

```
roles 1─* users 1─* instruments *─1 instrument_types
users 1─* verification_applications *─1 instruments
verification_applications 1─* application_status_history
verification_applications 1─* verification_assignments 1─* verification_schedules
verification_assignments 1─1* verifications 1─* inspection_observations
                                           1─* verification_readings
                                           1─1 verification_results
verifications 1─1 verification_certificates 1─* qr_authentications
                                            1─* reminder_log
attachments ─► exactly one of application | verification | certificate
users 1─* notifications ;  applications 1─* application_queries 1─* application_query_messages
fee_rules (instrument type / application type / capacity band) ; audit_log (hash chain)
```

## Business rules enforced in the database

| Rule | Where |
|---|---|
| assignee must be an LMO or GATC | trigger `check_assignee_role` |
| a certificate can only be issued for a PASS result | trigger `check_certificate_requires_pass` |
| issued certificates are immutable (number, token, instrument, verification, dates); hashes and file URL are write-once; a REVOKED certificate cannot change; an EXPIRED one cannot be reactivated | trigger `protect_issued_certificate` |
| readings and observations cannot change once the verification is not `IN_PROGRESS`; results cannot be updated or deleted | triggers in migration 021 |
| `audit_log` rows cannot be updated or deleted | trigger `audit_log_append_only` |
| one certificate per verification; unique certificate number and QR token | unique constraints |
| an attachment has exactly one owner; GPS values come in pairs and in range | CHECK constraints |
| a REVOKED certificate has `revoked_at` and a reason | CHECK `ck_verification_certificates_revocation_consistency` (added `NOT VALID`, so legacy rows are not blocked) |
| application and certificate numbers are race-free | counter tables with `INSERT … ON CONFLICT DO UPDATE` inside the issuing transaction |

## Views

`active_certificates`, `certificates_expiring_soon` (30 days), `certificates_past_due`, `pending_applications`, `schedules_today`, `instrument_verification_status` (latest usable certificate per instrument with `next_due_date`, `days_until_due`, state `NEVER_VERIFIED | VALID | DUE_SOON | OVERDUE | REVOKED`).

## Seed data

`api/src/db/seeds/001_initial_data.sql` (idempotent): the five roles, six instrument types, one development user per role (`*@pramaan.local`, shared development password hash) and one sample instrument. **Do not use the seeded users in production.** No fee amounts are seeded.
