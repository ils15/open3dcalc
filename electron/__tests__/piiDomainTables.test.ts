/**
 * @vitest-environment node
 *
 * Beta5 Wave 0 — the `history_entries` erasure gap (SPEC-02 §3 row 2).
 *
 * `history_entries` (db/schema/index.ts) carries `resultJson` (the whole
 * CalculationResult) and `snapshotJson` (every calculator input) under a
 * free-text `name`. It was absent from ALL FIVE hardcoded PII table lists in
 * the Electron code, so `sqliteDomainTablesAdapter.rescan()` — the SPEC-02
 * erasure post-condition — reported "clean" while those rows survived. Silent
 * plaintext residue in an already-shipped feature.
 *
 * These tests pin the table list to ONE canonical constant so the lists cannot
 * drift apart again, and exercise the real adapters over real SQLite.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sqliteDomainTablesAdapter,
  appdataFilesAdapter,
} from "../erasureStores.js";
import {
  snapshotPayload,
  restoreSnapshotPayload,
  type PayloadDb,
} from "../erasurePayload.js";
import { buildScanReport, summarizeReport } from "../legacyScan.js";
import {
  PII_CONTENT_TABLES,
  PII_DOMAIN_TABLES,
  PII_LEGACY_PLAINTEXT_TABLES,
  type PiiDomainTableCounts,
} from "../piiDomainTables.js";
import {
  createDiagnosticBackup,
  DiagnosticGateError,
} from "../diagnosticBackup.js";
import { resetDiagnosticGateForTests } from "../diagnosticGate.js";
import type { MinimalStorageDb } from "../persistGate.js";
import type { StoreAdapterLike } from "@/shared/lib/erasureSaga/types";

/** Synthetic PII marker — never real personal data. */
const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

/**
 * Every PII-bearing table declared on the SPEC-01 `sqlite_domain_tables`
 * surface. Declared here as a test constant so the behavioral tests below run
 * against the CURRENT shipped code (not a helper this change introduces) and
 * therefore fail before the fix.
 *
 * `pii_stage` is here even though it is not in db/schema/index.ts: it is created
 * by migration `0004_pii_stage.sql` and is a declared PII surface as of
 * `policy_version` 1.6. A table that is PII-bearing but reachable only through a
 * migration rather than the drizzle schema is exactly the shape of omission the
 * Wave 0 `history_entries` defect had.
 */
const EXPECTED_PII_TABLES = [
  "customers",
  "history_entries",
  // Declared at policy_version 1.8 (ADR-001 §3.6 recovery residue). It is PII
  // and now INVENTORIED, which is the point: an undeclared PII table is the
  // Wave 0 `history_entries` defect repeated.
  "legacy_residue",
  "pii_stage",
  "quote_items",
  "quotes",
] as const;

/** The canonical list as the electron code actually ships it, post-fix. */
async function shippedPiiTables(): Promise<readonly string[]> {
  const mod = await import("../piiDomainTables.js");
  return mod.PII_DOMAIN_TABLES;
}

let dir: string;
let dbPath: string;
let db: Database.Database;

/**
 * A realistic profile: every declared PII domain table present, each holding
 * exactly one row that embeds the marker.
 */
function seedProfile(): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, company TEXT, email TEXT, phone TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, customer_id TEXT, customer_snapshot TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS quote_items (id INTEGER PRIMARY KEY, quote_id TEXT, history_entry_id TEXT, name TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS history_entries (id TEXT PRIMARY KEY, timestamp INTEGER, type TEXT, name TEXT, summary TEXT, total_cost REAL, sell_price REAL, profit REAL, result_json TEXT, snapshot_json TEXT)",
  );
  // Present but EMPTY: this profile's premise is "every declared PII domain
  // table exists". `pii_stage` is declared as of policy_version 1.6 and
  // `legacy_residue` as of 1.8, so this profile now carries both. The
  // absent-table case has its own test below, and that is the one that has to
  // keep passing.
  db.exec(
    "CREATE TABLE IF NOT EXISTS pii_stage (transaction_id TEXT NOT NULL, generation INTEGER NOT NULL, privacy_epoch INTEGER NOT NULL, schema_version INTEGER NOT NULL, envelope_version INTEGER NOT NULL, state TEXT NOT NULL, blob TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (transaction_id, generation))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS legacy_residue (key TEXT PRIMARY KEY NOT NULL, shape TEXT NOT NULL, blob TEXT NOT NULL, recovered_value_sha TEXT NOT NULL, recovered_at INTEGER NOT NULL)",
  );

  db.prepare("INSERT INTO customers (id, name, email) VALUES (?, ?, ?)").run(
    "c1",
    MARKER,
    "fernanda@exemplo.teste",
  );
  db.prepare("INSERT INTO quotes (id, customer_snapshot) VALUES (?, ?)").run(
    "q1",
    JSON.stringify({ name: MARKER }),
  );
  db.prepare(
    "INSERT INTO quote_items (quote_id, history_entry_id, name) VALUES (?, ?, ?)",
  ).run("q1", "h1", MARKER);
  db.prepare(
    "INSERT INTO history_entries (id, timestamp, type, name, result_json, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    "h1",
    1_700_000_000_000,
    "fdm",
    MARKER,
    JSON.stringify({ totalCost: 10, notes: MARKER }),
    JSON.stringify({ client: MARKER }),
  );
}

function asStorageDb(): MinimalStorageDb {
  return db as unknown as MinimalStorageDb;
}

/**
 * better-sqlite3 IS the `$client` in production (drizzle wraps it), so expose
 * it under that property. `better-sqlite3` already satisfies the payload
 * client's prepare/get/all/run surface.
 */
function asPayloadDb(): PayloadDb {
  return { $client: db as unknown as PayloadDb["$client"] };
}

beforeEach(() => {
  delete process.env.OPEN3DCALC_DIAGNOSTIC;
  resetDiagnosticGateForTests();
  dir = mkdtempSync(join(tmpdir(), "o3dc-pii-dom-"));
  dbPath = join(dir, "live.sqlite3");
  db = new Database(dbPath);
  seedProfile();
});

afterEach(() => {
  delete process.env.OPEN3DCALC_DIAGNOSTIC;
  resetDiagnosticGateForTests();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The canonical list
// ---------------------------------------------------------------------------

describe("PII_DOMAIN_TABLES (single source of truth)", () => {
  it("covers every PII-bearing normalized table in db/schema", async () => {
    expect([...(await shippedPiiTables())].sort()).toEqual([
      ...EXPECTED_PII_TABLES,
    ]);
  });

  it("keeps active PII content tables aligned with the manifest", async () => {
    // Current content tables remain declared. The old vault staging and
    // recovery-residue tables are retired and intentionally absent from the
    // manifest, even though the legacy cleanup adapters remain covered below.
    const { default: fixture } =
      await import("../../docs/privacy/SPEC-01-manifest-fixture.json");
    const declared = fixture.keys
      .filter(
        (k: { surface: string; pii: boolean }) =>
          k.surface === "sqlite_domain_tables" && k.pii,
      )
      .map((k: { key: string }) => k.key);
    for (const table of PII_CONTENT_TABLES) {
      expect(declared).toContain(table);
    }
    expect(declared).not.toContain("pii_stage");
    expect(declared).not.toContain("legacy_residue");
  });
});

// ---------------------------------------------------------------------------
// THE DEFECT: SPEC-02 §3 row 2 purge + §6 rescan post-condition
// ---------------------------------------------------------------------------

describe("sqliteDomainTablesAdapter (SPEC-02 §3 row 2, §6 post-condition)", () => {
  it("purges history_entries and the rescan reports clean", async () => {
    const adapter = sqliteDomainTablesAdapter(asStorageDb());
    const purged = await adapter.purge();
    const remaining = await adapter.rescan();

    // Post-condition: no residual PII rows on ANY declared table.
    expect(remaining).toEqual([]);
    expect(purged).toBe(4);
    for (const table of EXPECTED_PII_TABLES) {
      const count = (
        db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
      ).c;
      expect(count, `${table} must be empty after purge`).toBe(0);
    }
  });

  it("removes the marker from the database FILE, not just the row", async () => {
    const adapter = sqliteDomainTablesAdapter(asStorageDb());
    await adapter.purge();
    expect(readFileSync(dbPath).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
  });

  it("rescan REPORTS residue when a table is repopulated (post-condition is not vacuous)", async () => {
    // Guards against a fix that empties `remaining` unconditionally: a row
    // that survives the purge must be named by the rescan.
    db.prepare("DELETE FROM customers").run();
    db.prepare("DELETE FROM quotes").run();
    db.prepare("DELETE FROM quote_items").run();
    db.prepare("DELETE FROM history_entries").run();

    const adapter = sqliteDomainTablesAdapter(asStorageDb());
    expect(await adapter.rescan()).toEqual([]);

    db.prepare(
      "INSERT INTO history_entries (id, timestamp, type, name, result_json) VALUES (?, ?, ?, ?, ?)",
    ).run("h2", 1_700_000_000_001, "fdm", MARKER, "{}");

    const remaining = await adapter.rescan();
    expect(remaining).toEqual(["history_entries: 1 rows"]);
  });

  it("is idempotent when a declared table is absent from an older database", async () => {
    db.exec("DROP TABLE history_entries");
    const adapter = sqliteDomainTablesAdapter(asStorageDb());
    await expect(adapter.purge()).resolves.toBeTypeOf("number");
    expect(await adapter.rescan()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The privacy scan report (ADR-002 §2.3) must SEE the table
// ---------------------------------------------------------------------------

describe("buildScanReport / summarizeReport over the domain tables", () => {
  it("carries a history_entries count in the report", () => {
    const report = buildScanReport([], {
      customers: 1,
      quotes: 1,
      quote_items: 1,
      history_entries: 7,
      pii_stage: 0,
    });
    expect(report.domainTables.history_entries).toBe(7);
  });

  it("names history_entries in the summary string (metadata only)", () => {
    const report = buildScanReport([], {
      customers: 1,
      quotes: 1,
      quote_items: 1,
      history_entries: 7,
      pii_stage: 0,
    });
    const summary = summarizeReport(report);
    expect(summary).toContain("history_entries=7");
    expect(summary).not.toContain(MARKER);
  });

  it("reports a nonempty history_entries table as plaintext-domain residue", () => {
    // Mirrors the main-process gate: domainRows > 0 ⇒ the profile is not clean.
    const report = buildScanReport([], {
      customers: 1,
      quotes: 1,
      quote_items: 1,
      history_entries: 1,
      pii_stage: 0,
    });
    const domainRows = PII_LEGACY_PLAINTEXT_TABLES.reduce(
      (a, table) => a + (report.domainTables[table] ?? 0),
      0,
    );
    expect(domainRows).toBeGreaterThan(0);
  });

  it("a pii_stage row alone is NOT plaintext-domain residue (it is a sealed envelope)", () => {
    // The gate sums `PII_LEGACY_PLAINTEXT_TABLES`, not every declared domain
    // table. A stage row is always an `enc1:` envelope, so counting it would
    // make every in-flight re-homing warn "legacy plaintext PII detected" —
    // the same class of lie as the `history_entries` omission, in the other
    // direction. Pinned here because the exclusion is a deletion: summing
    // `Object.values(report.domainTables)` again would compile and pass.
    const report = buildScanReport([], {
      customers: 0,
      quotes: 0,
      quote_items: 0,
      history_entries: 0,
      pii_stage: 3,
    });
    const domainRows = PII_LEGACY_PLAINTEXT_TABLES.reduce(
      (a, table) => a + (report.domainTables[table] ?? 0),
      0,
    );
    expect(report.domainTables.pii_stage).toBe(3);
    expect(domainRows).toBe(0);
    // The table is still named in the report — counted for erasure, excluded
    // from the plaintext verdict.
    expect(summarizeReport(report)).toContain("pii_stage=3");
  });
});

// ---------------------------------------------------------------------------
// Diagnostic-backup redaction (ADR-003 §2.2.2)
// ---------------------------------------------------------------------------

describe("createDiagnosticBackup redaction over the domain tables", () => {
  it("strips history_entries rows from a redacted backup", async () => {
    process.env.OPEN3DCALC_DIAGNOSTIC = "1";
    resetDiagnosticGateForTests();
    const target = join(dir, "diag-redacted.sqlite3");
    const result = await createDiagnosticBackup({
      dbPath,
      targetPath: target,
      redact: true,
    });
    expect(result.strippedDomainRows).toBe(4);

    const out = new Database(target);
    const historyCount = (
      out.prepare("SELECT COUNT(*) AS c FROM history_entries").get() as {
        c: number;
      }
    ).c;
    out.close();
    expect(historyCount).toBe(0);
    expect(readFileSync(target).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
  });

  it("strips a declared table that is absent from an older database (no throw)", async () => {
    process.env.OPEN3DCALC_DIAGNOSTIC = "1";
    resetDiagnosticGateForTests();
    db.exec("DROP TABLE history_entries");
    const target = join(dir, "diag-older.sqlite3");
    await expect(
      createDiagnosticBackup({ dbPath, targetPath: target, redact: true }),
    ).resolves.toMatchObject({ redacted: true });
    expect(existsSync(target)).toBe(true);
  });

  it("still refuses without the diagnostic gate", async () => {
    await expect(
      createDiagnosticBackup({
        dbPath,
        targetPath: join(dir, "out.sqlite3"),
        redact: true,
      }),
    ).rejects.toThrow(DiagnosticGateError);
  });
});

// ---------------------------------------------------------------------------
// The erasure snapshot (SPEC-02 §5) must capture the table
// ---------------------------------------------------------------------------

describe("erasure snapshot payload (SPEC-02 §5) — the real builder", () => {
  it("includes history_entries in the captured payload", async () => {
    // Exercises the ACTUAL implementation (`erasurePayload.snapshotPayload`,
    // which `erasure.ts` calls) rather than a loop re-implemented here — so
    // reverting erasure.ts to a hardcoded three-table list would fail this.
    const payload = snapshotPayload(asPayloadDb());
    expect(payload).toContain("history_entries");

    const parsed = JSON.parse(payload) as {
      storage: Array<{ key: string; value: string }>;
      domain: Record<string, Array<Record<string, unknown>>>;
    };
    expect(parsed.domain.history_entries).toHaveLength(1);
    // Every canonical table gets a slot, present or empty.
    for (const table of await shippedPiiTables()) {
      expect(parsed.domain).toHaveProperty(table);
    }
  });

  it("captures the marker-bearing rows so a rollback can restore them", () => {
    const parsed = JSON.parse(snapshotPayload(asPayloadDb())) as {
      domain: Record<string, Array<Record<string, unknown>>>;
    };
    expect(parsed.domain.history_entries[0].result_json).toContain(MARKER);
    expect(parsed.domain.customers[0].name).toBe(MARKER);
  });

  it("round-trips through restoreSnapshotPayload", () => {
    const payload = snapshotPayload(asPayloadDb());
    const adapter = sqliteDomainTablesAdapter(asStorageDb());
    return adapter.purge().then(async () => {
      expect((await adapter.rescan()).length).toBe(0);

      restoreSnapshotPayload(asPayloadDb(), payload);

      const restored = (
        db.prepare("SELECT COUNT(*) AS c FROM history_entries").get() as {
          c: number;
        }
      ).c;
      expect(restored).toBe(1);
      // A rollback restores EVERY captured table, so the post-condition is
      // satisfiable again — and rescan must name all of them, including the
      // table that was missing from the old hardcoded list.
      const remaining = await adapter.rescan();
      expect(remaining).toEqual([
        "customers: 1 rows",
        "quotes: 1 rows",
        "quote_items: 1 rows",
        "history_entries: 1 rows",
      ]);
    });
  });

  it("tolerates a table absent from an older database", () => {
    db.exec("DROP TABLE history_entries");
    const parsed = JSON.parse(snapshotPayload(asPayloadDb())) as {
      domain: Record<string, unknown[]>;
    };
    expect(parsed.domain.history_entries).toEqual([]);
  });

  it("the domain-table adapter and the snapshot list agree on the store set", async () => {
    const adapter: StoreAdapterLike = sqliteDomainTablesAdapter(asStorageDb());
    expect(adapter.store).toBe("sqlite_domain_tables");
    expect(await shippedPiiTables()).toContain("history_entries");
  });
});

// ---------------------------------------------------------------------------
// Pre-import backup copies in userData (db/database.ts resolves the DB to
// <userData>/open3dcalc.db, so dirname(dbPath) === userData)
// ---------------------------------------------------------------------------

describe("appdataFilesAdapter covers pre-import database copies", () => {
  let userData: string;

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), "o3dc-userdata-"));
  });

  afterEach(() => {
    rmSync(userData, { recursive: true, force: true });
  });

  it("purges and reports a <db>.backup-<ts> copy carrying PII", async () => {
    // Confirms the earlier "may survive erasure" report was a FALSE POSITIVE.
    const backup = join(userData, "open3dcalc.db.backup-1700000000000");
    writeFileSync(backup, MARKER);
    writeFileSync(join(userData, "open3dcalc.db"), MARKER);
    // The saga journal must survive the purge.
    writeFileSync(join(userData, "erasure-journal.json"), "{}");

    const adapter = appdataFilesAdapter(userData);
    const purged = await adapter.purge();
    expect(purged).toBe(2); // the .db and its backup
    expect(existsSync(backup)).toBe(false);
    expect(existsSync(join(userData, "erasure-journal.json"))).toBe(true);
    expect(await adapter.rescan()).toEqual([]);
  });

  it("REPORTS a surviving open3dcalc-backup file — the rescan/purge asymmetry is closed", async () => {
    // Previously recorded as a latent gap: `purge()` deleted every
    // `open3dcalc-backup*` file while `rescan()` skipped the prefix, so a purge
    // that FAILED on such a file left residue the §6 post-condition could not
    // name — and the saga committed over it. Both sides now share one
    // predicate, so this file is reported the moment it exists, whatever the
    // reason it survived.
    const backup = join(userData, "open3dcalc-backup-1700000000000");
    writeFileSync(backup, MARKER);

    const adapter = appdataFilesAdapter(userData);
    // Reported BEFORE the purge, which is the whole point: the report is what a
    // failed purge leaves behind.
    expect(await adapter.rescan()).toEqual([
      "appdata: open3dcalc-backup-1700000000000",
    ]);
    await adapter.purge();
    expect(existsSync(backup)).toBe(false);
    expect(await adapter.rescan()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T4.5 — the domain-table cleanup is GATED on COUNT > 0
// ---------------------------------------------------------------------------

/**
 * A synthetic sealed preimage. Derived from the existing synthetic MARKER
 * rather than hardcoded, so the file carries no high-entropy literal (and no
 * secret scanner has to guess whether it is one).
 */
const SEALED_PREIMAGE = `enc1:envelope:${Buffer.from(MARKER, "utf8").toString("base64")}`;

/**
 * Wrap a live better-sqlite3 client so every SQL string the adapter prepares is
 * recorded. The RECORDED STATEMENTS are the observable: "no delete is attempted
 * at COUNT = 0" (T4.5 DoD) is a claim about which SQL the cleanup issues, and
 * nothing else can prove it — the row count after a no-op `DELETE` on an empty
 * table is identical to the row count after a skipped one.
 */
function recordingStorageDb(real: Database.Database): {
  db: MinimalStorageDb;
  statements: string[];
} {
  const statements: string[] = [];
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      statements.push(sql);
      return real.prepare(sql);
    },
    exec(sql: string) {
      real.exec(sql);
    },
  };
  return { db, statements };
}

const isDelete = (sql: string): boolean => /^\s*DELETE\s+FROM\s+/i.test(sql);

describe("sqliteDomainTablesAdapter T4.5 — cleanup gated on COUNT > 0", () => {
  it("issues NO DELETE for a declared table whose COUNT is 0", async () => {
    // `seedProfile` creates every declared table; `pii_stage` and
    // `legacy_residue` are present but EMPTY, the four content tables each hold
    // one row. Remove the `count === 0` guard in `erasureStores.ts` and this
    // test fails: a `DELETE FROM pii_stage` is then recorded.
    const { db: recording, statements } = recordingStorageDb(db);
    const adapter = sqliteDomainTablesAdapter(recording);
    await adapter.purge();

    const deletes = statements.filter(isDelete);
    for (const empty of ["pii_stage", "legacy_residue"]) {
      expect(
        deletes.some((s) => s.includes(empty)),
        `${empty} is empty; it must not be issued a DELETE`,
      ).toBe(false);
    }
    // The gate is per-table, not a blanket skip: every NON-empty table is
    // still deleted.
    for (const seeded of [
      "customers",
      "quotes",
      "quote_items",
      "history_entries",
    ]) {
      expect(
        deletes.some((s) => s.includes(seeded)),
        `${seeded} has rows; it must be deleted`,
      ).toBe(true);
    }
  });

  it("issues NO DELETE at all when every declared table is empty", async () => {
    // The strongest form of the gate: a profile with no residue produces zero
    // DELETE statements — and the rescan is still clean, so the gate does not
    // weaken the §6 post-condition.
    for (const table of EXPECTED_PII_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    const { db: recording, statements } = recordingStorageDb(db);
    const adapter = sqliteDomainTablesAdapter(recording);
    expect(await adapter.purge()).toBe(0);
    expect(statements.some(isDelete)).toBe(false);
    expect(await adapter.rescan()).toEqual([]);
  });

  it("still purges a table whose COUNT > 0 and reports the count before deletion", async () => {
    // `pii_stage` holds a sealed preimage and `legacy_residue` a retained
    // ciphertext: both are NON-empty, so the COUNT gate must NOT skip them —
    // they are the residue the erasure exists to remove.
    db.prepare(
      "INSERT INTO pii_stage (transaction_id, generation, privacy_epoch, schema_version, envelope_version, state, blob, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("tx-1", 1, 1, 1, 1, "staged", SEALED_PREIMAGE, 1_700_000_000_000);
    db.prepare(
      "INSERT INTO legacy_residue (key, shape, blob, recovered_value_sha, recovered_at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      "open3dcalc_customers_v1",
      "safeStorage",
      SEALED_PREIMAGE,
      "sha-1",
      1_700_000_000_000,
    );

    const { db: recording, statements } = recordingStorageDb(db);
    const adapter = sqliteDomainTablesAdapter(recording);
    // Six tables now hold a row each.
    expect(await adapter.purge()).toBe(6);
    // The count is read for EVERY table — the gate reports before it deletes.
    const counted = statements.filter((s) =>
      /^\s*SELECT\s+COUNT\(\*\)/i.test(s),
    );
    for (const table of EXPECTED_PII_TABLES) {
      expect(
        counted.some((s) => s.includes(table)),
        `${table} count must be read before the delete decision`,
      ).toBe(true);
    }
    expect(await adapter.rescan()).toEqual([]);
    for (const table of EXPECTED_PII_TABLES) {
      const count = (
        db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
      ).c;
      expect(count, `${table} must be empty after purge`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T4.5 DoD — every table's count is reported, a nonzero count is a finding
// ---------------------------------------------------------------------------

describe("scan report (T4.5 DoD) — every declared table's count is named", () => {
  it("names EVERY declared table, including the ones at zero", () => {
    // "every table's count appears in the scan report": the summary enumerates
    // the canonical list rather than only the nonzero rows, so a table at 0 is
    // still visible and a table added later cannot go unreported.
    const zeroCounts = Object.fromEntries(
      PII_DOMAIN_TABLES.map((table) => [table, 0]),
    ) as PiiDomainTableCounts;
    const summary = summarizeReport(buildScanReport([], zeroCounts));
    for (const table of PII_DOMAIN_TABLES) {
      expect(summary).toContain(`${table}=0`);
    }
  });

  it("surfaces a nonzero domain count as a finding, not a silent clear", () => {
    const counts = Object.fromEntries(
      PII_DOMAIN_TABLES.map((table) => [table, 0]),
    ) as PiiDomainTableCounts;
    counts.history_entries = 2;
    const summary = summarizeReport(buildScanReport([], counts));
    expect(summary).toContain("history_entries=2");
    const domainRows = PII_LEGACY_PLAINTEXT_TABLES.reduce(
      (total, table) => total + counts[table],
      0,
    );
    expect(domainRows).toBeGreaterThan(0);
  });
});
