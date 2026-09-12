# Deepwork D1.1 S2 — Crypto capability layer (ADR-001)

- **Branch/worktree:** `feat/d1-s2-crypto-capability` / `../open3dcalc-d1-s2-crypto`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** crypto capability layer per ADR-001 —
  capability decision engine, at-rest passphrase envelope (SPEC-03 parameters),
  memory-only passphrase session, main-process safeStorage/envelope/deny wiring,
  capability IPC (main + preload + renderer types), and the real-Electron contract
  harness (TEST-MATRIX §2 rows 2.1–2.3 + §3.1-style zero-plaintext scan). No contract
  documents modified (no policy bump); no new storage keys (the session passphrase is
  surface `memory`, already declared as `session_passphrase_key` in SPEC-01).
- **Base:** `main` @ `0cc4718` (includes PR #107 D1.1 S1 and PR #108 cleanup).

## What landed in this slice

- `src/shared/lib/crypto/capability.ts` — pure ADR-001 §2.3 decision table
  (`safe_storage` / `passphrase` / `denied`) with fail-closed semantics: missing,
  failed, or ambiguous probes resolve to `denied`, never to a plaintext path.
- `src/shared/lib/crypto/envelope.ts` — at-rest passphrase envelope using the
  normative SPEC-03 parameters: AES-256-GCM (128-bit tag), PBKDF2-SHA256 with exactly
  310,000 iterations, 128-bit salt, 96-bit IV, canonical-JSON AAD binding
  (purpose + key name). Wrong-passphrase, tamper, unknown-version, and parameter-drift
  all reject with the same indistinguishable error. Web Crypto only — runs unchanged
  in Electron main, web renderer, and tests.
- `src/shared/lib/crypto/passphraseSession.ts` — memory-only session passphrase
  (SPEC-01 `session_passphrase_key`: surface `memory`, sync never, export never),
  best-effort zeroize, no storage/log surface ever touched.
- `electron/cryptoCapability.ts` — main-process layer: fail-closed safeStorage probe,
  prefixed blob formats (`enc1:safeStorage:` / `enc1:envelope:`), `encryptForStorage`
  / `decryptFromStorage`, deny path (`CryptoDeniedError`), and
  `CRYPTO_WRITE_PATH_ENABLED` rollback flag (flip disables NEW encrypted writes; the
  decrypt path stays enabled per OWNERS-RUNBOOK §7). Legacy/unknown blobs raise
  `UnknownBlobError` — they belong to the ADR-002 quarantine (S4), never silently
  re-read or re-encrypted.
- IPC surface: `crypto:capability`, `crypto:set-passphrase` (passphrase adopted into
  main-process memory only — never echoed, persisted, or logged), `crypto:lock`
  (zeroize), plus zeroize on `before-quit`; exposed via `preload.cts` as
  `window.electronAPI.crypto` and typed in `electron.d.ts`.
- `electron/selftest/crypto-selftest.ts` + `electron/__tests__/crypto.selftest.test.ts`
  — real-Electron contract harness (TEST-MATRIX §0): spawns the actual Electron binary,
  writes through the layer into a real better-sqlite3 temp DB, and raw-scans the file
  bytes for the synthetic PII marker.

## Verification

- Unit/contract tests (real Web Crypto, no mocks): envelope round-trip + SPEC-03
  parameter assertions, randomness, AAD drift, indistinguishable rejection, decision
  table rows 1–6 + fail-closed, session memory-only/zeroize/no-storage/no-log.
- Real-Electron self-test (this environment has no keyring, so rows 2.2/2.3 execute;
  row 2.1 runs wherever `safeStorage` is available): envelope blob written and
  round-tripped, deny path refused, `plaintextHitsInDbFile: 0` on the real DB file.
- Coverage on the contract modules: 96.8% lines / 86.1% branches (capability and
  passphraseSession at 100%).
- Full suite: 1,303 passed across 95 files. Typecheck (app + Electron), lint, desktop
  and web builds green.

## S3 boundary

S3 wires `encryptForStorage`/`decryptFromStorage` into the `db:save`/`db:load` write
and read paths (per-key, manifest `pii` flag) plus the startup scan. This slice
deliberately does not change any persisted byte: no migration, rollback is a revert.

**D1.1 S2 is pending Themis review. S3 (PII at-rest encryption on write paths) and
S5/S6 may proceed after S2 lands.**
