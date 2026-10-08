/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  deleteNewPiiRow,
  readNewPiiRow,
  remainingNewPiiRows,
  snapshotNewPiiRows,
} from "../newPiiStore.js";
import type { MinimalStorageDb } from "../persistGate.js";
import {
  NEW_PII_STORAGE_KEYS,
  type NewPiiStorageKey,
} from "../../src/shared/lib/crypto/newPiiNamespace.js";

const [CUSTOMERS, QUOTES] = NEW_PII_STORAGE_KEYS;
const SEALED = 'enc1:profileKey:{"v":"2.0"}';

function makeDatabase(seed: Array<[string, string]> = []) {
  const rows = new Map<string, string>(seed);
  const calls = { prepare: [] as string[], run: 0 };
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      calls.prepare.push(sql);
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          calls.run++;
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (sql.includes("DELETE FROM storage")) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all() {
          return [...rows.keys()].map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows, calls };
}

describe("exact new-PII storage-row helpers", () => {
  it("reads only an authorised key", () => {
    const { db, calls } = makeDatabase([[CUSTOMERS, SEALED]]);
    expect(readNewPiiRow(db, CUSTOMERS)).toBe(SEALED);
    expect(readNewPiiRow(db, QUOTES)).toBeNull();
    // The exact SQL names only the storage table and binds the key.
    expect(calls.prepare[0]).toContain("FROM storage WHERE key = ?");
  });

  it("refuses a non-authorised key before any SQL", () => {
    const { db, calls } = makeDatabase();
    expect(() =>
      readNewPiiRow(db, "open3dcalc_customers_v1" as NewPiiStorageKey),
    ).toThrow();
    expect(() =>
      deleteNewPiiRow(db, "pii_stage" as NewPiiStorageKey),
    ).toThrow();
    expect(() =>
      deleteNewPiiRow(db, "open3dcalc_pwless_invented_v9" as NewPiiStorageKey),
    ).toThrow();
    expect(calls.prepare).toEqual([]);
  });

  it("deletes exactly the named authorised row", () => {
    const { db, rows } = makeDatabase([
      [CUSTOMERS, SEALED],
      [QUOTES, SEALED],
      ["open3dcalc_customers_v1", "legacy"],
    ]);
    deleteNewPiiRow(db, CUSTOMERS);
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.get(QUOTES)).toBe(SEALED);
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy");
  });

  it("snapshots only the three authorised rows, sealed bytes only", () => {
    const { db } = makeDatabase([
      [CUSTOMERS, SEALED],
      ["open3dcalc_customers_v1", "legacy"],
    ]);
    const snapshot = snapshotNewPiiRows(db);
    expect(Object.keys(snapshot).sort()).toEqual(
      [...NEW_PII_STORAGE_KEYS].sort(),
    );
    expect(snapshot[CUSTOMERS]).toBe(SEALED);
    expect(snapshot[QUOTES]).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain("legacy");
  });

  it("reports the remaining authorised rows and supports an explicit scope", () => {
    const { db } = makeDatabase([
      [CUSTOMERS, SEALED],
      [QUOTES, SEALED],
    ]);
    expect(remainingNewPiiRows(db)).toEqual([CUSTOMERS, QUOTES]);
    expect(remainingNewPiiRows(db, [CUSTOMERS])).toEqual([CUSTOMERS]);
    expect(remainingNewPiiRows(db, [])).toEqual([]);
  });
});
