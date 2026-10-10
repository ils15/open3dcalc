/**
 * @vitest-environment node
 *
 * Beta5 desktop re-home — the read-only legacy PII row reader, over REAL SQLite.
 *
 * The schema is not hand-written: every test migrates a real temporary database
 * file with the app's own runner (`runMigrations`), so a change to the `storage`
 * schema that this module does not agree with fails here instead of passing
 * against a fixture that drifted.
 *
 * What each assertion pins, and why:
 *
 *  - Only the three DECLARED keys are ever read. A non-PII key present in the
 *    table must not appear in the report — the reader takes no key from the
 *    caller, which is what keeps a renderer from asking for any row it likes.
 *  - The value is returned VERBATIM for readable plaintext and `null` for an
 *    unsupported legacy format, so the disclosure never treats opaque bytes
 *    as a record.
 *  - It is READ-ONLY: the rows are byte-identical after the read
 *    (copy-without-delete).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readLegacyPiiRows,
  LEGACY_PII_STORAGE_KEYS,
  type LegacyPiiStorageKey,
} from "../legacyRows.js";
import type { MinimalStorageDb } from "../storageRows.js";
import { runMigrations } from "../../db/database.js";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";

/** A synthetic zustand-wrapper residue, the shape the old bridge stored. */
const CUSTOMERS_RESIDUE = JSON.stringify({
  state: { customers: [{ id: "legacy_cust_1", name: "Ana Sintética" }] },
  version: 1,
});

let dir: string;
let db: Database.Database;

function insertRow(key: string, value: string): void {
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, value, 1_700_000_000_000);
}

function storedValue(key: string): string | null {
  return (
    (
      db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
        { value: string } | undefined
    )?.value ?? null
  );
}

function read(): ReturnType<typeof readLegacyPiiRows> {
  return readLegacyPiiRows(db as unknown as MinimalStorageDb);
}

function rowFor(report: ReturnType<typeof readLegacyPiiRows>, key: string) {
  return report.rows.find((r) => r.key === key);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-legacy-rows-"));
  db = new Database(path.join(dir, "live.sqlite3"));
  runMigrations(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("readLegacyPiiRows — declared keys only", () => {
  it("reports every declared key, absent when there is no row", () => {
    const report = read();
    expect(report.rows.map((r) => r.key)).toEqual([...LEGACY_PII_STORAGE_KEYS]);
    expect(report.rows.every((r) => r.status === "absent")).toBe(true);
    expect(report.rows.every((r) => r.value === null)).toBe(true);
  });

  it("returns the plaintext value verbatim for a legacy residue row", () => {
    insertRow(CUSTOMERS, CUSTOMERS_RESIDUE);
    const row = rowFor(read(), CUSTOMERS);
    expect(row?.status).toBe("legacy_plaintext");
    expect(row?.value).toBe(CUSTOMERS_RESIDUE);
  });

  it("never reports a value for a non-PII key present in the table", () => {
    insertRow("open3dcalc_settings_v2", '{"theme":"dark"}');
    const report = read();
    expect(report.rows.map((r) => r.key)).toEqual([...LEGACY_PII_STORAGE_KEYS]);
    expect(report.rows.some((r) => r.key === "open3dcalc_settings_v2")).toBe(
      false,
    );
  });

  it("reports an ADR-001 envelope as unsupported_legacy_format with no value", () => {
    insertRow(HISTORY, "enc1:envelope:QUJD");
    const row = rowFor(read(), HISTORY);
    expect(row?.status).toBe("unsupported_legacy_format");
    expect(row?.value).toBeNull();
  });

  it("distinguishes keys in one report (mixed states)", () => {
    insertRow(CUSTOMERS, CUSTOMERS_RESIDUE);
    insertRow(QUOTES, "enc1:envelope:QUJD");
    // HISTORY absent.
    const report = read();
    expect(rowFor(report, CUSTOMERS)).toMatchObject({
      status: "legacy_plaintext",
      value: CUSTOMERS_RESIDUE,
    });
    expect(rowFor(report, QUOTES)).toMatchObject({
      status: "unsupported_legacy_format",
      value: null,
    });
    expect(rowFor(report, HISTORY)).toMatchObject({
      status: "absent",
      value: null,
    });
  });

  it("is copy-without-delete: the residue row is byte-identical after the read", () => {
    insertRow(CUSTOMERS, CUSTOMERS_RESIDUE);
    read();
    read();
    expect(storedValue(CUSTOMERS)).toBe(CUSTOMERS_RESIDUE);
  });

  it("declares the same three keys as the canonical plaintext list", async () => {
    const shared = await import("../../src/shared/lib/legacyPiiPlaintext.js");
    expect([...LEGACY_PII_STORAGE_KEYS]).toEqual([
      ...shared.LEGACY_PII_PLAINTEXT_KEYS,
    ]);
    // Compile-time binding of the local key type to the canonical key type.
    const key: LegacyPiiStorageKey = shared.LEGACY_PII_PLAINTEXT_KEYS[0];
    expect(LEGACY_PII_STORAGE_KEYS).toContain(key);
  });
});
