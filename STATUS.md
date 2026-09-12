# Deepwork D1.1 S7 — Erasure (delete-all) saga (SPEC-02)

- **Branch/worktree:** `feat/d1-s7-erasure-saga` / `../open3dcalc-d1-s7-erasure`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** SPEC-02 erasure saga — pure state-machine
  engine (prepared → snapshot_taken → deleting → committed | rolled_back) with a
  resumable per-store journal (atomic writes, attempts ≤3, no re-prompt), an
  encrypted TTL'd safety snapshot with the §5 rollback window, the §6 post-condition
  rescan (zero PII before commit), desktop + renderer store adapters, the erasure
  IPC surface, the delete-all flow in the privacy screen, and REAL crash-injection
  tests (SIGKILL-equivalent at exact durable journal points). Contract change:
  SPEC-01 fixture registers the web journal + snapshot keys and bumps
  `policy_version` 1.1 → 1.2 (per OWNERS-RUNBOOK §6).
- **Base:** `main` @ `9e57800` (includes PR #112 D1.1 S5, PR #113 D1.1 S6 and the
  node_modules repair).

## What landed in this slice

- `src/shared/lib/erasureSaga/` — pure engine (no Electron/DOM):
  - `engine.ts` — §2 state machine with a real commit point: commit only after
    every store row is `done` AND the §6 rescan finds zero PII; pre-commit
    unrecoverable failure ⇒ rollback (snapshot restore); impossible rollback
    (§5: capability denied / TTL expired / key lost) ⇒ completes `committed` with
    a `rollback_unavailable` annotation — never a silent partial state; the
    in_progress journal row is persisted BEFORE each purge (resume seam).
  - `journal.ts` (disk) / `webStores.ts` (localStorage) — metadata-only journal,
    atomic write-temp+fsync+rename.
  - `snapshot.ts` / `webStores.ts` — encrypted snapshot (capability-injected),
    TTL sweep on every entry into `deleting`, destroy-on-commit
    (overwrite+unlink / remove).
  - `rendererSweep.ts` — granular renderer adapters: localStorage (manifest keys +
    unknown `open3dcalc_*` sweep, R1), IndexedDB, OPFS, Cache API/SW.
- `electron/erasureStores.ts` + `electron/erasure.ts` — desktop adapters (domain
  tables, storage rows, WAL/SHM checkpoint+verify, appdata files, logs, staging,
  snapshots) with VACUUM after table deletion; safeStorage-backed snapshot
  capability; startup resume of non-terminal sagas.
- IPC `erasure:start`/`erasure:status` + preload + typed `electron.d.ts`.
- PrivacyScreen — "Delete all my data": renderer purges first, main saga covers
  the durable surfaces, §7 `external_copies_notice` shown on the completion
  receipt. i18n pt-BR/en-US.
- SPEC-01 fixture: `policy_version` 1.2; new web keys `open3dcalc_erasure_journal`
  (diagnostic) and `open3dcalc_erasure_snapshot` (class snapshot, encrypted at
  rest, 7-day retention).

## Verification (TEST-MATRIX §6)

- 6.1 happy path · 6.2 death after snapshot_taken ⇒ idempotent resume commits
  without re-prompt (journal durable, confirmation preserved) · 6.3 death mid-
  deleting (first store done) ⇒ resumes from the first incomplete store ·
  6.4 store failing 3× ⇒ rollback restores the snapshot payload · 6.5 post-erasure
  byte scan: zero PII markers in the SQLite file (VACUUM) · 6.6 TTL sweep +
  destroy-on-commit · 6.7 key lost ⇒ completes with `rollback_unavailable` ·
  6.8 rescan finding PII ⇒ store failed, never success.
- 1,366 tests across 107 files; typecheck (app + Electron), strict lint, builds.
- Rollback (OWNERS-RUNBOOK §7): the saga is user-triggered; rollback = disable the
  delete-all entry (flag) while journal+resume logic stays enabled (§7 S7 row).

**D1.1 S7 is pending Themis review. S8 (consent receipt, SPEC-04) depends on this
slice and is next.**
