import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useDemoModeStore } from "../demoModeStore";
import { useHistoryStore } from "../historyStore";
import { useFilamentInventory } from "../filamentInventory";
import type { FilamentSpool } from "../filamentInventory";
import { useCustomerStore } from "../customerStore";
import type { Customer, CustomerFormData } from "@/shared/types";

/**
 * F6 — privacy regression. Entering and leaving the demo must neither persist
 * fictional data nor corrupt the user's real data: the mode is ephemeral end
 * to end, and nothing demo-related may survive in localStorage/SQLite.
 */

/**
 * Real user record seeded through the store's own `addSpool` action. Direct
 * `setState` never writes: only actions cross the manifestStorage choke point,
 * so the seed must go through the action for the data to be genuinely
 * persisted. `addSpool` assigns `id`/`dateAdded`, so the persisted shape is
 * captured back from the store for the byte-a-byte assertions below.
 */
const REAL_SPOOL: Omit<FilamentSpool, "id" | "dateAdded"> = {
  brand: "Marca Real",
  material: "PLA",
  color: "Azul",
  colorHex: "#1e40af",
  weightGrams: 750,
  originalWeightGrams: 1000,
  costPerKg: 110,
  diameterMm: 1.75,
  notes: "carreteu real de test",
  status: "in_stock",
  purchaseStore: "Loja da Esquina",
};

const REAL_CUSTOMER: CustomerFormData = {
  name: "Cliente Real",
  company: "Oficina Real",
  email: "real@example.com",
  phone: "",
  address: "",
  notes: "",
};

let realSpool: FilamentSpool;
let realCustomer: Customer;

/** Full copy of every persisted key, so a leak anywhere is caught. */
function persistedSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) {
      snapshot[key] = localStorage.getItem(key) as string;
    }
  }
  return snapshot;
}

describe("demo mode — privacy regression (F6)", () => {
  beforeEach(() => {
    // Release any leaked demo lock FIRST, so the real seed below is not
    // suppressed and actually lands in persisted storage.
    useDemoModeStore.getState().exit();
    localStorage.clear();
    // In-memory reset so the seeded anchor is the only real record.
    useFilamentInventory.setState({ spools: [] });
    useCustomerStore.setState({ customers: [] });
    useHistoryStore.setState({ entries: [] });

    // Real user data, genuinely persisted before the demo starts — seeded via
    // actions (addSpool/addCustomer), the only path that writes to storage.
    useFilamentInventory.getState().addSpool(REAL_SPOOL);
    useCustomerStore.getState().addCustomer(REAL_CUSTOMER);
    realSpool = useFilamentInventory.getState().spools[0];
    realCustomer = useCustomerStore.getState().customers[0];
  });

  afterEach(() => {
    useDemoModeStore.getState().exit();
  });

  it("persists the user's real data before the demo", () => {
    const snapshot = persistedSnapshot();
    const filament = Object.values(snapshot).find((v) => v.includes(realSpool.id));

    expect(filament, "real spool must be persisted").toBeDefined();
  });

  it("never writes demo data to persisted storage while active", () => {
    const before = persistedSnapshot();

    useDemoModeStore.getState().enter();

    // In memory the demo dataset is live…
    expect(useFilamentInventory.getState().spools.length).toBeGreaterThan(1);
    // …but persisted storage is byte-for-byte untouched.
    expect(persistedSnapshot()).toEqual(before);
  });

  it("restores real data byte-a-byte on exit, with no demo residue", () => {
    useDemoModeStore.getState().enter();
    useDemoModeStore.getState().exit();

    expect(useFilamentInventory.getState().spools).toEqual([realSpool]);
    expect(useCustomerStore.getState().customers).toEqual([realCustomer]);
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("leaves persisted storage identical after a full enter/exit cycle", () => {
    const before = persistedSnapshot();

    useDemoModeStore.getState().enter();
    useDemoModeStore.getState().exit();

    expect(persistedSnapshot()).toEqual(before);
  });

  it("does not corrupt real data when demo writes happen mid-session", () => {
    useDemoModeStore.getState().enter();
    // A demo-session write (suppressed by design — no persistence).
    useFilamentInventory.setState({ spools: [] });
    expect(Object.keys(persistedSnapshot()).length).toBeGreaterThan(0);

    useDemoModeStore.getState().exit();

    expect(useFilamentInventory.getState().spools).toEqual([realSpool]);
  });
});
