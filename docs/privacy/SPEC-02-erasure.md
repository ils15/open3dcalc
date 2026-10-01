# SPEC-02 — Erasure (Delete-All) Saga

**Track:** D1 — Privacy & Data Contracts
**Status:** Normative for D1.1+ (D1.0 is documentation only)
**Addresses findings:** R4 (deleteAll completo), R9 (atomicidade saga), R10 (crash/rollback/efêmera)
**Related:** SPEC-01 (manifest), ADR-001 (crypto), ADR-002 (quarantine), SPEC-04 (receipt)

## 1. Goal

"Delete all my data" must be a **complete, resumable, verifiable** erasure across every
persistence surface — not a best-effort loop over `localStorage` keys. This spec defines
the state machine, the per-store journal, crash recovery, rollback semantics, and the
post-condition proof.

## 2. State machine

```
prepared ──> snapshot_taken ──> deleting ──> committed
                  │                │
                  └────> rolled_back ◄────┘ (failure before commit point)
```

| State            | Meaning                                                                                           | Persisted?               | Resumable?                               |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `prepared`       | User confirmed delete-all; manifest scanned; per-store plan built; passphrase/capability verified | journal on disk          | yes — restart re-enters `prepared`       |
| `snapshot_taken` | Safety snapshot of all PII-bearing surfaces written (encrypted, TTL)                              | journal + snapshot files | yes — idempotent re-entry                |
| `deleting`       | Per-store deletion in progress; each store's progress journaled individually                      | journal (per-store rows) | yes — resume from first incomplete store |
| `committed`      | All stores completed deletion; post-condition rescan passed; snapshot destroyed                   | journal (final)          | terminal                                 |
| `rolled_back`    | Failure before the commit point; snapshot restored; partial deletions undone                      | journal (final)          | terminal (user may retry)                |

Rules:

- The saga MUST be **resumable per store**, not merely per saga. Each store has its own journal
  row with its own state (`pending | in_progress | done | failed`).
- `deleting` is the only state where partial progress exists; it is always safe to resume
  because each store row records exactly what has been completed.
- **Crash after `snapshot_taken`** (including crash mid-`deleting`): on restart, the saga
  resumes **idempotently** — re-running a store's deletion must be safe (deleting an
  already-deleted key/row/table is a no-op success). The saga never restarts from scratch
  and never re-prompts the user for confirmation already given (the journal holds the
  confirmation record).
- **Commit point:** the saga commits only after (a) every store row is `done`, and (b) the
  post-condition rescan (§6) passes. Before the commit point, any unrecoverable failure
  rolls back. After the commit point, failures are impossible by construction (nothing left
  to fail) — the terminal state is durable.

## 3. Store coverage (per-store journal)

The saga MUST iterate over **every** surface in SPEC-01, per platform:

| #   | Store                      | Platform | Deletion mechanics                                                                                                                  |
| --- | -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `localStorage`             | all      | remove every manifest key + any unknown `open3dcalc_*` key (default-deny sweep, R1)                                                 |
| 2   | SQLite domain tables       | electron | `DELETE FROM` every table in `electron/piiDomainTables.ts` (customers, quotes, quote_items, history_entries); then `VACUUM`         |
| 3   | SQLite `storage` table     | electron | delete all rows; then `VACUUM`                                                                                                      |
| 4   | SQLite WAL/SHM sidecars    | electron | `wal_checkpoint(TRUNCATE)` after table deletion so freed pages are not recoverable from WAL; verify `-wal`/`-shm` are empty/removed |
| 5   | IndexedDB                  | web/pwa  | delete databases + object stores used by the app                                                                                    |
| 6   | OPFS                       | web/pwa  | recursive delete of app-owned directories                                                                                           |
| 7   | Cache API / Service Worker | pwa      | `caches.keys()` → delete all app caches; unregister SW; purge any cached PII-bearing responses                                      |
| 8   | appData files              | electron | delete app-owned files under `userData` (window state, prefs, etc.) except the saga journal itself                                  |
| 9   | logs                       | electron | truncate/delete log files (they must be PII-scrubbed anyway, but erasure removes them)                                              |
| 10  | temp/staging               | all      | purge staging directories (import/export staging, temp files)                                                                       |
| 11  | snapshots                  | electron | destroy prior erasure snapshots (see §5); the current saga's snapshot is handled by commit/rollback                                 |
| 12  | `pii_stage` preimage table | electron | `DELETE FROM pii_stage` (§3.1) — an in-flight migration preimage is the user's data mid-re-homing                                   |

### 3.1 The `pii_stage` preimage table

`pii_stage` (migration `0004_pii_stage.sql`) holds the **sealed preimage** of a
value being re-homed from a plaintext source to its encrypted destination: an
ADR-001 envelope (`enc1:…`), never plaintext, beside the AAD components it is
bound to (`privacy_epoch`, `schema_version`, `envelope_version`) and the
`state`/`generation` of the transaction that owns it.

It is a dedicated table, not a row in `storage`, and the reason is mechanical
rather than stylistic:

- `persistence-bridge.deleteStaleKeys()` runs every `AUTO_SAVE_INTERVAL_MS`
  (10 s) and **deletes** every `storage` key absent from renderer
  `localStorage`, so a stage row parked there is removed within one poll — not
  lost in a race;
- `loadFromDatabase()` materializes every manifest-**allowed** `storage` row
  into renderer `localStorage`, so a stage row parked under an allowed key is
  decrypted straight back into the renderer as plaintext — the exact mirror this
  work removes.

Both halves are pinned by
`src/platform/desktop/overrides/__tests__/persistence-bridge.pii-stage.test.ts`.
A separate table is invisible to `db:list-keys` and to that sweep, so a staged
preimage lives exactly as long as its own state machine says it should
(S2 stage write → S4 destination write → S6 stage removal → S8 per-source
deletes, each in its own transaction — `electron/piiStage.ts`).

**In the erasure scope**, therefore:

- §3 row 12 / the `sqlite_domain_tables` purge: every `DELETE FROM pii_stage`;
- §6 rescan: a surviving stage row is named (`pii_stage: N rows`), so a purge
  that could not remove it blocks the commit instead of hiding it;
- §5 snapshot: the payload captures and the rollback restores stage rows — a
  rollback that omitted them would be unrecoverable for exactly the transaction
  that is mid-flight. The restore is a **merge** (upsert by key), so it restores
  what the saga deleted without destroying what was written after the snapshot;
- ADR-003 §2.2.2: a redacted diagnostic backup strips the table, and a strip
  that is _refused_ (locked database, read-only file, corrupt page, refusing
  trigger) is reported in `stripFailures` / the sidecar's `strip_failures` rather
  than counted as a clean redaction. A table the profile predates is not a
  refusal and is not reported.

`PII_ERASURE_TABLES` in `electron/piiDomainTables.ts` is the single constant
every one of those sites iterates (the four PII domain tables plus this one) —
the direct consequence of the `history_entries` omission described below. It is
the same set as `PII_DOMAIN_TABLES`: `pii_stage` is a declared
`sqlite_domain_tables` surface in SPEC-01 as of `policy_version` 1.6, so the
pinned two-way list covers it. The two constants exist separately because they
answer different questions — erasure coverage, versus what the ADR-002 startup
scan is allowed to count as plaintext residue (§3.1, last paragraph).

**Exempt from `db:import` validation.** `db/database.ts requiredTables()` derives
the mandatory table list from the migration files by regex, so adding any table
makes it a precondition for importing a database. `pii_stage` is exempted
(`IMPORT_EXEMPT_TABLES`), because:

1. the check cannot prevent a bad swap — `db:import` validates a copy, swaps it
   in, and then calls `initDatabase()`, which re-runs the migration that creates
   this table;
2. rejecting it would remove recoverability exactly where it is needed, since the
   files lacking `pii_stage` are the pre-remediation backups of the users this
   work protects;
3. `requiredTables()` is a legitimacy test on the user's **data** schema, not a
   "is this the newest migration" test — `pii_stage` holds no user data and
   mirrors nothing.

The exemption is a named constant (not an inferred rule) and is pinned in
`db/__tests__/pii-stage-migration.test.ts`: a 0000-0003 database is accepted and
forward-migrated, and a database missing any real table is still refused.

**Snapshot, WAL, and staging are INSIDE the erasure scope.** A delete-all that leaves
`-wal` files, staging files, or old snapshots containing PII has not completed. The
post-condition rescan (§6) checks all of them.

**The PII domain table list has exactly one source of truth:**
`PII_ERASURE_TABLES` in `electron/piiDomainTables.ts` — the PII domain tables
(`customers`, `quotes`, `quote_items`, `history_entries`) plus the `pii_stage`
preimage table (§3.1). The purge adapter (§3 row 2), the §6 rescan
post-condition, the §5 snapshot payload, and the ADR-003 §2.2.2 backup redaction
all iterate that one list. `history_entries` was missing from every one of those
sites, which made the §6 rescan report "clean" while its PII-bearing rows
survived — the list must never be duplicated per module. Adding a PII-bearing
table requires adding it there, and declaring it `pii: true` on the
`sqlite_domain_tables` surface in SPEC-01.

**Declared on the `sqlite_domain_tables` surface since `policy_version` 1.6.**
The table was created by migration `0004_pii_stage.sql` and was PII-bearing from
that moment, but it was absent from the SPEC-01 fixture — a real PII surface the
privacy inventory did not name, which is the `history_entries` defect one layer
out. Declaring it is a privacy-contract change, not bookkeeping: a new declared
PII surface means a `policy_version` bump, so the version moved 1.5 → 1.6 and
receipts issued under 1.5 stop validating (SPEC-04 §6). That re-consent cost no
real user anything because nothing had shipped under 1.5 — but it is not a free
edit, and the next declared surface will not get that exemption.

**A `pii_stage` row is not legacy-plaintext evidence.** The table is erased,
snapshotted and redacted like any other PII surface, but it is excluded from
`PII_LEGACY_PLAINTEXT_TABLES` — the subset the ADR-002 §2.3 startup scan sums to
decide whether the profile is clean. A stage row is always a sealed `enc1:`
envelope, never plaintext, so counting it would make every in-flight re-homing
warn "legacy plaintext PII detected". That is the same class of lie as the
`history_entries` omission, in the other direction, and the exclusion is pinned
by `piiDomainTables.test.ts` because it is a deletion: summing the full report
again would compile and pass.

**Row 5 now has a real target.** The only app database on this surface is
`open3dcalc_pii_vault` (SPEC-01 `policy_version` 1.8, `pii: true`,
`erasure: erase_on_delete_all`): the sealed browser store the three PII keys
migrate onto off plaintext `localStorage`. `indexeddbAdapter().purge()` in
`src/shared/lib/erasureSaga/rendererSweep.ts` enumerates `indexedDB.databases()`
and deletes each one, so the vault is covered wholesale by construction rather
than by an enumerated key list. Note the deliberate asymmetry with row 5's
`rescan()`: it returns `[]` unconditionally, so the §6 post-condition reports
"clean" for IndexedDB on the strength of the purge, not of a rescan. That was
already true before this task, but the vault makes it load-bearing: a purge that
fails partway still reports clean, and the sealed records are the user's
customers, quotes and history.

## 4. Journal format (per-store, resumable)

The journal is a small file (or SQLite table on desktop) under `userData` (desktop) or
OPFS/localStorage (web), itself **not** PII-bearing (it contains keys, states, timestamps —
no user content):

```json
{
  "saga_id": "uuid-v4",
  "state": "deleting",
  "policy_version": "1.0",
  "started_at": "2026-09-11T12:00:00Z",
  "stores": [
    { "store": "sqlite_domain_tables", "state": "done", "attempts": 1 },
    { "store": "sqlite_wal_shm", "state": "done", "attempts": 1 },
    { "store": "localstorage", "state": "in_progress", "attempts": 2 },
    { "store": "cache_api", "state": "pending" }
  ]
}
```

- Journal writes MUST be atomic (write-temp + fsync + rename, per SPEC-03 §6 mechanics).
- On resume, the saga loads the journal, finds the first non-`done` store, and continues.
- Attempts are capped per store (e.g., 3); exhausted attempts ⇒ saga fails ⇒ rollback path
  (if before commit point) with a user-visible error and the journal preserved for support.

## 5. Safety snapshot

- Before `deleting`, the saga writes an encrypted snapshot of all PII-bearing data being
  deleted (so a failed run can be rolled back).
- **Encryption:** the snapshot is encrypted with a key from the ADR-001 capability model
  (`safeStorage` on desktop, or passphrase-derived on web). It is never plaintext.
- **TTL:** the snapshot has a TTL (default 7 days, per SPEC-01 `erasure_snapshots`
  retention). On any load, expired snapshots are destroyed first.
- **Destroyed after commit:** when the saga reaches `committed`, the snapshot is securely
  deleted (overwrite-then-unlink on desktop; OPFS/IndexedDB delete on web) and the journal
  records the destruction.
- **Ephemeral key lost/expired ⇒ rollback impossible after a defined window:**
  - If the snapshot key depends on a session passphrase (web fallback) and the passphrase is
    lost, or the snapshot TTL expires, **rollback is impossible** — the data cannot be
    restored. This is a deliberate, documented trade-off: the erasure guarantee must not be
    weakened by keeping plaintext recovery paths alive.
  - **Window:** rollback is possible only while (a) the snapshot exists, (b) its TTL has
    not expired, and (c) the key is available. Default window = the snapshot TTL (7 days)
    AND key availability. Outside the window, a failed saga cannot restore data; the UI
    MUST warn the user of this window **before** confirmation (in `prepared`), and the
    journal records `rollback_window: {ttl_days: 7, key_source: "safeStorage|passphrase"}`.
  - Behavior outside the window: the saga still completes `deleting` → `committed` (the
    user asked for erasure; inability to roll back does not block erasure). If the saga
    _failed_ and rollback is impossible, the terminal state is `committed` with a
    `rollback_unavailable` annotation in the journal and a user-visible warning — never a
    silent partial state.

## 6. Post-condition: rescan proof

After all stores report `done`, and before `committed`:

1. Rescan **every** surface in §3 (same scanner as ADR-002 quarantine detection).
2. Assert: **zero manifest PII keys present** — no `open3dcalc_customers_v1`, no
   `customers`/`quotes` rows, no `storage` rows with PII keys, no PII in IndexedDB/OPFS/
   caches/logs/staging/snapshots, WAL/SHM empty.
3. Unknown keys matching the app namespace (`open3dcalc_*`) are also deleted (R1 sweep).
4. If the rescan finds PII: the store responsible is marked `failed`, the saga does NOT
   commit; it retries that store; if unfixable ⇒ rollback (data restored from snapshot)
   and a user-visible error. **The saga never reports success with PII remaining.**

## 7. External copies

The app cannot delete what it does not control. The completion receipt (SPEC-04 §6)
MUST include an `external_copies_notice` listing, for user awareness:

- SPEC-03 export envelopes the user created (file(s) on disk/cloud the user chose);
- engineering backups made under ADR-003 (with their retention status);
- any device where the user imported a sync bundle.

The notice states that these copies are outside the app's erasure reach and how the user
can destroy them (delete the files; re-run delete-all on the other device).

## 8. What D1.0 does NOT deliver

D1.0 specifies; D1.1+ implements. As of D1.0 there is no saga, no journal, no snapshot, no
rescan — current delete-all is a partial, non-resumable loop. TEST-MATRIX §6 defines the
mandatory contract tests (crash injection at each state, per-store resume, rollback,
post-condition rescan).

## 9. Compliance trace

- R4 → §3 (full store coverage incl. WAL/SHM, IndexedDB/OPFS, Cache API/SW, appData/logs/
  temps, snapshots/staging), §6 (rescan proof).
- R9 → §2 (state machine with real commit point), §4 (per-store resumable journal).
- R10 → §2 (crash after `snapshot_taken` ⇒ idempotent resume), §5 (ephemeral key lost/TTL ⇒
  rollback impossible after defined window; documented behavior), §6 (never success with PII
  remaining).
- Cross-references: SPEC-01 (surfaces, retention), ADR-001 (snapshot encryption), ADR-002
  (shared scanner), SPEC-04 (receipt with `external_copies_notice`), TEST-MATRIX §6.

## Status

**Status: Proposed (awaiting Themis gate + user final approval)**
