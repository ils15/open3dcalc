# Open3DCalc Privacy Contracts — D1.0

## Current policy — 1.9 (supersedes conflicting D1.0 and Beta addenda)

Stable Web/PWA and Desktop directly save the exact three customer, quote, and history
manifest keys as plaintext, without a password, vault unlock, or consent/receipt prerequisite.
This is an approved policy change, not a claim that the former zero-plaintext contract was
fulfilled. `contract_performance` is provisional and requires qualified legal review; this
engineering document does not select or validate a legal basis. The encrypted logical export
contract remains separate and intact; its password never gates local saves.

Web Beta remains a separate test-only channel: only generated synthetic records in its three
Beta-specific keys, plaintext, no sync/export/import/deletion, and no Stable or historical-data
access. The Stable/Desktop policy does not broaden Beta's scope.

Bytes already written to `open3dcalc_pii_vault` are inert historical data. No current startup,
read, inspection, conversion, recovery, migration, or cleanup path may touch them. The vault is
excluded from current deletion scope; its bytes may remain in the profile. Current deletion
applies only to current application-owned data within the declared supported scope.

Receipts created under older policies remain historical records and evaluate as
`policy_mismatch` under policy 1.9. No consent, withdrawal, or receipt action gates current
local saves. See the dated decision at the start of each superseding ADR/spec below.

**Track:** D1 (Privacy & Data Contracts) — Deliverable 1.0 (documentation only)
**DRI:** Hermes (backend/data contracts executor)
**Review gate:** Themis (quality & security gate — 3 review rounds completed, findings R1–R15)
**Final approver:** The user (repo owner). Themis sanctions production; only the user approves adoption.
**Base:** `main` @ `4783d69` (includes PR #105)

---

## 1. Scope of D1.0

D1.0 produces **normative documentation and machine-validated contracts only**. It deliberately
does **not** change runtime behavior.

In scope (this deliverable):

- Architecture Decision Records (ADR-001 … ADR-003)
- Normative specifications (SPEC-01 … SPEC-04)
- Versioned JSON Schema for the data manifest + a synthetic fixture
- Compliance matrix tracing every Themis finding (R1–R15) to a document and section
- Contract test matrix for D1.1+ (tests are _specified_ here, _implemented_ in D1.1+)
- Owners and rollback runbook

Out of scope (explicitly **blocked** until this deliverable is approved — see §5):

- Any runtime code change (stores, Electron main/preload, services)
- Any application test change
- Any change to `package.json`, dependencies, or CI workflows
- D1.1+ implementation slices
- D5 (whatever later track depends on these contracts)

The only files added by D1.0 live under `docs/privacy/`. This is enforced by the diff-check
gate in §4 (finding R15).

## Current beta runtime disclosure

This section describes the current application behavior; it does not change the
historical scope or normative status of D1.0. The in-app Copilot uses
material-based local heuristics, locally assembled proposal templates, and
numbers calculated by the app. It does not perform generative AI, call an AI
provider, read or store an API key, or transfer project/calculator data or keys
to an AI service. Any Copilot API key left in browser storage by an older beta
is ignored by the current feature.

This is not a claim that the entire application never uses the network. The
web/PWA fetches application assets and updates from its hosting service; the
desktop app checks GitHub Releases for updates; and opening a generated
WhatsApp proposal link intentionally shares the proposal text with WhatsApp.
Those operations are separate from the Copilot's local suggestions.

## 2. Document index

| File                                      | Purpose                                                                                     | Addresses   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| `ADR-001-crypto-capability.md`            | Policy 1.9 direct local plaintext; former at-rest crypto superseded; export crypto retained | R3, R7      |
| `ADR-002-pii-at-rest-legacy.md`           | Inert historical retention; no inspection, migration, or startup cleanup                    | R3, R11     |
| `ADR-003-export-vs-backup.md`             | Encrypted logical export vs. diagnostic backup; no vault prerequisite                       | R2, R13     |
| `SPEC-01-manifest.schema.json`            | Versioned JSON Schema of the per-key/surface/platform data manifest                         | R1, R8      |
| `SPEC-01-manifest-fixture.json`           | Stable policy 1.9 exact PII scope; synthetic contract fixture                               | R1, R8      |
| `SPEC-01-beta-test-manifest.schema.json`  | Separate exact-key schema for synthetic-only Web Beta storage                               | Beta D1, D2 |
| `SPEC-01-beta-test-manifest-fixture.json` | Unchanged three-key, plaintext, synthetic Web Beta fixture                                  | Beta D1, D2 |
| `SPEC-02-erasure.md`                      | Deletion limited to current owned data; historical vault excluded; Beta refuses             | R4, R9, R10 |
| `SPEC-03-export-envelope.md`              | Normative encrypted export envelope: canonicalization, algorithms, limits, atomic IO        | R12         |
| `SPEC-04-consent-receipt.md`              | Historical receipts; no consent/receipt prerequisite for local saves                        | R5, R14     |
| `COMPLIANCE-MATRIX.md`                    | Traceability of every finding R1–R15 → document/section → status                            | R1–R15      |
| `TEST-MATRIX.md`                          | Policy 1.9 direct-save, reload, failure, Beta-boundary, and export tests                    | R6          |
| `OWNERS-RUNBOOK.md`                       | Policy versioning, verification, and rollback rules                                         | R6, R15     |

Reading order for reviewers: README → COMPLIANCE-MATRIX (map of findings) → ADRs → SPECs →
TEST-MATRIX → OWNERS-RUNBOOK.

## 3. Roles

- **DRI (Hermes):** owns the correctness, internal consistency, and cross-references of this
  document set. Any contradiction between documents MUST be treated as a D1.0 defect and MUST block approval.
- **Themis (gate):** reviewed this deliverable over 3 rounds. Themis approval of the _documents_
  is recorded via the compliance matrix; Themis remains the quality gate for every D1.1+ slice.
- **User (final approver):** the only authority who can (a) accept these contracts as binding
  for D1.1+, and (b) unblock D1.1+/runtime/D5. Until the user approves, everything downstream
  stays blocked.

## 4. Objective exit criteria for D1.0

D1.0 is complete when **all** of the following are verifiably true:

1. **Coverage:** Every finding R1–R15 from the 3 Themis review rounds is addressed by at least
   one document/section and traced in `COMPLIANCE-MATRIX.md` with status `Addressed`.
2. **Schema validity:** `SPEC-01-manifest.schema.json` is valid JSON Schema (draft 2020-12) and
   `SPEC-01-manifest-fixture.json` validates against it, including all edge cases listed in
   SPEC-01 §3 (flags as local-only, customers/quotes as PII, preferences, cache, diagnostic,
   snapshot, reserved surfaces).
3. **No runtime footprint:** the diff against the base branch MUST contain **only new files
   under `docs/privacy/`**. Note: the repo's `.gitignore` has a `docs/*` rule (with
   explicit negations for `conventions.md` and `estimators-model.md`), so these files are
   ignored until staged. When the user approves and commits, either add a
   `!docs/privacy/` negation following the existing pattern or stage with
   `git add -f docs/privacy/`. After staging, verify with:
   ```bash
   git diff --cached --stat origin/main   # only additions under docs/privacy/
   git diff --cached --name-only origin/main | grep -v '^docs/privacy/' && echo "VIOLATION" || echo "OK"
   ```
   (D1.0 itself does not commit, per its charter; the base is `origin/main` @ `4783d69`,
   which includes PR #105.)
4. **Language:** all documents are in English, per `docs/conventions.md`.
5. **No real PII:** fixtures and examples contain only synthetic data (reserved domains such as
   `example.invalid`, placeholder names). No user, customer, or device data appears anywhere.
6. **No over-promising:** every document states that D1.0 is documentation-only; normative
   MUST/SHOULD clauses bind D1.1+ implementation, not the current runtime. Where current
   behavior deviates from the contract (e.g., today's user-facing `db:export`), the deviation
   is documented as the _problem_ the contract resolves, not as delivered behavior.
7. **ADR status:** every ADR terminates with `Status: Proposed (awaiting Themis gate + user
final approval)`.

## 5. Block declaration (binding until approval)

> **D1.1+, all runtime work, and D5 are BLOCKED** until the user grants final approval of this
> document set. Themis sanction (3 rounds, R1–R15 addressed) authorizes _production of the
> documents_, not adoption of the contracts. No code, test, dependency, or workflow change
> derived from these contracts MUST NOT land before approval. Upon approval, implementation follows
> the slice plan in `OWNERS-RUNBOOK.md` §4 and the mandatory tests in `TEST-MATRIX.md`.

## 6. Current-state facts these contracts build on

These facts were verified against the codebase at the D1.0 base commit and are the _inputs_ the
contracts normatively govern (they are not claims that the contracts are already implemented):

- **localStorage keys (web/PWA/desktop renderer):** `open3dcalc_consent_v1`,
  `open3dcalc_customers_v1`, `open3dcalc_quotes_v1`, `open3dcalc_history_v2`,
  `open3dcalc_products`, `open3dcalc_filaments`, `open3dcalc_sections`,
  `open3dcalc_settings_v2`, `open3dcalc_theme`, `open3dcalc_dashboard_v1`,
  `open3dcalc_dashboard_goal`, `open3dcalc_catalog_v1`, `open3dcalc_tutorial_v1`.
- **Desktop persistence:** Electron main exposes `db:get`/`db:set`/`db:delete`/`db:list-keys`
  over a SQLite `storage` table (key/value mirror of renderer state), plus `db:export`, which
  copies the raw SQLite file (post `wal_checkpoint(TRUNCATE)`) to a user-chosen path.
- **Cross-device sync/export:** `src/shared/lib/dataSync.ts` builds a client-side encrypted
  bundle: AES-256-GCM, PBKDF2-SHA256 at 100,000 iterations, 16-byte salt, 12-byte IV,
  SHA-256 plaintext checksum, format `open3dcalc-export`, version `1.0`.
- **Consent:** `consentStore` persists `consentGiven`/`consentDate`/`privacyBannerDismissed`
  under `open3dcalc_consent_v1`; banner dismissal is separate from consent.
- **PII:** `customers` (name, company, email, phone, address, notes) and `quotes`
  (`customerSnapshot` JSON blob) are the primary PII classes; history/dashboard are
  PII-derived.

Known gaps that the contracts turn into D1.1+ obligations: PII is persisted in plaintext
(R3/R11), `db:export` is a raw PII-bearing SQLite copy exposed in the user flow (R2/R13),
delete-all is not a complete, resumable, cross-surface erasure (R4/R9/R10), consent is a bare
flag without a tamper-evident receipt (R5/R14), and storage-key allowlists are duplicated
across stores and `dataSync.ts` (R1/R8).

## 7. Superseded Beta-only addendum and current channel boundary

The Beta-only addendum below is retained for history where it describes Web Beta restrictions.
Its claims that Stable policy 1.0 / policy 1.8 and consent requirements remain unchanged are
superseded by policy 1.9 above. This slice changes contracts and adds RED tests only; it does
not claim that runtime behavior has been implemented or verified.

The Web-Beta profile remains restricted to synthetic test data and these exact browser keys:

- `open3dcalc_beta_test_customers_v1`
- `open3dcalc_beta_test_quotes_v1`
- `open3dcalc_beta_test_history_v1`

They are plaintext `localStorage` entries for **Web Beta only**, are never synchronized or
exported, and are not personal data because only generated synthetic records are permitted.
The Beta fixture and strict schema are separate from the Stable manifest; they do not add
Beta keys to `SPEC-01-manifest-fixture.json`. Stable data keys and encrypted export formats
remain unchanged; the three Stable customer/quote/history declarations are updated under
policy 1.9 as specified by D06/D07.

The Beta app must not read Stable keys or legacy residue, sweep namespaces, migrate or delete
data, open IndexedDB/vault, Cache API, SQLite, snapshots, or desktop bridges, or expose import,
export, backup, consent, password, withdrawal, or erasure gates. The Beta first-run disclosure
must plainly say “test data only”, “stored unencrypted”, “no password”, “no migration”, “no
export”, and that the browser profile is disposable. Beta is web-only; Desktop follows the
policy 1.9 Stable plaintext manifest and remains distinct from Beta.

Wave 1–3 suites and release evidence are enumerated in TEST-MATRIX §11. The Beta
implementation on this branch passes those contracts; this addendum must not be used to
claim that a published Beta build already has the test-only behavior until the Wave 3
release gate (built-Beta same-origin isolation + Themis approval) passes on the release
workflow.

## 8. SPEC-01 fixture changes in policy 1.9

The Stable fixture keeps `manifest_version: 1.0` and advances `policy_version` from 1.8 to 1.9.
Only `open3dcalc_customers_v1`, `open3dcalc_quotes_v1`, and `open3dcalc_history_v2` change to
`pii:true`, `persistence:plaintext_allowed`, and provisional `legal_basis:contract_performance`.
Their declared destination remains `localStorage` on Electron, Web, and PWA. Other PII
destinations—including the SQLite domain tables—retain their prior persistence restrictions;
the exact three-key exception must not be generalized.

Nine former vault, migration, and re-homing entries are retired from the active manifest:

- `open3dcalc_migration_done_v2`
- `open3dcalc_migration_progress_v2`
- `open3dcalc_legacy_keep_readonly_v1`
- `open3dcalc_migration_fingerprint_v1`
- `open3dcalc_pii_vault`
- `pii_stage`
- `legacy_residue`
- `session_passphrase_key`
- `open3dcalc_legacy_pii_rehomed_v1`

Retiring these declarations removes them as active policy/write/delete targets; it is not an
instruction to inspect, migrate, or delete historical bytes already present in user profiles.
In particular, existing `open3dcalc_pii_vault` data remains inert and outside current deletion
scope as described above. The schema and runtime validator enforce the same three-key and
destination boundary.
