import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySyncData,
  collectSyncData,
  exportBundle,
  hashData,
  importBundle,
  importData,
  validateBundle,
  type SyncData,
} from "@/shared/lib/dataSync";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";

function sampleSyncData(): SyncData {
  return {
    settings: { productName: "Suporte", quantity: 2 },
    history: [{ id: "history-1", timestamp: 100 }],
    customers: [{ id: "customer-1", name: "Cliente Real" }],
    quotes: [{ id: "quote-1", number: 1 }],
    quotesNextNumber: 2,
    catalog: {
      printers: [{ id: "custom-printer", custom: true, name: "Minha FDM" }],
      materials: [{ id: "custom-material", custom: true, name: "PETG" }],
      marketplaces: [
        { id: "custom-marketplace", custom: true, name: "Marketplace" },
      ],
    },
    filaments: [{ id: "filament-1", brand: "Filamento" }],
    products: [{ id: "product-1", name: "Suporte" }],
    colorPalette: [{ id: "color-1", name: "Azul", hex: "#00f" }],
    modelComparison: [{ id: "comparison-1", fileName: "peca.stl" }],
    theme: "dark",
    dashboard: { chartType: "profit", goal: "1000" },
    sections: { costs: true, labor: false },
  };
}

function resetUserStores(): void {
  useHistoryStore.setState({ entries: [] });
  useCustomerStore.setState({ customers: [] });
  useQuoteStore.setState({ quotes: [], nextNumber: 1 });
}

function importFile(value: string): File {
  return new File([value], "open3dcalc-backup.open3dcalc", {
    type: "application/json",
  });
}

describe("data export and import", () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserStores();
  });

  afterEach(() => {
    resetUserStores();
    localStorage.clear();
  });

  it("collects real local customer, quote, history and preference data", () => {
    const data = sampleSyncData();
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify(data.settings),
    );
    localStorage.setItem("open3dcalc_catalog_v1", JSON.stringify(data.catalog));
    localStorage.setItem(
      "open3dcalc_filaments",
      JSON.stringify(data.filaments),
    );
    localStorage.setItem("open3dcalc_theme", data.theme);
    localStorage.setItem(
      "open3dcalc_dashboard_v1",
      JSON.stringify(data.dashboard),
    );
    localStorage.setItem("open3dcalc_sections", JSON.stringify(data.sections));
    useHistoryStore.setState({ entries: data.history as never });
    useCustomerStore.setState({ customers: data.customers as never });
    useQuoteStore.setState({
      quotes: data.quotes as never,
      nextNumber: data.quotesNextNumber,
    });

    const collected = collectSyncData();
    expect(collected.settings).toEqual(data.settings);
    expect(collected.history).toEqual(data.history);
    expect(collected.customers).toEqual(data.customers);
    expect(collected.quotes).toEqual(data.quotes);
    expect(collected.quotesNextNumber).toBe(data.quotesNextNumber);
    expect(collected.catalog.printers).toEqual(data.catalog.printers);
    expect(collected.catalog.materials).toEqual(data.catalog.materials);
    expect(collected.filaments).toEqual(data.filaments);
    expect(collected.theme).toBe(data.theme);
  });

  it("creates a readable JSON bundle without encryption metadata", async () => {
    const data = sampleSyncData();
    useHistoryStore.setState({ entries: data.history as never });
    useCustomerStore.setState({ customers: data.customers as never });
    useQuoteStore.setState({ quotes: data.quotes as never, nextNumber: 2 });

    const bundle = await exportBundle();

    expect(bundle).not.toHaveProperty("encrypted");
    expect(bundle.data.customers).toEqual(data.customers);
    expect(bundle.data.quotes).toEqual(data.quotes);
    expect(bundle.data.history).toEqual(data.history);
    expect(bundle.data).toEqual(expect.objectContaining({ products: [] }));
    expect(bundle).not.toHaveProperty("salt");
    expect(bundle).not.toHaveProperty("iv");
    expect(JSON.stringify(bundle)).toContain("Cliente Real");
    expect(validateBundle(bundle)).toBe(true);
  });

  it("validates only supported bundle shapes", async () => {
    const bundle = await exportBundle();
    expect(validateBundle(bundle)).toBe(true);
    expect(validateBundle(null)).toBe(false);
    expect(validateBundle({ ...bundle, version: "9.0" })).toBe(false);
    expect(
      validateBundle({ ...bundle, data: { history: [], customers: [] } }),
    ).toBe(false);
  });

  it("keeps accepting readable v1.0 exports with the old false marker", async () => {
    const bundle = await exportBundle();
    expect(validateBundle({ ...bundle, encrypted: false })).toBe(true);
  });

  it("imports a plain bundle without a password and restores real records", async () => {
    const source = sampleSyncData();
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify(source.settings),
    );
    useHistoryStore.setState({ entries: source.history as never });
    useCustomerStore.setState({ customers: source.customers as never });
    useQuoteStore.setState({ quotes: source.quotes as never, nextNumber: 2 });
    const bundle = await exportBundle();

    localStorage.clear();
    resetUserStores();
    const result = await importBundle(bundle);

    expect(result.imported).toEqual(
      expect.arrayContaining(["history", "customers", "quotes", "settings"]),
    );
    expect(useHistoryStore.getState().entries).toEqual(source.history);
    expect(useCustomerStore.getState().customers).toEqual(source.customers);
    expect(useQuoteStore.getState().quotes).toEqual(source.quotes);
    expect(localStorage.getItem("open3dcalc_settings_v2")).toContain("Suporte");
  });

  it("merges records by id, keeping local records and resolving collisions", () => {
    const local = sampleSyncData();
    useHistoryStore.setState({
      entries: [
        { id: "history-1", timestamp: 200 },
        { id: "history-local", timestamp: 150 },
      ] as never,
    });
    const incoming = sampleSyncData();
    incoming.history = [
      { id: "history-1", timestamp: 100 },
      { id: "history-new", timestamp: 300 },
    ];
    incoming.settings = {};

    const result = applySyncData(incoming, "merge");

    expect(result.conflicts).toContain("history");
    expect(useHistoryStore.getState().entries).toEqual([
      { id: "history-1", timestamp: 200 },
      { id: "history-local", timestamp: 150 },
      { id: "history-new", timestamp: 300 },
    ]);
    expect(local.settings).toEqual({ productName: "Suporte", quantity: 2 });
  });

  it("replace imports the provided user records without requiring a vault", () => {
    useCustomerStore.setState({
      customers: [{ id: "old", name: "Antigo" }] as never,
    });
    const incoming = sampleSyncData();

    applySyncData(incoming, "replace");

    expect(useCustomerStore.getState().customers).toEqual(incoming.customers);
    expect(useHistoryStore.getState().entries).toEqual(incoming.history);
    expect(useQuoteStore.getState().quotes).toEqual(incoming.quotes);
  });

  it("rejects retired backup formats without a password prompt", async () => {
    const legacyBundle = {
      version: "1.1",
      format: "open3dcalc-export",
      exportedAt: new Date().toISOString(),
      appVersion: "legacy",
      platform: "web",
      payload: { data: "unsupported-format" },
    };
    const legacyEnvelope = {
      format: "open3dcalc-export",
      version: "1.1",
      payload: { data: "unsupported-format" },
    };

    await expect(
      importData(importFile(JSON.stringify(legacyBundle)), { mode: "merge" }),
    ).rejects.toThrow(/legível compatível/i);
    await expect(
      importData(importFile(JSON.stringify(legacyEnvelope)), { mode: "merge" }),
    ).rejects.toThrow(/legível compatível/i);
  });

  it("rejects malformed input before modifying local storage", async () => {
    localStorage.setItem("open3dcalc_theme", "dark");
    const before = localStorage.getItem("open3dcalc_theme");

    await expect(
      importData(importFile(JSON.stringify({ version: "9.0" })), {
        mode: "replace",
      }),
    ).rejects.toThrow(/compatível/i);

    expect(localStorage.getItem("open3dcalc_theme")).toBe(before);
  });

  it("rejects a plain bundle with a corrupted checksum", async () => {
    const bundle = await exportBundle();
    const corrupted = { ...bundle, checksum: "not-the-checksum" };
    await expect(importBundle(corrupted)).rejects.toThrow(/checksum/i);
  });

  it("keeps SHA-256 checksum behavior for corruption detection", async () => {
    expect(await hashData("abc")).toBe(await hashData("abc"));
    expect(await hashData("abc")).not.toBe(await hashData("abd"));
  });
});
