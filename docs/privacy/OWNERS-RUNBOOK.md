# OWNERS-RUNBOOK — Plaintext Local Data

**Owner:** Repository owner (policy approval); implementation owners are assigned per change.
**Scope:** Local persistence, JSON portability, deletion boundaries, and privacy disclosures.

## 1. Current behavior

- Customer, quote, history, and calculator data are stored locally in readable form. Web uses
  browser storage; Desktop uses its local SQLite profile. Saves do not require a password, key,
  cryptographic capability, or consent receipt.
- `.open3dcalc` exports are readable JSON and may contain real user data. Anyone with access to
  the file or profile can read it; users should store files only in locations they control.
- A SHA-256 checksum may be included to detect accidental corruption. It does not encrypt,
  conceal, or authenticate file contents.
- Readable v1.0 JSON exports remain importable for data migration between app versions. Older
  encrypted exports are unsupported and must be rejected without requesting a password or
  attempting decryption.
- Existing opaque bytes in retired encrypted stores are not automatically opened, decoded,
  migrated, overwritten, or deleted. They may remain on disk and are not recoverable in the
  current app. This does not prevent migration from readable V1 JSON exports.
- Deletion reports only the outcome for data reachable through current supported adapters. It
  does not promise removal of exported files, external copies, or retired historical bytes.
- The `contract_performance` legal-basis annotation is provisional and requires qualified legal
  review. Engineering documentation is not a legal determination.

## 2. Change rules

- Do not add password prompts, encryption/decryption code, key derivation/key storage, or
  encrypted backup formats without a new explicit owner decision and reviewed design.
- Do not silently change the readable export format. Preserve migration from supported
  readable V1 JSON or document a deliberate versioned migration.
- Do not turn legacy-format detection into a decoder or an automatic data rewrite.
- Keep privacy disclosures explicit about local readable storage and readable exports.

## 3. Verification checklist

For changes to persistence, portability, or privacy behavior, run:

1. `npm run test:run` and `npm run test:browser`.
2. `npm run typecheck` and `npm run typecheck:electron`.
3. `npm run lint`.
4. `npm run build:web`, `npm run build:desktop`, and the relevant save/reload checks.
5. Review the diff and confirm no secret values or user records are logged.

This runbook authorizes no commit, merge, release, or publication.
