# ADR-001 — Cryptographic Capability Model for PII at Rest

**Track:** D1 — Privacy & Data Contracts
**Status:** Proposed (awaiting Themis gate + user final approval)
**Addresses findings:** R3 (PII at-rest), R7 (web/PWA crypto)
**Related:** ADR-002 (legacy plaintext quarantine), SPEC-01 (manifest), SPEC-03 (export envelope)

## 1. Context

Open3DCalc persists user data on three surfaces:

- **Electron desktop:** renderer state mirrored into a SQLite `storage` table via
  `db:get`/`db:set`/`db:delete`/`db:list-keys` IPC, plus the SQLite domain tables
  (`customers`, `quotes`, `quote_items`, …) under `userData`.
- **Web/PWA:** `localStorage` (Zustand `persist` and direct `localStorage` usage), plus
  potential IndexedDB/OPFS and Cache API surfaces used by the PWA/service worker.
- **Cross-device transfer:** the `dataSync.ts` encrypted bundle (already AES-256-GCM with
  PBKDF2-SHA256, 100k iterations — see SPEC-03 for the normative envelope).

Today, PII (customers, quotes with `customerSnapshot`) is written to these surfaces in
plaintext. This ADR defines the **capability model** that D1.1+ must implement so that no
platform ever has a plaintext PII path at rest.

## 2. Decision

### 2.1 Electron desktop

**Primary mechanism: `safeStorage` (Electron API).**

- On availability of `safeStorage` (`isEncryptionAvailable() === true`), every PII-bearing
  value (per SPEC-01: any manifest key with `pii: true`) MUST be encrypted with
  `safeStorage.encryptString()` before it is written to SQLite (`storage` table or domain
  tables) or to any file under `userData` (logs, snapshots, staging included).
- Decryption happens only in memory, at read time, via `safeStorage.decryptString()`.

**Fallback: encrypted-at-rest with a user passphrase — only when a passphrase is available.**

- If `safeStorage` is unavailable, the app MAY fall back to an envelope encryption scheme
  (AES-256-GCM with a key derived from a user-supplied passphrase via PBKDF2-SHA256, per
  SPEC-03 parameters) **only while a passphrase is held in memory**.
- The passphrase MUST NOT be persisted anywhere: not to disk, not to SQLite, not to
  `localStorage`, not to OS credential storage, not to logs. It lives in memory for the
  session only and is zeroized on lock/exit.
- Consequence: with this fallback, PII written in one session is only readable again after
  the user re-enters the passphrase. That is the intended trade-off.

**Deny path: no `safeStorage` AND no passphrase ⇒ PII persistence is DENIED.**

- If neither capability is available, the app MUST NOT persist PII at all. PII-bearing
  features degrade to in-memory-only (`persistence: "memory_only"` in SPEC-01 terms) or are
  disabled with an explicit user-facing explanation (i18n, per repo conventions). The app
  remains usable for non-PII data.

**Zero plaintext path.** There is no configuration, flag, or code path in which PII is written
unencrypted at rest. `plaintext_allowed` in SPEC-01 is valid **only** for keys with
`pii: false`, and the schema enforces this invariant structurally.

### 2.2 Web / PWA

- **Primary mechanism: Web Crypto API** (`crypto.subtle`), which requires a
  [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts)
  (HTTPS or `localhost`).
- PII at rest on web MUST be encrypted with AES-256-GCM using a key derived from a
  user-supplied passphrase (PBKDF2-SHA256, SPEC-03 parameters). The passphrase is held in
  memory only (session lifetime), never persisted — not to `localStorage`, IndexedDB,
  cookies, or the service worker cache.
- **Insecure context (plain HTTP on a LAN IP, etc.) or no passphrase ⇒ PII is blocked.**
  The web build MUST NOT write PII to `localStorage`/IndexedDB/OPFS/Cache API in these
  conditions. Non-PII keys (preferences, flags, cache) continue to work normally.
- The PWA service worker MUST NOT cache PII-bearing responses or PII-bearing export
  artifacts. Cache API entries are covered by the erasure saga (SPEC-02) and by the
  manifest's `surface` field.

### 2.3 Capability decision table

The table below is normative for D1.1+ and is mirrored by SPEC-01's per-platform fields.
"PII persistence outcome" is the only allowed outcome for that row.

| Platform | `safeStorage` / Web Crypto | Passphrase (in memory) | PII persistence outcome |
|----------|---------------------------|------------------------|-------------------------|
| Electron | `safeStorage` available | (not required) | **Encrypted at rest** via `safeStorage` |
| Electron | `safeStorage` unavailable | Available | **Encrypted at rest** via passphrase envelope (SPEC-03 params) |
| Electron | `safeStorage` unavailable | Not available | **DENIED** — PII features degrade to `memory_only` or disabled |
| Web/PWA | Secure context | Available | **Encrypted at rest** via Web Crypto + passphrase |
| Web/PWA | Secure context | Not available | **DENIED** — PII blocked (memory-only at most) |
| Web/PWA | Insecure context | (any) | **DENIED** — PII blocked; non-PII unaffected |

Notes:

- "Available" for a passphrase means the user has entered one in the current session and it
  is held in memory. There is no "remember passphrase" feature; that would be persistence.
- The deny path is fail-closed. A crash, capability probe failure, or ambiguous state
  resolves to DENIED, never to plaintext.
- Capability probing happens at startup and on demand; results are cached in memory only.

## 3. Consequences

- **Positive:** no plaintext PII at rest on any supported platform; a stolen SQLite file,
  `localStorage` dump, or `userData` directory does not yield customer data without the
  OS-backed key or the passphrase; the model is testable (TEST-MATRIX §2, §3).
- **Negative:** without `safeStorage` and without a passphrase, PII features are degraded —
  this is an accepted, explicit trade-off in favor of confidentiality; passphrase fallback
  means PII is unreadable across sessions until the passphrase is re-entered.
- **Migration:** existing plaintext PII does NOT silently become encrypted. It enters the
  quarantine regime of ADR-002 until migrated or eliminated by explicit user action.

## 4. What D1.0 does NOT deliver

This ADR is a contract for D1.1+. As of D1.0, the runtime still writes PII in plaintext and
`db:export` still copies a raw SQLite file; those are the gaps this ADR obligates D1.1+ to
close. Nothing in this document claims that behavior is already implemented.

## 5. Compliance trace

- R3 → §2.1 (deny path, zero plaintext), §2.3 table rows 3.
- R7 → §2.2 (web/PWA secure context + passphrase, blocked otherwise), §2.3 rows 4–6.
- Cross-references: SPEC-01 (`persistence` enum, `plaintext_allowed` ⇔ `pii:false`), SPEC-02
  (snapshot encryption uses the same capability model), SPEC-03 (envelope parameters),
  TEST-MATRIX §2 (capability matrix tests), §3 (deny-path tests).

## Status

**Status: Proposed (awaiting Themis gate + user final approval)**
