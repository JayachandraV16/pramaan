# Design: moving QR signatures from a shared secret to Ed25519

Status: **design only, not implemented.** Written for the SIH round; recommendation at the end.

## 1. What exists today (v1)

- QR link: `{FRONTEND_URL}/verify-public?q=<qr_token>&s=<signature>`.
- `qr_token`: 24 random bytes, base64url (32 chars), unique per certificate, stored in the database.
- `s`: first 32 hex characters (128 bits) of `HMAC-SHA256(INTEGRITY_SECRET, "qr|<token>|<certificate number>")`.
- Verification is **online only**: the server looks the token up, recomputes the HMAC and checks the stored record fingerprint (`record_sha256`). Expiry, revocation and the record come from the database.
- The QR carries no certificate number or dates, so nothing can be shown without the server.

What this protects: someone editing or inventing a QR link is rejected, and edits to the database row are detected.
What it cannot do: be checked by anyone who does not hold the secret, or by a phone without a connection.

## 2. Why change (and why it may not matter yet)

| Benefit of Ed25519 | Matters for |
|---|---|
| Anyone can verify with a **public** key; no secret leaves the server | third-party verifiers, the mobile app |
| **Offline** check by an officer in the field (shows number and validity) | inspections without coverage |
| Smaller trust surface: leaking a verifier leaks nothing | mobile app distribution |

For an **online** verification system (the problem statement) v1 already meets the need. Ed25519 is an upgrade for offline field use, not a fix for a weakness.

## 3. Proposed v2

**Payload** (versioned, signed fields visible so an offline phone can show them):

```
{FRONTEND_URL}/verify-public?v=2&k=<kid>&q=<token>&n=<certificate number>&e=<valid_until YYYY-MM-DD>&g=<base64url Ed25519 signature>
```

Signed message (exact bytes, UTF-8, `\n` separated, no trailing newline):

```
PRAMAAN-QR-v2
<kid>
<token>
<certificate number>
<valid_until>
```

The domain prefix stops a signature being reused for anything else. Signature = 64 bytes = 86 base64url characters. The link grows by about 120 characters, so the QR needs a larger module size or higher version; test scanning at the printed size before committing.

Node signs and verifies Ed25519 natively (`crypto.sign(null, msg, key)`), so the server needs **no new dependency**. The mobile app has no native Ed25519 in Hermes; use one pinned, audited pure-JS library.

## 4. Key storage

- **Private key**: PKCS#8 PEM in a file outside the repository (`QR_SIGNING_KEY_PATH`, mode 0600), or a cloud KMS/HSM later. Never in the database, never in `.env` text. Separate from `INTEGRITY_SECRET` and from the PDF signing key (different purpose, different rotation).
- **Public keys**: table `qr_signing_keys(kid, public_key, status ACTIVE|RETIRED|COMPROMISED, created_at, retired_at)`. Published at `GET /api/qr-auth/keys` and bundled into the mobile app (updated by sync).
- `kid` = first 8 bytes of SHA-256 of the public key, hex. Certificates record `qr_sig_version` and `qr_kid` (new columns, write-once like `pdf_sha256`).
- **Rotation**: create a new key, mark the old one RETIRED (still verifies what it signed, never signs again). Public keys are never deleted.
- **Backup**: losing the private key stops *issuing* new QR codes; existing ones keep verifying because only public keys are needed.

## 5. Compatibility with certificates already issued

- v1 certificates and their printed QR codes **cannot be re-signed** (their PDF hash is immutable). They keep working through the existing HMAC path.
- The verify endpoint branches on `v`: absent = v1 (HMAC), `2` = Ed25519, anything else = "unsupported QR version".
- **Downgrade guard**: the server knows each certificate's `qr_sig_version`; a v2 certificate presented with a v1-style link (or the reverse) is refused.
- `INTEGRITY_SECRET` must stay available until the last v1 certificate has expired plus the retention period. Rotating it earlier turns genuine v1 QR codes into "INVALID".
- Rollout: deploy dual-mode verification first (accepts both), then switch issuance to v2 behind a flag, so a rollback is a configuration change.

## 6. Revocation (the real limit of offline checks)

A signature proves the QR was issued by Pramaan; it cannot say whether the certificate was revoked afterwards.

- Server stays authoritative: online verification still checks revocation and expiry in the database.
- Offline: the app downloads a **signed revocation list** (`GET /api/qr-auth/revocations?since=`: revoked tokens with `revoked_at`, signed with the same key family, with a timestamp). The offline verdict is "authentic, valid until X, **revocation list last updated D**"; if the list is older than a set age (suggest 7 days) it says revocation cannot be confirmed.
- **Key compromise**: mark the key COMPROMISED with a cutoff date and publish it; the app treats certificates signed by it as "unconfirmed, check online". Certificates signed after the compromise but before detection are the exposure window, which is why rotation and short list staleness matter.

## 7. Offline verification flow (mobile)

1. Scan QR, parse `v`, `k`, `q`, `n`, `e`, `g`.
2. Look up `k` in the local key set; unknown key means "sync keys" (or online check).
3. Verify the Ed25519 signature over the canonical message; reject on mismatch.
4. Show number and valid-until from the **signed** fields only; compare with today's date.
5. Check the local revocation list; show its age.
6. If online, call the API for the authoritative result and prefer it.

## 8. Migration risks

| Risk | Impact | Mitigation |
|---|---|---|
| Private key lost or leaked | cannot issue / forgeries | file permissions, backup, KMS later; rotation and COMPROMISED status |
| Offline use hides a revocation | a revoked instrument looks valid | signed revocation list with visible age; online check preferred |
| Canonicalisation mistakes | valid QR rejected | fixed byte format, published test vectors, tests in both Node and the app |
| Longer QR link | hard to scan when printed small | test at print size, error-correction level M, larger module size |
| Downgrade to v1 | bypass of v2 checks | per-certificate `qr_sig_version` enforced server-side |
| Old app builds in the field | cannot read v2 | "unsupported version, use the website" fallback; the link still opens the web page |
| Mobile crypto library | supply-chain and bugs | one pinned, audited pure-JS library; test vectors |
| Two code paths | more attack surface and tests | keep v1 frozen and covered by the existing tests |
| Confusion with the legal PDF signature | wrong claims in the pitch | state clearly: the QR signature is application-level integrity; the PDF digital signature (with a CA-issued DSC) is what is legally recognised |

## 9. Implementation outline (when approved)

1. Migration: `qr_signing_keys`, certificate columns `qr_sig_version`, `qr_kid`.
2. Key generation script and key loader; config `QR_SIGNING_KEY_PATH`, `QR_SIG_VERSION` (1|2).
3. Signer and verifier with test vectors; dual-mode `verifyPublic`; keys and revocations endpoints.
4. Issuance writes v2 when enabled; PDF/QR generation uses the new link.
5. Mobile: key sync, signature check, revocation list, offline verdict screen.
6. Tests: tamper each signed field, wrong key, retired key, compromised key, downgrade, v1 still valid, stale list.

Estimated effort: server about 1.5 days, mobile about 1 day, plus on-device scan testing.

## 10. Recommendation

**Do not implement for the PPT round.** The online system already satisfies the problem statement, v1 is covered by tests, and v2 needs mobile work and field scan testing that cannot be proven in a demo. Present it as the planned next step for offline field verification, with this design as evidence that migration risks (old certificates, revocation, key loss) are understood. Implement after the round, starting with the dual-mode verifier so nothing issued today is affected.
