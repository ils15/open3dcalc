# Open3DCalc Privacy Contracts

## Current policy — 1.9 (supersedes conflicting D1.0 and Beta addenda)

Stable Web/PWA and Desktop directly save the exact three customer, quote, and history
manifest keys as plaintext, without a password, vault unlock, or consent/receipt prerequisite.
Web/PWA use their listed `localStorage` keys; Desktop maps them to the corresponding
`open3dcalc_pwless_*` keys in SQLite's `storage` table (SPEC-01). This is an approved policy
change, not a claim that the former zero-plaintext contract was fulfilled. `contract_performance`
is provisional and requires qualified legal review; this engineering document does not select
or validate a legal basis. The encrypted logical export contract remains separate and intact;
its password never gates local saves.

Web Beta remains a separate test-only channel intended for generated synthetic records in its
three Beta-specific keys, plaintext, with no sync/export/import/deletion. The app restricts its
own storage operations to that namespace but does not validate whether record contents are
synthetic; this is an intended-use restriction, not a security boundary. Same-origin scripts,
browser extensions, and DevTools can access browser storage, so namespace isolation is
app-mediated and does not protect against code running in the same origin. Stable/Desktop
policy does not broaden Beta's scope.

Bytes already written to `open3dcalc_pii_vault` are inert historical data. Current production
startup and user-facing flows have no call site that reads, inspects, converts, recovers,
migrates, or cleans up those vault records; startup also does not read retired migration markers
or legacy history/product sources. The vault is excluded from current deletion scope; its bytes
may remain in the profile. Current deletion applies only to current application-owned data
within the declared supported scope.

Receipts created under older policies remain historical records and evaluate as
`policy_mismatch` under policy 1.9. No consent, withdrawal, or receipt action gates current
local saves. See the dated decision at the start of each superseding ADR/spec below.

## Next V2 candidate — real-data direction approved; not yet shipped

The owner has approved a different destination for the next V2 Beta: real workshop data,
encrypted local persistence, explicit V1/current-profile migration, encrypted recovery, and
truthful deletion. The normative target is [ADR-004](ADR-004-real-data-v2.md),
[SPEC-01 V2 Candidate](SPEC-01-v2-candidate.md), and
[SPEC-05](SPEC-05-v1-to-v2-migration.md). This decision does not change the current runtime:
Stable/Desktop still follow policy 1.9 and the published `v2.0.0-beta.15` still has its
plaintext, test-intended namespace. Do not enter real data in that released Beta. The new
runtime, manifest, first-run disclosure, and release evidence must be implemented and verified
before any candidate is described as supporting real data.

ADR-004 supersedes the Beta test-only addenda and policy 1.9 plaintext choices only for that
future candidate. The historical documents below remain evidence of earlier released
behavior; they are not authorization to reuse the old plaintext paths or to claim migration
has occurred.

**Historical D1.0 metadata:** Track D1 (Privacy & Data Contracts), documentation deliverable
**DRI:** Hermes (backend/data contracts executor)
**Historical review:** Themis completed 3 document-review rounds (findings R1–R15)
**Historical base:** `main` @ `4783d69` (includes PR #105)

---

## Historical D1.0 record — documentation deliverable

> The sections below preserve the D1.0 project's original charter and codebase snapshot as
> historical context. Their former phase gates and blocked-work language are not current
> requirements; policy 1.9 and the current implementation status above take precedence.

## 1. D1.0 scope (historical)

D1.0 produced **normative documentation and machine-validated contracts only**. It deliberately
did **not** change runtime behavior at that time.

In scope for that deliverable:

- Architecture Decision Records (ADR-001 … ADR-003)
- Normative specifications (SPEC-01 … SPEC-04)
- Versioned JSON Schema for the data manifest + a synthetic fixture
- Compliance matrix tracing every Themis finding (R1–R15) to a document and section
- Contract test matrix for D1.1+ (tests were _specified_ here for later implementation)
- Owners and rollback runbook

Out of scope for that historical deliverable:

- Any runtime code change (stores, Electron main/preload, services)
- Any application test change
- Any change to `package.json`, dependencies, or CI workflows
- D1.1+ implementation slices
- D5 (whatever later track depends on these contracts)

The D1.0 diff-check gate described in §4 required its changes to stay under `docs/privacy/`.

## Current beta runtime disclosure

This section describes the current application behavior. The in-app Copilot uses
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

| File                                      | Purpose                                                                               | Addresses   |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| `ADR-001-crypto-capability.md`            | Policy 1.9 runtime record; former at-rest crypto superseded; export crypto retained   | R3, R7      |
| `ADR-002-pii-at-rest-legacy.md`           | Policy 1.9 runtime record; former quarantine/migration proposal retained historically | R3, R11     |
| `ADR-003-export-vs-backup.md`             | Encrypted logical export vs. diagnostic backup; 1.9 runtime record                    | R2, R13     |
| `ADR-004-real-data-v2.md`                 | Approved target for encrypted real-data profiles and explicit migration               | Next V2     |
| `SPEC-01-v2-candidate.md`                 | Candidate classification and source inventory; runtime manifest remains 1.9           | Next V2     |
| `SPEC-01-manifest.schema.json`            | Versioned JSON Schema of the per-key/surface/platform data manifest                   | R1, R8      |
| `SPEC-01-manifest-fixture.json`           | Stable policy 1.9 exact PII scope; synthetic contract fixture                         | R1, R8      |
| `SPEC-01-beta-test-manifest.schema.json`  | Separate exact-key schema for app-mediated Web Beta storage (synthetic intended use)  | Beta D1, D2 |
| `SPEC-01-beta-test-manifest-fixture.json` | Three-key, plaintext Web Beta fixture; content is not validated as synthetic          | Beta D1, D2 |
| `SPEC-02-erasure.md`                      | Deletion limited to current owned data; historical vault excluded; Beta refuses       | R4, R9, R10 |
| `SPEC-03-export-envelope.md`              | Normative encrypted export envelope: canonicalization, algorithms, limits, atomic IO  | R12         |
| `SPEC-04-consent-receipt.md`              | Historical receipts; no consent/receipt prerequisite for local saves                  | R5, R14     |
| `SPEC-05-v1-to-v2-migration.md`           | Exact-source, user-confirmed, lossless V1/current-profile migration gate              | Next V2     |
| `COMPLIANCE-MATRIX.md`                    | Traceability of every finding R1–R15 → document/section → status                      | R1–R15      |
| `TEST-MATRIX.md`                          | Policy 1.9 direct-save, reload, failure, Beta-boundary, and export tests              | R6          |
| `OWNERS-RUNBOOK.md`                       | Policy versioning, verification, and rollback rules                                   | R6, R15     |

Reading order for reviewers: README → COMPLIANCE-MATRIX (map of findings) → ADRs → SPECs →
TEST-MATRIX → OWNERS-RUNBOOK.

## 3. D1.0 roles (historical)

- **DRI (Hermes):** owned the correctness, internal consistency, and cross-references of that
  document set. Contradictions were treated as D1.0 defects during that review.
- **Themis (gate):** reviewed the D1.0 documents over 3 rounds. The current implementation
  still requires its final gate before promotion.
- **User (final approver):** approved policy 1.9; promotion and publication remain separate
  decisions.

## 4. D1.0 exit criteria (historical)

The original D1.0 deliverable was considered complete when **all** of the following were
verifiably true:

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

## 5. Historical D1.0 block declaration (closed)

> At the time this declaration was written, D1.1+, runtime work, and D5 were blocked pending
> final user approval. That historical block is closed: policy 1.9 has been approved and the
> runtime work is being verified under the current review gate. This paragraph grants no
> commit, merge, release, or publication authorization.

## 6. D1.0 base-commit facts (historical snapshot)

These facts were verified against the codebase at the D1.0 base commit. They are historical
inputs to the original contracts, not statements of current implementation status:

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

Known gaps at the D1.0 base commit (historical): PII was persisted in plaintext
(R3/R11), `db:export` is a raw PII-bearing SQLite copy exposed in the user flow (R2/R13),
delete-all was not a complete, resumable, cross-surface erasure (R4/R9/R10), consent was a bare
flag without a tamper-evident receipt (R5/R14), and storage-key allowlists were duplicated
across stores and `dataSync.ts` (R1/R8). These are not current implementation claims.

## 7. Superseded Beta-only addendum (historical) and current channel boundary

The Beta-only addendum below is retained as a historical record. Its claims that Stable policy
1.0 / policy 1.8 and consent requirements remain unchanged are superseded by policy 1.9 above.
The old Wave 1 RED-only status is also superseded by the current branch status stated below.

The Web-Beta profile is intended for synthetic test data and uses these exact browser keys:

- `open3dcalc_beta_test_customers_v1`
- `open3dcalc_beta_test_quotes_v1`
- `open3dcalc_beta_test_history_v1`

They are plaintext `localStorage` entries for **Web Beta only** and are never synchronized or
exported. Synthetic-only is an intended-use restriction; the app does not inspect record
contents to prove they are generated synthetic data.
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

Beta storage isolation is enforced by the app's own adapters and guards, not by browser-origin
security: same-origin scripts, extensions, and DevTools can still access `localStorage`. The
implementation was merged into `main` by PR #279 and is present in web Beta `v2.0.0-beta.15`.
Final Themis review and explicit owner/legal approval remain required before Stable promotion;
publication of the restricted Beta channel does not approve the separate Stable/Desktop policy.

## 8. SPEC-01 fixture changes in policy 1.9

The Stable fixture keeps `manifest_version: 1.0` and advances `policy_version` from 1.8 to 1.9.
Only `open3dcalc_customers_v1`, `open3dcalc_quotes_v1`, and `open3dcalc_history_v2` change to
`pii:true`, `persistence:plaintext_allowed`, and provisional `legal_basis:contract_performance`.
Their renderer-facing `surface` remains `localStorage`; `platform_destinations` declares the
physical Electron aliases `open3dcalc_pwless_customers_v1`, `open3dcalc_pwless_quotes_v1`, and
`open3dcalc_pwless_history_v1` in SQLite's `storage` table, while Web/PWA use the logical keys
in `localStorage`. Other PII destinations—including SQLite domain tables—retain their prior
persistence restrictions; the exact three-key exception must not be generalized.

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
