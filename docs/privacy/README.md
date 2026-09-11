# Open3DCalc Privacy Contracts — D1.0

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
- Contract test matrix for D1.1+ (tests are *specified* here, *implemented* in D1.1+)
- Owners and rollback runbook

Out of scope (explicitly **blocked** until this deliverable is approved — see §5):

- Any runtime code change (stores, Electron main/preload, services)
- Any application test change
- Any change to `package.json`, dependencies, or CI workflows
- D1.1+ implementation slices
- D5 (whatever later track depends on these contracts)

The only files added by D1.0 live under `docs/privacy/`. This is enforced by the diff-check
gate in §4 (finding R15).

## 2. Document index

| File | Purpose | Addresses |
|------|---------|-----------|
| `ADR-001-crypto-capability.md` | Cryptographic capability model per platform; zero plaintext path for PII | R3, R7 |
| `ADR-002-pii-at-rest-legacy.md` | Default-deny PII at rest; legacy plaintext enters read-only quarantine | R3, R11 |
| `ADR-003-export-vs-backup.md` | User logical export vs. engineering/diagnostic raw SQLite backup | R2, R13 |
| `SPEC-01-manifest.schema.json` | Versioned JSON Schema of the per-key/surface/platform data manifest | R1, R8 |
| `SPEC-01-manifest-fixture.json` | Synthetic fixture (no real PII) covering all edge cases | R1, R8 |
| `SPEC-02-erasure.md` | Resumable erasure saga: state machine, per-store journal, crash/rollback semantics | R4, R9, R10 |
| `SPEC-03-export-envelope.md` | Normative encrypted export envelope: canonicalization, algorithms, limits, atomic IO | R12 |
| `SPEC-04-consent-receipt.md` | Consent receipt: canonicalization, anti-tamper, exact withdrawal effect | R5, R14 |
| `COMPLIANCE-MATRIX.md` | Traceability of every finding R1–R15 → document/section → status | R1–R15 |
| `TEST-MATRIX.md` | Mandatory contract tests for D1.1+ (real browser, real IPC/SQLite, crash, cross-version) | R6 |
| `OWNERS-RUNBOOK.md` | DRI, per-contract owners, rollback runbook per D1.1+ slice | R6, R15 |

Reading order for reviewers: README → COMPLIANCE-MATRIX (map of findings) → ADRs → SPECs →
TEST-MATRIX → OWNERS-RUNBOOK.

## 3. Roles

- **DRI (Hermes):** owns the correctness, internal consistency, and cross-references of this
  document set. Any contradiction between documents MUST be treated as a D1.0 defect and MUST block approval.
- **Themis (gate):** reviewed this deliverable over 3 rounds. Themis approval of the *documents*
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
   is documented as the *problem* the contract resolves, not as delivered behavior.
7. **ADR status:** every ADR terminates with `Status: Proposed (awaiting Themis gate + user
   final approval)`.

## 5. Block declaration (binding until approval)

> **D1.1+, all runtime work, and D5 are BLOCKED** until the user grants final approval of this
> document set. Themis sanction (3 rounds, R1–R15 addressed) authorizes *production of the
> documents*, not adoption of the contracts. No code, test, dependency, or workflow change
> derived from these contracts MUST NOT land before approval. Upon approval, implementation follows
> the slice plan in `OWNERS-RUNBOOK.md` §4 and the mandatory tests in `TEST-MATRIX.md`.

## 6. Current-state facts these contracts build on

These facts were verified against the codebase at the D1.0 base commit and are the *inputs* the
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
