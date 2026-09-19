import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useDemoModeStore } from "../demoModeStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useCalculatorStore } from "../calculatorStore";
import { useHistoryStore } from "../historyStore";
import { useFilamentInventory } from "../filamentInventory";
import { useCustomerStore } from "../customerStore";
import { useQuoteStore } from "../quoteStore";
import { useProductInventory } from "../productInventory";
import {
  DEMO_SPOOLS,
  DEMO_CUSTOMERS,
  DEMO_QUOTES,
  DEMO_PRODUCTS,
  buildDemoHistoryEntries,
  DEMO_CALCULATOR,
} from "@/shared/lib/demoDataset";
import { isDemoPersistenceSuppressed } from "@/shared/lib/manifestStorage";

/** Deep-ish snapshot of every localStorage key/value, to prove demo writes nothing. */
function snapshotLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) out[key] = localStorage.getItem(key) ?? "";
  }
  return out;
}

describe("demoModeStore (demo-data mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    useFilamentInventory.setState({ spools: [] });
    useHistoryStore.setState({ entries: [] });
    useCustomerStore.setState({ customers: [] });
    useQuoteStore.setState({ quotes: [], nextNumber: 1 });
    useProductInventory.setState({ products: [] });
    useDemoModeStore.setState({ isActive: false, snapshot: null });
    vi.clearAllTimers();
  });

  // spies criados abaixo são restaurados após cada teste (data-safety tests
  // injetam falhas em ações de store — sem limpeza elas vazam para outros testes)
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── enter(): population through REAL actions only ──────────────
  it("enter() populates calculator, inventory, history, customers, quotes and products", () => {
    expect(useDemoModeStore.getState().isActive).toBe(false);

    useDemoModeStore.getState().enter();

    // flag + export guard
    expect(useDemoModeStore.getState().isActive).toBe(true);

    // inventory: 6 reels added through addSpool (ids assigned by the store)
    const { spools } = useFilamentInventory.getState();
    expect(spools).toHaveLength(DEMO_SPOOLS.length);
    expect(spools.every((s) => typeof s.id === "string" && s.dateAdded > 0)).toBe(true);

    // history: one entry per seed, added through addEntry
    expect(useHistoryStore.getState().entries).toHaveLength(
      buildDemoHistoryEntries().length,
    );

    // CRM
    expect(useCustomerStore.getState().customers).toHaveLength(DEMO_CUSTOMERS.length);
    expect(useQuoteStore.getState().quotes).toHaveLength(DEMO_QUOTES.length);
    expect(useProductInventory.getState().products).toHaveLength(DEMO_PRODUCTS.length);

    // calculator: preloaded FDM calc + water-washable resin slices
    const calc = useCalculatorStore.getState();
    expect(calc.activeTab).toBe("fdm");
    expect(calc.selectedPrinter.id).toBe(DEMO_CALCULATOR.selectedPrinterId);
    expect(calc.selectedMarketplace.id).toBe(DEMO_CALCULATOR.selectedMarketplaceId);
    expect(calc.productName).toBe(DEMO_CALCULATOR.productName);
    expect(calc.fdmMaterial.weightUsed).toBe(DEMO_CALCULATOR.fdmMaterial.weightUsed);
    expect(calc.resinPostProcess.washType).toBe("water");
    expect(calc.results).not.toBeNull();
  });

  // ── idempotency ──────────────────────────────────────────────────
  it("enter() called twice does not duplicate anything (idempotent)", () => {
    useDemoModeStore.getState().enter();
    const counts = {
      spools: useFilamentInventory.getState().spools.length,
      entries: useHistoryStore.getState().entries.length,
      customers: useCustomerStore.getState().customers.length,
      quotes: useQuoteStore.getState().quotes.length,
      products: useProductInventory.getState().products.length,
    };

    useDemoModeStore.getState().enter(); // no-op: already active
    useDemoModeStore.getState().enter(); // no-op again

    expect(useFilamentInventory.getState().spools.length).toBe(counts.spools);
    expect(useHistoryStore.getState().entries.length).toBe(counts.entries);
    expect(useCustomerStore.getState().customers.length).toBe(counts.customers);
    expect(useQuoteStore.getState().quotes.length).toBe(counts.quotes);
    expect(useProductInventory.getState().products.length).toBe(counts.products);
  });

  // ── exit(): byte-for-byte restore ───────────────────────────────
  it("exit() restores the exact previous state (deep-equal)", () => {
    const before = {
      calculator: useCalculatorStore.getState(),
      history: useHistoryStore.getState(),
      filament: useFilamentInventory.getState(),
      customers: useCustomerStore.getState(),
      quotes: useQuoteStore.getState(),
      products: useProductInventory.getState(),
    };

    useDemoModeStore.getState().enter();
    expect(useDemoModeStore.getState().isActive).toBe(true);

    useDemoModeStore.getState().exit();

    expect(useDemoModeStore.getState().isActive).toBe(false);
    expect(useDemoModeStore.getState().snapshot).toBeNull();

    expect(useCalculatorStore.getState()).toEqual(before.calculator);
    expect(useHistoryStore.getState()).toEqual(before.history);
    expect(useFilamentInventory.getState()).toEqual(before.filament);
    expect(useCustomerStore.getState()).toEqual(before.customers);
    expect(useQuoteStore.getState()).toEqual(before.quotes);
    expect(useProductInventory.getState()).toEqual(before.products);
  });

  it("exit() while inactive is a safe no-op that releases the persistence lock", () => {
    useDemoModeStore.getState().exit();
    expect(useDemoModeStore.getState().isActive).toBe(false);
    expect(isDemoPersistenceSuppressed()).toBe(false);
  });

  // ── data-safety: rollback when things break ─────────────────────
  it("enter() rolls back to the pre-enter state and releases the lock if applying the dataset throws", () => {
    // falha no meio do applyDemoDataset: a calculadora já foi populada quando o
    // addSpool explode — o rollback precisa reverter tudo e liberar o flag
    const filament = useFilamentInventory.getState();
    const originalAddSpool = filament.addSpool;
    const boom = new Error("boom: addSpool failed");
    vi.spyOn(filament, "addSpool").mockImplementation(() => {
      throw boom;
    });

    try {
      const before = {
        calculator: useCalculatorStore.getState(),
        history: useHistoryStore.getState(),
        filament: useFilamentInventory.getState(),
        customers: useCustomerStore.getState(),
        quotes: useQuoteStore.getState(),
        products: useProductInventory.getState(),
      };

      expect(() => useDemoModeStore.getState().enter()).toThrow(boom);

      // não entrou em modo demo e o flag de supressão foi liberado
      expect(useDemoModeStore.getState().isActive).toBe(false);
      expect(isDemoPersistenceSuppressed()).toBe(false);

      // estado restaurado byte-a-byte ao snapshot pré-enter
      expect(useCalculatorStore.getState()).toEqual(before.calculator);
      expect(useHistoryStore.getState()).toEqual(before.history);
      expect(useFilamentInventory.getState()).toEqual(before.filament);
      expect(useCustomerStore.getState()).toEqual(before.customers);
      expect(useQuoteStore.getState()).toEqual(before.quotes);
      expect(useProductInventory.getState()).toEqual(before.products);
    } finally {
      // setState cria novos objetos de estado: devolve a ação original ao vivo
      useFilamentInventory.setState({ addSpool: originalAddSpool });
    }
  });

  it("exit() with an active flag but no snapshot still releases the lock (defensive guard)", () => {
    // estado possível após uma falha de exit() anterior: ativo sem snapshot.
    // o guard tem que sobreviver sem quebrar e mesmo assim liberar o flag.
    useDemoModeStore.setState({ isActive: true, snapshot: null });

    expect(() => useDemoModeStore.getState().exit()).not.toThrow();
    expect(isDemoPersistenceSuppressed()).toBe(false);
    expect(useDemoModeStore.getState().isActive).toBe(false);
    expect(useDemoModeStore.getState().snapshot).toBeNull();
  });

  it("exit() releases the persistence lock even if the restore throws (data-safety)", () => {
    useDemoModeStore.getState().enter();
    expect(isDemoPersistenceSuppressed()).toBe(true);

    // restoreSnapshot chama useCalculatorStore.setState primeiro — faz explodir
    const boom = new Error("boom: restore failed");
    vi.spyOn(useCalculatorStore, "setState").mockImplementation(() => {
      throw boom;
    });

    expect(() => useDemoModeStore.getState().exit()).toThrow(boom);

    // o finally libera o flag mesmo com o restore quebrado — sem ele, todos os
    // writes reais posteriores do usuário ficariam silenciados para sempre
    expect(isDemoPersistenceSuppressed()).toBe(false);

    // prova que writes reais voltam a persistir
    useFilamentInventory.getState().addSpool({
      brand: "ExitFailBrand",
      material: "PLA",
      color: "Blue",
      colorHex: "#0000ff",
      weightGrams: 500,
      originalWeightGrams: 1000,
      costPerKg: 100,
      diameterMm: 1.75,
      notes: "",
      status: "in_stock",
      purchaseStore: "Local",
    });
    expect(localStorage.getItem("open3dcalc_filaments")).toContain("ExitFailBrand");
  });

  it("exit() releases the persistence suppression so normal writes resume", () => {
    useDemoModeStore.getState().enter();
    expect(isDemoPersistenceSuppressed()).toBe(true);

    useDemoModeStore.getState().exit();
    expect(isDemoPersistenceSuppressed()).toBe(false);

    // a post-demo write reaches localStorage again
    useFilamentInventory.getState().addSpool({
      brand: "TestBrand",
      material: "PLA",
      color: "Red",
      colorHex: "#ff0000",
      weightGrams: 500,
      originalWeightGrams: 1000,
      costPerKg: 100,
      diameterMm: 1.75,
      notes: "",
      status: "in_stock",
      purchaseStore: "Local",
    });
    expect(localStorage.getItem("open3dcalc_filaments")).toContain("TestBrand");
  });

  // ── export guard selector ───────────────────────────────────────
  it("useIsDemoMode() tracks the demo state for export blocking/marking", () => {
    const { result, rerender, unmount } = renderHook(() => useIsDemoMode());
    expect(result.current).toBe(false);

    act(() => {
      useDemoModeStore.getState().enter();
    });
    rerender();
    expect(result.current).toBe(true); // export must be blocked/marked while demo is on

    act(() => {
      useDemoModeStore.getState().exit();
    });
    rerender();
    expect(result.current).toBe(false);
    unmount();
  });

  // ── zero persistence ─────────────────────────────────────────────
  it("enter()/exit() write nothing to localStorage (ephemeral mode)", () => {
    const before = snapshotLocalStorage();
    useDemoModeStore.getState().enter();
    expect(snapshotLocalStorage()).toEqual(before);

    useDemoModeStore.getState().exit();
    expect(snapshotLocalStorage()).toEqual(before);
  });

  it("registers no demo-specific storage key", () => {
    useDemoModeStore.getState().enter();
    const keys = Object.keys(snapshotLocalStorage());
    expect(keys).not.toContain("open3dcalc_demo");
    expect(keys.filter((k) => k.includes("demo"))).toEqual([]);
  });

  it("survives a reload: re-created stores hold no demo data after enter()", async () => {
    useDemoModeStore.getState().enter();
    // demo data lives in memory only — simulate a fresh module load
    vi.resetModules();
    const filamentModule: typeof import("../filamentInventory") =
      await import("../filamentInventory");
    const historyModule: typeof import("../historyStore") =
      await import("../historyStore");

    await new Promise((r) => setTimeout(r, 10));

    expect(filamentModule.useFilamentInventory.getState().spools).toEqual([]);
    expect(historyModule.useHistoryStore.getState().entries).toEqual([]);
  });
});
