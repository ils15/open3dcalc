# TEST-MATRIX — Local Data and Migration Contracts

This matrix covers readable local storage, JSON portability, and explicit migration. It does
not claim protection against another process, a same-origin script, a browser extension, or
anyone with access to the user's browser/Desktop profile or exported file. A SHA-256 checksum
detects accidental changes; it does not encrypt or authenticate the data.

## 1. Local persistence

| Scenario                                                                         | Required result                                                                                                                         |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Save customer, quote, history, product, inventory, or calculator data on Web/PWA | Readable data is stored locally and survives reload.                                                                                    |
| Save and reload supported data on Desktop                                        | Readable data persists in the user's local SQLite profile.                                                                              |
| Save with no app password, key, keyring, or consent receipt                      | Save proceeds without an unlock or cryptographic setup flow.                                                                            |
| Local storage is unavailable, malformed, or rejects a write                      | Report persistence failure; do not claim success or overwrite unreadable bytes with empty defaults.                                     |
| Beta starts with valid legacy `open3dcalc_beta_test_*` records                   | Copy/merge only the exact recognized keys into the shared Stable keys before hydration; remove old copies only after successful writes. |
| Stable and Beta use the same browser origin                                      | App storage uses the shared profile; disclosure makes clear that same-origin code and profile access can read it.                       |
| Demo/example flow is entered and exited                                          | Demo values do not overwrite or silently merge into durable user records.                                                               |

## 2. Export and import

| Scenario                                                     | Required result                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Export supported local records                               | Produce readable JSON; do not add password, key, cipher, or encryption metadata.                                         |
| Import a current readable JSON export                        | Validate format and checksum before writes; present/perform the selected additive or replace operation as documented.    |
| Import a supported readable v1.0 JSON export                 | Preserve compatibility for migration between app versions.                                                               |
| Import an old encrypted envelope or `encrypted: true` bundle | Reject without asking for a password or attempting decryption.                                                           |
| Modify a checksum-protected export                           | Reject the checksum mismatch; do not claim the checksum hides or authenticates the contents.                             |
| Export/import completes or fails                             | Never report a successful durable operation before validation and writes complete; never send local records to a server. |

## 3. Historical data and privacy

| Scenario                                        | Required result                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retired encrypted vault/key bytes exist         | Do not open, enumerate, decrypt, migrate, overwrite, or delete them automatically; disclose that they remain unsupported and may remain on disk.             |
| Privacy screen or first-run disclosure is shown | State that current profile data and JSON exports are readable to anyone with access to the profile/file; explain the local-only storage boundary accurately. |
| User deletes current supported records          | Report only the outcome for data reachable through supported adapters; do not claim deletion of external files or inert historical data.                     |
| Logs/errors are generated from user records     | Do not log customer content, secrets, or full export payloads.                                                                                               |

## 4. Explicit V1/current-profile migration (release gate)

The Beta legacy-key copy in §1 is a narrow compatibility path. It does not by itself prove the
full V1.14/current-profile migration contract. Migration acceptance tests must cover:

| Scenario                                                   | Required result                                                                                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A supported source is present at startup                   | Show that migration is available without silently resetting or replacing the source.                                                                                                                  |
| User opens migration preview                               | Read only exact, versioned allowlisted sources; show source/type/status/counts, never personal values.                                                                                                |
| User cancels preview or a source is malformed/inaccessible | Leave source bytes unchanged and report a distinct canceled/blocked state, not an empty profile or success.                                                                                           |
| User confirms migration                                    | Copy supported records to the readable local destination; preserve IDs, relationships, snapshots, and unknown fields where safe; validate the destination by reading it back.                         |
| Migration is retried or interrupted                        | Be idempotent/resumable; do not duplicate records or report a group complete before destination verification.                                                                                         |
| Duplicate and distinct records are encountered             | Deduplicate only exact identity-equivalent records under documented rules; preserve distinct IDs even if display fields match.                                                                        |
| Source cleanup is offered                                  | Require a separate explicit confirmation after a successful report; delete only exact registered sources and verify cleanup. Failure leaves the destination usable and reports remaining source data. |
| An undeclared key/database/table is present                | Never discover or mutate it through prefix scans, broad enumeration, or unrelated storage access.                                                                                                     |

Fixtures must be synthetic and checked against tagged v1.14 and current serializers. Browser
tests must exercise the production storage path; Desktop tests must exercise the actual IPC and
SQLite path, not only renderer mocks. Migration and disclosure gates must pass for each target
before that target is advertised as supporting real data.

## 5. Verification and decision status

After changes to these contracts, run the full test suite, browser storage tests, web/Electron
typechecks, lint, web/Desktop builds, and relevant save/reload/migration checks. The currently
implemented plaintext save/export behavior is separate from the still-pending full V1.14 and
Desktop migration gates. This matrix authorizes no release or publication.

The former at-rest and export encryption tests are historical evidence only. Current tests must
guard against reintroducing password/key/encryption flows unless the owner explicitly changes
this decision again. Legacy encrypted files remain unsupported; no automatic recovery is
promised.
