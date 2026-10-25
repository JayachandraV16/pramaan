# Phase 6 plan: SIH differentiation

> **Status:** feature 1 (OCR nameplate check) is implemented and tested; features 2–4 are not started.

Principles: one feature at a time; open-source and local only (no AWS S3, no Neon, no paid AI services); no rewrites; **software never makes the final legal decision**: anything automated is a suggestion that a named person confirms, and the confirmation is recorded.

## 1. What exists today (inspected in the code)

| Candidate | What is already there | What is missing |
|---|---|---|
| **1. OCR nameplate/document check** | Registered instrument data to compare against (`manufacturer`, `model`, `serial_number`, `capacity` + unit, `accuracy_class`); upload middleware with type and magic-byte checks and SHA-256; private signed file serving; storage drivers; audit log; roles for review. No OCR code or dependency anywhere. | Everything OCR-specific: engine, field parsing, comparison, review record, UI. |
| **2. Real-device offline workflow** | Mobile offline engine (`mobile/services/offline`), sync API (`/sync/push`, `/pull`), contract tests of the engine against the API, Field-work screens, GPS capture. | Never run on a device or emulator (no test evidence). No camera/image-picker dependency, so **photos are not captured or queued offline**; assignment acceptance needs a connection; older online screens unverified against this API; network address setup for phones deferred. |
| **3. Ed25519 offline verification** | Design only (`docs/DESIGN_ED25519_QR.md`); QR links use a shared-secret HMAC. | All of it: key management, v2 payload, dual-mode verifier, revocation list, mobile verifier. |
| **4. Command HQ + evidence-linked reports** | Role-scoped dashboard stats, monthly trends, category approvals, management summary (pendency, workload, divisions, expiry forecast, instrument states), enforcement summary, CSV exports, recharts in the web app; coordinates stored for instruments, inspections and enforcement cases; evidence already hashed (`file_sha256`). | A single HQ view; geographic view (no map library); drill-down from every number to the records behind it; reports that carry evidence (hashes, photo links, who/when) rather than only counts. |

## 2. Ranking

Scores: 5 is best (for effort and risk, 5 means least effort / least risk).

| Rank | Feature | Demo impact | Effort | Risk | Fit with Node/Postgres/React/Expo | Notes |
|---|---|---|---|---|---|---|
| **1** | OCR nameplate check with human review | **5**: visibly "smart", easy to show in 60 s, nothing like it in a basic verification portal | 3 (about 1.5–2 days) | 3 | 4 | Feasibility proven locally (see below). Risk is real-world accuracy and first-run model setup; both are contained by the human-review design and a manual fallback. |
| 2 | Command HQ + evidence-linked reports | 4 | 4 (about 1–1.5 days; data exists) | **5** | **5** | Safest and mostly SQL plus a page. Less novel than OCR, but strong for the judges' "monitoring" story. Natural second step. |
| 3 | Real-device offline testing and fixes | 4 as a story, but cannot be shown without a verified device run | 2 | 2 | 3 | Needs a physical phone and your hands; I can prepare the checklist and build the missing pieces (photo queue, offline accept) but cannot certify it. Do it as soon as a device is available. |
| 4 | Ed25519 offline verification | 2 (hard to show on stage) | 3 | 3 | 4 | Design is ready; adds value mainly for offline field verification. Defer until after the PPT, as already recommended. |

### Recommendation: implement **1. OCR nameplate check** first

- It is the only option here that is both a clear differentiator and fully testable on this machine.
- The local OCR engine (tesseract.js, Apache-2.0, WASM, no native build) started in 0.4 s, read a six-line test nameplate in 0.3 s and returned every field (confidence 94 %). A clean synthetic image only proves the plumbing, not accuracy on real embossed or angled plates; that stays NOT TESTED until real photos are tried.
- Command HQ is the recommended next feature; real-device testing runs in parallel whenever a phone is available.

## 3. Plan for feature 1 (small)

Scope: one instrument, one photo, one comparison, one human decision.

1. **Engine**: tesseract.js with the English fast model kept in `api/ocr-data/` (downloaded by `npm run ocr:setup`, git-ignored). Runs on the server, nothing leaves the machine. If the model is missing the feature reports "not set up" and the manual process continues.
2. **Parsing** (pure code): manufacturer, model, serial number, capacity + unit, accuracy class, year, approval number from the text, with tolerant label patterns.
3. **Comparison** (pure code): per field MATCH, CLOSE (probable OCR slip such as O/0), MISMATCH, NOT READ, NOT REGISTERED; capacity compared in base units; overall advisory ALL_MATCH, NEEDS_REVIEW, LIKELY_MISMATCH or UNREADABLE.
4. **Record and review**: every extraction is stored with the image hash, the raw text, the registered values it was compared with, and the machine advisory (all immutable). Status starts `PENDING_REVIEW`. Only an administrator or an assigned officer, **who is not the uploader**, can set `CONFIRMED_MATCH`, `CONFIRMED_MISMATCH` or `UNREADABLE`, with a note; the decision is audited together with what the machine suggested.
5. **No automatic effects**: the instrument record, certificates and enforcement cases are never changed by OCR. A confirmed mismatch notifies the owner and leaves any follow-up (re-inspection, enforcement case) to a person.
6. **API and UI**: upload and result on the instrument page, side-by-side table, review panel, history. Rate-limited because OCR is CPU-heavy.
7. **Tests**: parser and comparison unit tests with noisy samples; API tests with a fake engine (permissions, immutability, review rules, no side effects); one real-engine test using a generated image (reported as NOT TESTED when the model is not installed).

Out of scope for now: Hindi OCR, PDF documents, handwriting, on-phone OCR, automatically updating registered data, any use of OCR output for legal decisions.

## 4. Plans for the others (not started)

- **Command HQ**: one `GET /api/hq/overview` (national counters, trend, risk list) and drill-down endpoints that return the underlying records with their evidence (certificate number + hashes, inspection photos, officer, time, GPS); a page with KPI tiles, charts, a division table and a simple coordinate map (plain SVG or one small open-source library); an "evidence pack" export per certificate or case listing every hash so a third party can re-verify it.
- **Real-device offline**: written device test script (airplane-mode inspection, sync, kill app mid-sync, clock skew, duplicate pushes); add camera/image-picker and a photo queue with client IDs on attachments (server change needed); offline accept; fix what the device run finds.
- **Ed25519**: follow the design: dual-mode verifier first, then v2 issuance behind a flag, then the mobile verifier and signed revocation list.
