# Deepwork D1.1 S4 — Legacy quarantine state + privacy screen + migrate/eliminate (ADR-002)

- **Branch/worktree:** `feat/d1-s4-quarantine` / `../open3dcalc-d1-s4-quarantine`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** ADR-002 §2.2 legacy plaintext quarantine —
  quarantine state derived from the §2.3 scan (a PII key holding legacy plaintext is
  quarantined), read-only enforcement at the persistence gate, the two explicit exits
  (migrate with verify-then-destroy + VACUUM scrub; eliminate with verified absence),
  the quarantine/migrate/eliminate IPC surface, and the dedicated privacy screen
  (new nav tab, pt-BR/en-US i18n) reachable in the app. No contract documents modified
  (no policy bump): the state needs no new storage key — it is derived from the scan.
- **Base:** `main` @ `26eb0d3` (includes PR #110 D1.1 S3).

## What landed in this slice

- `electron/quarantine.ts` — state machine per ADR-002 §2.3:
  `legacy_plaintext ⇒ QUARANTINED` (read-only, never auto-resolves);
  MIGRATE encrypts through the ADR-001 capability, replaces the row, verifies the
  encrypted copy reads back identical, and only then considers the plaintext
  destroyed — with `VACUUM` scrubbing freed pages (physical destruction; WAL/SHM
  handling is finalized by the SPEC-02 saga in S7). ELIMINATE deletes the quarantined
  rows and verifies absence. Migration restores the plaintext row if verification
  fails — data loss is impossible by construction. Deny-path platforms can only
  eliminate (no capability ⇒ migration refused).
- `electron/persistGate.ts` — §2.2.1 read-only enforcement: gated writes over a
  quarantined key are refused (`quarantined_read_only`) until the user acts; writes
  over encrypted or non-PII keys are unaffected.
- IPC + preload + types: `privacy:quarantine-report`, `privacy:migrate-key`,
  `privacy:eliminate-key` (all metadata-only in logs).
- `PrivacyScreen` (`src/shared/components/Privacy/`) — new "Privacy" nav tab: lists
  quarantined keys with record counts, offers migrate/eliminate with confirmations,
  shows per-action results, never renders quarantined VALUES (metadata only), and
  degrades to a desktop-only notice on web. i18n keys in pt-BR + en-US
  (TEST-MATRIX §9.2).

## Verified by the real-Electron self-test (no mocks, real SQLite file)

- Quarantined key detected (with record count); gated write over it REFUSED.
- MIGRATE: row becomes ciphertext, reads back verified, plaintext physically gone.
- ELIMINATE: second planted legacy key deleted, absence verified.
- After both exits the quarantine report is empty and the DB-file byte scan finds
  ZERO occurrences of the synthetic PII marker (S3 left exactly the planted rows;
  S4's explicit flows destroyed them).

## S5+ boundary

Sync/export exclusion of quarantined data becomes enforceable where those flows are
reclassified: SPEC-03 envelope replaces the legacy bundle in S5 (quarantined
localStorage data never reaches it — the legacy bundle keeps its own S7-era
treatment), and ADR-003 gates the raw `db:export` in S6. The SPEC-02 saga (S7)
absorbs the per-key elimination performed here into the resumable cross-surface
flow with receipts.

## Verification

- 1,332 tests across 101 files; typecheck (app + Electron), lint, desktop/web
  builds, pre-push gate — all green.
- Coverage on the S4 contract modules: 87.9% lines / 84.6% branches.
- Rollback (OWNERS-RUNBOOK §7): revert — the screen disappears and the gate stops
  refusing quarantined writes; no data migration happens without explicit user
  action, so nothing needs reversing.

**D1.1 S4 is pending Themis review. S5 (export envelope v1.1) and S6 (db:export
reclassification) can proceed in parallel; S7 (erasure saga) depends on S1+S2 and
absorbs S4's elimination into the full saga.**
