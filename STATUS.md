# Deepwork D1.1 S8 — Consent receipt (SPEC-04)

- **Branch/worktree:** `feat/d1-s8-consent-receipt` / `../open3dcalc-d1-s8-consent`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** SPEC-04 consent receipt — policy-bound,
  tamper-evident, canonicalized receipt (issue/verify/withdraw/policy-delta),
  consentStore rewired so `consentGiven` is derived from a VALID receipt
  (default-deny), withdrawal executing the manifest-derived erasure plan, and the
  consent section in the privacy screen. No contract documents modified (no policy
  bump — the receipt is stored inside the existing `open3dcalc_consent_v1`
  consent_record key, sync never, export never).
- **Base:** `main` @ `a851bc1` (includes PR #114 D1.1 S7).

## What landed in this slice

- `src/shared/lib/consentReceipt.ts`:
  - `issueReceipt` — receipt bound to the CURRENT policy (`policy_hash` = sha256 of
    the canonical SPEC-01 manifest, deterministic across platforms, §4);
  - `evaluateReceipt` — digest recomputed on every load (§5): tampered ⇒ invalid ⇒
    default-deny; withdrawn ⇒ not given (audit record kept); policy
    version/hash mismatch ⇒ `policy_mismatch` ⇒ re-consent required, old receipt
    retained for the delta view (§6);
  - `consentErasurePlan` — the §6.1 withdrawal plan derived from the manifest:
    every `legal_basis: consent` key partitioned by `erasure`
    (erase_on_delete_all vs retain_anonymized);
  - `anonymizeRecord` — strips identifying fields for `retain_anonymized` keys,
    keeping non-identifying aggregates.
- `consentStore` — `giveConsent` issues and VERIFIES the receipt before marking
  consent; `withdrawConsent` annotates `withdrawn_at`, erases the consent-basis
  localStorage keys per the plan (desktop durable copies go through the S4
  `privacy:eliminate-key` flow) and keeps the withdrawn receipt in an audit list;
  stored via the gated storage (consent_record: sync never, export never).
- PrivacyScreen — consent section: status (valid/absent/tampered/policy-mismatch),
  grant/withdraw actions, and the SPEC-04 §2 note that flags never substitute
  consent. i18n pt-BR/en-US.

## Verification (TEST-MATRIX §8)

- 8.1 issue + digest verification (policy hash compared against an independent
  sha256 over the canonical fixture) · 8.2 tamper ⇒ default-deny, never repaired ·
  8.3 flags-only state ⇒ consent NOT given · 8.4 withdrawal: annotation kept,
  erasure plan derived from the manifest, anonymization strips identifying fields
  while keeping aggregates · 8.5 policy change ⇒ mismatch + old receipt retained ·
  8.6 the SPEC-03 envelope never contains receipt material (strict field allowlist).
- 1,377 tests across 108 files; typecheck (app + Electron), strict lint, builds.
- Coverage on the receipt module: 95.5% lines / 92.6% branches.
- Rollback (OWNERS-RUNBOOK §7): flag off ⇒ boolean-consent behavior returns; any
  receipts already issued stay stored (inert); re-enabling re-validates digests.

**D1.1 S8 closes the D1 track (S1–S8): the SPEC-01 manifest, ADR-001 capability,
ADR-002 default-deny/quarantine, SPEC-03 envelope and SPEC-02 saga are all
implemented and enforced at runtime.**
