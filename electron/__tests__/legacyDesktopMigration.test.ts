import { describe, expect, it } from "vitest";
import {
  applyLegacyDesktopMigration,
  detectLegacyDesktopData,
} from "../legacyDesktopMigration.js";
import type { MinimalStorageDb } from "../storageRows.js";

function makeDatabase(seed: Array<[string, string]> = []) {
  const rows = new Map(seed);
  return {
    db: {
      prepare(statement: string) {
        return {
          get(...params: unknown[]) {
            const value = rows.get(String(params[0]));
            return value === undefined ? undefined : { value };
          },
          run(...params: unknown[]) {
            if (statement.includes("INSERT INTO storage")) {
              rows.set(String(params[0]), String(params[1]));
            } else if (statement.includes("DELETE FROM storage")) {
              rows.delete(String(params[0]));
            }
            return undefined;
          },
          all() {
            return [...rows.keys()].map((key) => ({ key }));
          },
        };
      },
    } as MinimalStorageDb,
    rows,
  };
}

const legacyCustomers = JSON.stringify({
  state: {
    customers: [
      { id: "c1", name: "Maria 1.14" },
      { id: "c2", name: "João 1.14" },
    ],
  },
  version: 1,
});
const legacyHistory = JSON.stringify({
  state: {
    entries: [
      {
        id: "h1",
        timestamp: 1700000000000,
        type: "fdm",
        totalCost: 8,
        sellPrice: 16,
        profit: 8,
      },
    ],
  },
  version: 2,
});
const currentCustomers = JSON.stringify({
  state: { customers: [{ id: "c2", name: "João já na 2.x" }] },
  version: 1,
});

describe("legacyDesktopMigration — S2 desktop (v1.14 → 2.x)", () => {
  it("detects valid counts per type from the inherited storage keys", () => {
    const { db } = makeDatabase([
      ["open3dcalc_customers_v1", legacyCustomers],
      ["open3dcalc_history_v2", legacyHistory],
    ]);
    const preview = detectLegacyDesktopData(db);
    expect(preview.hasAny).toBe(true);
    expect(preview.total).toBe(3);
    expect(preview.sources).toEqual([
      { type: "customers", records: 2, corrupt: false },
      { type: "quotes", records: 0, corrupt: false },
      { type: "history", records: 1, corrupt: false },
    ]);
  });

  it("merges by id into the pwless rows and preserves the legacy source", () => {
    const { db, rows } = makeDatabase([
      ["open3dcalc_customers_v1", legacyCustomers],
      ["open3dcalc_pwless_customers_v1", currentCustomers],
      ["open3dcalc_history_v2", legacyHistory],
    ]);
    const report = applyLegacyDesktopMigration(db);

    expect(report.imported).toBe(2); // c1 + h1; c2 is a duplicate
    expect(report.skipped).toBe(1);
    expect(report.perType.customers).toBe(1);
    expect(report.perType.history).toBe(1);

    const pwless = JSON.parse(
      rows.get("open3dcalc_pwless_customers_v1") ?? "{}",
    );
    expect(
      pwless.state.customers.find((c: { id: string }) => c.id === "c1"),
    ).toBeTruthy();
    // Target wins on conflict: the 2.x row keeps its own name.
    expect(
      pwless.state.customers.find((c: { id: string }) => c.id === "c2")?.name,
    ).toBe("João já na 2.x");
    // The v1.14 source rows are never written or deleted.
    expect(rows.get("open3dcalc_customers_v1")).toBe(legacyCustomers);
    expect(rows.get("open3dcalc_history_v2")).toBe(legacyHistory);
  });

  it("is idempotent: a second apply imports nothing", () => {
    const { db, rows } = makeDatabase([
      ["open3dcalc_customers_v1", legacyCustomers],
      ["open3dcalc_history_v2", legacyHistory],
    ]);
    expect(applyLegacyDesktopMigration(db).imported).toBe(3);
    const before = rows.get("open3dcalc_pwless_customers_v1");
    const second = applyLegacyDesktopMigration(db);
    expect(second.imported).toBe(0);
    expect(rows.get("open3dcalc_pwless_customers_v1")).toBe(before);
  });

  it("flags a corrupt legacy envelope instead of throwing", () => {
    const { db } = makeDatabase([["open3dcalc_customers_v1", "{not json"]]);
    const preview = detectLegacyDesktopData(db);
    expect(preview.sources[0].corrupt).toBe(true);
    expect(applyLegacyDesktopMigration(db).imported).toBe(0);
  });
});
