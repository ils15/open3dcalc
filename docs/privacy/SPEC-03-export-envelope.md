# SPEC-03 — Export Envelope (Normative)

**Track:** D1 — Privacy & Data Contracts
**Status:** Normative for D1.1+ (D1.0 is documentation only)
**Addresses findings:** R12 (envelope normativo completo), R2 (export lógico vs raw)
**Related:** ADR-001 (crypto), ADR-003 (export vs backup), SPEC-01 (manifest)

## 1. Goal

The user export is a single, fully-specified, encrypted envelope. Any two implementations
of this spec (across app versions and platforms) must produce interoperable envelopes and
must reject anything malformed, downgraded, or hostile — without ever leaking the password
or writing partial state.

## 2. Envelope structure

```json
{
  "format": "open3dcalc-export",
  "version": "1.1",
  "kdf": { "algorithm": "PBKDF2-SHA256", "iterations": 310000, "salt_hex": "<128-bit>" },
  "cipher": { "algorithm": "AES-256-GCM", "iv_hex": "<96-bit>", "tag_bits": 128 },
  "aad": { "format": "open3dcalc-export", "version": "1.1", "policy_version": "1.0" },
  "integrity": { "algorithm": "SHA-256", "plaintext_digest_hex": "<digest of canonical plaintext>" },
  "limits": { "records": 50000, "bytes": 52428800 },
  "payload": { "ciphertext_base64": "..." }
}
```

- `format` MUST be the constant `open3dcalc-export` (existing convention).
- `version`: **minimum supported** `1.0` (the current `dataSync` bundle, accepted for
  import); **current** `1.1` (this spec). The envelope declares the version it was
  produced with; importers accept `1.0` and `1.1` only (§8).
- `aad` is the Additional Authenticated Data: the exact canonical JSON of
  `{format, version, policy_version}` — it cryptographically binds the header to the
  ciphertext (tampering with any header field fails decryption, §5).

## 3. Canonicalization

- **Canonical JSON:** [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785) MUST be used as the
  normative canonicalization. Where a runtime lacks an RFC 8785 library, an equivalent may
  be used **only if documented** in the implementation notes with a test vector proving
  byte-identical output to JCS for: object key sorting (UTF-16 code unit order), number
  serialization (ECMAScript `Number::toString`), no whitespace, UTF-8 output.
- Canonicalization applies to: (a) the plaintext payload before encryption and digest,
  (b) the `aad` object, (c) the SPEC-04 receipt content (cross-reference).
- The `plaintext_digest_hex` is SHA-256 over the **canonical** plaintext — this is what
  makes the digest stable across platforms and versions.

## 4. Algorithms (allowlist — no negotiation, no cipher agility)

| Parameter | Allowed value | Notes |
|-----------|---------------|-------|
| Content encryption | `AES-256-GCM` | only; 128-bit tag |
| Key derivation | `PBKDF2-SHA256` | only; iterations **exactly 310,000** (OWASP 2023 guidance for PBKDF2-SHA256); `1.0` envelopes at 100,000 remain importable (§8) |
| Key length | 256 bits | fixed |
| Salt | 16 bytes (128 bits) | random per envelope, hex-encoded |
| IV/nonce | 12 bytes (96 bits) | random per envelope, hex-encoded; never reused with the same key |
| Integrity | SHA-256 | over canonical plaintext |

Any envelope specifying an algorithm, iteration count, salt size, or IV size outside this
allowlist MUST be **rejected** at parse time. There is no "try it anyway" path. (Iteration
upgrade path: a future `version` bump may raise the floor; it may never lower it.)

## 5. Integrity and binding

1. The importer MUST parse the header (strict: unknown fields ⇒ reject, §7).
2. Verify `kdf`/`cipher`/`integrity` against the allowlist (§4).
3. Derive key: `PBKDF2(password, salt, iterations, 256 bits, SHA-256)`.
4. Decrypt with `AES-256-GCM(key, iv, ciphertext, aad = canonical(aad object))`.
   - GCM tag failure ⇒ **reject** (wrong password or tampered header — indistinguishable
     by design).
5. Verify `plaintext_digest_hex` == SHA-256(canonical plaintext). Mismatch ⇒ reject
   (corruption).
6. Only then parse the plaintext as the logical export payload (SPEC-01-derived field set).

## 6. Password handling

- The user password MUST be provided via a UI prompt (or `dialog.showSaveDialog`-adjacent
  secure input on desktop). It is **NEVER**:
  - passed in `argv` (no CLI flags carrying passwords),
  - read from or written to environment variables,
  - written to logs, crash reports, or the journal,
  - persisted to any storage (memory only, zeroized after envelope completion).
- Passwords are held in memory for the minimum time required and dropped on
  success/failure/cancel alike.

## 7. Limits and hostile-input rejection

- **Limits:** an envelope MUST declare and enforce `limits` — max **50,000 records** and
  max **50 MiB (52,428,800 bytes)** of plaintext. Exceeding either ⇒ export refuses to
  produce / import refuses to process. (Current user scale is far below; the limit exists
  to bound decompression-bomb-style risk and memory exhaustion.)
- **Downgrade rejection:** an importer supporting `1.1` must not silently accept a
  `version` it does not know (e.g., a future `2.0` or a bogus `0.9`); unknown versions are
  rejected with a clear error, never best-effort parsed.
- **Unknown fields:** any header or payload field not in this spec ⇒ reject (fail-closed;
  prevents smuggled policy overrides).
- **Path traversal / symlink:** on import, the envelope never carries file paths; if any
  implementation accepts file-attachment style payloads, filenames inside must be
  rejected unless they match `^[A-Za-z0-9._-]+$` (no `/`, no `..`, no absolute paths), and
  the import must never follow symlinks when writing staging files (use `O_NOFOLLOW`
  semantics or equivalent; refuse if the staging target exists as a symlink).

## 8. Cross-version rules

| Envelope version | Produced by | Import behavior |
|------------------|-------------|-----------------|
| `1.0` | current `dataSync.ts` | accepted; 100,000 PBKDF2 iterations honored for that envelope only; field set per the legacy bundle |
| `1.1` | D1.1+ per this spec | accepted; full validation (§5) |
| anything else | — | **rejected** |

Export always produces `1.1`. Import never "upgrades" a `1.0` silently — it imports the
legacy field set and, if the user then re-exports, produces `1.1`.

## 9. Atomic file I/O (crash safety)

Export and import MUST both use **staging + fsync + atomic rename**:

1. Write the complete envelope to a temp file in the same directory (or OPFS staging area)
   as the final target.
2. `fsync` the temp file (and the directory, where the platform allows).
3. `rename` temp → final (atomic on POSIX; on platforms without atomic rename, write to
   temp, flush, then replace via the platform's atomic primitive).
4. On any error, the temp file is removed; the final target is never a partial write.

**Crash during import:** the import first materializes the decrypted payload into a
staging area (never directly over live stores). If the app crashes mid-import, the next
startup detects the staging directory and **discards it entirely** — a partial import is
never committed to live stores. Import applies to live stores only after full validation
and only as an atomic per-store swap (or a journaled apply equivalent to SPEC-02's
per-store model).

## 10. What D1.0 does NOT deliver

D1.0 is the normative text. As of D1.0, `dataSync.ts` produces the `1.0` bundle (100k
iterations, no AAD binding, no limits, no strict unknown-field rejection) — that is the
baseline this spec obligates D1.1+ to supersede. TEST-MATRIX §7 defines the mandatory
contract tests (tamper, wrong password, downgrade, cross-version import, crash mid-import).

## 11. Compliance trace

- R12 → §2 (full envelope), §3 (RFC 8785 canonicalization), §4 (allowlist with exact
  parameters), §5 (integrity + AAD binding), §6 (password never in argv/env/logs),
  §7 (limits, downgrade/unknown/path/symlink rejection), §9 (staging+fsync+rename, crash
  ⇒ discard staging).
- R2 → §1 (the user export is this envelope only; raw SQLite is ADR-003's engineering
  path).
- Cross-references: ADR-001 (key derivation matches capability model), ADR-003
  (classification), SPEC-01 (`export: user_export` keys only), SPEC-04 (same
  canonicalization for receipts), TEST-MATRIX §7.

## Status

**Status: Proposed (awaiting Themis gate + user final approval)**
