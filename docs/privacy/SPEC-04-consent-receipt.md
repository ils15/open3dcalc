# SPEC-04 — Consent Receipt

**Track:** D1 — Privacy & Data Contracts
**Status:** Normative for D1.1+ (D1.0 is documentation only)
**Addresses findings:** R5 (consent), R14 (receipt canonicalização)
**Related:** SPEC-01 (manifest), SPEC-02 (erasure), ADR-002 (quarantine)

## 1. Goal

Consent must be a **tamper-evident, canonicalized, policy-bound record** — not a boolean
flag in `localStorage`. This spec defines the consent receipt: what it contains, how it is
protected, and exactly what withdrawal does.

## 2. What consent is NOT

The following MUST NEVER satisfy or substitute consent (they are local UI state, per
SPEC-01 `onboarding_flag` / `consent_record` classes, `sync: never`, `export: never`):

- tutorial completion (`open3dcalc_tutorial_v1`);
- onboarding/quickstart flags (`open3dcalc_quickstart_done`);
- migration markers (`open3dcalc_migration_flags`);
- privacy banner **dismissal** (`privacyBannerDismissed` — closing a banner is not
  consenting);
- any "I've read this" checkbox that is not the explicit consent action itself.

The consent store's `consentGiven` boolean remains a UI convenience, but the **proof** of
consent is the receipt defined here. If the receipt is absent or invalid, the app treats
consent as **not given** (default-deny, §6).

## 3. Receipt content

```json
{
  "receipt_id": "uuid-v4",
  "receipt_version": "1.0",
  "policy_version": "1.0",
  "policy_hash": "sha256:<hex of canonical policy document>",
  "granted_at": "2026-09-11T12:00:00Z",
  "scope": ["customers", "quotes", "history", "dashboard"],
  "legal_basis": "consent",
  "purposes": ["issue_quotes", "cross_device_sync"],
  "withdrawn_at": null
}
```

- `policy_version` + `policy_hash` MUST bind the receipt to the **exact** policy the user saw
  (the SPEC-01 manifest's policy content, versioned).
- `scope` lists the manifest keys/data classes covered.
- `withdrawn_at` is `null` until withdrawal; withdrawal never deletes the receipt — it
  annotates it (audit trail of the withdrawal itself).

## 4. Canonicalization and policy_hash

- The policy document (the SPEC-01 manifest content) MUST be canonicalized with the **same**
  canonical JSON as SPEC-03 §3 (RFC 8785 / documented equivalent).
- `policy_hash` = `sha256:` + hex of SHA-256 over the canonical policy JSON.
- Because canonicalization is deterministic, the same policy content always yields the
  same hash on every platform/version — this is what makes `policy_hash` verifiable at
  withdrawal time and comparable across receipts.

## 5. Anti-tamper protection

- The receipt is stored locally (desktop: `userData` via the ADR-001 capability model;
  web: encrypted at rest per ADR-001 §2.2) together with a **digest**:
  `receipt_digest = SHA-256(canonical(receipt))`.
- On every load, the app MUST recompute the digest. Mismatch ⇒ the receipt is treated as
  **invalid** ⇒ consent is not given (default-deny) and the user is asked to consent
  again under the current policy. The app never "repairs" a tampered receipt.
- Note the threat model honestly: a local digest is tamper-*evident*, not tamper-*proof*
  against a fully-compromised device (an attacker with file access can recompute it). It
  protects against accidental mutation, partial writes, and naive edits — the realistic
  risks for a local-first app. Cryptographic non-repudiation is out of scope for D1.
- Receipts are `sync: never`, `export: never` (SPEC-01 `consent_record` constraints) —
  they never leave the device.

## 6. Default-deny and withdrawal

**Default-deny:** absent, invalid, or version-mismatched receipt ⇒ no consent ⇒ PII
features gated on consent MUST remain blocked (memory-only at most, per ADR-001) until the user
consents under the current policy.

**Withdrawal has an EXACT effect, defined by the manifest:**

1. For every manifest key whose `legal_basis` is `consent` and whose scope was covered by
   the receipt: the data collected under that purpose is **erased** via the SPEC-02 saga
   (scoped to those keys — the per-store journal model applies unchanged).
   - `erasure: erase_on_delete_all` keys: full deletion.
   - `erasure: retain_anonymized` keys: PII removed per the manifest's anonymization
     (e.g., history entries stripped of customer/product references), leaving only
     non-identifying aggregates.
2. Consent-gated features degrade immediately (back to default-deny).
3. The receipt is annotated `withdrawn_at` (kept as the audit record; never re-usable).
4. The user receives a completion receipt (SPEC-02 §7) including the
   `external_copies_notice` (sync bundles previously imported on other devices, export
   envelopes previously created).
5. Withdrawal never touches data whose `legal_basis` is not `consent` (e.g., non-PII
   preferences stay — the user can delete them separately via delete-all).

**Policy version change:** when `policy_version` changes, existing receipts do NOT carry
over silently. The app compares the receipt's `policy_version`/`policy_hash` to the
current policy; mismatch ⇒ re-consent required for the delta (new/changed purposes), with
the old receipt retained as history. The user is shown what changed.

## 7. What D1.0 does NOT deliver

D1.0 is the normative text. As of D1.0, consent is a bare boolean flag
(`open3dcalc_consent_v1`) with no receipt, no hash, no withdrawal semantics — that is the
gap this spec obligates D1.1+ to close. TEST-MATRIX §8 defines the mandatory contract
tests (tamper detection, withdrawal effect per manifest key, policy version change).

## 8. Compliance trace

- R5 → §2 (flags never satisfy consent), §3 (receipt content), §6 (default-deny; exact
  withdrawal effect via manifest).
- R14 → §4 (canonical policy_hash via SPEC-03 §3 canonicalization), §5 (receipt digest,
  tamper-evident, invalid ⇒ re-consent).
- Cross-references: SPEC-01 (`consent_record` class constraints; `legal_basis` per key),
  SPEC-02 (erasure saga executes withdrawal), ADR-001 (receipt at-rest encryption),
  ADR-002 (banner dismissal ≠ acceptance), TEST-MATRIX §8.

## Status

**Status: Proposed (awaiting Themis gate + user final approval)**
