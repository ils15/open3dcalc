# TEST-MATRIX — Current Local Data Contracts

This matrix describes the current plaintext storage and JSON portability behavior. The former
encryption/key/password flows are retired. These checks do not claim security against another
process, browser extension, same-origin script, or anyone with access to the user's profile or
export file.

## 1. Local persistence

| Scenario                                                        | Required result                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Save customer, quote, history, and calculation data on Web      | Readable data is stored locally and survives reload.                                                |
| Save and reload the same data on Desktop                        | Readable data persists in the local SQLite profile.                                                 |
| Save a record while no key, password, or consent receipt exists | Save proceeds; no encryption setup or unlock is requested.                                          |
| Local storage is unavailable or malformed                       | Report persistence failure; do not claim success or overwrite unreadable bytes with empty defaults. |
| Beta Web starts with Stable data in the same profile            | Beta uses the shared real-data stores; no separate synthetic-only namespace is required.            |

## 2. Export and import

| Scenario                                                              | Required result                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Export local records                                                  | Produce readable JSON containing supported real user data; no password, key, cipher, or encryption metadata is generated. |
| Import a current readable JSON export                                 | Validate the format/checksum and apply the requested merge or replace operation.                                          |
| Import a previous readable v1.0 JSON export with `encrypted: false`   | Continue to support it for migration between app versions.                                                                |
| Import an old encrypted envelope or a bundle marked `encrypted: true` | Reject it without asking for a password or attempting decryption.                                                         |
| Modify a checksum-protected readable export                           | Reject a checksum mismatch; the SHA-256 checksum is integrity-only and does not hide contents.                            |

## 3. Historical data and privacy

| Scenario                                                 | Required result                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Existing bytes in retired encrypted vault/key namespaces | Do not open, enumerate, decrypt, migrate, overwrite, or delete them automatically. They remain unsupported and may remain on disk. |
| Display local-data privacy information                   | Clearly state that current profile data and JSON exports are readable by anyone with access.                                       |
| Delete current supported records                         | Report only the result for data reachable through current adapters; do not claim deletion of external files or retired data.       |

## 4. Verification

Run the full Vitest suite, web and Electron typechecks, lint, web/Desktop builds, and browser
checks after changes to these contracts. Test fixtures may use synthetic records; this does not
restrict real user data in the product. This matrix authorizes no commit, merge, or publication.
