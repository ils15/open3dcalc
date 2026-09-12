# Deepwork D1.1 S6 — db:export reclassification: dev gate, redaction, retention (ADR-003)

- **Branch/worktree:** `feat/d1-s6-dbexport` / `../open3dcalc-d1-s6-dbexport`
- **Status:** implementation complete — local gates green; awaiting Themis review (PR next).
- **Scope (OWNERS-RUNBOOK §6 declared):** ADR-003 §2.2 — the raw SQLite `db:export`
  reclassified as an engineering/diagnostic backup: explicit diagnostic gate
  (fail-closed), manifest-driven redaction mode, retention sidecars, and the
  retention/disposal tooling script (OWNERS-RUNBOOK §5). No user-facing UI entry
  existed or returns. No contract documents modified (no policy bump).
- **Base:** `main` @ `9e57800` (includes PR #112 D1.1 S5).

## What landed in this slice

- `electron/diagnosticGate.ts` — authorized-access gate (§2.2.1): `--diagnostic`
  CLI switch or `OPEN3DCALC_DIAGNOSTIC=1`; fail-closed by default in production
  builds and un-flagged dev runs.
- `electron/diagnosticBackup.ts` — the gated backup operation (§2.2.2/§2.2.4):
  non-redacted straight copy (PII-bearing, 14-day retention sidecar written);
  redaction mode stages a copy, masks every manifest-`pii` storage row (unknown
  keys fail-closed as PII), strips the PII domain tables, `VACUUM`s so masked
  content is not retained in free pages, then atomically renames. Every backup
  writes a `<target>.meta.json` sidecar (createdAt, redacted, retentionDays).
- `main.ts` — `db:export` handler refuses without the gate, delegates to the
  diagnostic module, and the save dialog is retitled as an engineering artifact.
  No renderer UI invokes it (verified: zero `exportDatabase` call sites in src).
- `scripts/diagnostic-retention.mjs` (+ npm `diagnostic:retention`) — retention
  tooling (§2.2.4 / OWNERS-RUNBOOK §5): CHECK mode flags unredacted backups past
  their deadline and exits 1 (CI-failing); `--dispose` securely destroys them
  (overwrite with zeros + unlink, sidecar included) and appends a metadata-only
  line to `diagnostic-disposal.log`. Sidecar-less files are fail-closed (judged
  unredacted, aged by mtime).
- User export remains the SPEC-03 envelope only (§2.1): quarantined/excluded
  policies continue to apply there.

## Verification (TEST-MATRIX §5)

- 5.1: without the gate the handler refuses — no artifact is written.
- 5.2: with the gate, an unredacted backup lands locally with the retention
  sidecar; the module performs zero network I/O (local file only, §2.2.3).
- 5.3: redacted backup masks manifest-PII storage rows (`[REDACTED]`), leaves
  non-PII rows intact, strips the domain tables, and the marker is provably gone
  from the file bytes.
- 5.4: the retention script flags unredacted backups past 14 days (exit 1) and
  `--dispose` removes them with an audit log; redacted backups are retained.
- 1,350 tests across 104 files; typecheck (app + Electron), strict lint, builds.
- Rollback (OWNERS-RUNBOOK §7): flag off ⇒ previous behavior returns — requires
  user sign-off per the runbook (re-exposes raw PII copy); the preferred path is
  keeping the gate and fixing forward.

**D1.1 S6 is pending Themis review. S7 (erasure saga, SPEC-02) is next; S8
(consent receipt, SPEC-04) depends on S7.**
