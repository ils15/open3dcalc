# Deepwork D1.1 S5 — Export envelope v1.1, producer + consumer (SPEC-03)

- **Branch/worktree:** `feat/d1-s5-export-envelope` / `../open3dcalc-d1-s5-envelope`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** SPEC-03 export envelope v1.1 — producer and
  consumer (canonical JSON plaintext, SHA-256 digest, PBKDF2-SHA256 exactly 310k,
  AES-256-GCM with the header bound as AAD, §7 limits, strict unknown-field and
  unknown-version rejection), wired into the sync UI (export always encrypted; import
  accepts v1.1 + legacy v1.0 per §8). No contract documents modified (no policy bump).
- **Base:** `main` @ `4929271` (includes PR #111 D1.1 S4 and the node_modules
  symlink repair).

## What landed in this slice

- `src/shared/lib/exportEnvelope.ts` — normative v1.1 envelope:
  - producer enforces §7 limits (50,000 records / 50 MiB) BEFORE encrypting and
    refuses passwordless exports (§1: the user export is always encrypted);
  - consumer validates strictly per §5: strict header field allowlist (unknown
    fields ⇒ reject), parameter allowlist (§4), GCM auth with the AAD binding
    (wrong password and tamper indistinguishable), digest verification over the
    canonical plaintext, then limits, then parse;
  - unknown versions (0.9, 9.9, anything ≠ 1.1) rejected without best-effort
    parsing (§7/§8);
  - canonicalization is a documented RFC 8785-equivalent (sorted keys, ECMAScript
    number serialization, no whitespace, UTF-8) with vector tests (§3).
- `src/shared/lib/dataSync.ts` — `exportData` produces the v1.1 envelope
  (PASSWORD_REQUIRED without a password); `importData` routes v1.1 envelopes
  through the new consumer and legacy `1.0` bundles through the untouched §8 path;
  `isEncrypted` recognizes v1.1. The legacy `exportBundle` producer remains only as
  the §8 import-compatibility baseline.
- `DataSyncModal` — export is always encrypted: the optional-encryption toggle is
  gone, the password field is always visible, and the export button stays disabled
  until a password is set (tests updated accordingly).
- §9 note: the browser envelope path materializes the full payload in memory and
  applies per-store after full validation (atomic per-store swaps — the documented
  §9 equivalent for the renderer; no partial file is ever produced by the blob
  download). File-system staging discipline lands with S6/S7 fs flows.

## Verification

- 1,344 tests across 102 files; typecheck, strict lint, desktop/web builds green.
- TEST-MATRIX §7 rows encoded: 7.1 (round-trip, byte-stable canonicalization),
  7.2/7.3/7.4 (tamper/wrong-password/corruption), 7.5 (downgrade), 7.6 (unknown
  fields), 7.7 (legacy 1.0 import honored via the untouched path; re-export
  produces 1.1), 7.8 (limits), 7.10 (password never logged). Coverage on the
  envelope module: 93.0% lines / 88.2% branches.
- Rollback (OWNERS-RUNBOOK §7): producer flag off ⇒ exports return to the legacy
  bundle path (kept intact); import keeps accepting 1.0 and 1.1 — never removes
  either.

**D1.1 S5 is pending Themis review. S6 (db:export reclassification) can proceed in
parallel; S7 (erasure saga) depends on S1+S2 and formalizes S4's elimination.**
