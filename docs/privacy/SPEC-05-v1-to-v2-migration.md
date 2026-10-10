# SPEC-05 — Explicit Local-Profile Migration (V1 → V2)

**Target policy:** 2.0, as defined by ADR-004
**Status:** Normative for the next Beta candidate; runtime implementation pending
**Related:** SPEC-01 (data inventory), SPEC-02 (deletion), SPEC-03 (encrypted backup), ADR-001–004.

## 1. Purpose and non-goals

This specification governs user-selected migration of existing local Open3DCalc data into
the encrypted V2 profile. It is not a startup cleanup, namespace sweep, reset, cloud sync, or
proof that an old source is empty. The released `v2.0.0-beta.15` and Stable/Desktop policy
1.9 behavior remain unchanged until a candidate implements and verifies this contract.

The migration must preserve usable user data, not merely preserve a count. This includes
relationships and identifiers among customers, quotes, quote items, history snapshots,
products, materials, printer profiles, filament inventory, calculation settings, and other
user-owned records declared by the versioned source registry.

## 2. Versioned source registry

Before implementation is enabled in a release, the candidate must ship a reviewed registry
that enumerates, per supported source version and platform:

- exact storage key/table name and physical surface;
- record envelope/schema version and validator;
- destination manifest key and transform version;
- identifier and relationship fields used for deduplication;
- whether the source can be read, copied, verified, and explicitly cleaned up; and
- the user-facing label used in preview and completion reports.

The first registry must cover, at minimum, the supported Stable Web v1.14 profile, Desktop
v1.14 profile, current 2.x Stable plaintext keys, current Desktop `open3dcalc_pwless_*`
rows, and all three current Beta source keys:

- `open3dcalc_beta_test_customers_v1`
- `open3dcalc_beta_test_quotes_v1`
- `open3dcalc_beta_test_history_v1`

For the published Beta source, content is treated as user-owned regardless of whether it was
generated, typed, or mixed. Desktop domain tables and the generic `storage` table are distinct
sources and must be enumerated separately. The registry is an exact allowlist: wildcard
prefixes, broad key enumeration, and opening the retired `open3dcalc_pii_vault` are forbidden.
The registry and synthetic fixtures must be finalized from the shipped v1.14/v2 code before
the release gate can pass; this document does not claim that audit has been completed.

## 3. User flow and preview

1. Startup may report that migration is available from non-sensitive source metadata, but it
   must not read source record contents or alter any source.
2. The user selects **Migrate my local data**. The app then reads only the registry's exact
   sources and presents a preview of source status and record counts by type. Values such as
   names, email addresses, addresses, quote text, and notes are not shown in logs or telemetry.
3. Missing, malformed, inaccessible, or unsupported sources appear as distinct states. None
   may be represented as an empty source. The user can cancel without mutation.
4. The user unlocks an existing V2 profile or creates one after seeing the recovery warning.
   The destination is never initialized from demo seeds during migration.
5. The user confirms the preview. The app transforms and writes data to the encrypted
   destination, then reads it back and validates counts, identifiers, and relationships.
6. The app presents a report with per-source counts for imported, already-present,
   deduplicated, skipped-with-reason, and failed records. A successful copy is not described
   as a completed move while plaintext sources remain.
7. After reviewing the report, the user may explicitly request cleanup of exact sources the
   registry marks cleanable. Cleanup is verified by rereading those same exact sources. If
   cleanup is unavailable or fails, the destination remains usable and the remaining source
   is disclosed; the app never claims it was removed.

## 4. Integrity and retry rules

- Source bytes are read-only until the explicit post-copy cleanup action. Preview, cancel,
  password failure, destination failure, and crash preserve them byte-for-byte.
- Writes use stable source IDs plus a migration/import ledger so retry does not duplicate a
  record. A transformation must be deterministic for the same source bytes and version.
- Each source group is checkpointed only after its destination data has been written
  encrypted and read back successfully. A failed group remains retryable; completed groups
  are not silently reimported.
- Deduplication may merge records only when the registry defines a stable identity rule and
  the records are equivalent under that rule. Distinct IDs remain distinct even when their
  visible fields happen to match.
- Schema changes are versioned, validated, and tested with both historical fixtures and
  current application serializers. Unknown fields are preserved where safe or surfaced as
  unsupported; they are never silently dropped.
- The migration does not inspect arbitrary files, browser databases, service-worker caches,
  or unrelated SQLite tables. A newly discovered source requires a reviewed registry update.

## 5. Required verification fixtures

The candidate test suite must include synthetic, non-PII fixtures for each registry entry and
cover:

- intact source → preview → encrypted copy → decrypt/read-back parity;
- all supported source combinations, including overlapping Stable/Beta records;
- duplicate IDs, distinct IDs with identical display fields, missing IDs, and broken links;
- malformed JSON/envelopes, unsupported schema versions, inaccessible storage, quota errors,
  wrong passphrase, and unavailable cryptographic capability;
- cancel at preview, cancel after destination creation, crash/restart at every checkpoint,
  idempotent retry, and partial-source failure;
- explicit cleanup success and cleanup failure, with truthful remaining-source reporting;
- demo data never being written into, substituted for, or merged with a durable profile; and
- a sentinel in every undeclared key/database/table remaining untouched.

Fixtures must never contain real personal or customer data. Browser integration tests must
use the production Web Crypto/IndexedDB path; Electron integration tests must exercise the
actual gated IPC/database path, not only renderer mocks.

## 6. Release gate

V1→V2 migration is a hard gate for a real-data Beta. The release is blocked unless the exact
source registry, preview/consent flow, encryption/read-back, retry behavior, supported
cleanup outcomes, and all fixtures pass on Web Stable, Web Beta/PWA, and Desktop targets.
Any source not supported by the registry must be named in the release disclosure and left
untouched; no release may claim that source was migrated.
