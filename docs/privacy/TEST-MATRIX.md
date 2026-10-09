# TEST-MATRIX — Policy 1.9 Contracts

**Scope:** Stable/Desktop direct plaintext saves, Web-Beta app-mediated restrictions, current-owned-data deletion, and retained encrypted export. This matrix replaces the former local at-rest encryption, vault-lock, consent-gate, and startup-migration requirements. Implementation is present on the current branch; final Themis review is pending and no publication is authorized.

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
  release, or publication; published web Beta remains v2.0.0-beta.13.
