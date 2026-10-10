# ADR-002 — PII at Rest: Default-Deny and Legacy Plaintext Quarantine

## Policy 1.9 supersession — inert historical retention

Policy 1.9 supersedes the default-deny quarantine, inspection, purge, and migration lifecycle
described below. Historical vault bytes and other retired legacy targets are inert: the app
must not inspect, read, enumerate, convert, migrate, recover, or delete them, and no startup
scan or cleanup may touch them. They remain outside the current deletion scope and may remain
on disk indefinitely. This is retention without an automatic cleanup promise, not a guarantee
that the data is recoverable.

Current Stable/Desktop customer, quote, and history saves use the exact plaintext scope in
SPEC-01 policy 1.9 and require no local at-rest keyring, passphrase, vault, or consent gate.
By owner decision on 2026-10-10, Web Beta now shares the same three plaintext user-content keys
and migrates valid records from its retired `open3dcalc_beta_test_*` keys. Same-origin code can
access browser storage. All sections below are retained as historical context only where they
conflict with this superseding decision. Export behavior remains separate.

**Track:** D1 — Privacy & Data Contracts
**Status:** Superseded by approved policy 1.9; historical-data handling is inert retention
**Addresses findings:** R3 (PII at-rest), R11 (legacy plaintext quarantine)
**Related:** ADR-001 (crypto capability), SPEC-01 (manifest), SPEC-02 (erasure)

> **Historical D1.0 material below.** Sections 1–4 describe the former quarantine, migration,
> and default-deny proposal. They are not active requirements under policy 1.9; the supersession
> decision above governs current behavior.

## 1. Context

At the D1.0 base commit, Open3DCalc persists PII in plaintext across surfaces:

- `customers` (name, company, email, phone, address, notes) and `quotes` (including the
  `customerSnapshot` JSON blob) in SQLite domain tables;
- the mirrored `storage` table rows and `localStorage` keys (`open3dcalc_customers_v1`,
  `open3dcalc_quotes_v1`, `open3dcalc_history_v2`, …) that contain the same data;
- raw SQLite backups produced by `db:export` (see ADR-003);
- any logs, snapshots, or staging files that captured PII-bearing state.

LGPD (and any comparable regime) treats "we always did it this way" as a violation, not a
defense. This ADR defines the at-rest policy and the treatment of pre-existing plaintext.

## 2. Decision

### 2.1 Default-deny PII at rest

The standing policy for every write path, on every platform, from D1.1+ onward:

> **A PII-bearing value may be persisted at rest only if the write path can prove, at write
> time, that the value will be encrypted at rest under ADR-001's capability model. Any
> other outcome for PII is denied.**

Operationally:

- The SPEC-01 manifest is the single source of truth for which keys/tables are PII. A key
  not in the manifest is unknown ⇒ default-deny (SPEC-01 §4).
- Write paths consult the manifest (`pii`, `persistence`, `platforms`) before persisting.
  `persistence: "plaintext_allowed"` is only valid for `pii: false` keys (schema-enforced).
- PII with `persistence: "encrypted_at_rest"` requires an ADR-001 capability at write time;
  without one, the write is refused (fail-closed), never downgraded to plaintext.
- PII with `persistence: "memory_only"` never reaches disk in any form — including logs,
  crash dumps, analytics, and staging directories.

### 2.2 Legacy plaintext enters read-only QUARANTINE

Existing plaintext PII (created before D1.1 lands) is not migrated silently, not accepted
implicitly, and not left writable. It enters **quarantine**:

1. **Read-only:** quarantined plaintext PII is readable (so the user can see what exists and
   choose), but no new writes, updates, or appends to those records are allowed. The stores
   holding quarantined PII reject mutations to quarantined records.
2. **No new write/sync/export:**
   - No new plaintext writes anywhere (§2.1).
   - Quarantined data MUST be **excluded from sync** (`dataSync` bundles) and from the user
     logical export (SPEC-03) until it is migrated or eliminated.
   - The raw SQLite `db:export` path is reclassified by ADR-003 and, under quarantine, is
     additionally blocked from including quarantined plaintext rows unless redaction is
     applied (ADR-003 §3).
3. **Explicit user decision — migrate or eliminate:**
   - **Migrate:** the user triggers migration to encrypted-at-rest (ADR-001 capability
     required). Migration is per-surface, resumable, and atomic per record; the plaintext
     copy is destroyed only after the encrypted copy is verified readable.
   - **Eliminate:** the user triggers erasure of the quarantined data via the SPEC-02 saga
     (full delete across all surfaces, with receipt).
   - In both cases the **result is visible to the user**: a per-surface report of what was
     migrated/eliminated, what remains quarantined, and the final state. The migration/
     elimination flow ends with an explicit confirmation screen, not a silent background
     operation.
4. **An isolated warning is not sufficient.** Quarantine is a state, not a toast. The app
   must present the quarantine status (which surfaces hold legacy plaintext PII, counts,
   and the two available actions) in a dedicated privacy screen reachable from settings.
   Banner dismissal, tutorial completion, or any other flag never acknowledges or accepts
   plaintext (see SPEC-04: those flags can never satisfy consent).
5. **No implicit acceptance path.** There is no "continue as-is" button, no timeout that
   auto-accepts plaintext, no upgrade flow that silently re-labels plaintext as approved.
   The only exits from quarantine are migration and elimination, both explicit.

### 2.3 Quarantine state model (summary)

```
legacy_plaintext (detected at startup scan)
  └─> QUARANTINED (read-only, excluded from sync/export, surfaced in privacy screen)
        ├─ user chooses MIGRATE  ─> encrypted_at_rest (verified) ─> plaintext destroyed ─> DONE
        ├─ user chooses ELIMINATE ─> SPEC-02 erasure saga ─> receipt ─> DONE
        └─ user does nothing    ─> stays QUARANTINED (never auto-resolves)
```

Detection MUST be a startup scan of all manifest surfaces (SQLite tables, `storage` rows,
`localStorage` keys, IndexedDB/OPFS, Cache API, `userData` files) comparing found PII
against the manifest's expected encrypted form. The scan is the same rescan used as the
SPEC-02 post-condition, so it is implemented once and reused.

## 3. Consequences

- **Positive:** plaintext PII shrinks monotonically (no new writes; exits only via
  destruction); the user always knows the quarantine state; sync/export can never leak
  legacy plaintext; the policy is testable (TEST-MATRIX §4 quarantine tests).
- **Negative:** users with legacy data see degraded (read-only) PII features until they
  migrate or eliminate — accepted, since the alternative is implicit acceptance of a
  policy violation; migration requires an ADR-001 capability, so on deny-path platforms
  the only exit from quarantine is elimination.
- **Scope:** quarantine applies to PII only. Non-PII legacy data (preferences, flags,
  catalog) is unaffected and continues to work.

## 4. What D1.0 does NOT deliver

D1.0 is documentation. As of D1.0 the runtime still writes plaintext PII and has no
quarantine mechanism; this ADR obligates D1.1+ to implement the scan, the quarantine state,
and the two explicit exits. Nothing here claims current compliance.

## 5. Compliance trace

- R3 → §2.1 (default-deny, fail-closed, no plaintext path).
- R11 → §2.2 (read-only quarantine; no write/sync/export; migrate-or-eliminate with visible
  result; dedicated screen, not a warning; no implicit acceptance), §2.3 (state model).
- Cross-references: ADR-001 (capability required for migration), SPEC-01 (manifest as source
  of truth; default-deny for unknown keys), SPEC-02 (elimination path and rescan
  post-condition), SPEC-04 (flags never satisfy consent), TEST-MATRIX §4.

## Status

**Status:** D1.0 quarantine and migration proposal superseded by policy 1.9; historical vault
bytes remain outside current deletion scope.

## Superseded historical Beta test-only profile addendum

This addendum records the earlier test-only profile scope and is no longer current. Beta now
uses the same current user-content keys as Stable. The default-deny lifecycle below remains
historical for retired encrypted or migration stores; it does not block direct local saves or
the explicit Beta test-key migration described above.

This is not permission for plaintext personal data and does not relax Stable policy. The
Beta guard fails closed on Stable keys, unknown keys, unreadable fixtures, and
legacy-access attempts (betaFreshNamespace and betaIsolation suites). Final Themis review is
pending; no publication is authorized or performed.
