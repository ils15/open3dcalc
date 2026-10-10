# ADR-004 — Real-Data V2: Encrypted Local Profile and Explicit Migration

**Decision date:** 2026-10-10
**Status:** Product direction approved; implementation and release gates pending
**Applies to:** the next V2 Beta candidate and later Stable/Desktop builds
**Supersedes for that target:** Beta test-only addenda D1–D12 and policy 1.9's
plaintext-at-rest decisions; it does not rewrite the behavior or evidence of `v2.0.0-beta.15`.
**Related:** ADR-001/002/003, SPEC-01–04, SPEC-05, and the data-compatibility gate in `ROADMAP.md`.

## 1. Context

The published `v2.0.0-beta.15` build uses three Beta-specific `localStorage` keys for
customer, quote, and history stores. They are plaintext, intended for synthetic test use, and
the application does not validate their contents. It has no V1 migration or user import/export
path. Stable Web and the current Desktop build also have plaintext persistence paths under
policy 1.9. These are facts about the released build, not a suitable product boundary for
the next V2 candidate.

The product must support actual workshop data. A release must not require users to replace
their existing profile with generated examples, nor may it present a new empty profile as if
the upgrade had preserved their work. Browser-origin code and DevTools can inspect browser
storage; this ADR provides local at-rest protection, not protection from code already running
inside the app's origin or from a compromised device.

## 2. Decision

### 2.1 Real data is supported; demo data is isolated

- The next candidate supports user-entered records and existing records, whether their
  contents look synthetic or real. Key names and record contents are not proof of data type.
- The generated demo remains an explicit, ephemeral session. It must not seed, replace,
  clear, or write over a user's durable profile.
- Existing `beta_test_*` keys are treated as user-owned migration sources. Their contents
  are never discarded merely because the old UI called them test data.

### 2.2 At-rest protection is mandatory for user content

- Every manifest entry classified as user content or personal data MUST be encrypted before
  durable persistence on Web, PWA, and Desktop. There is no plaintext fallback, including
  when a keyring, Web Crypto, secure context, or storage backend is unavailable.
- Web/PWA uses Web Crypto AES-256-GCM with the authenticated envelope and parameters defined
  by ADR-001/SPEC-03, deriving a non-extractable session key from a user passphrase held only
  in memory. The profile is locked on explicit lock and page exit; no passphrase is stored.
- Web data is stored in a new V2 IndexedDB vault namespace. The application MUST NOT open,
  enumerate, or alter the retired `open3dcalc_pii_vault` database as part of ordinary startup
  or V1 migration. A separate, explicitly approved compatibility reader is required if later
  evidence shows that database contains user data needing recovery.
- Desktop MUST use the existing authenticated at-rest envelope and a successfully gated OS
  keyring profile key, or an explicit session passphrase. A failed capability gate refuses
  persistence; it MUST NOT route to the current plaintext `open3dcalc_pwless_*` namespace.
- Only data classified as non-user-content (for example, interface preferences) may remain
  outside the vault, and SPEC-01 must enumerate those exact keys. Encryption does not imply
  cloud sync; no server or account is required.

### 2.3 Migration is explicit, previewed, and lossless

- No migration runs automatically at startup. The user chooses **Migrate my local data**,
  unlocks or creates the destination vault, and sees a preview grouped by source and record
  type before committing.
- The source allowlist is versioned and exact. It includes supported Stable Web v1.14 keys,
  the documented Desktop v1.14 `storage` and domain-table sources, the current known 2.x
  Stable plaintext stores, and the three `open3dcalc_beta_test_*_v1` keys. No prefix scan,
  wildcard enumeration, or unrelated IndexedDB/Cache API scan is permitted.
- Migration validates source envelopes and records, preserves IDs and relationships, applies
  only documented schema transforms, and reports imported, deduplicated, skipped, and failed
  counts by source. Duplicate IDs are resolved deterministically without dropping distinct
  records. A malformed or unavailable source is shown as a blocker, not as an empty source.
- Destination writes are encrypted and verified by reading them back through the vault
  before a migration checkpoint can advance. The source remains byte-for-byte intact until
  the user reviews a successful report and explicitly confirms source cleanup. Cancel,
  failure, or crash never resets a source or reports completion. Retrying is idempotent.
- Import from a V1 logical export is also supported after the encrypted export contract is
  revised and tested. It is additive/previewed by default; replacing existing records
  requires a separate explicit confirmation and recoverable backup.
- The application does not promise automatic recovery of an old V2 encrypted vault format
  until its exact format is inventoried and a fixture proves compatibility. It must not
  silently delete that vault or claim the records are absent.

### 2.4 Recovery, deletion, and disclosure are release gates

- Users can create and restore an encrypted, versioned backup using the governed logical
  export contract. Export/import passwords are separate from the at-rest passphrase unless a
  later reviewed ADR explicitly joins them.
- The privacy screen offers a truthful, exact-scope delete operation for the active profile,
  with a verified postcondition and clear notice that external copies are outside its reach.
- The first-run disclosure states where data is stored, what is encrypted, how to lock it,
  and that losing both the passphrase and recovery copy makes encrypted records unrecoverable.
  It must not claim that data never leaves the browser if a user invokes an export/share flow.
- Until encryption, migration, backup/restore, deletion, and disclosure gates pass on all
  release targets, the build MUST NOT invite users to enter real operational data.

## 3. Consequences

- The old Beta synthetic namespace remains readable only through a user-triggered migration;
  Beta persistence is no longer plaintext or test-only in the next candidate.
- Stable Web and Desktop policy 1.9 descriptions remain historical until the implementation
  and manifest are changed. A policy document alone does not make current runtime behavior
  encrypted.
- Web remains static-hosting compatible. The local vault requires a secure browser context
  and IndexedDB, but no server-side service.
- Password loss becomes a meaningful user risk; the product must make backup/recovery
  available and explain it before the user commits to a new encrypted profile.
- The next candidate is a data-compatibility release as well as a UX release. Existing
  profile fixtures, privacy tests, and migration evidence are required before publication.

## 4. Acceptance criteria for the next Beta candidate

1. Real user records can be created, reopened after reload, explicitly locked/unlocked, and
   inspected in storage only as ciphertext for every supported target.
2. Unsupported crypto/storage and wrong-password paths fail closed, preserve source bytes,
   and do not display an empty profile as a successful load.
3. V1.14, current 2.x Stable, current Beta, and supported Desktop fixtures migrate with
   stable IDs and no loss; preview, cancel, crash/retry, duplicate, malformed-source, and
   explicit cleanup paths are covered.
4. Backup export/import and profile deletion have verified encrypted round-trips and honest
   failure/postcondition reporting.
5. Demo data is ephemeral and cannot overwrite or merge into a real profile.
6. The privacy inventory, release disclosure, Web, PWA, and Desktop documentation match the
   shipped behavior. The normal test, lint, typecheck, build, and browser quality gates pass.

Until all six criteria are evidenced on the exact candidate tree, this ADR approves direction
only; it does not authorize or claim a release.
