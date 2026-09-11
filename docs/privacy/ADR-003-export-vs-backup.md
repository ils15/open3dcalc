# ADR-003 — User Export vs. Engineering Backup

**Track:** D1 — Privacy & Data Contracts
**Status:** Proposed (awaiting Themis gate + user final approval)
**Addresses findings:** R2 (export lógico vs raw), R13 (raw SQLite diagnóstico)
**Related:** SPEC-01 (manifest), SPEC-03 (export envelope), ADR-002 (quarantine)

## 1. Context

Open3DCalc currently has two data-egress paths that are conflated:

1. **`dataSync.ts` export bundle** — a client-side, optionally-encrypted JSON bundle
   (`open3dcalc-export`, version `1.0`) with a defined field set (settings, history,
   customers, quotes, catalog, filaments, products, theme, dashboard, sections). This is a
   *logical* export: it is structured, versioned, filterable, and can exclude data by
   policy.
2. **`db:export` (Electron IPC)** — a raw file copy of the SQLite database (after
   `wal_checkpoint(TRUNCATE)`), exposed through a user-facing save dialog
   ("Exportar Banco de Dados"). This is a *physical* backup: it contains every table,
   every column, every PII field, WAL internals, and any legacy plaintext — with no
   filtering, no redaction, and no envelope.

Treating (2) as a user export is the problem: a raw SQLite file is not a governed egress
artifact. It is a forensic/diagnostic image of the entire persistence layer.

## 2. Decision

### 2.1 User export = logical envelope (SPEC-03)

The **only** user-facing export is the logical export defined by SPEC-03:

- Content is derived from the SPEC-01 manifest: each manifest key contributes its data
  only if its `export` policy allows (`user_export`).
- PII is included only in encrypted form inside the SPEC-03 envelope (ADR-001 capability
  or passphrase-derived key; the envelope's own crypto parameters apply).
- Quarantined legacy plaintext (ADR-002) is **excluded** from user export until migrated
  or eliminated.
- The envelope is versioned, canonicalized, integrity-protected, and importable by the
  same app across versions (SPEC-03 §8 cross-version rules).

### 2.2 Raw SQLite `db:export` is reclassified as an ENGINEERING/DIAGNOSTIC backup

From D1.1+ onward, `db:export` (or its successor) is **not** a user feature:

1. **Authorized access only (dev flag):** the handler is gated behind an explicit
   development/diagnostic flag (e.g., `--diagnostic` CLI switch or a build-time dev gate),
   off by default in production builds. In production, the user-facing menu entry is
   removed; the IPC handler refuses to run without the gate.
2. **Possible redaction:** the diagnostic backup SHOULD support a redaction mode that
   strips or masks PII columns/rows (per SPEC-01 `pii` flags) before the file is written.
   When redaction is not applied, the artifact is treated as PII-bearing (see §2.3).
3. **Forbidden from user/sync/upload flows:**
   - It MUST NOT appear in any user-facing UI, onboarding, help, or sync flow.
   - It MUST NOT be attached to the sync/export pipeline, uploaded anywhere (telemetry,
     crash reports, support tickets), or transmitted by any automated means.
   - Its output path is a local file chosen by the operator running the diagnostic, never
     an app-managed upload.
4. **Defined retention and secure disposal:**
   - Because the file contains PII (or redaction must be provable), the operator following
     it MUST record: creation date, retention period, and disposal method.
   - Default retention: **14 days** maximum for unredacted diagnostic backups, after which
     the runbook (OWNERS-RUNBOOK §5) mandates secure deletion (overwrite + unlink; on
     supported filesystems, `srm`-class tooling or equivalent).
   - Disposal is logged (date, file, method) in the diagnostic log kept next to the
     engineering runbook — the log records metadata only, never PII.
   - Redacted backups may be retained longer per engineering need, but the redaction must
     be verified before the extended retention applies.

### 2.3 Classification table

| Artifact | Classification | Audience | PII handling | Transport | Retention |
|----------|---------------|----------|--------------|-----------|-----------|
| SPEC-03 export envelope | User logical export | End user | Encrypted inside envelope; quarantine excluded | User-mediated file transfer only | User-controlled |
| Raw SQLite copy (`db:export`) | Engineering/diagnostic backup | Authorized operators (dev flag) | PII-bearing unless redacted | **Never** uploaded/synced; local file only | ≤14 days unredacted (secure disposal logged); longer only if redaction verified |

## 3. Consequences

- **Positive:** the only user-reachable egress is governed, versioned, and encrypted; raw
  PII images stop flowing through a user-facing dialog; retention/disposal of diagnostic
  images becomes auditable; the reclassification is testable (TEST-MATRIX §5: production
  build must not expose `db:export`; dev gate must require the flag).
- **Negative:** engineering loses a one-click full backup in production builds — accepted;
  operators must use the dev flag and follow retention rules; support workflows that relied
  on "send me your database" are now forbidden (users send the SPEC-03 envelope instead,
  which support cannot read without the user's passphrase — by design).
- **Migration:** the existing user-facing entry point for `db:export` is removed in the
  D1.1+ slice that implements this ADR; release notes must state the replacement (SPEC-03
  export) explicitly.

## 4. What D1.0 does NOT deliver

D1.0 is documentation. As of D1.0, `db:export` remains a user-facing raw copy — that is the
gap this ADR obligates D1.1+ to close (reclassify, gate, redact, retain, dispose). Nothing
here claims the reclassification has already happened.

## 5. Compliance trace

- R2 → §2.1 (user export is the SPEC-03 logical envelope only), §2.2 (raw copy out of user
  flow).
- R13 → §2.2 items 1–4 (dev flag, redaction, no user/sync/upload, retention + secure
  disposal), §2.3 table.
- Cross-references: SPEC-01 (`export: never|user_export|diagnostic_only`), SPEC-03
  (envelope), ADR-002 (quarantine exclusion), TEST-MATRIX §5, OWNERS-RUNBOOK §5 (disposal
  runbook).

## Status

**Status: Proposed (awaiting Themis gate + user final approval)**
