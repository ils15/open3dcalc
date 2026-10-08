# SPEC-04 — Consent Receipt

## Policy 1.9 supersession — receipts are historical, not save gates

The receipt issuance, consent prerequisite, and withdrawal-as-a-condition-of-saving rules in
this specification are superseded for current local saves in both Stable and Beta. Neither
channel requires consent, a receipt, or withdrawal state before accepting a save. Stable and
Desktop follow SPEC-01's exact plaintext policy; Beta remains limited to synthetic-only test
data and its existing restrictions. This does not authorize inspection or conversion of
historical vault bytes, which remain inert and outside current deletion scope.

Receipts issued under earlier policy versions remain untouched historical records. Under
policy 1.9 they evaluate as `policy_mismatch`; they are not silently rewritten and do not
gate saves. The retained `contract_performance` declaration for the three Stable PII keys is
provisional and requires qualified legal review; this specification does not make a legal
determination. The encrypted export password remains independent of receipt state and local
saves.

**Track:** D1 — Privacy & Data Contracts
**Status:** Superseded for save prerequisites by approved policy 1.9; historical receipts retained
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
- Note the threat model honestly: a local digest is tamper-_evident_, not tamper-_proof_
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

**Policy 1.4 → 1.5 (Beta5 privacy remediation).** The manifest policy content changed, so
`policy_version` moved from `1.4` to `1.5`. Receipts issued under `1.4` now evaluate as
`policy_mismatch` and the user is **re-consented**. This is the intended behaviour, not a
regression. What changed in the policy the user is consenting to:

- `history_entries` and `quote_items` are now declared PII sqlite domain tables.
  `history_entries` was PII-bearing but absent from the manifest entirely, so it was
  invisible to the erasure post-condition, which reported "clean" while its rows survived.
- `open3dcalc_migration_done_v2` is now `pii: true` (its value embeds the full raw
  pre-migration history array) instead of a non-PII onboarding flag.
- `open3dcalc_dashboard_v1` is now `pii: false` (it persists only three typed-in
  numbers; the aggregates it displays are computed in memory and never stored).
- `appdata_temp_staging` and the new `appdata_diagnostic_backup` declare the real
  surfaces; the latter discloses that `redact: false` is a straight unredacted copy of
  the whole database retained for 14 days.
- `erasure_snapshots` is narrowed to `electron` (the desktop saga uses
  `diskSnapshotStore` under userData). The genuinely unwritten `idb_reports_staging` and
  `opfs_export_staging` declarations are removed — neither has a writer anywhere in the
  codebase. `open3dcalc_erasure_snapshot` is **retained**: it is written by
  `webSnapshotStore().write()` through `guardedStorage`, so the S1 gate must keep
  recognizing it.

**Policy 1.5 → 1.6 (declaring `pii_stage`).** `pii_stage` is now a declared PII
`sqlite_domain_tables` surface. Receipts issued under 1.5 evaluate as
`policy_mismatch` and the user is re-consented for the delta. What changed in the
policy the user is consenting to:

- `pii_stage` (Beta5 Wave 1, migration `0004_pii_stage.sql`) is declared. A
  staged row carries the sealed preimage of a user value mid-re-homing, so the
  table was PII-bearing from the moment it was created and the inventory simply
  did not name it — the `history_entries` omission one layer out. Its policy:
  `encrypted_at_rest`, `sync: never`, `export: diagnostic_only`,
  `erasure: erase_on_delete_all`, `legal_basis: consent` (so a withdrawal erases
  it), retention `session_only` / 1 day — the intended ceiling, not an enforced
  timer, since the state machine discards the row and there is no TTL sweeper.

**Policy 1.6 -> 1.7 (declaring the browser PII vault).** `open3dcalc_pii_vault`
is now a declared PII `indexeddb` surface. Receipts issued under 1.6 evaluate as
`policy_mismatch` and the user is re-consented for the delta. What changed in the
policy the user is consenting to:

- `open3dcalc_pii_vault` (Beta5 Wave 2) is declared. It is the encrypted browser
  store the three PII keys (`open3dcalc_customers_v1`, `open3dcalc_quotes_v1`,
  `open3dcalc_history_v2`) are migrated onto as they come off plaintext
  `localStorage`. Until this declaration the largest PII store in the web build
  was undeclared: the same class of defect as `pii_stage`, one layer out.
- Its policy is `encrypted_at_rest` (AES-256-GCM under a passphrase-derived,
  non-extractable, memory-only key), `sync: never`, `export: never`,
  `erasure: erase_on_delete_all`, `legal_basis: consent` (so a withdrawal erases
  it), retention `user_controlled` with no ceiling and **no TTL sweeper**.
- The vault is unreachable from the sync/export path by construction:
  `dataSync.ts` reads a fixed list of `localStorage` key literals and never
  enumerates a store, so a new surface is excluded structurally. Pinned by
  `src/shared/lib/__tests__/piiVaultDeclaration.test.ts`, which asserts both the
  behaviour and the shape, because a structural guarantee is exactly what gets
  broken by one careless enumeration.
- The three legacy `localStorage` keys keep their existing declarations. This
  change declares the destination; migrating the stores onto it, and then
  narrowing those three entries to `sync: never` for the web build, is the
  follow-on, and it is a second re-consent.

**Policy 1.7 → 1.8 (declaring `legacy_residue`).** `legacy_residue` is now a
declared PII `sqlite_domain_tables` surface. Receipts issued under 1.7 evaluate as
`policy_mismatch` and the user is re-consented for the delta. What changed in the
policy the user is consenting to:

- `legacy_residue` (Beta5 Wave 2, migration `0005_legacy_residue.sql`, ADR-001
  §3.6) is declared. One row is the pre-remediation at-rest blob for one PII value
  — an `enc1:safeStorage:<base64>` raw keyring output, or an `enc1:envelope:` v1.1
  self-asserted-AAD envelope — copied aside byte for byte when §3.6 recovery
  re-seals that value under the new bound envelope. It is PII-bearing because the
  blob is a sealed copy of a user value and is the only retained copy after a
  re-homing, so it must be purgeable and redacted on the same terms as live PII.
- Its policy is `encrypted_at_rest` (the blob is ciphertext, never plaintext),
  `sync: never`, `export: diagnostic_only` (only through `db:export` and an
  unredacted diagnostic backup, which copy the raw file), `erasure:
erase_on_delete_all`, `legal_basis: consent` (so a withdrawal erases it), and
  retention `user_controlled` / `max_days: 0` — the approved mode is
  copy-and-never-delete, so removal is the user's explicit erasure action and there
  is **no TTL sweeper**.
- Declaring it is the Wave 0 `history_entries` lesson applied forward: an
  undeclared PII-bearing table is invisible to the ADR-002 §2.3 scan, the SPEC-02
  §3 purge, the §6 rescan and the erasure post-condition while holding recovered
  user data.

**Why this re-consent is free, and why the next one will not be.** Nothing had
shipped when 1.6 was cut, so no consent receipt issued under 1.5 exists in the
wild outside a developer's own profile: no real user is interrupted, and the
delta is a declaration rather than a change in what the app collects. That
exemption is a property of the release state, not of the process — it is
recorded here so a later reader does not mistake this bump for a routine one.
**The same exemption covers 1.7 and 1.8** (the PII vault and `legacy_residue`
declarations) for the same reason: still nothing shipped, so no receipt issued
under 1.6 or 1.7 exists outside a developer's own profile. The exemption applies
only to bumps cut before the first release; the first bump after a release does
not get it. A
declared PII surface added _after_ a release costs every user holding a live
receipt one interrupted re-consent and, until they return, gates PII features
that depend on consent. Decide the `policy_version` bump when the surface is
designed, not when the omission is noticed.

- The `version` field of the new `pii_stage` entry is `1.0` and MUST NOT be
  bumped: the AAD's `S` is a hardcoded constant today, and the day it becomes a
  per-key manifest lookup a `version` bump re-labels every existing envelope's
  `S` and strands it. See ADR-001 §3.3 `TODO(hermes)`.

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

## Beta test-only profile addendum (approved scope; Waves 1–3 implemented)

SPEC-04 remains the receipt-backed Stable/Desktop consent contract. The Web-Beta test-only
profile asks for no consent and issues no receipt because it is limited to generated synthetic
test records and does not process real personal data. Its first-run disclosure is informational
only and must not become a consent gate, password prompt, withdrawal control, or privacy-receipt
surface. Beta consent and receipt APIs are not reachable from the Beta app.

This addendum does not change the Stable receipt format, policy hash, policy version, or
historical consent/withdrawal guarantees. Waves 1–3 are implemented: Beta first-run
disclosure and reachability removals are enforced (betaFirstRun, betaReachability);
Stable consent enforcement is unchanged.
