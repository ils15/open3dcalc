import { describe, expect, it } from "vitest";
import {
  detectBetaData,
  mergeById,
  snapshotBetaSources,
  validRecords,
  verifySourceIntact,
} from "../betaImport";

/** Beta persist envelopes (open3dcalc_beta_test_*), the shape the beta
 * build writes: zustand persist wrapper with the PII array field. */
const fixture = new Map<string, string | null>([
  [
    "open3dcalc_beta_test_customers_v1",
    JSON.stringify({
      state: {
        customers: [
          { id: "c1", name: "Maria Print", email: "maria@exemplo.br" },
          { id: "c2", name: "João São João" },
          { notACustomer: true },
        ],
      },
      version: 1,
    }),
  ],
  [
    "open3dcalc_beta_test_quotes_v1",
    JSON.stringify({
      state: {
        quotes: [
          { id: "q1", number: 1, customerId: "c1", total: 42 },
          { id: "q2", number: 2, customerId: "c1", total: 17.9 },
        ],
      },
      version: 1,
    }),
  ],
  [
    "open3dcalc_beta_test_history_v1",
    JSON.stringify({
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
          {
            id: "h2",
            timestamp: 1700000100000,
            type: "resin",
            totalCost: 12,
            sellPrice: 30,
            profit: 18,
          },
        ],
      },
      version: 1,
    }),
  ],
  ["open3dcalc_beta_test_corrupt_v1", "{not json"],
]);

const read = (key: string) => fixture.get(key) ?? null;

describe("betaImport — S2 explicit Beta → Stable import", () => {
  it("detects counts per type from the three beta_test keys", () => {
    const preview = detectBetaData(read);
    expect(preview.hasAny).toBe(true);
    expect(preview.total).toBe(6);
    const byType = new Map(preview.sources.map((s) => [s.type, s.records]));
    expect(byType.get("customers")).toBe(2); // invalid record filtered
    expect(byType.get("quotes")).toBe(2);
    expect(byType.get("history")).toBe(2);
  });

  it("is read-only: the source snapshot survives a full detect+apply cycle", () => {
    const snapshot = snapshotBetaSources(read);
    expect(detectBetaData(read).total).toBe(6);
    expect(validRecords("customers", read)).toHaveLength(2);
    expect(verifySourceIntact(read, snapshot)).toBe(true);
  });

  it("flags a corrupt envelope instead of throwing", () => {
    const corruptRead = (key: string) =>
      key === "open3dcalc_beta_test_customers_v1"
        ? "{not json"
        : (fixture.get(key) ?? null);
    const preview = detectBetaData(corruptRead);
    const customers = preview.sources.find((s) => s.type === "customers");
    expect(customers?.corrupt).toBe(true);
    expect(customers?.records).toBe(0);
  });

  it("mergeById preserves ids and is idempotent on re-run", () => {
    const target = [{ id: "c2", name: "João já existe na stable" }];
    const incoming = validRecords("customers", read) as Array<{
      id: string;
      name: string;
    }>;
    const first = mergeById(target, incoming);
    expect(first.imported).toBe(1); // c1 only; c2 is a duplicate
    expect(first.skipped).toBe(1);
    expect(first.merged.find((c) => c.id === "c1")?.name).toBe("Maria Print");
    expect(first.merged.find((c) => c.id === "c2")?.name).toBe(
      "João já existe na stable",
    );

    // Re-running the import on the merged target imports nothing.
    const second = mergeById(first.merged, incoming);
    expect(second.imported).toBe(0);
    expect(second.merged).toHaveLength(first.merged.length);
  });

  it("returns no records when the beta profile is empty", () => {
    const empty = detectBetaData(() => null);
    expect(empty.hasAny).toBe(false);
    expect(empty.total).toBe(0);
    expect(validRecords("history", () => null)).toHaveLength(0);
  });
});
