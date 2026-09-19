import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useDemoModeStore } from "../demoModeStore";
import { useCalculatorStore } from "../calculatorStore";
import { useHistoryStore } from "../historyStore";
import { useFilamentInventory } from "../filamentInventory";
import { useCustomerStore } from "../customerStore";
import { useQuoteStore } from "../quoteStore";
import { useProductInventory } from "../productInventory";
import {
  DEMO_MARKETPLACE_ID,
  DEMO_PRINTER_IDS,
} from "@/shared/lib/demoDataset";

/**
 * F5 — the "Estúdio Maria Print" dataset must land coherently in every store
 * it touches, so each tab renders real content instead of empty grids.
 * Counts and linkages are asserted against the seeds in `demoDataset.ts`.
 */
function emptyStores(): void {
  useHistoryStore.setState({ entries: [] });
  useFilamentInventory.setState({ spools: [] });
  useCustomerStore.setState({ customers: [] });
  useQuoteStore.setState({ quotes: [] });
  useProductInventory.setState({ products: [] });
}

describe("demo dataset — cross-tab data (F5)", () => {
  beforeEach(() => {
    localStorage.clear();
    emptyStores();
    useDemoModeStore.getState().exit();
  });

  afterEach(() => {
    useDemoModeStore.getState().exit();
  });

  it("applies the full dataset across all stores", () => {
    useDemoModeStore.getState().enter();

    expect(useHistoryStore.getState().entries).toHaveLength(11);
    expect(useFilamentInventory.getState().spools).toHaveLength(6);
    expect(useCustomerStore.getState().customers).toHaveLength(3);
    expect(useQuoteStore.getState().quotes).toHaveLength(2);
    expect(useProductInventory.getState().products).toHaveLength(3);
  });

  it("preloads the calculator with the demo calculation", () => {
    useDemoModeStore.getState().enter();

    const calc = useCalculatorStore.getState();
    expect(calc.selectedPrinter.id).toBe(DEMO_PRINTER_IDS[1]);
    expect(calc.selectedMarketplace.id).toBe(DEMO_MARKETPLACE_ID);
  });

  it("links both quotes to their customers (CRM integrity)", () => {
    useDemoModeStore.getState().enter();

    const customers = useCustomerStore.getState().customers;
    const quotes = useQuoteStore.getState().quotes;

    const linked = quotes.filter((q) => q.customerId);
    expect(linked).toHaveLength(2);

    for (const quote of linked) {
      const customer = customers.find((c) => c.id === quote.customerId);
      expect(customer, "quote customerId must point at a real customer").toBeDefined();
      expect(quote.customerSnapshot?.name).toBe(customer?.name);
    }
  });

  it("counts quote purchases on the linked customers", () => {
    useDemoModeStore.getState().enter();

    const customers = useCustomerStore.getState().customers;
    const quotes = useQuoteStore.getState().quotes;

    for (const quote of quotes) {
      const customer = customers.find((c) => c.id === quote.customerId);
      if (customer) {
        expect(customer.quoteCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("keeps every history entry addressable by id (no duplicates)", () => {
    useDemoModeStore.getState().enter();

    const entries = useHistoryStore.getState().entries;
    const ids = new Set(entries.map((e) => e.id));

    expect(ids.size).toBe(entries.length);
  });

  it("restores every store to its pre-demo state on exit", () => {
    useDemoModeStore.getState().enter();
    expect(useHistoryStore.getState().entries).toHaveLength(11);

    useDemoModeStore.getState().exit();

    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(useFilamentInventory.getState().spools).toHaveLength(0);
    expect(useCustomerStore.getState().customers).toHaveLength(0);
    expect(useQuoteStore.getState().quotes).toHaveLength(0);
    expect(useProductInventory.getState().products).toHaveLength(0);
  });
});
