# COMPLIANCE-MATRIX — D1.0 Themis Findings Traceability

**Track:** D1 — Privacy & Data Contracts (D1.0, documentation only)
**DRI:** Hermes
**Gate:** Themis (3 review rounds; findings R1–R15)
**Final approver:** User

Every finding from the 3 Themis review rounds MUST be addressed in a document/section of
this deliverable and traced below. Status legend:

- `Addressed` — a normative document/section fully covers the finding.
- `Addressed (D1.1+ obligation)` — the finding requires runtime work; the *contract* that
  binds that work is complete in D1.0, and the obligation is traced to TEST-MATRIX.

| ID | Finding (round) | Requirement | Addressed by (document §) | Status |
|----|-----------------|-------------|---------------------------|--------|
| R1 | Duplicated storage-key allowlists across stores and `dataSync.ts`; need a single source + unknown-key sweep | Single-source inventory; unknown keys default-deny | SPEC-01 schema (manifest is the single source; `key` unique; unknown ⇒ deny), SPEC-01 fixture (all 13 real keys + reserved surfaces), SPEC-02 §3 (row 1: localStorage sweep) / §6 step 3 (unknown `open3dcalc_*` sweep on erasure), README §6 (current duplication documented as gap) | Addressed (D1.1+ obligation) |
| R2 | User export conflated with raw SQLite copy | User export must be logical; raw copy out of user flow | ADR-003 §2.1 (user export = SPEC-03 envelope only), §2.2.3 (raw copy forbidden from user/sync/upload flows), SPEC-03 §1 | Addressed (D1.1+ obligation) |
| R3 | PII persisted plaintext at rest | Default-deny; zero plaintext path | ADR-001 §2.1 (deny path; zero plaintext), §2.3 (capability table), ADR-002 §2.1 (default-deny write policy), SPEC-01 schema (`plaintext_allowed` ⇔ `pii:false`, schema-enforced) | Addressed (D1.1+ obligation) |
| R4 | deleteAll incomplete (surfaces missed) | Full coverage of every surface | SPEC-02 §3 (11-store table: localStorage, SQLite tables+storage, WAL/SHM, IndexedDB, OPFS, Cache API/SW, appData, logs, temps, snapshots), §6 (post-condition rescan = zero PII keys) | Addressed (D1.1+ obligation) |
| R5 | Consent is a bare flag; banner dismissal ≠ consent | Receipt-based consent; flags never satisfy | SPEC-04 §2 (flags never satisfy), §3 (receipt), §6 (default-deny + exact withdrawal) | Addressed (D1.1+ obligation) |
| R6 | DRI unclear; tests not contractual | Named DRI; mandatory contract tests | README §3 (DRI/gate/approver roles), TEST-MATRIX (mandatory tests for D1.1+), OWNERS-RUNBOOK §2–§3 (owners per contract) | Addressed |
| R7 | Web/PWA crypto undefined | Web Crypto + secure context + passphrase rules | ADR-001 §2.2 (Web Crypto, secure context, passphrase memory-only, insecure ⇒ PII blocked), §2.3 rows 4–6 | Addressed (D1.1+ obligation) |
| R8 | Inventory must be per field/surface/platform | Granular manifest | SPEC-01 schema (`key`, `surface`, `platforms`, per-key policies), fixture (25 entries covering every surface/platform/class) | Addressed |
| R9 | Saga atomicity undefined | Real state machine with commit point | SPEC-02 §2 (state machine; commit point; per-store journal), §4 (journal format) | Addressed (D1.1+ obligation) |
| R10 | Crash/rollback/ephemeral-key semantics undefined | Resumable crash recovery; rollback window documented | SPEC-02 §2 (crash after `snapshot_taken` ⇒ idempotent resume), §5 (ephemeral key lost/TTL ⇒ rollback impossible after defined window; behavior documented; UI warns pre-confirmation) | Addressed (D1.1+ obligation) |
| R11 | Legacy plaintext needs quarantine, not a warning | Read-only quarantine; explicit migrate/eliminate; visible result | ADR-002 §2.2 (read-only; no write/sync/export; migrate-or-eliminate with visible result; dedicated screen; no implicit acceptance), §2.3 (state model) | Addressed (D1.1+ obligation) |
| R12 | Export envelope not normative | Full envelope spec: canonicalization, algorithms, limits, atomic IO, password handling | SPEC-03 §2 (structure), §3 (RFC 8785), §4 (allowlist, exact iterations/salt/IV), §5 (integrity+AAD), §6 (password never argv/env/logs), §7 (limits, downgrade/unknown/path/symlink), §9 (staging+fsync+rename; crash ⇒ discard) | Addressed (D1.1+ obligation) |
| R13 | Raw SQLite export is a PII-bearing diagnostic | Reclassify as engineering backup: dev flag, redaction, no user flow, retention+disposal | ADR-003 §2.2 (items 1–4), §2.3 (classification table), OWNERS-RUNBOOK §5 (disposal runbook) | Addressed (D1.1+ obligation) |
| R14 | Receipt canonicalization undefined | Canonical policy_hash; anti-tamper digest | SPEC-04 §4 (canonical JSON → SHA-256 policy_hash), §5 (receipt digest; mismatch ⇒ invalid ⇒ re-consent) | Addressed (D1.1+ obligation) |
| R15 | Approvers and diff-check gate undefined | Explicit approvers; docs-only diff enforcement | README §3 (Themis gate + user final approval), §4.3 (diff-check commands: only `docs/privacy/` additions), §5 (block declaration), OWNERS-RUNBOOK §6 (slice diff-check) | Addressed |

## Verification procedure (for the approving user)

1. `git diff --name-only main...chore/d1-privacy-contracts` — every path starts with
   `docs/privacy/` (R15, README §4.3).
2. Validate the fixture against the schema (R1/R8): any JSON Schema 2020-12 validator;
   the fixture must pass and the negative cases in TEST-MATRIX §1 must fail.
3. Spot-check any finding ID above against the cited section — each citation must contain
   the normative text (MUST/SHOULD), not just a mention.

## Round summary

- **Round 1 (architecture):** R1–R6 — inventory, export conflation, PII at-rest,
  delete-all, consent, ownership.
- **Round 2 (semantics):** R7–R11 — web crypto, granularity, saga atomicity, crash
  semantics, legacy quarantine.
- **Round 3 (normative completeness):** R12–R15 — envelope, diagnostic reclassification,
  receipt canonicalization, approvers/diff-check.

All 15 findings are `Addressed`. Findings requiring runtime work carry the
`D1.1+ obligation` marker: the contract is complete and binding, implementation is
blocked until user approval (README §5) and is verified by TEST-MATRIX.
