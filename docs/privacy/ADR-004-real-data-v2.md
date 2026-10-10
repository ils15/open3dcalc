# ADR-004 — Real-Data V2: Readable Local Profile and Explicit Migration

**Decision date:** 2026-10-10
**Status:** Product direction approved; complete migration and release gates pending
**Applies to:** the next V2 Beta candidate and later Stable/Desktop builds
**Supersedes for that target:** the Beta test-only restriction and proposals that require
local-at-rest encryption, app passwords, or key management
**Related:** ADR-001/002/003, SPEC-01–05, and the data-compatibility gate in `ROADMAP.md`.

## 1. Context

The published `v2.0.0-beta.15` uses three Beta-specific localStorage keys intended for
synthetic test data; the application does not validate that record contents are synthetic.
Stable Web and Desktop already have local plaintext persistence paths. The product must support
actual workshop records and preserve existing user data through an explicit V1/current-profile
migration. This decision deliberately does not add an app-level encryption or password flow.

Readable local storage is not a confidentiality boundary: same-origin code and anyone with
access to a browser or Desktop profile can read it. This is an explicit product tradeoff, not
protection against a compromised device or application origin. Local persistence does not
send records to an Open3DCalc server.

## 2. Decision

### 2.1 Real data is supported; demo data is isolated

- The next candidate supports user-entered and existing records whether their contents look
  synthetic or real. Key names and record contents are not proof of data type.
- The generated demo remains an explicit, ephemeral session. It must not seed, replace, clear,
  or write over a user's durable profile.
- Existing `beta_test_*` keys are user-owned migration sources. Their contents are never
  discarded merely because an earlier UI called them test data.

### 2.2 Local storage is readable; no app-level encryption

- User records are stored locally in readable browser storage on Web/PWA and readable SQLite
  profile storage on Desktop. Saves require no app password, passphrase, keyring, vault unlock,
  encryption capability, or consent receipt.
- Do not add an encryption/decryption path, password/key lifecycle, encrypted-at-rest vault, or
  encrypted export without a new explicit owner decision and reviewed product design.
- Disclose the exact consequence: anyone with access to the browser origin/profile, Desktop
  user profile, or exported JSON may read those records. Users should use trusted devices and
  operating-system account protections.
- Local persistence remains separate from network services; no account or cloud sync is
  introduced by this decision.

### 2.3 Migration is explicit, previewed, and lossless

- No broad migration runs automatically at startup. A visible migration action reads only a
  versioned, exact source allowlist after the user chooses to preview it.
- The initial source inventory covers supported Stable Web v1.14 keys, documented Desktop
  v1.14 storage/domain-table sources, current 2.x Stable/Desktop plaintext stores, and the
  known `open3dcalc_beta_test_*_v1` keys. No prefix scan, wildcard enumeration, or unrelated
  IndexedDB/Cache API scan is permitted.
- Migration validates source records, preserves IDs/relationships, applies documented schema
  transforms, and reports imported, deduplicated, skipped, and failed counts by source.
  Malformed or inaccessible data is a blocker, never an empty-source success.
- Destination records are written in the normal readable local format and read back/validated
  before a source group is reported as copied. Sources remain byte-for-byte intact until the
  user reviews a successful report and separately confirms exact-source cleanup.
- Cancel, failure, or crash never resets a source or reports completion. Retry is idempotent.
  Import from a supported readable JSON export is previewed/additive by default; replacing
  existing records requires separate explicit confirmation.
- The retired `open3dcalc_pii_vault` is not opened or modified by ordinary startup or migration.
  No automatic recovery of unsupported encrypted legacy files is promised; their bytes remain
  untouched and may be unrecoverable by this version.

### 2.4 Portability, deletion, and disclosure are release gates

- User-initiated export and import use readable, versioned JSON. A SHA-256 checksum can detect
  accidental corruption only; it is not encryption, authentication, or a secrecy mechanism.
- The privacy screen offers truthful, exact-scope deletion of current supported local data and
  clearly states that exported files, external copies, and inert historical bytes are outside its
  reach.
- First-run and privacy disclosures state that local records are readable, where they reside,
  what export contains, and which old formats are unsupported. They must not claim that data
  never leaves the device when a user invokes a share/export flow.
- A target may advertise real-data support only after its direct save/reload, explicit migration,
  readable export/import, deletion, and disclosure gates pass. This ADR alone does not authorize
  a release.

## 3. Consequences

- The Beta synthetic namespace is migrated only through the reviewed user-data path; Beta and
  Stable use the shared local profile in the candidate.
- No passphrase-loss recovery issue is introduced because the app does not encrypt or gate local
  saves. Conversely, profile/file access grants readable access to the data.
- The product must be honest about the exposure tradeoff and avoid presenting a checksum as
  security. External backups remain the user's responsibility.
- Web remains static-hosting compatible. The candidate requires no server-side service.
- The next candidate is a data-compatibility release as well as a UX release. Source fixtures,
  migration evidence, export/import behavior, deletion, and disclosures must pass before
  publication.

## 4. Acceptance criteria for the next Beta candidate

1. Real user records can be created and reopened after reload on each supported target without
   an app password/key prompt; local storage and export behavior match the readable-data
   disclosure.
2. Storage errors, malformed records, and quota failures are reported truthfully and never
   silently overwrite existing data with empty defaults.
3. Supported V1.14, current 2.x Stable, current Beta, and Desktop fixtures migrate with stable
   IDs and no loss; preview, cancel, interruption/retry, duplicates, malformed-source, and
   explicit cleanup paths are covered.
4. Readable JSON export/import validates format and checksum, round-trips supported records,
   and rejects unsupported encrypted legacy envelopes without asking for a password.
5. Demo data is ephemeral and cannot overwrite or merge into a real profile.
6. Exact-scope deletion and privacy disclosure match the shipped behavior on Web, PWA, and
   Desktop. The normal tests, lint, typechecks, builds, and browser gates pass.

Until these criteria are evidenced on the exact candidate tree, this ADR approves product
direction only; it does not claim that migration or a release is complete.
