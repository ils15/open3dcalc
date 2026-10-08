# SPEC-02 — Current-Owned-Data Deletion

**Policy:** 1.9
**Status:** Current deletion scope; supersedes the former all-surfaces saga contract
**Related:** SPEC-01 (manifest), ADR-002 (inert historical retention), ADR-003 (export)

## 1. Goal and boundary

This specification defines deletion of current application-owned data that the active
Stable/Desktop build owns and can identify through the current manifest and supported
storage adapters. It does not claim complete erasure from every physical surface, external
copy, historical profile, or retired storage format. The caller must not report successful
deletion if an in-scope operation fails.

The declared current scope is limited to current owned records in supported application
stores, including the current customer, quote, and history records on the active Stable or
Desktop target. Only explicitly declared, currently supported keys/rows are eligible; there
is no wildcard namespace sweep, legacy scanner, migration target, or filesystem-wide purge.

## 2. Excluded historical data

The following are explicitly outside current deletion scope:

- all bytes already stored in the retired `open3dcalc_pii_vault` IndexedDB database;
- retired migration, quarantine, preimage, legacy-residue, and passphrase-session targets;
- exports or backups outside the application's current owned stores; and
- all Stable data when running Web Beta.

Historical vault bytes are inert. Startup and deletion paths must not open, enumerate, read,
inspect, convert, recover, migrate, or delete that database. No startup cleanup or automatic
expiry may be added for these targets. Their bytes may remain in the profile indefinitely;
the application makes no promise that they can be recovered.

## 3. Current deletion behavior

1. The user explicitly invokes deletion in a channel that supports it.
2. The implementation identifies only current owned data using the active SPEC-01 manifest
   and the supported adapter for the current target.
3. It deletes those identified values and records truthful per-operation outcomes.
4. It reports completion only when all in-scope operations succeed. On failure it reports an
   error/partial outcome and must not imply that excluded or external copies were removed.

The operation does not require unlocking the retired vault, a passphrase, consent, a receipt,
or access to an encrypted rollback snapshot. This contract does not promise crash recovery,
rollback, restoration, secure physical overwrite, WAL compaction, cache-wide cleanup, or a
cross-surface post-condition scan. Such guarantees must not be inferred from the word
“delete”.

## 4. Beta refusal

Web Beta remains synthetic-only and has no user deletion, erasure saga, withdrawal purge,
recovery, namespace sweep, or cleanup operation. A Beta deletion request must be refused
before storage access or mutation. Beta's three exact test keys are not granted deletion
permission by this Stable/Desktop policy.

## 5. External copies and disclosure

The UI and release documentation must distinguish the supported current deletion scope from
copies the application does not control. Users must be told that encrypted exports, external
backups, and inert historical vault bytes can remain. A current deletion success is not a
claim about those excluded copies.

## 6. Verification contract

Tests must cover deletion of current owned data, truthful failure reporting, no access to the
retired vault or migration targets, and Beta refusal before mutation. Tests must not require
or simulate vault purge, encrypted rollback, historical-data recovery, or automatic startup
cleanup.
