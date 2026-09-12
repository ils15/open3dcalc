# Deepwork D1.1 S3 — PII encryption on write paths + startup scan (ADR-002)

- **Branch/worktree:** `feat/d1-s3-pii-encryption` / `../open3dcalc-d1-s3-pii`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** ADR-002 §2.1 default-deny enforced at the
  desktop storage write path (`db:save`/`db:load` gated per-key by the SPEC-01
  manifest `pii` flag through the S2 capability layer), the ADR-002 §2.3 startup
  legacy-plaintext scanner (same classifier the SPEC-02 saga will reuse), the
  `privacy:scan-report` IPC, and the dataManifest/shippedManifest module split that
  lets the main process consume the manifest without an ESM JSON import. Packaging
  ships the fixture inside the asar. No contract documents modified (no policy bump).
- **Base:** `main` @ `f6c8734` (includes PR #109 D1.1 S2).

## What landed in this slice

- `electron/persistGate.ts` — the write-path choke point: unknown keys are denied
  (SPEC-01 default-deny), non-PII keys pass through (plaintext_allowed only for
  pii:false, schema-enforced), PII keys go through `encryptForStorage` and the write
  is REFUSED when no ADR-001 capability exists (fail-closed, never downgraded).
  Loads decrypt capability blobs; legacy plaintext stays READABLE
  (ADR-002 §2.2.1) and is classified as `legacy_plaintext` for the S4 quarantine.
- `electron/legacyScan.ts` — ADR-002 §2.3 startup scanner: classifies every storage
  row against the manifest's expected encrypted form, counts the plaintext domain
  tables (customers/quotes/quote_items), and produces a METADATA-ONLY report
  (key names + counts, never values — TEST-MATRIX §3.2).
- `electron/manifestSource.ts` — main-process manifest loader via fs with
  dev/packaged/self-test candidate paths (fail-closed: unreadable fixture denies
  every key).
- `main.ts` — `db:save`/`db:load` now route through the gate; the scan runs at
  startup (metadata-only summary logged) and on demand via `privacy:scan-report`;
  `preload.cts` exposes `window.electronAPI.privacy.scanReport` (typed in
  `electron.d.ts`).
- `src/shared/lib/dataManifest.ts` / `shippedManifest.ts` split — pure validation
  stays importable by the compiled main process (node16 ESM cannot execute a static
  JSON import); the renderer keeps the same S1 API via `manifestGate`.
- `package.json` (electron-builder `files`) — ships the SPEC-01 fixture inside the
  asar so the packaged main process reads the same manifest file.

## Verified by the real-Electron self-test (no mocks, real SQLite file)

- Gated PII write lands as ciphertext (`enc1:*` prefix); gated load round-trips.
- Unknown keys are refused and never written; non-PII passes through as plaintext.
- Deliberately planted legacy plaintext row: readable through the gate, flagged by
  the scanner (`legacyCount`/key names in report), and the DB-file byte scan shows
  the synthetic marker ONLY in that planted row — every gated write stayed
  ciphertext.

## S4 boundary

Renderer localStorage keeps working as today (plaintext working cache); its
encrypted-at-rest wiring plus the quarantine state machine (read-only enforcement,
sync/export exclusions, privacy screen, passphrase UX, migrate/eliminate flows) is
S4. Domain tables have no runtime writers today; the scan counts their rows so any
future writer is automatically covered.

## Verification

- 1,319 tests across 96 files; typecheck (app + Electron), lint, desktop/web builds.
- Coverage on the S3 contract modules: 88.3% lines / 84.1% branches.
- Rollback (OWNERS-RUNBOOK §7): revert — no data migration happened; values written
  encrypted under this slice remain readable only via the gate (decrypt path kept).

**D1.1 S3 is pending Themis review. S4 (quarantine + privacy screen) is next.**
