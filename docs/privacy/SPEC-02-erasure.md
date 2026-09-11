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

| State | Meaning | Persisted? | Resumable? |
|-------|---------|-----------|------------|
| `prepared` | User confirmed delete-all; manifest scanned; per-store plan built; passphrase/capability verified | journal on disk | yes — restart re-enters `prepared` |
| `snapshot_taken` | Safety snapshot of all PII-bearing surfaces written (encrypted, TTL) | journal + snapshot files | yes — idempotent re-entry |
| `deleting` | Per-store deletion in progress; each store's progress journaled individually | journal (per-store rows) | yes — resume from first incomplete store |
| `committed` | All stores completed deletion; post-condition rescan passed; snapshot destroyed | journal (final) | terminal |
| `rolled_back` | Failure before the commit point; snapshot restored; partial deletions undone | journal (final) | terminal (user may retry) |

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

| # | Store | Platform | Deletion mechanics |
|---|-------|----------|--------------------|
| 1 | `localStorage` | all | remove every manifest key + any unknown `open3dcalc_*` key (default-deny sweep, R1) |
| 2 | SQLite domain tables | electron | `DELETE FROM` customers, quotes, quote_items, …; then `VACUUM` |
| 3 | SQLite `storage` table | electron | delete all rows; then `VACUUM` |
| 4 | SQLite WAL/SHM sidecars | electron | `wal_checkpoint(TRUNCATE)` after table deletion so freed pages are not recoverable from WAL; verify `-wal`/`-shm` are empty/removed |
| 5 | IndexedDB | web/pwa | delete databases + object stores used by the app |
| 6 | OPFS | web/pwa | recursive delete of app-owned directories |
| 7 | Cache API / Service Worker | pwa | `caches.keys()` → delete all app caches; unregister SW; purge any cached PII-bearing responses |
| 8 | appData files | electron | delete app-owned files under `userData` (window state, prefs, etc.) except the saga journal itself |
| 9 | logs | electron | truncate/delete log files (they must be PII-scrubbed anyway, but erasure removes them) |
| 10 | temp/staging | all | purge staging directories (import/export staging, temp files) |
| 11 | snapshots | all | destroy prior erasure snapshots (see §5); the current saga's snapshot is handled by commit/rollback |

**Snapshot, WAL, and staging are INSIDE the erasure scope.** A delete-all that leaves
`-wal` files, staging files, or old snapshots containing PII has not completed. The
post-condition rescan (§6) checks all of them.

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
    { "store": "sqlite_domain_tables", "state": "done",   "attempts": 1 },
    { "store": "sqlite_wal_shm",        "state": "done",   "attempts": 1 },
    { "store": "localstorage",          "state": "in_progress", "attempts": 2 },
    { "store": "cache_api",             "state": "pending" }
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
    *failed* and rollback is impossible, the terminal state is `committed` with a
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
