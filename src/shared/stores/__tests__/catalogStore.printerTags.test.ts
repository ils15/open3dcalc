import { describe, it, expect, beforeEach } from "vitest";
import { useCatalogStore } from "../catalogStore";

const STORAGE_KEY = "open3dcalc_catalog_v1";

const customPrinter = (id: string, tags: string[] = []) => ({
  id,
  name: `Printer ${id}`,
  brand: "DIY",
  power: 120,
  value: 1500,
  usefulLife: 3000,
  maintenancePerHour: 0.25,
  custom: true,
  tags,
});

describe("catalogStore — printer tags", () => {
  beforeEach(() => {
    localStorage.clear();
    useCatalogStore.setState({
      printers: [customPrinter("p1", ["resin"]), customPrinter("p2", [])],
      materials: [],
      marketplaces: [],
      selectedPrinterTag: null,
    });
  });

  // ── Filter state ───────────────────────────────────────────────
  it("starts with no tag filter selected", () => {
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  it("setPrinterTagFilter selects and clears the active tag", () => {
    useCatalogStore.getState().setPrinterTagFilter("resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBe("resin");

    useCatalogStore.getState().setPrinterTagFilter(null);
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  // ── addPrinterTag ──────────────────────────────────────────────
  it("adds a tag to a printer", () => {
    useCatalogStore.getState().addPrinterTag("p2", "voron");
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p2")?.tags).toEqual(["voron"]);
  });

  it("normalizes tags to trimmed, single-spaced lowercase", () => {
    useCatalogStore.getState().addPrinterTag("p2", "  Fast   Print ");
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p2")?.tags).toEqual(["fast print"]);
  });

  it("does not duplicate an existing tag (case-insensitive)", () => {
    useCatalogStore.getState().addPrinterTag("p1", "RESIN");
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags).toEqual(["resin"]);
  });

  it("ignores empty or whitespace-only tags", () => {
    useCatalogStore.getState().addPrinterTag("p1", "   ");
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags).toEqual(["resin"]);
  });

  it("ignores tags for an unknown printer", () => {
    useCatalogStore.getState().addPrinterTag("does-not-exist", "voron");
    expect(useCatalogStore.getState().printers.every((p) => !p.tags.includes("voron"))).toBe(true);
  });

  // ── removePrinterTag ───────────────────────────────────────────
  it("removes a tag from a printer", () => {
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags).toEqual([]);
  });

  it("clears the active filter when the selected tag is removed", () => {
    useCatalogStore.getState().setPrinterTagFilter("resin");
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  it("keeps other filters intact when a different tag is removed", () => {
    useCatalogStore.getState().setPrinterTagFilter("other");
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBe("other");
  });

  it("is a no-op when the tag is absent", () => {
    const before = useCatalogStore.getState().printers;
    useCatalogStore.getState().removePrinterTag("p2", "resin");
    expect(useCatalogStore.getState().printers).toEqual(before);
  });

  // ── Persistence ────────────────────────────────────────────────
  it("persists added tags to localStorage", () => {
    useCatalogStore.getState().addPrinterTag("p2", "voron");
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.printers.find((p: { id: string }) => p.id === "p2").tags).toEqual(["voron"]);
  });

  it("persists tag removal to localStorage", () => {
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.printers.find((p: { id: string }) => p.id === "p1").tags).toEqual([]);
  });

  // ── Backward compatibility (pre-Phase-4A bundles) ──────────────
  it("coerces legacy bundles without a tags field to tags: []", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        printers: [{ id: "legacy", name: "Legacy", brand: "X", power: 90, value: 800, usefulLife: 2000, maintenancePerHour: 0.2, custom: true }],
        materials: [],
        marketplaces: [],
      }),
    );
    useCatalogStore.getState().load();
    const legacy = useCatalogStore.getState().printers.find((p) => p.id === "legacy");
    expect(legacy?.tags).toEqual([]);
  });

  it("keeps existing tags when reloading a Phase-4A bundle", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        printers: [customPrinter("p1", ["resin", "fast"])],
        materials: [],
        marketplaces: [],
      }),
    );
    useCatalogStore.getState().load();
    expect(useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags).toEqual(["resin", "fast"]);
  });
});
