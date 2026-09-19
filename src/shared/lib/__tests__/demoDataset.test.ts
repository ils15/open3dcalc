import { describe, it, expect } from "vitest";

import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";
import { BRAND_TARE_GRAMS, lookupBrandTare } from "@/shared/lib/brandTare";
import type { HistoryEntry } from "@/shared/types";

import {
  DEMO_STUDIO_NAME,
  DEMO_PRINTER_IDS,
  DEMO_MARKETPLACE_ID,
  DEMO_SPOOLS,
  DEMO_CUSTOMERS,
  DEMO_QUOTES,
  DEMO_PRODUCTS,
  DEMO_HISTORY_SEEDS,
  buildDemoHistoryEntries,
  DEMO_CALCULATOR,
} from "../demoDataset";

const DAY_MS = 86_400_000;

describe("demoDataset — fictional 'Estúdio Maria Print'", () => {
  // ── catalog integrity ──────────────────────────────────────────
  it("exposes exactly 3 real-catalog printer ids", () => {
    expect(DEMO_PRINTER_IDS).toHaveLength(3);
    for (const id of DEMO_PRINTER_IDS) {
      expect(printers.some((p) => p.id === id)).toBe(true);
    }
  });

  it("uses a real-catalog marketplace for the fee config", () => {
    expect(marketplaces.some((m) => m.id === DEMO_MARKETPLACE_ID)).toBe(true);
    const mp = marketplaces.find((m) => m.id === DEMO_MARKETPLACE_ID);
    expect(mp?.feePercent).toBeGreaterThan(0);
  });

  it("studio name is the fictional Maria Print studio", () => {
    expect(DEMO_STUDIO_NAME).toBe("Estúdio Maria Print");
  });

  // ── spools ──────────────────────────────────────────────────────
  it("has 6 spools including a water-washable resin", () => {
    expect(DEMO_SPOOLS).toHaveLength(6);
    const materials = DEMO_SPOOLS.map((s) => s.material.toLowerCase());
    expect(materials).toContain("pla");
    expect(materials.some((m) => m.includes("petg"))).toBe(true);
    expect(materials.some((m) => m.includes("abs"))).toBe(true);
    expect(materials.some((m) => m.includes("tpu"))).toBe(true);
    expect(materials.some((m) => m.includes("silk"))).toBe(true);
    // the resin entry
    expect(materials.some((m) => m.includes("water"))).toBe(true);
  });

  it("spool tares match the brand tare bank", () => {
    for (const spool of DEMO_SPOOLS) {
      expect(spool.tareGrams).toBe(lookupBrandTare(spool.brand));
      expect(spool.tareGrams).toBeGreaterThan(0);
    }
    // all four brands of the tare bank are exercised
    const brands = new Set(DEMO_SPOOLS.map((s) => s.brand));
    for (const entry of BRAND_TARE_GRAMS) {
      expect(brands.has(entry.brand)).toBe(true);
    }
  });

  it("spools carry partial weights and mixed statuses with low-stock cases", () => {
    const statuses = new Set(DEMO_SPOOLS.map((s) => s.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);

    for (const spool of DEMO_SPOOLS) {
      expect(spool.weightGrams).toBeGreaterThan(0);
      expect(spool.originalWeightGrams).toBeGreaterThan(0);
      expect(spool.costPerKg).toBeGreaterThan(0);
      // partial: consumed reels (not full, except sealed on-the-way ones)
      expect(spool.weightGrams).toBeLessThanOrEqual(spool.originalWeightGrams);
    }
    // at least one low-stock reel for the alert
    expect(DEMO_SPOOLS.filter((s) => s.weightGrams < 200).length).toBeGreaterThanOrEqual(1);
  });

  // ── CRM + catalog entities ─────────────────────────────────────
  it("has 3 customers, 2 quotes and 3 products", () => {
    expect(DEMO_CUSTOMERS).toHaveLength(3);
    expect(DEMO_QUOTES).toHaveLength(2);
    expect(DEMO_PRODUCTS).toHaveLength(3);

    for (const c of DEMO_CUSTOMERS) {
      expect(c.name.trim().length).toBeGreaterThanOrEqual(2);
    }
    for (const p of DEMO_PRODUCTS) {
      expect(p.name.trim().length).toBeGreaterThanOrEqual(2);
      expect(p.salePrice).toBeGreaterThan(0);
    }
    for (const q of DEMO_QUOTES) {
      expect(q.form.title.trim().length).toBeGreaterThanOrEqual(2);
      expect(q.form.items.length).toBeGreaterThan(0);
      expect(q.form.items.every((i) => i.quantity > 0)).toBe(true);
      expect(q.customerIndex).toBeGreaterThanOrEqual(0);
    }
  });

  // ── history ─────────────────────────────────────────────────────
  it("history seeds are 10–12 entries spread over ~90 days", () => {
    expect(DEMO_HISTORY_SEEDS.length).toBeGreaterThanOrEqual(10);
    expect(DEMO_HISTORY_SEEDS.length).toBeLessThanOrEqual(12);

    const days = DEMO_HISTORY_SEEDS.map((s) => s.daysAgo);
    expect(Math.min(...days)).toBeLessThanOrEqual(3);
    expect(Math.max(...days)).toBeLessThanOrEqual(90);
    // genuinely spread, not clustered on a single day
    expect(new Set(days).size).toBeGreaterThanOrEqual(8);
  });

  it("buildDemoHistoryEntries() returns real timestamps within ~90 days", () => {
    const entries: HistoryEntry[] = buildDemoHistoryEntries();
    expect(entries).toHaveLength(DEMO_HISTORY_SEEDS.length);
    const now = Date.now();
    for (const e of entries) {
      expect(e.timestamp).toBeGreaterThan(now - 95 * DAY_MS);
      expect(e.timestamp).toBeLessThanOrEqual(now);
      expect(e.id).toBeDefined();
      expect(e.name.length).toBeGreaterThan(0);
    }
    // unique ids + unique timestamps (not all "now")
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.timestamp)).size).toBe(entries.length);
  });

  it("history includes at least one deliberately low margin for the alert", () => {
    const entries = buildDemoHistoryEntries();
    const margins = entries.map((e) => {
      const snapshot = e.snapshot;
      if (!snapshot) throw new Error("demo history entry must carry a snapshot");
      const sales = e.type === "fdm" ? snapshot.fdmSales : snapshot.resinSales;
      return sales.profitMarginPercent;
    });
    expect(Math.min(...margins)).toBeLessThan(10);
  });

  it("history includes a water-washable resin entry", () => {
    const entries = buildDemoHistoryEntries();
    const resin = entries.filter((e) => e.type === "resin");
    expect(resin.length).toBeGreaterThanOrEqual(1);
    expect(
      resin.some((e) => e.snapshot?.resinPostProcess.washType === "water"),
    ).toBe(true);
  });

  it("preloaded calculator carries an FDM tab plus a water-washable resin setup", () => {
    expect(DEMO_CALCULATOR.type).toBe("fdm");
    expect(DEMO_CALCULATOR.fdmMaterial.weightUsed).toBeGreaterThan(0);
    expect(DEMO_CALCULATOR.fdmMaterial.costPerKg).toBeGreaterThan(0);
    // resin side is a water-washable setup: washed with water, no IPA cost
    expect(DEMO_CALCULATOR.resinMaterial.type.toLowerCase()).toContain("water");
    expect(DEMO_CALCULATOR.resinPostProcess.washType).toBe("water");
    expect(DEMO_CALCULATOR.resinMaterial.volumeUsedMl).toBeGreaterThan(0);
    expect(DEMO_CALCULATOR.selectedPrinterId).toBe(DEMO_PRINTER_IDS[1]);
    expect(DEMO_CALCULATOR.selectedMarketplaceId).toBe(DEMO_MARKETPLACE_ID);
    expect(DEMO_CALCULATOR.results).not.toBeNull();
  });
});
