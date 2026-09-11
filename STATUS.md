# Deepwork D1.1 S1 — SPEC-01 manifest loader + gated storage

- **Branch/worktree:** `feat/d1-s1-manifest-loader` / `../open3dcalc-d1-s1-manifest`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** SPEC-01 manifest loader + validation, manifest
  gate, gated storage wrappers, gate wiring into all localStorage writers, fixture
  registration of the runtime key set, contract tests (TEST-MATRIX §1 rows + S1 wiring).
  No other contract documents touched; `policy_version` bumped for the fixture edit.
- **Base:** `main` @ `cc90ae4` (includes PR #105 D0 fix and PR #106 D1.0 contracts).

## What landed in this slice

- `src/shared/lib/dataManifest.ts` — normative vocabularies mirrored from SPEC-01
  `$defs`, entry/document validation (TEST-MATRIX 1.2–1.11), loader with duplicate-key
  rejection, shipped-fixture loader, policy-version accessors, orphan-key enumeration.
- `src/shared/lib/manifestGate.ts` — fail-closed choke point: known keys pass with their
  full policy record; unknown keys throw `ManifestError` in dev and deny-safely in
  production; unreadable manifest denies everything; `isKeyAllowed` non-throwing variant
  for bulk paths. Logs carry key NAMES only (TEST-MATRIX 3.2).
- `src/shared/lib/manifestStorage.ts` — `manifestStorage()` (zustand `PersistStorage`
  drop-in) and `guardedStorage` (localStorage-shaped facade). Deny is a true no-op
  (reads return null, writes/removed are skipped); unavailable backing storage degrades
  to no-ops.
- Fixture (`SPEC-01-manifest-fixture.json`): `policy_version` 1.0 → 1.1; renamed
  `open3dcalc_migration_flags` → `open3dcalc_migration_done_v2` and
  `open3dcalc_quickstart_done` → `open3dcalc_quickstart_dismissed` to match shipped code;
  registered `open3dcalc_onboarded` and `i18nextLng` (i18next detector cache). 27 keys.
- Gate wiring: zustand persist stores (consent, customer, history, product, quote) via
  `manifestStorage()`; direct-localStorage writers (calculator store + helpers, catalog,
  filaments, tutorial, storeBridge, web/desktop App migration + onboarding + settings,
  Dashboard, QuickStartBanner, OnboardingModal, useTheme, theme-persistence, dataSync)
  via `guardedStorage`; desktop persistence-bridge gates SQLite↔localStorage copies and
  skips unknown keys without aborting the whole backup (fail-closed per key).

## Verification

- Contract tests: 35 tests across `dataManifest.test.ts` (loader + TEST-MATRIX 1.1–1.11),
  `manifestGate.test.ts` (deny paths, fail-closed, reset semantics) and
  `manifestStorage.test.ts` (pass-through, dev-throw, production safe-deny, no-value
  logging, SSR no-op). Coverage on the three contract modules: 94.6% / 91.9% / 96% lines
  (≥80% bar of TEST-MATRIX §9.1).
- Full suite: 1,275 passed across 92 files. Typecheck (app + Electron), lint, desktop and
  web builds passed. Build emits pre-existing Vite warnings only.
- `SPEC-01-manifest-fixture.json` validated against `SPEC-01-manifest.schema.json`
  (draft 2020-12) with `jsonschema`.

## Defects found and fixed during the slice

- Production fail-open: the original gate wrappers discarded `checkKey`'s decision and
  wrote anyway when it returned `{ allowed: false }` (production safe-deny path). Deny is
  now a real no-op; regression tests cover both environments.
- `guardedStorage` crashed when `window.localStorage` was unavailable (the zustand
  wrapper already degraded); facade now shares the same no-op fallback.

## Rollback (OWNERS-RUNBOOK §7)

Single-slice flag flip: reverting the branch returns stores to direct-key behavior; the
fixture remains a read-only document. No data migration happened in S1.

**D1.1 S1 is pending Themis review. S2 (crypto capability) is the next dependency-free
slice after S1 lands.**
