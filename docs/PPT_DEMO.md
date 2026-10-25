# Pramaan: PPT round pack

SIH problem statement **26036**: Online Verification System for Weighing and Measuring Instruments. Team Fulcrum.

## 1. The pitch (one breath)

Owners register weighing and measuring instruments and apply online; the department assigns, schedules and records the field inspection; a tamper-evident digital certificate is issued, and **anyone** can check it in seconds by QR, number or by uploading the PDF.

## 2. Problem statement → what is built

| Requirement | What the prototype does | Where to show it |
|---|---|---|
| Digital certificate with QR verification | PDF (English + Hindi page) with a signed QR; public check by QR, number or uploaded PDF | `/verify-public` |
| Tamper detection | SHA-256 of the PDF and of the record, signed QR link, signed PDF, hash-chained audit log | verify page "Integrity checks" |
| Certificate revocation | reason required, permanent, shown on every check, owner notified | certificate detail → Revoke |
| Application → certification workflow | state machine with history; reject, cancel, payment verification, queries | application page |
| Scheduling and officer assignment | conflict and past-date checks, officer accept/decline | admin application page |
| Expiry reminders, re-verification tracking | 30/15/7/1-day reminders; due list; renewal rules | `/due`, notifications |
| Configurable fees and validity | fee rules and default validity per instrument type, no hard-coded amounts | `/fees` |
| Officer–owner queries | threads on each application | application page |
| Enforcement and repeat offenders | cases, penalties, REPEAT/HABITUAL flags, dashboard | `/enforcement` |
| Offline field inspection and sync | mobile app queue with idempotent sync (API proven; device run pending) | mobile "Field work" |
| Multilingual | English and Hindi (UI core screens, notifications, certificate PDF) | language switcher |
| Inspection evidence | GPS, capture time, file fingerprint, minimum-evidence rule | officer inspection |
| Automated reports | dashboards, pendency, expiry forecast, CSV export | `/reports` |
| Instrument lifecycle, required documents | edit, deactivate, decommission; admin-defined document checklist | instrument page, `/fees` |
| OCR-assisted nameplate check (differentiator) | local open-source OCR reads the plate, compares with the registered record, a second person confirms; the machine never decides | instrument page → Nameplate check |

## 3. Live demo script (about 8 minutes)

Accounts (development only, created by `npm run demo:users`): `demo.owner@`, `demo.admin@`, `demo.lmo@pramaan.local`. Start: `cd api && npm run dev`, `cd web && npm run dev`, open `http://localhost:5173`.

1. **Public first (30 s):** landing page → "Verify a certificate". Mention nothing needs an account.
2. **Owner:** *Instruments → Add*; then *New application*. Point out the banner: the server decides "first verification" and will refuse a premature renewal.
3. **Admin:** open the application → assign the officer → schedule. (If a document requirement is configured, show the checklist blocking assignment, then upload and continue.)
4. **Officer:** accept, start the inspection, add a reading with a value inside tolerance (and, in a second run, one outside it: the server computes PASS/FAIL itself and refuses a PASS result over a failing reading). Upload a photo.
5. **Admin:** issue the certificate. Open the PDF: English page, Hindi page, QR.
6. **Public verification (the money shot):** scan or paste the QR link → VALID with the integrity panel. Then tamper: change a character of the `s=` signature in the link → "possible tampering". Upload an edited PDF → "does not match".
7. **Revoke** the certificate → refresh the public page → REVOKED. Show the owner's notification.
8. **Nameplate check (60 s):** `npm run ocr:demo-plate -- --serial <the instrument's serial>`, upload the PNG on the instrument page → table shows MATCH and "waiting for a person". Generate a second plate with a different serial → "details do not match". Log in as the officer and record the decision. Say: the software suggests, a person decides, and nothing changes automatically.
9. **Enforcement and reports (1 min):** register a spot-check offence twice for the same trader → REPEAT flag; open the dashboard and a CSV export.

Fallback if the network or browser misbehaves: run `cd api && npm test -- test/e2e_demo.test.js` and show the 16 green steps (it performs the same journey).

## 4. Security slide

- Identity: bcrypt passwords, JWT with the account's status re-read on every request (suspension is immediate), admin approval for officers, rate-limited login.
- Integrity: SHA-256 (PDF, record, evidence, result seal), HMAC-signed QR links and file links, hash-chained audit log, database triggers that make certificates, results and the log immutable.
- Authenticity: PDF digital signature with independent verification (development key today; a CA-issued key is the production step).
- Privacy: owner names masked on the public page; files private behind expiring signed links.
- Safe defaults: production refuses to start with development accounts; secrets only in environment; no seed fee amounts.

## 5. Numbers to quote (all reproducible)

157 automated tests passing · 30 database migrations · 16-step end-to-end run · 2 languages · 5 roles · API modules: auth, users, instruments, applications, assignments, schedules, verifications, certificates, QR verification, attachments, notifications, fees, queries, reports, sync, enforcement, documents.

## 6. Be honest about these (judges respect it)

- Browser and mobile-device testing is still pending; the logic is covered by API tests.
- Certificate PDF signature uses a development key; legal validity needs a Digital Signature Certificate from a licensed authority.
- E-mail/SMS and cloud storage are built but not connected to real providers.
- Hindi covers the core screens, not every screen.
- OCR is proven on generated images only; accuracy on real nameplate photographs is not measured and the feature is advice, never a decision.
- Offline QR verification (public-key signatures) is designed (`docs/DESIGN_ED25519_QR.md`), not built.

## 7. Likely questions

| Question | Short answer |
|---|---|
| Why not blockchain? | A signed, hash-chained log plus database-enforced immutability gives tamper evidence without the cost; the department already is the trusted issuer. |
| Can it work without internet? | Inspections can (mobile queue, idempotent sync). Public verification is online; offline QR checking is the designed next step. |
| Is the digital signature legally valid? | Not yet: it needs a CA-issued Digital Signature Certificate. The mechanism is built and tested. |
| What if the QR is copied onto a fake? | The link carries a signature over the certificate number and token, the server compares the record fingerprint, and the PDF can be hash-checked. |
| What about existing manual records? | CSV import is on the roadmap; the schema accepts client-generated IDs. |
| Scale? | Stateless API on PostgreSQL; the scheduler uses a database lock so several instances are safe. Not load tested. |
