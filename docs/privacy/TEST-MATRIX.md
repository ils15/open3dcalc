# TEST-MATRIX — Policy 1.9 Contracts

**Scope:** Stable/Desktop direct plaintext saves, Web-Beta app-mediated restrictions, current-owned-data deletion, and retained encrypted export. This matrix replaces the former local at-rest encryption, vault-lock, consent-gate, and startup-migration requirements. Implementation was merged into `main` by PR #279 and is present in web Beta `v2.0.0-beta.15`; final Themis review and explicit owner/legal approval remain required before Stable promotion.

**Candidate status:** Sections §0–§8 describe policy 1.9, historical implementation evidence,
or the currently published Beta. They do not authorize real-data use in `beta.15`. The next V2
candidate is governed by ADR-004, SPEC-01 V2 Candidate, and SPEC-05; the independent release
matrix in §9 remains pending until its implementation and fixtures pass.

## 0. Global rules

- Use synthetic values only (`example.invalid`, generated names and identifiers).
- Verify behavior at the persistence boundary and through a real save/reload path; a UI-only
  assertion is insufficient.
- Assert failures by cause. A RED test is valid only when it fails because the intended
  policy behavior is absent, not due to setup, malformed fixtures, or unrelated runtime errors.
- Stable and Desktop local PII saves require no passphrase, consent receipt, vault unlock, or
  export password. Beta is intended for synthetic records, but app checks do not validate record
  content; its namespace restriction is app-mediated and not a same-origin security boundary.
- Keep encrypted export cryptography and its existing compatibility/integrity coverage (§6).
- Do not open, enumerate, inspect, convert, recover, migrate, or delete inert historical vault
  bytes. No startup cleanup test may expect such bytes to be removed.
- Candidate tests use synthetic fixtures. A record in a historical `beta_test_*` key is never
  presumed disposable from its key name.

## 1. Manifest and policy validation (SPEC-01)

| ID  | Setup                                                        | Required result                                                                                                                                                 |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Validate the Stable manifest fixture against the schema      | Valid policy 1.9; manifest version and encrypted-entry versions remain frozen                                                                                   |
| 1.2 | Inspect the three Stable customer/quote/history keys         | Each declares `pii:true`, `persistence:plaintext_allowed`, provisional `contract_performance`, Web/PWA `localStorage` and its Desktop alias in SQLite `storage` |
| 1.3 | Try `plaintext_allowed` for any other PII key or destination | Rejected; only the exact three-key scope and platform-specific destinations are accepted                                                                        |
| 1.4 | Inspect vault and retired migration targets                  | Not declared as active write, migration, or deletion targets; existing stored bytes are not read or changed                                                     |
| 1.5 | Validate the Beta fixture/schema                             | Exact three Web-only keys designated for synthetic test data; no permissions for sync, export, import, or deletion                                              |
| 1.6 | Validate unrelated manifest constraints                      | Unknown keys/enums, malformed entries, duplicate keys, and invalid snapshot/diagnostic/consent declarations remain rejected                                     |

## 2. Historical D1.0 RED phase (closed)

The following table preserves the original RED-first implementation plan. Its expected-failure
status applied to the historical contracts-only phase and is not the status of the current
branch. The current branch has implemented these behaviors; use §8 for final verification.

| Suite                       | Required scenario                                                                                                    | RED reason before runtime implementation                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `betaDirectSave`            | Fresh Web-Beta profile; save a synthetic customer/quote/history record without password, consent, receipt, or unlock | Regression guard for unchanged Beta behavior; this branch already passes the fresh-profile customer save, so it is not required to be RED |
| `stablePlaintextAcceptance` | Stable Web and Desktop accept only the exact policy 1.9 plaintext manifest declarations                              | Loader/guard still rejects approved plaintext PII or does not recognize policy 1.9                                                        |
| `saveReloadChannels`        | Real save then fresh-module/profile reload for Stable Web, Desktop, and Web Beta                                     | At least one supported channel does not persist and rehydrate its permitted record directly                                               |
| `noGatePrerequisites`       | Fresh profile save on Stable and Beta with no password, consent, receipt, or vault unlock                            | A retired local save prerequisite still blocks or diverts the operation                                                                   |

Stable/Desktop cases must fail for the unmet direct-save policy or exact manifest rejection.
The Beta direct-save regression may already be green because its implementation predates this
Stable policy change. A fixture parse error, missing test dependency, or unrelated UI
exception is not valid RED evidence.

## 3. Beta restrictions and isolation

| ID  | Setup                                                                                     | Required result                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Beta opens with empty profile                                                             | First-run disclosure says test-only, intended synthetic use, plaintext/local, disposable profile; no password/consent/migration/export/deletion controls                  |
| 3.2 | Attempt Stable-key access, prefix variant, unknown key, or legacy marker                  | Denied without reading, writing, scanning, or altering bytes                                                                                                              |
| 3.3 | Attempt IndexedDB/vault, Cache API, SQLite, desktop bridge, namespace sweep, or migration | No access or mutation; Beta remains Web-only                                                                                                                              |
| 3.4 | Attempt sync, import, export, backup, erasure, withdrawal, recovery, or delete            | Refused before record collection, storage, crypto, filesystem, or dispatch                                                                                                |
| 3.5 | Seed same-origin Stable canaries and exercise Beta                                        | Beta app paths leave Stable bytes byte-identical and touch only the three Beta keys; this does not prevent same-origin scripts/extensions/DevTools from accessing storage |

## 4. Stable/Desktop save, reload, and failure behavior

| ID  | Setup                                                                                             | Required result                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Fresh Stable Web profile; save a synthetic record to each declared customer/quote/history key     | Plaintext bytes are stored directly under the exact key with no password/consent/unlock prerequisite                            |
| 4.2 | Reload Stable Web with the same storage                                                           | The saved values are hydrated intact; no empty default overwrites existing bytes                                                |
| 4.3 | Fresh Desktop profile; save and reload each supported PII record through its declared destination | Values persist and reload as plaintext under `open3dcalc_pwless_*` keys in SQLite `storage`; no keyring/passphrase prerequisite |
| 4.4 | Local storage read/write unavailable or throws                                                    | The save reports failure truthfully; it does not claim durable success or silently drop the value                               |
| 4.5 | Malformed stored bytes                                                                            | Do not overwrite with empty defaults; expose a recoverable storage error without inspecting unrelated historical stores         |
| 4.6 | Seed an inert legacy-vault canary before save/startup                                             | No code path opens, enumerates, reads, converts, recovers, migrates, or removes the canary                                      |

## 5. Current-owned-data deletion

| ID  | Setup                                                                  | Required result                                                                      |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 5.1 | Delete current owned Stable/Desktop records                            | Only declared current data reachable through supported adapters is deleted           |
| 5.2 | In-scope deletion operation fails                                      | Report failure/partial outcome; never claim complete deletion                        |
| 5.3 | Seed inert vault, retired migration targets, and external-copy markers | They remain byte-identical and are excluded from the result; no startup cleanup runs |
| 5.4 | Invoke deletion in Beta                                                | Refuse before any storage, deletion, sweep, or cleanup operation                     |

## 6. Encrypted logical export (E1 retained; SPEC-03)

| ID  | Setup                                                        | Required result                                                                                                                           |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Export with a valid password                                 | Existing envelope format/version, algorithms, KDF parameters, authenticated integrity, and configured size/iteration limits are unchanged |
| 6.2 | Wrong password, tampered envelope, malformed/oversized input | Reject safely without partial imports, plaintext leakage, or weakening validation                                                         |
| 6.3 | Save locally with no export password                         | Local Stable/Desktop and synthetic Beta save behavior is independent of export password state                                             |
| 6.4 | Attempt Beta import/export even with a password supplied     | Refuse before collecting records or performing crypto/file operations                                                                     |
| 6.5 | Export current supported data                                | No inert historical vault or retired migration bytes are inspected or included                                                            |

## 7. Receipt/version behavior

| ID  | Setup                                                                   | Required result                                                                                                                   |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Load a receipt created under an earlier policy version                  | Preserve its bytes and evaluate it as `policy_mismatch` under 1.9                                                                 |
| 7.2 | Save while there is no receipt, an old receipt, or a mismatched receipt | Local save proceeds; receipt status is not a save gate                                                                            |
| 7.3 | Check legal-basis annotation in the fixture                             | `contract_performance` is visibly provisional and subject to qualified legal review, not asserted as an engineering determination |

## 8. Current verification and review gates

- Run the full test suite, web and Electron typechecks, ESLint, formatting checks, Stable and
  Beta builds, and stable-preview browser checks for this branch's final wave; report any
  unrelated baseline failures separately.
- Final Themis review is required before promotion. This matrix authorizes no commit, merge,
  release, or publication. The published web Beta is `v2.0.0-beta.15`; that Beta publication
  does not authorize promotion of the separate Stable/Desktop policy.

## 9. Next V2 real-data candidate (ADR-004; all gates pending)

These are additional acceptance tests for a new policy-2.0 manifest/runtime. They supersede
§3–§7 only for the exact next candidate once its manifest and disclosure are implemented;
they do not change the tests or claims for `beta.15`.

### 9.1 Encrypted user-content persistence (S1)

| ID    | Setup                                                                | Required result                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1.1 | Validate the candidate manifest and source-map fixture               | Every durable `user_content`/personal-data key is `encrypted_at_rest` on Web/PWA/Desktop; plaintext Beta data keys are sources only; only the reviewed preference allowlist stays plaintext           |
| 9.1.2 | Create a new Web profile with a passphrase and recovery disclosure   | New profile creation requires explicit acknowledgement; passphrase never enters storage, URL, logs, or analytics; no demo records are seeded into the durable profile                                 |
| 9.1.3 | Unlock a populated profile after reload                              | All registered user-content stores positively rehydrate before write access; wrong password or one failed/corrupt store blocks writes and never displays an empty profile as successful hydration     |
| 9.1.4 | Save unique synthetic sentinels to every user-content store          | IndexedDB contains authenticated ciphertext only; browser localStorage has no candidate content; ciphertext does not contain sentinel values; unlock/reload returns exact logical values              |
| 9.1.5 | Run without secure Web Crypto/IndexedDB or with quota/write failure  | User-content persistence fails closed, reports no durable save, preserves existing bytes, and does not fall back to plaintext                                                                         |
| 9.1.6 | Enter/edit/exit/reload explicit demo with a preexisting real profile | Demo values are ephemeral; ciphertext and legacy sources are byte-identical before/after; leaving/reloading does not write demo state into the profile                                                |
| 9.1.7 | Exercise Desktop with keyring capability available/unavailable       | Real gated Desktop path persists only encrypted values; unavailable gate refuses with no `open3dcalc_pwless_*` plaintext write; restart/unlock reads values back                                      |
| 9.1.8 | Export, restore, lock, and delete a candidate profile                | SPEC-03 encrypted backup round-trips every declared content class; exact-scope deletion verifies only active profile data removed; external backups and unselected sources are disclosed as remaining |

### 9.2 Explicit V1/current-profile migration (S2)

| ID    | Setup                                                                                                    | Required result                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.2.1 | Start with any registered source present                                                                 | Startup does not parse source contents; a visible migration action is available, and an empty new profile is not offered as if prior data were preserved                        |
| 9.2.2 | Select migration and preview each exact source                                                           | Only allowlisted source IDs are read; preview shows source/type/status/count, never PII values; cancel leaves source and destination byte-identical                             |
| 9.2.3 | Confirm migration with valid destination unlock                                                          | Stable IDs, relationships, snapshots, settings, products, catalog, and inventory are copied to encrypted destination and read back before source is eligible for cleanup        |
| 9.2.4 | Repeat or resume after interruption at every checkpoint                                                  | Migration is idempotent and resumable; no duplicate records; completed groups remain verified and incomplete groups remain retryable                                            |
| 9.2.5 | Duplicate records across v1.14 storage and domain rows                                                   | Only exact identity-equivalent duplicates are deduplicated; distinct IDs with identical display fields remain distinct; report counts explain each decision                     |
| 9.2.6 | Malformed, unsupported, inaccessible, or corrupt source; wrong passphrase; quota error                   | Show blocker/failure rather than empty; source remains byte-identical; no completion/checkpoint is reported for an unverified destination                                       |
| 9.2.7 | Confirm source cleanup after successful report                                                           | Delete only exact sources marked cleanable after a second confirmation; reread to verify; failed cleanup reports remaining plaintext without invalidating encrypted destination |
| 9.2.8 | Seed sentinel data in undeclared localStorage key, IndexedDB database, SQLite table, or Beta key version | Migration never opens/enumerates/changes the sentinel; old `open3dcalc_pii_vault` remains unopened unless a separately reviewed compatibility reader is approved                |

Synthetic source fixtures must be checked against tagged v1.14 and current 2.x serializers.
Web tests must exercise production Web Crypto/IndexedDB; Desktop tests must exercise the
actual gated main-process IPC/database path, not a renderer-only mock. Failure of any S1/S2
case blocks a Beta that advertises support for real data.
