# TEST-MATRIX — Mandatory Contract Tests for D1.1+

**Track:** D1 — Privacy & Data Contracts
**Status:** Normative for D1.1+ (D1.0 specifies; D1.1+ implements and must pass)
**Addresses finding:** R6 (DRI/testes)
**Related:** every SPEC/ADR in this directory

These are **contract tests**: they verify the contracts in this directory against real
platforms — not mocks. A D1.1+ slice is not done until its rows here pass. Coverage of the
**critical paths** (crypto, erasure, envelope, consent, quarantine) MUST exceed **80%**
(measured on the modules implementing the contracts; line/branch coverage via the repo's
existing tooling).

## 0. Global rules

- Real browser (Chromium via Playwright) for web/PWA rows; real Electron (packed or
  `electron --run-as-node` harness with the real `main.ts` handlers) for desktop rows.
- No mocking of: Web Crypto, `safeStorage`, SQLite, the filesystem, or IPC. Mocks are
  allowed only for the UI shell around the contract.
- Every test names the contract clause it verifies (e.g., `SPEC-02 §5`).
- Fixtures use synthetic data only (reserved domains, placeholder names) — never real PII.

## 1. Manifest schema validation (SPEC-01)

| # | Test | Expected |
|---|------|----------|
| 1.1 | Fixture (`SPEC-01-manifest-fixture.json`) validates against `SPEC-01-manifest.schema.json` | passes |
| 1.2 | `persistence: plaintext_allowed` + `pii: true` | rejected |
| 1.3 | `legal_basis: not_personal_data` + `pii: true` | rejected |
| 1.4 | `class: onboarding_flag` with `sync: opt_in` or `export: user_export` | rejected |
| 1.5 | `class: consent_record` with `export != never` | rejected |
| 1.6 | `class: snapshot` with `sync != never` or `persistence: plaintext_allowed` | rejected |
| 1.7 | `class: ephemeral_key` with `persistence != memory_only` | rejected |
| 1.8 | `class: diagnostic` with `export: user_export` | rejected |
| 1.9 | Unknown `persistence`/`sync`/`export`/`erasure` value | rejected |
| 1.10 | Missing any required field; extra field; empty `platforms` | rejected |
| 1.11 | Duplicate `key` across entries | rejected (uniqueness enforced by loader) |

(1.2–1.11 were verified against the D1.0 schema during production — 13/13 correct
outcomes; D1.1+ must encode them as automated tests.)

## 2. Crypto capability matrix (ADR-001)

| # | Test | Expected |
|---|------|----------|
| 2.1 | Electron with `safeStorage` available: write PII key | value in SQLite is `safeStorage` ciphertext; decrypt round-trips |
| 2.2 | Electron, `safeStorage` unavailable, passphrase provided | PII written encrypted (SPEC-03 params); passphrase never on disk (scan `userData` + logs for passphrase bytes) |
| 2.3 | Electron, `safeStorage` unavailable, no passphrase | PII write **refused**; feature degrades to memory-only; non-PII writes unaffected |
| 2.4 | Web, secure context, passphrase | PII in `localStorage`/IndexedDB is AES-256-GCM ciphertext |
| 2.5 | Web, secure context, no passphrase | PII blocked (memory-only at most) |
| 2.6 | Web, insecure context (HTTP on LAN IP) | PII blocked; non-PII keys work |
| 2.7 | Capability probe fails/ambiguous | resolves to DENIED (fail-closed), never plaintext |

## 3. Deny-path and zero-plaintext (ADR-001/ADR-002)

| # | Test | Expected |
|---|------|----------|
| 3.1 | Attempt every write path with PII while denied | no PII bytes on any surface (grep SQLite file, `userData`, `localStorage` dump for fixture PII markers) |
| 3.2 | Logs during PII operations | zero PII substrings in log files |
| 3.3 | Crash dump during PII operation | no PII in crash artifacts |

## 4. Quarantine (ADR-002)

| # | Test | Expected |
|---|------|----------|
| 4.1 | Seed legacy plaintext PII; startup scan | detected; quarantined; surfaced in privacy screen with counts |
| 4.2 | Mutate quarantined record | rejected (read-only) |
| 4.3 | Sync/export with quarantined data | quarantined data excluded from bundle/envelope |
| 4.4 | Migrate flow (capability available) | encrypted copy verified readable, then plaintext destroyed; report shows per-surface result |
| 4.5 | Eliminate flow | SPEC-02 saga runs; receipt; quarantine empty |
| 4.6 | No action | stays quarantined across restarts; never auto-resolves; no implicit acceptance path exists (no UI element accepts plaintext) |

## 5. Export vs backup (ADR-003)

| # | Test | Expected |
|---|------|----------|
| 5.1 | Production build | no user-facing `db:export` entry; IPC handler refuses without dev gate |
| 5.2 | Dev flag set | diagnostic backup possible; file lands locally; no upload/sync path exists (assert no network call during/after) |
| 5.3 | Redaction mode | PII columns masked per manifest; verify by scanning output |
| 5.4 | Retention | unredacted diagnostic older than 14 days flagged by runbook check script (OWNERS-RUNBOOK §5) |

## 6. Erasure saga (SPEC-02)

| # | Test | Expected |
|---|------|----------|
| 6.1 | Happy path | `prepared → snapshot_taken → deleting → committed`; post-condition rescan finds zero PII keys on all 11 stores (§3) |
| 6.2 | Crash after `snapshot_taken` (kill -9) | restart resumes idempotently; already-deleted stores stay done; saga completes; no re-prompt |
| 6.3 | Crash mid-store (kill -9 during `deleting`) | journal shows per-store state; resume from first incomplete store |
| 6.4 | Store failure (e.g., locked SQLite) before commit point | retries (≤3) then rollback: snapshot restored; state `rolled_back`; user-visible error |
| 6.5 | WAL/SHM after erasure | `-wal`/`-shm` empty or removed; no recoverable pages (attempt raw scan of files for PII markers) |
| 6.6 | Snapshot lifecycle | encrypted at rest; TTL honored (expired ⇒ destroyed on next load); destroyed after commit (file absent + journal records destruction) |
| 6.7 | Ephemeral key lost (passphrase fallback) after failure | rollback impossible; terminal state `committed` with `rollback_unavailable` annotation; user warned (pre-confirmation warning present in `prepared`) |
| 6.8 | Post-condition with planted PII (simulate missed store) | rescan fails ⇒ store marked failed ⇒ no commit; never success with PII remaining |
| 6.9 | Receipt | completion receipt includes `external_copies_notice` (SPEC-02 §7) |

## 7. Export envelope (SPEC-03)

| # | Test | Expected |
|---|------|----------|
| 7.1 | Round-trip export→import (same version) | byte-stable canonical plaintext; digest matches |
| 7.2 | Tampered header (any field) | GCM auth fails (AAD binding) ⇒ reject |
| 7.3 | Wrong password | reject; error indistinguishable from tamper |
| 7.4 | Corrupted ciphertext (flip 1 byte) | reject |
| 7.5 | Downgrade/unknown version (`0.9`, `9.9`) | reject, no best-effort parse |
| 7.6 | Unknown header/payload field | reject |
| 7.7 | Legacy `1.0` bundle import | accepted (100k iterations honored); re-export produces `1.1` |
| 7.8 | Oversized payload (>50k records or >50 MiB) | refused on export and import |
| 7.9 | Path traversal/symlink in staging | rejected; `O_NOFOLLOW` semantics; no write outside staging |
| 7.10 | Password handling | password absent from argv, env, logs, journal (scan all four) |
| 7.11 | Crash mid-import (kill -9) | next startup discards staging entirely; live stores untouched |
| 7.12 | Crash mid-export | no partial final file; temp removed on restart |
| 7.13 | Cross-version matrix: export on N, import on N±1 supported versions | per §8 table |

## 8. Consent receipt (SPEC-04)

| # | Test | Expected |
|---|------|----------|
| 8.1 | Consent flow | receipt stored encrypted; digest valid; `policy_hash` = SHA-256 of canonical current policy |
| 8.2 | Tamper receipt (flip byte) | digest mismatch ⇒ invalid ⇒ default-deny; re-consent required |
| 8.3 | Flags-only state (tutorial/onboarded/migration/quickstart set, no receipt) | consent NOT given; PII gated |
| 8.4 | Withdrawal | consent-basis keys erased per manifest (`erase_on_delete_all` deleted; `retain_anonymized` anonymized); non-consent keys untouched; receipt annotated `withdrawn_at`; completion receipt with `external_copies_notice` |
| 8.5 | Policy version change | mismatch detected; re-consent required for delta; old receipt retained |
| 8.6 | Receipt sync/export | never leaves device (absent from bundles/envelopes) |

## 9. Cross-cutting

| # | Test | Expected |
|---|------|----------|
| 9.1 | Critical-path coverage (crypto, erasure, envelope, consent, quarantine modules) | >80% line/branch |
| 9.2 | i18n | all new user-facing strings via i18n keys (pt-BR + en-US), per repo conventions |
| 9.3 | No real PII in any test fixture | grep for real-looking names/emails fails; only synthetic markers |

## 10. D1.1+ slice gating

A slice may merge only when: (a) its rows above pass in CI, (b) coverage ≥80% on critical
paths, (c) Themis review passes, and (d) the diff matches the slice's declared scope
(OWNERS-RUNBOOK §6). Partial passes block the slice — no "follow-up" test debt on
contract rows.
