# COMPLIANCE-MATRIX — D1.0 Themis Findings Traceability

## Current policy 1.9 trace — approved change, not legacy compliance

Policy 1.9 explicitly approves direct plaintext persistence for only
`open3dcalc_customers_v1`, `open3dcalc_quotes_v1`, and `open3dcalc_history_v2` on the
declared Stable Web/PWA and Desktop destinations. Web/PWA use the logical `localStorage` keys;
Desktop maps them to `open3dcalc_pwless_customers_v1`, `open3dcalc_pwless_quotes_v1`, and
`open3dcalc_pwless_history_v1` in SQLite's `storage` table (SPEC-01). This is a change in policy and is **not**
described as fulfillment of the historical zero-plaintext requirement in R3. `contract_performance`
is provisional and requires qualified legal review. The encrypted logical export remains
protected by SPEC-03 (E1 retained); its password does not gate local saves. Historical
`open3dcalc_pii_vault` bytes are inert and expressly excluded from current deletion scope
(ADR-002, SPEC-02); no access, conversion, migration, recovery, or purge is promised.

The R1–R15 table below is a historical trace of the former D1.0 contract and must be read
through this policy 1.9 supersession. The current operative contracts are SPEC-01 policy 1.9,
ADR-001/002/003 supersession notes, SPEC-02, SPEC-03, SPEC-04, and the current TEST-MATRIX.

**Implementation status:** implementation and local verification were completed in PR #279 and
merged into `main`; the restricted web Beta is now `v2.0.0-beta.15`. Final Themis review and
explicit owner/legal approval remain pending before Stable promotion. Beta publication does not
approve the separate Stable/Desktop policy.

## Next V2 candidate trace — ADR-004/SPEC-05 (implementation pending)

The R1–R15 table below remains the historical D1.0 finding trace under current policy 1.9.
It is not evidence that the next-candidate requirements are implemented. The real-data
candidate adds these release obligations:

| Requirement                                                                        | Normative contract                                                         | Current state                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Encrypt all durable user content on Web/PWA/Desktop; no Beta plaintext exception   | ADR-004 §§2.1–2.2; SPEC-01 V2 Candidate §§1–3                              | Direction approved; manifest/runtime pending S1                         |
| Create/unlock/lock; unsupported crypto fails closed; no PII in logs                | ADR-001 candidate amendment; ADR-004 §2.2; TEST-MATRIX §9                  | Existing primitives partially reusable; platform integration pending S1 |
| Exact-source, user-selected, previewed and retry-safe V1/current-profile migration | ADR-002 candidate amendment; SPEC-05 §§2–5                                 | Registry audit and implementation pending S2                            |
| Encrypted backup/restore and exact-scope verified deletion                         | ADR-003 candidate amendment; SPEC-02/03 candidate amendments; ADR-004 §2.4 | Policy 1.9 Beta paths remain restricted; target runtime pending S1      |
| Honest first-run disclosure and demo isolation                                     | ADR-004 §§2.1, 2.4; SPEC-04 candidate amendment; TEST-MATRIX §9            | Candidate UX and evidence pending S1                                    |

No row in this trace marks a release gate as passed. The policy 1.9 runtime and beta.15
evidence remain historical until an exact candidate tree passes its own tests and review.

**Track:** D1 — Privacy & Data Contracts (D1.0, documentation only)
**DRI:** Hermes
**Gate:** Themis (3 review rounds; findings R1–R15)
**Final approver:** User

Every finding from the 3 Themis review rounds MUST be addressed in a document/section of
this deliverable and traced below. Status legend:

- `Addressed` — a normative document/section fully covers the finding.
- `Addressed (D1.1+ obligation)` — the finding requires runtime work; the _contract_ that
  binds that work is complete in D1.0, and the obligation is traced to TEST-MATRIX.

| ID  | Finding (round)                                                                                             | Requirement                                                                             | Addressed by (document §)                                                                                                                                                                                                                                                             | Status                       |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| R1  | Duplicated storage-key allowlists across stores and `dataSync.ts`; need a single source + unknown-key sweep | Single-source inventory; unknown keys default-deny                                      | SPEC-01 schema (manifest is the single source; `key` unique; unknown ⇒ deny), SPEC-01 fixture (all 13 real keys + reserved surfaces), SPEC-02 §3 (row 1: localStorage sweep) / §6 step 3 (unknown `open3dcalc_*` sweep on erasure), README §6 (current duplication documented as gap) | Addressed (D1.1+ obligation) |
| R2  | User export conflated with raw SQLite copy                                                                  | User export must be logical; raw copy out of user flow                                  | ADR-003 §2.1 (user export = SPEC-03 envelope only), §2.2.3 (raw copy forbidden from user/sync/upload flows), SPEC-03 §1                                                                                                                                                               | Addressed (D1.1+ obligation) |
| R3  | PII persisted plaintext at rest                                                                             | Default-deny; zero plaintext path                                                       | ADR-001 §2.1 (deny path; zero plaintext), §2.3 (capability table), ADR-002 §2.1 (default-deny write policy), SPEC-01 schema (`plaintext_allowed` ⇔ `pii:false`, schema-enforced)                                                                                                      | Addressed (D1.1+ obligation) |
| R4  | deleteAll incomplete (surfaces missed)                                                                      | Full coverage of every surface                                                          | SPEC-02 §3 (11-store table: localStorage, SQLite tables+storage, WAL/SHM, IndexedDB, OPFS, Cache API/SW, appData, logs, temps, snapshots), §6 (post-condition rescan = zero PII keys)                                                                                                 | Addressed (D1.1+ obligation) |
| R5  | Consent is a bare flag; banner dismissal ≠ consent                                                          | Receipt-based consent; flags never satisfy                                              | SPEC-04 §2 (flags never satisfy), §3 (receipt), §6 (default-deny + exact withdrawal)                                                                                                                                                                                                  | Addressed (D1.1+ obligation) |
| R6  | DRI unclear; tests not contractual                                                                          | Named DRI; mandatory contract tests                                                     | README §3 (DRI/gate/approver roles), TEST-MATRIX (mandatory tests for D1.1+), OWNERS-RUNBOOK §2–§3 (owners per contract)                                                                                                                                                              | Addressed                    |
| R7  | Web/PWA crypto undefined                                                                                    | Web Crypto + secure context + passphrase rules                                          | ADR-001 §2.2 (Web Crypto, secure context, passphrase memory-only, insecure ⇒ PII blocked), §2.3 rows 4–6                                                                                                                                                                              | Addressed (D1.1+ obligation) |
| R8  | Inventory must be per field/surface/platform                                                                | Granular manifest                                                                       | SPEC-01 schema (`key`, `surface`, `platforms`, per-key policies), fixture (25 entries covering every surface/platform/class)                                                                                                                                                          | Addressed                    |
| R9  | Saga atomicity undefined                                                                                    | Real state machine with commit point                                                    | SPEC-02 §2 (state machine; commit point; per-store journal), §4 (journal format)                                                                                                                                                                                                      | Addressed (D1.1+ obligation) |
| R10 | Crash/rollback/ephemeral-key semantics undefined                                                            | Resumable crash recovery; rollback window documented                                    | SPEC-02 §2 (crash after `snapshot_taken` ⇒ idempotent resume), §5 (ephemeral key lost/TTL ⇒ rollback impossible after defined window; behavior documented; UI warns pre-confirmation)                                                                                                 | Addressed (D1.1+ obligation) |
| R11 | Legacy plaintext needs quarantine, not a warning                                                            | Read-only quarantine; explicit migrate/eliminate; visible result                        | ADR-002 §2.2 (read-only; no write/sync/export; migrate-or-eliminate with visible result; dedicated screen; no implicit acceptance), §2.3 (state model)                                                                                                                                | Addressed (D1.1+ obligation) |
| R12 | Export envelope not normative                                                                               | Full envelope spec: canonicalization, algorithms, limits, atomic IO, password handling  | SPEC-03 §2 (structure), §3 (RFC 8785), §4 (allowlist, exact iterations/salt/IV), §5 (integrity+AAD), §6 (password never argv/env/logs), §7 (limits, downgrade/unknown/path/symlink), §9 (staging+fsync+rename; crash ⇒ discard)                                                       | Addressed (D1.1+ obligation) |
| R13 | Raw SQLite export is a PII-bearing diagnostic                                                               | Reclassify as engineering backup: dev flag, redaction, no user flow, retention+disposal | ADR-003 §2.2 (items 1–4), §2.3 (classification table), OWNERS-RUNBOOK §5 (disposal runbook)                                                                                                                                                                                           | Addressed (D1.1+ obligation) |
| R14 | Receipt canonicalization undefined                                                                          | Canonical policy_hash; anti-tamper digest                                               | SPEC-04 §4 (canonical JSON → SHA-256 policy_hash), §5 (receipt digest; mismatch ⇒ invalid ⇒ re-consent)                                                                                                                                                                               | Addressed (D1.1+ obligation) |
| R15 | Approvers and diff-check gate undefined                                                                     | Explicit approvers; docs-only diff enforcement                                          | README §3 (Themis gate + user final approval), §4.3 (diff-check commands: only `docs/privacy/` additions), §5 (block declaration), OWNERS-RUNBOOK §6 (slice diff-check)                                                                                                               | Addressed                    |

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

The `Addressed` values above record the historical D1.0 document-review disposition. They are
not claims that every D1.0 runtime requirement was implemented or remains operative. Current
policy 1.9 and implementation status are stated at the start of this matrix; final Themis
review remains pending and publication has not been authorized.

## Approved Beta strip-down trace (D1–D12; additive)

This trace covers the separately approved Web-Beta test-only profile; it does not revise the
historical R1–R15 findings. The implementation is present on the current branch; final Themis
review remains pending. Synthetic-only is intended use, not content validation, and Beta's
namespace isolation is app-mediated rather than a same-origin security boundary.

| Decision | Required scope                                                                                                | Contract / evidence                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1       | Add exactly three plaintext Web-Beta keys designated for synthetic test data                                  | `SPEC-01-beta-test-manifest-fixture.json`                             |
| D2       | Separate strict exact-key Beta schema remains unchanged; Stable schema is separately updated under policy 1.9 | `SPEC-01-beta-test-manifest.schema.json`; SPEC-01 Stable schema       |
| D3       | No Beta deletion, erasure saga, snapshot, or cleanup contract                                                 | SPEC-02 Beta addendum; `betaNoDestructiveOps`                         |
| D4       | Encrypted export remains Stable/Desktop-only; Beta has no export/import/password path                         | SPEC-03 Beta addendum; `betaNoExport`                                 |
| D5       | Beta and Stable saves have no consent prerequisite; old Stable receipts remain historical and mismatch on 1.9 | SPEC-04 §Policy 1.9; `noGatePrerequisites`                            |
| D6       | Exclude crypto capability, vault, and password session from Beta                                              | ADR-001 Beta addendum; `betaTestStorage`                              |
| D7       | Synthetic-only intended use; app-mediated namespace guard and no legacy access                                | ADR-002 Beta addendum; `betaFreshNamespace` / `betaIsolation.browser` |
| D8       | No user export or backup in Beta                                                                              | ADR-003 Beta addendum; `betaNoExport`                                 |
| D9       | Preserve app-mediated Beta namespace checks and disclose same-origin limitation; retain Stable suites         | TEST-MATRIX §3                                                        |
| D10      | Distinct Beta contract and fail-closed deployment restrictions; Stable policy version is 1.9                  | OWNERS-RUNBOOK; TEST-MATRIX §3                                        |
| D11      | Document Beta limitations and the separately approved Stable/Desktop direct-plaintext scope                   | Root/privacy/Web/Desktop READMEs                                      |
| D12      | Mark test-only Beta capabilities absent without rewriting history                                             | ROADMAP Beta strip-down note                                          |

The Beta schema and fixture declare exactly three keys intended for synthetic test data; they
do not validate content or secure browser storage from same-origin code. The Stable fixture is
policy 1.9, while manifest version 1.0 and encrypted-entry versions remain frozen. Earlier
receipt bytes/hashes are preserved and evaluate as `policy_mismatch`; no workflow, publication,
PR, or release action is authorized by this trace.
