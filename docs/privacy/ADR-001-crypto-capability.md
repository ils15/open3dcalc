# ADR-001 — Cryptographic Capability Model for PII at Rest

## Policy 1.9 supersession — local at-rest capability retired

As of policy 1.9, the former local at-rest encryption capability model in this ADR is
superseded. Stable Web/PWA and Desktop save the three exact customer/quote/history keys
declared by SPEC-01 directly as plaintext. Local saves do not require a passphrase, OS
keyring, crypto capability, vault unlock, or consent. Web Beta's former synthetic-test manifest
is retained as historical context only. By owner decision on 2026-10-10, Beta now uses the same
plaintext customer/quote/history keys as Stable and migrates valid retired
`open3dcalc_beta_test_*` records before hydration. Same-origin code can access browser storage.

This supersession applies to every local persistence path and startup gate below. Those
sections are historical rationale only, not active requirements or evidence that the former
design is implemented. The historical `open3dcalc_pii_vault` is inert; its bytes are not
opened or converted by current saves. The 2026-10-10 owner decision retires all encryption,
key, and password paths: new `.open3dcalc` files are plain JSON, and older encrypted exports
are unsupported.
`contract_performance` is provisional and requires qualified legal review; this ADR makes no
legal determination.

**Track:** D1 — Privacy & Data Contracts
**Status:** Superseded for active encryption by approved policy 1.9 and the 2026-10-10 owner decision; old design retained as history
**Addresses findings:** R3 (PII at-rest), R7 (web/PWA crypto)
**Related:** ADR-002 (legacy plaintext quarantine), SPEC-01 (manifest), SPEC-03 (export envelope)

> **Historical D1.0 material below.** Sections 1–6 preserve the former capability design and
> its proposed requirements. They are superseded for current storage/export behavior by the
> decisions above; do not read their blocking language as current behavior. There is no legacy
> export decryption reader.

## 1. Context

Open3DCalc persists user data on three surfaces:

- **Electron desktop:** renderer state mirrored into a SQLite `storage` table via
  `db:get`/`db:set`/`db:delete`/`db:list-keys` IPC, plus the SQLite domain tables
  (`customers`, `quotes`, `quote_items`, `history_entries` — the single list is
  `PII_DOMAIN_TABLES` in `electron/piiDomainTables.ts`) under `userData`.
- **Web/PWA:** `localStorage` (Zustand `persist` and direct `localStorage` usage), plus
  potential IndexedDB/OPFS and Cache API surfaces used by the PWA/service worker.
- **Cross-device transfer:** the `dataSync.ts` encrypted bundle (already AES-256-GCM with
  PBKDF2-SHA256, 100k iterations — see SPEC-03 for the normative envelope).

Today, PII (customers, quotes with `customerSnapshot`) is written to these surfaces in
plaintext. This ADR defines the **capability model** that D1.1+ must implement so that no
platform ever has a plaintext PII path at rest.

## 2. Decision

### 2.1 Electron desktop

**Primary mechanism: the at-rest envelope, under a `safeStorage`-wrapped profile data key.**

- On a passing §3.4 keyring gate, a random 256-bit **profile data key** is generated once
  per profile and sealed by the OS keyring (`safeStorage.encryptString`). **Only the wrapped
  form is persisted** — `userData/pii-profile-key.json`, mode `0600` — and the clear key is
  held in main-process memory only, zeroized on lock. It is never persisted, never logged
  and never crosses IPC.
- Every PII-bearing value (per SPEC-01: any manifest key with `pii: true`) MUST then be
  sealed with the §3 application envelope **under that data key**, not with
  `safeStorage.encryptString` directly. Stored shape: `enc1:profileKey:<json envelope>`.
- Decryption happens only in memory, at read time, by opening the envelope under the
  unwrapped data key.

**Why a second layer, and why this is the primary path.** `safeStorage` accepts no
associated-data parameter, so a value sealed by it _directly_ is bound to nothing — not to
its storage key, purpose, `S` or `F`. A ciphertext written for `open3dcalc_customers_v1`
decrypts just as cleanly once the row it sits in is renamed to `open3dcalc_quotes_v1`, and
nothing in the ciphertext can reveal the move. Sealing the data key rather than the value is
what puts the §3.1 AAD back on the primary path, so `K`/`P`/`S`/`F` are each authenticated
independently — the property the passphrase fallback has had all along. The primary path
previously had strictly _less_ protection than the fallback.

**The keyring is gated, not merely probed.** `isEncryptionAvailable()` alone is not the
gate; see §3.4.

**Fallback: encrypted-at-rest with a user passphrase — only when a passphrase is available.**

- If the keyring fails the §3.4 gate, the app MAY fall back to an envelope encryption scheme
  (AES-256-GCM with a key derived from a user-supplied passphrase via PBKDF2-SHA256, per
  SPEC-03 parameters) **only while a passphrase is held in memory**.
- The passphrase MUST NOT be persisted anywhere: not to disk, not to SQLite, not to
  `localStorage`, not to OS credential storage, not to logs. It lives in memory for the
  session only and is zeroized on lock/exit.
- Consequence: with this fallback, PII written in one session is only readable again after
  the user re-enters the passphrase. That is the intended trade-off.
- Stored shape: `enc1:envelope:<json envelope>`.

**Deny path: no `safeStorage` AND no passphrase ⇒ PII persistence is DENIED.**

- If neither capability is available, the app MUST NOT persist PII at all. PII-bearing
  features degrade to in-memory-only (`persistence: "memory_only"` in SPEC-01 terms) or are
  disabled with an explicit user-facing explanation (i18n, per repo conventions). The app
  remains usable for non-PII data.
- The reason a write is refused MUST name the keyring refusal (§3.4) rather than the §2.3
  table's single "no keyring" row, because "this machine is on the plaintext fallback —
  install libsecret or kwallet" and "nothing here will encrypt PII" are different problems
  with different fixes. The §2.3 code is retained for the generic case, where it is the
  broader truth.

**Self-test before hydration.** Before any PII is sealed or opened, the layer MUST prove
that this machine can do the job — see §3.4. A keyring that answers "available" and then
hands back something else is caught once, with a reason, instead of on the first read of a
customer's name.

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

**The browser vault is renderer-only, and the main process is not a browser.** The
encrypted IndexedDB vault (`src/shared/lib/crypto/piiStore.ts`) is reachable
only from a browser context, and it REFUSES — with a typed reason — everywhere
else. `electron/tsconfig.json` compiles `src/shared/lib/crypto/**`, so the module
is loaded by the main build by construction; it must load without throwing, and
it must be impossible to obtain a working handle there. Three things make that
true rather than aspirational:

- the IndexedDB dependency is an **injected port** (`crypto/indexedDbPort.ts`),
  not the ambient global, so its absence is a refusal rather than a crash, and
  the single `globalThis` cast is confined to one documented function;
- the capability gate is **DOM-free and dependency-free**
  (`crypto/piiStoreCapability.ts`), so the vault does not import a zustand /
  `window` module into the main bundle. `manifestStorage.ts` owns the demo flag
  and mirrors it in; the gate owns the decision;
- a non-browser runtime gets its own reason, **`not_a_browser`**, distinct from
  `insecure_context`. The main process is not an insecure context, and a
  desktop user told their context is insecure goes looking for a TLS problem
  they do not have.

Construction refuses on the capability axes; the `locked` axis is checked per
operation, because a handle legitimately exists before a passphrase does. An
inert handle was considered and rejected: a future caller could hold one, assume
it works, and ship a path that silently persists nothing.

### 2.3 Capability decision table

The table below is normative for D1.1+ and is mirrored by SPEC-01's per-platform fields.
"PII persistence outcome" is the only allowed outcome for that row.

| Platform | `safeStorage` / Web Crypto | Passphrase (in memory) | PII persistence outcome                                        |
| -------- | -------------------------- | ---------------------- | -------------------------------------------------------------- |
| Electron | `safeStorage` available    | (not required)         | **Encrypted at rest** via `safeStorage`                        |
| Electron | `safeStorage` unavailable  | Available              | **Encrypted at rest** via passphrase envelope (SPEC-03 params) |
| Electron | `safeStorage` unavailable  | Not available          | **DENIED** — PII features degrade to `memory_only` or disabled |
| Web/PWA  | Secure context             | Available              | **Encrypted at rest** via Web Crypto + passphrase              |
| Web/PWA  | Secure context             | Not available          | **DENIED** — PII blocked (memory-only at most)                 |
| Web/PWA  | Insecure context           | (any)                  | **DENIED** — PII blocked; non-PII unaffected                   |

Notes:

- "Available" for a passphrase means the user has entered one in the current session and it
  is held in memory. There is no "remember passphrase" feature; that would be persistence.
- **"Available" for `safeStorage` means the §3.4 gate passes, NOT
  `isEncryptionAvailable() === true`.** The column predates that gate and its label is kept
  for continuity, but the raw probe accepts Linux's `basic_text` backend, which is
  obfuscation rather than encryption, so reading the column as the raw probe overstates the
  guarantee on exactly the machines that have least of it. The table is implemented by
  `resolveCryptoCapability` (`src/shared/lib/crypto/capability.ts`), which is pure and takes
  its platform input as an argument; `electron/cryptoCapability.ts` feeds it the gate's
  verdict, not the raw probe's. The raw probe survives as a diagnostic and is documented as
  not being the gate.
- The deny path is fail-closed. A crash, capability probe failure, or ambiguous state
  resolves to DENIED, never to plaintext.
- Capability probing happens at startup and on demand; results are cached in memory only.
  A cached readiness verdict is believed only while the data key it proved is still
  resident (§3.4).

## 3. The authenticated-encryption contract (at-rest envelope)

The at-rest envelope is specified in `src/shared/lib/crypto/envelope.ts`. Its AAD is
the whole security contract, so it is written here as bytes, not prose.

### 3.1 The exact AAD byte string

The additional authenticated data is the UTF-8 encoding of five fields joined by a
single NUL (`U+0000`) each:

```
"open3dcalc-pii-at-rest" NUL <K> NUL <P> NUL "schema:<S>" NUL "envelope:<F>"
```

| Slot | Symbol | Meaning                                                               |
| ---- | ------ | --------------------------------------------------------------------- |
| 1    | —      | Domain separator: `open3dcalc-pii-at-rest`                            |
| 2    | `K`    | Storage key NAME (e.g. `open3dcalc_customers_v1`) — metadata, not PII |
| 3    | `P`    | Stable crypto-purpose identifier (e.g. `at-rest`)                     |
| 4    | `S`    | `schemaVersion` — logical schema of the protected value               |
| 5    | `F`    | `envelopeFormatVersion` — wire format of the sealed record            |

Constraints, all enforced by `validateEnvelopeExpectation`:

- `K` and `P` MUST NOT contain NUL. NUL is the only separator, so a NUL inside a
  component could make two different expectations serialise to identical bytes, and
  the AAD would then bind nothing. A NUL is rejected with `EnvelopeAadInvalidError`
  rather than producing an ambiguous AAD.
- `S` and `F` are **positive integers** serialised in canonical decimal: no sign, no
  leading zero, no exponent. One integer therefore has exactly one byte
  representation, and `1` can never mean something different from `01`.
- The byte string is a fixed layout, not a key-ordered JSON encoding. Sorting keys
  is what let the old binding be re-derived from the ciphertext; the offsets here
  are normative and are asserted in `__tests__/envelope.test.ts` against a
  hand-written literal.

### 3.2 Caller-trusted, never self-asserted

Decryption receives `K`, `P`, `S` and `F` from the trusted manifest/storage contract
and builds the AAD itself. **There is no decrypt overload that omits them.**

The envelope still carries the four values, but they are _unauthenticated metadata_:
they are compared against the caller's expectation and a mismatch is a rejection
(`metadata_mismatch`), and they are never used to derive the AAD. Consequently a
ciphertext copied under a different key, purpose, `S` or `F` fails GCM
authentication, independently in each of the four dimensions.

The defect this replaced: the reader took the key name from the ciphertext and
re-derived the AAD from it, so a ciphertext moved to another key decrypted cleanly,
and the production `decryptFromStorage(key, blob)` accepted its `key` argument and
discarded it.

### 3.3 Two version dimensions, and the envelope version

Three versions are in play and they are not interchangeable:

| Version | Type             | Changes when                                            |
| ------- | ---------------- | ------------------------------------------------------- |
| `v`     | envelope version | The sealed record's own format; dispatches the reader   |
| `F`     | positive integer | The envelope format the storage layer believes it wrote |
| `S`     | positive integer | The logical schema of the protected value               |

`S` and `F` are distinct axes on purpose: a value can keep its schema while the
sealed record changes shape, and a migration that bumps one must not silently bump
the other.

**`TODO(hermes)` — `S` is a constant, not a lookup, and a manifest `version` bump
is a live landmine.** There are now **two** mirrors of the constant, not one:
`electron/cryptoCapability.ts` (main process) and
`src/shared/lib/crypto/piiSchemaVersion.ts` (the browser PII vault). They cannot
import each other — the main process cannot reach the JSON fixture, and the
shared module is not on the electron import allowlist — so the duplication is
pinned by test instead (`piiVaultDeclaration.test.ts` reads the electron source
and asserts the two values are equal, in both directions). The lookup that
replaces them therefore has to remove **both** pins in the same commit. The trusted source for `S` is the per-key `version` in the
SPEC-01 manifest, but the `PII_SCHEMA_VERSION` declaration in `electron/cryptoCapability.ts`
cannot reach the fixture (node16 ESM output will not execute a static JSON import) and
mirrors the value as `PII_SCHEMA_VERSION = 1` instead. That mirror is safe only while nothing
else reads those `version` fields. It must become a per-key lookup, and the order
matters:

1. land the per-key lookup first, while every PII at-rest entry is still at
   version `1.0`/`1.1`/`1.2` — i.e. while the lookup returns what the constant
   already returns, so no envelope is affected;
2. only then allow a `version` bump on a PII at-rest entry.

Bump a `sqlite_domain_tables` (or any PII `encrypted_at_rest`) `version` while
`S` is still the constant, and on the day the lookup lands it silently re-labels
`S` for that key: every envelope already on disk — passphrase-sealed _and_
profile-data-key-sealed — fails GCM authentication and becomes undecryptable. There
is **no runtime signal** — no migration, no counter, no log line, nothing that says
"this key's schema version moved"; the decryption path just throws `metadata_mismatch`
on values that were written correctly, and the bytes are still on disk and still
intact.

**The §3.4 remediation widened this landmine, and that is a deliberate cost.** While the
primary path sealed with `safeStorage` directly it bound no AAD at all, so a `version` bump
could not strand a `safeStorage` blob — the primary path was the one safe case, and only
passphrase-sealed rows were at risk. Now that the primary path is context-bound (§2.1),
**every** at-rest envelope is exposed to this landmine, and the per-key lookup stops being
hygiene and becomes a precondition for any `version` bump. Treat the two TODOs as ordered:
land the lookup first.

**The mirror is a cross-process pin and its literal form is load-bearing.** Two copies of
the constant exist, and they cannot import each other — the main process cannot reach the
JSON fixture, and the shared module is not on the electron import allowlist — so the
duplication is pinned by test instead: `piiVaultDeclaration.test.ts` reads the **source text**
of `electron/cryptoCapability.ts` and scrapes it with
`/const PII_SCHEMA_VERSION = (\d+);/`. That is a deliberate tripwire, and it means
reformatting the declaration, renaming it, or hoisting it to a different form **reddens a
web-tree test** even though no value changed. The declaration MUST stay a literal
`const PII_SCHEMA_VERSION = <integer>;` in that file until the lookup removes both pins in
the same commit.

This is a separate tracked item from the manifest work that makes it reachable:
`pii_stage`'s SPEC-01 declaration (§ Policy 1.5 → 1.6 in SPEC-04) is the first
edit to add a new PII at-rest `version` field, and it is deliberately left at
`1.0`. Pinned by `src/shared/lib/__tests__/piiStageDeclaration.test.ts` ("no PII
at-rest entry has moved off schema version 1"), which fails on the bump and names
this TODO. The `pii_stage` entry's own `purpose` carries the same warning, so it
is visible from the manifest as well as from here.

`v` selects a **version-specific reader**. The pre-remediation `1.1` envelope
authenticated `canonicalJson({purpose, key})` with both halves read back out of the
ciphertext, so its binding proved nothing about provenance, and it cannot be
re-authenticated under §3.1 — the tag covers the old bytes and cannot be re-signed.
The `1.1` reader therefore **fails closed and says so** (`legacy_self_asserted_aad`);
it is not silently reinterpreted as `2.0`. A live `1.1` value has to be re-encrypted
under `2.0` from a trusted read of the old envelope and the `1.1` blob deleted — a
storage-layer migration, not a crypto one. An unrecognised `v` is refused separately
(`unknown_envelope_version`) so an operator can tell "we can see this and cannot
trust it" from "this is from the future".

### 3.4 Key lifecycle, the keyring gate, and the sync-only decision

- **Passphrase (fallback path):** user-supplied, held in main-process memory for the
  session only, zeroized on lock/exit. Never persisted, never logged, never sent to
  argv/env. The at-rest key is derived per envelope from a fresh 128-bit salt at
  PBKDF2-SHA256 with exactly 310,000 iterations; there is no stored derived key to
  leak, rotate or revoke. Consequence: a value written in one session is unreadable
  until the passphrase is re-entered, which is the intended trade-off.
- **Profile data key (primary path):** a random 256-bit key from
  `crypto.getRandomValues`, generated once per profile and sealed by the OS keyring. The
  OS keyring owns the _unwrapping_; the app owns the data key itself. **Only the wrapped
  form is persisted**, in `userData/pii-profile-key.json` at mode `0600`; the clear key
  lives in a mutable `Uint8Array` in main-process memory and is zeroized on lock.
  Nothing in this layer persists, logs or returns the clear key to the renderer.
  - _Resident, not durable._ The base64 form the envelope KDF consumes is an immutable
    JS string and cannot be scrubbed, so the durable guarantee is "never persisted", not
    "never resident" — the same limitation `passphraseSession.ts` documents.
  - _A wrapped key that will not unwrap is a named refusal, never a replacement._
    Generating a fresh key over an unreadable one is indistinguishable from a fresh
    install and would strand every record already sealed under the old key: the bytes stay
    on disk, intact, and become unopenable with no trace of why. Every unwrap failure
    therefore throws and the file is left exactly as found.

**The keyring gate is a backend allowlist, not `isEncryptionAvailable()`.**
`isEncryptionAvailable()` returns `true` for Linux's `basic_text` backend, which is
Electron's "desktop environment not recognised" fallback: a fixed obfuscation key held in
the process, with no OS credential store and no per-user secret behind it. Accepting that
probe means the app reports a customer's name as "encrypted at rest" on precisely the
machines where it is not, with no second gate to notice. The gate differs by platform,
because the evidence differs:

| Platform        | Gate                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Linux           | The backend **name**, against an allowlist: exactly `gnome_libsecret`, `kwallet`, `kwallet5`, `kwallet6` |
| Windows / macOS | OS-backed availability **plus** an encrypt/decrypt round-trip (DPAPI / the Keychain) — behavioural       |
| Anything else   | Refuse: a platform with no documented gate is not a platform this layer will encrypt PII on              |

`safeStorage.getSelectedStorageBackend()` is annotated `@platform linux` — it does not
exist on Windows or macOS, so calling it there is not a stricter check, it is a call to a
member the runtime does not have, and the value it appears to return says nothing about
DPAPI or the Keychain. That is why the two platform families are gated differently rather
than one gate pretending to cover both.

The allowlist is closed on purpose: `basic_text` is refused, and so is `unknown` (Electron's
own "asked before `app` was ready"), an empty or non-string value, any name this build has
no threat model for, a probe that throws, and a missing getter. A new backend name is a new
threat model, and an allowlist that grows by accident is not an allowlist. Every branch is
fail-closed — a throw resolves to DENIED (ADR-001 §2.3).

**The self-test, run before any PII is hydrated.** Three claims, each cheaper and more
fundamental than the last:

1. **The backend is real** — the §3.4 gate. A `basic_text` keyring fails here, before a
   data key exists, so a machine that cannot protect PII never gets a key file written to
   it.
2. **The key unwraps and the envelope round-trips** — a fixed, non-PII sentinel is sealed
   and opened under the data key. This is where a keyring that claims availability and then
   hands back something else is caught.
3. **The AAD actually binds** — the negative control: the same envelope is opened under a
   _different_ key name and a refusal is required. A composition that sealed without an AAD
   — the exact defect this layer was remediated for — passes 1 and 2 and is caught here.

The self-test runs at the choke point every seal and open passes through, not merely at
startup, so "nothing is sealed or opened before the machine has proved it can" is a property
of the code rather than a thing each caller must remember. Its cached verdict is believed
only while the data key it proved is still resident: a verdict that outlived its key would
assert a key that is no longer in memory.

**Sync APIs only, deliberately.** `encryptStringAsync` / `decryptStringAsync` are NOT used.
`decryptStringAsync` resolves `{result, shouldReEncrypt}`, and its documentation says to
call it again when re-encryption is requested — but it returns **no replacement
ciphertext**, so there is no documented way for this app to persist the rewrapped blob. A
rotation flow built on that would be an invention rather than an implementation, so the
async path stays unavailable and this layer has **no key-rotation story at all**.
`setUsePlainTextEncryption` is likewise never called: forcing the plaintext backend would
manufacture the very condition the gate refuses. If a future Electron ships a documented
rotation, this is the place to revisit.

### 3.5 KDF work factor — inconsistency, deliberately unresolved

Three PBKDF2-SHA256 work factors exist in the repo: 310,000 in `crypto/envelope.ts`
and in `exportEnvelope.ts` (the SPEC-03 value), and **100,000** in `dataSync.ts`,
which its own header documents as "100.000" and which it genuinely derives with. This
ADR retains the current factors and does **not** change them in the contract
remediation: a KDF parameter is not a value you can edit in place, since changing it
makes every existing ciphertext undecryptable. Bringing the 100,000 path to 310,000 is
separate, versioned work — a new envelope version, a read path that derives with the
declared factor rather than the compiled-in one, and a migration that re-encrypts
existing bundles. It is **out of scope here and still open.**

### 3.6 Version migration obligation — legacy envelopes fail closed and are recovered

**Status: IMPLEMENTED — see `electron/legacyRecovery.ts`.** The §3.6 recovery is the
`recoverLegacyKey` path exposed over `privacy:recover-key`, with per-key hydration
isolation in `hydrateAll` and the report behind `privacy:recovery-report`.

Bumping the envelope version is a data-affecting change, not a code-only one, and the
affected data is real: packaged Electron builds have run against real profiles, so a
live profile can hold `enc1:envelope:` rows written as `1.1`.

**Which stored shapes are affected**

| Stored shape                                                                                                                                      | Affected | Notes                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `enc1:envelope:<json>` in the SQLite `storage` table (`key`/`value` columns) under a manifest `pii: true` key, in the Electron `userData` profile | **Yes**  | Written only when the keyring failed the §3.4 gate AND a session passphrase was held (ADR-001 §2.1, row 2.2)    |
| `enc1:profileKey:<json>` in the same table                                                                                                        | No       | Current primary shape; context-bound under §3.1                                                                 |
| `enc1:safeStorage:<base64>`                                                                                                                       | **Yes**  | **Now refused by name** — `LegacyUnboundBlobError`. Pre-remediation primary shape; carried no AAD at all (§3.4) |
| Domain tables `customers`, `quotes`, `quote_items`, `history_entries`                                                                             | No       | Not written through the envelope path                                                                           |
| Browser / PWA `localStorage`, IndexedDB, OPFS, Cache API                                                                                          | No       | The web build never calls the envelope path — see below                                                         |
| `dataSync.ts` / SPEC-03 export bundles                                                                                                            | No       | A different format with its own AAD (`canonicalJson`), untouched here                                           |

**Reachability in the web build: none.** `enc1:envelope:` is produced in exactly one
place, `electron/cryptoCapability.ts`, which runs only in the Electron main process.
The shared capability decision engine (`crypto/capability.ts`) is pure and has no
platform injection on web, and no module under `src/platform/web/**` imports the
envelope. The web row of the §2.3 table is still a _contract_, not an implementation:
the web build writes PII to `localStorage` **unencrypted**, which is the §6 gap and is
unaffected by this change. A browser profile therefore cannot contain an
`enc1:envelope:` row.

**What happens to an affected row now.** The versioned reader recognises `1.1` and
refuses it with `legacy_self_asserted_aad`. That is fail-closed by design — the `1.1`
AAD cannot be re-authenticated under §3.1 — so the value is unreadable on the
ordinary read path until §3.6 recovery re-seals it.

**Recovery: copy-and-verify, never delete.**

1. Read the `1.1` value **through a `1.1`-capable reader that still honours its own
   self-asserted AAD**, holding the result only in memory. That reader is quarantined
   to this migration and is NOT the general read path — the defect this ADR
   remediates is precisely that self-assertion. `readLegacyValue` in
   `electron/legacyRecovery.ts` is that reader, and it refuses every shape other than
   `enc1:envelope:` `v: "1.1"` and `enc1:safeStorage:`.
2. Re-encrypt that plaintext under `2.0` using the caller-trusted expectation for its
   key, purpose, `S` and `F`.
3. **Verify** the `2.0` envelope decrypts back to the same plaintext through a FRESH
   authenticated read-back of the full payload, then write it alongside.
4. The legacy copy is **RETAINED, not removed.** `recoverLegacyKey` copies the legacy
   ciphertext byte for byte into the `legacy_residue` table (migration
   `0005_legacy_residue.sql`) BEFORE it rewrites the `storage` row, and it never
   deletes it. The copy-then-verify order is still not negotiable: overwriting or
   deleting a `1.1` blob in place destroys the only copy of a value that may not be
   recoverable from any other source, since the passphrase fallback never replicated
   it. Deleting is additionally unsafe because no mechanism can prove an old client is
   not still writing that row, so the user removes the residue through the erasure
   flow.

This matches the approved mode in which legacy sources are retained as **disclosed
residue** rather than silently purged; the migration reports what it moved and what
it left behind. The retained blob is itself declared PII-bearing (`legacy_residue`,
`policy_version` 1.8) and covered by `PII_ERASURE_TABLES`, so the SPEC-02 erasure flow
removes it. A value that cannot be decrypted (wrong or absent passphrase, corrupt
`1.1` blob) is surfaced to the user as unrecoverable, not dropped.

**Loading is per-key, and a refusal is named.** A profile can hold both legacy shapes
at once. `hydrateAll` classifies each key independently: a key whose value is refused
is ABSENT from the hydrated map and reported in `unavailable` with a reason (and
whether §3.6 recovery is still possible), while every other key loads. The former
all-or-nothing behaviour — one refused row rejecting the whole hydration — is gone.
A refusal that crosses `ipcRenderer.invoke` arrives as a flattened string, so the
reason is interpolated into the rejection MESSAGE (`UnreadablePiiValueError`) and the
renderer parses that exact code back out (`persistence-bridge.refusalCodeFromError`);
the structured `reason`/`code` fields do not survive the boundary.

**The same obligation now also covers pre-remediation `enc1:safeStorage:` blobs, and they
fail closed in the same shape.** The §3.4 remediation replaced the primary path's format, so
a profile written by an earlier build holds `enc1:safeStorage:<base64>` rows carrying **no
AAD at all** — they are bound to nothing, which is the defect being remediated. The reader
recognises the shape and refuses it by name with `LegacyUnboundBlobError`, rather than
decrypting it. That is the right crypto call: reading it would re-admit exactly the
unbound branch this layer no longer has, and would hand back a value that proves nothing
about where it came from. The operational cost is the one above, and it is identical:

- **A profile with existing `enc1:safeStorage:` PII rows now fails closed on load, per
  key.** The refusal is isolated to the one value: the affected key is quarantined and
  reported as `legacy_unbound_encryption` with recovery still available, and every other
  key still hydrates. It is not confined to the passphrase fallback. (Before `9c935f8`
  the refusal propagated as a throw and rejected the whole hydration — the same
  **whole-hydration-rejection** shape Themis flagged for `1.1` envelopes; the per-key
  isolation is what removed it.)
- The bytes are **still on disk and still intact**. Nothing is deleted, and the plaintext is
  still recoverable by a keyring-capable reader that chooses to ignore the binding.
- `LegacyUnboundBlobError` is a **distinct type** on purpose, for the ADR-002 routing:
  raising `UnknownBlobError` would route it into the `legacy_plaintext` branch and hand the
  stored string back as the value — the customer's raw ciphertext rendered as if it were
  their name — and raising `CryptoDeniedError` would report it as `locked`, a different
  problem with a different fix.
- **Recovery is implemented, and it retains the copy.** `recoverLegacyKey` unwraps the
  keyring blob in memory, re-seals it under §3.1, verifies by a fresh authenticated
  read-back of the full payload, and parks the legacy ciphertext byte for byte in
  `legacy_residue` — it does not remove it. The user removes the disclosed residue through
  the SPEC-02 erasure flow. The path is exposed over `privacy:recover-key`, so an upgrading
  user with historical `enc1:safeStorage:` PII can re-seal it.

**Net: both stored shapes are migratable, per key.** The `1.1` envelope and the
pre-remediation keyring blob are refused on the ordinary read path, and both are recovered
by `recoverLegacyKey`. The legacy blob is retained as disclosed residue in
`legacy_residue` and removed only by the user's SPEC-02 erasure action.

## 4. Consequences

- **Positive:** no plaintext PII at rest on any supported platform; a stolen SQLite file,
  `localStorage` dump, or `userData` directory does not yield customer data without the
  OS-backed key or the passphrase; a ciphertext cannot be silently relocated between
  keys, purposes or schema generations; the model is testable (TEST-MATRIX §2, §3).
  The primary Electron path now carries that same AAD binding rather than none, and a
  `basic_text` keyring is refused rather than reported as encryption.
- **Negative:** without a passing keyring gate and without a passphrase, PII features are
  degraded — this is an accepted, explicit trade-off in favor of confidentiality; passphrase
  fallback means PII is unreadable across sessions until the passphrase is re-entered. The
  allowlist is closed, so a Linux desktop on a keyring this build has no threat model for
  is denied PII until it is named.
- **Migration:** existing plaintext PII does NOT silently become encrypted. It enters the
  quarantine regime of ADR-002 until migrated or eliminated by explicit user action.
  Existing `1.1` envelopes likewise fail closed and require the §3.3 re-encryption.
  **Existing `enc1:safeStorage:` PII rows now also fail closed** on the ordinary read
  path (§3.6) and are refused by name as `LegacyUnboundBlobError`; they are not
  decrypted, not re-sealed and not deleted there. The §3.6 recovery
  (`recoverLegacyKey`) can re-seal them under the bound envelope, retaining the legacy
  copy as disclosed residue that the user removes via the erasure flow.
- **Cost:** a caller that supplies a wrong `S` or `F` loses access to its own data. That is
  the intended failure mode, and it is why those two values belong to the storage
  contract rather than to a constant inside the crypto module.

## 5. What this ADR explicitly does NOT claim

- **This is application-level encryption of current logical values.** It protects a value as
  it sits in the store right now. It is not a claim about the whole profile.
- **It is not protection against an unlocked-runtime compromise.** While a session is
  unlocked — or a passphrase is in main-process memory, or the profile data key is unwrapped
  in main-process memory — the plaintext exists in memory and is reachable by anything
  running as the user. The contract is about what the _stored bytes_ are bound to, not about
  defending a live process. The data key in particular is resident whenever the session is
  unlocked, because the app has to open records.
- **It is not secure erasure of historical copies.** Encrypting a value now says nothing
  about copies that already exist: SQLite WAL/journal residue, `userData` backups, OS-level
  snapshots, diagnostic bundles, previously exported bundles, and copies the user has already
  made. This applies to the `enc1:safeStorage:` rows refused in §3.6 exactly as much as to
  anything else — refusing them stops the app from _reading_ them; it does not remove the
  bytes. Erasure is SPEC-02's job, and it can only be as good as its enumeration of the
  surfaces that hold copies.
- **It does not have a key-rotation story.** The sync-only decision in §3.4 leaves rotation
  unimplemented by choice, because Electron's async API returns no replacement ciphertext to
  persist.
- **It does not migrate any stored shape.** See §3.6.
- **It does not resolve the KDF inconsistency.** See §3.5.

## 6. What D1.0 does NOT deliver

This ADR is a contract for D1.1+. As of D1.0, the runtime still writes PII in plaintext and
`db:export` still copies a raw SQLite file; those are the gaps this ADR obligates D1.1+ to
close. Nothing in this document claims that behavior is already implemented.

## 7. Compliance trace

- R3 → §2.1 (deny path, zero plaintext), §2.3 table rows 3.
- R7 → §2.2 (web/PWA secure context + passphrase, blocked otherwise), §2.3 rows 4–6.
- Cross-device context binding → §3.1, §3.2.
- Cross-references: SPEC-01 (`persistence` enum, `plaintext_allowed` ⇔ `pii:false`, and
  the per-key `version` that is the trusted source of `S`), SPEC-02 (snapshot encryption
  uses the same capability model), SPEC-03 (export envelope parameters),
  TEST-MATRIX §2 (capability matrix tests), §3 (deny-path tests).

## Status

**Status:** D1.0 local at-rest capability proposal superseded by policy 1.9; SPEC-03 export
crypto provisions retained.

## Superseded historical Beta test-only profile addendum

This addendum records the former Beta test-only scope and is no longer current. Beta's real
local user data now shares the Stable plaintext keys; no passphrase or at-rest vault is required
for Web Beta saves.

This addendum does not alter Stable crypto behavior or any stored envelope, schema version,
hash, or compatibility rule. The Beta crypto/vault/password path is excluded from the current
app runtime and covered by the betaTestStorage and betaElectronGating suites. Final Themis review
is pending; no publication is authorized or performed by this work.
