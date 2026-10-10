/**
 * Desktop exact-key plaintext adapter over the `pii:new:*` route.
 *
 * These specs drive the REAL adapter (no module mock): they install a fake
 * `window.electronAPI.piiNew` and assert delegation, key mapping, and the
 * web/below-UI block. The main process owns the security; this layer must not
 * invent a key, and must never turn "route absent" into a silent no-op.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});

import {
  createNewPiiPersistStorage,
  getNewPiiCapability,
  hasPersistedNewPiiRecord,
  getNewPiiRoute,
  installNewPiiStorageForDesktop,
  installNewPiiStorageOnStore,
  isNewPiiRoutePresent,
  loadNewPii,
  NewPiiRouteUnavailableError,
  newPiiKeyFor,
  saveNewPii,
} from "../newPiiStorage";
import { setWithdrawalPending } from "@/shared/lib/localDataLifecycle";
import { rehydratePiiStores } from "@/shared/lib/localPiiPersistence";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import type { HistoryEntry } from "@/shared/types";

type PiiNew = {
  capability: () => Promise<{
    available: boolean;
    backend?: string;
    reason?: string;
  }>;
  load: (key: string) => Promise<string | null>;
  save: (key: string, value: string) => Promise<void>;
};

function installRoute(partial: Partial<PiiNew> = {}): PiiNew {
  const route: PiiNew = {
    capability: vi.fn(
      partial.capability ??
        (async () => ({ available: true, backend: "plaintext" })),
    ),
    load: vi.fn(partial.load ?? (async () => null)),
    save: vi.fn(partial.save ?? (async () => undefined)),
  };
  (window as unknown as { electronAPI?: unknown }).electronAPI = {
    piiNew: route,
  };
  return route;
}

beforeEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

afterEach(() => {
  setWithdrawalPending(false);
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe("newPiiStorage adapter", () => {
  it("is absent on the web build and refuses load/save below the UI", async () => {
    expect(isNewPiiRoutePresent()).toBe(false);
    expect(getNewPiiRoute()).toBeNull();
    await expect(getNewPiiCapability()).resolves.toEqual({
      available: false,
      reason: "route_unavailable",
    });
    await expect(
      loadNewPii("open3dcalc_pwless_customers_v1"),
    ).rejects.toBeInstanceOf(NewPiiRouteUnavailableError);
    await expect(
      saveNewPii("open3dcalc_pwless_customers_v1", "x"),
    ).rejects.toBeInstanceOf(NewPiiRouteUnavailableError);
  });

  it("keeps Web passwordless persistence denied without touching localStorage", async () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    const storage = createNewPiiPersistStorage<{ value: string }>("customers");

    await expect(
      storage.setItem("open3dcalc_customers_v1", {
        state: { value: "Synthetic customer" },
        version: 1,
      }),
    ).rejects.toBeInstanceOf(NewPiiRouteUnavailableError);
    await expect(storage.getItem("open3dcalc_customers_v1")).rejects.toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("maps logical domains to the exact authorised keys only", () => {
    expect(newPiiKeyFor("customers")).toBe("open3dcalc_pwless_customers_v1");
    expect(newPiiKeyFor("quotes")).toBe("open3dcalc_pwless_quotes_v1");
    expect(newPiiKeyFor("history")).toBe("open3dcalc_pwless_history_v1");
  });

  it("delegates capability/load/save to the route", async () => {
    const route = installRoute();
    expect(isNewPiiRoutePresent()).toBe(true);

    await expect(getNewPiiCapability()).resolves.toEqual({
      available: true,
      backend: "plaintext",
    });
    await loadNewPii("open3dcalc_pwless_customers_v1");
    await saveNewPii("open3dcalc_pwless_customers_v1", "plaintext-envelope");

    expect(route.capability).toHaveBeenCalledTimes(3);
    expect(route.load).toHaveBeenCalledWith("open3dcalc_pwless_customers_v1");
    expect(route.save).toHaveBeenCalledWith(
      "open3dcalc_pwless_customers_v1",
      "plaintext-envelope",
    );
  });

  it("reports an unavailable gate without throwing", async () => {
    installRoute({
      capability: async () => ({
        available: false,
        reason: "backend_basic_text",
      }),
    });
    await expect(getNewPiiCapability()).resolves.toEqual({
      available: false,
      reason: "backend_basic_text",
    });
  });

  it("maps a thrown capability probe to route_error, not a crash", async () => {
    installRoute({
      capability: async () => {
        throw new Error("ipc blew up");
      },
    });
    await expect(getNewPiiCapability()).resolves.toEqual({
      available: false,
      reason: "route_error",
    });
  });

  it("never reports available without a backend", async () => {
    installRoute({ capability: async () => ({ available: true }) });
    await expect(getNewPiiCapability()).resolves.toEqual({
      available: false,
      reason: "route_error",
    });
  });

  it("refuses a memory-only backend even if the route claims availability", async () => {
    installRoute({
      capability: async () => ({ available: true, backend: "memory_only" }),
    });
    await expect(getNewPiiCapability()).resolves.toEqual({
      available: false,
      reason: "memory_only",
    });
  });

  it("round-trips a store value only through its passwordless domain key", async () => {
    const values = new Map<string, string>();
    const route = installRoute({
      load: async (key) => values.get(key) ?? null,
      save: async (key, value) => {
        values.set(key, value);
      },
    });
    const storage = createNewPiiPersistStorage<{ customers: string[] }>(
      "customers",
    );
    const value = { state: { customers: ["Synthetic customer"] }, version: 1 };

    await storage.setItem("open3dcalc_customers_v1", value);

    await expect(storage.getItem("open3dcalc_customers_v1")).resolves.toEqual(
      value,
    );
    expect(route.save).toHaveBeenCalledWith(
      "open3dcalc_pwless_customers_v1",
      JSON.stringify(value),
    );
    expect(route.load).toHaveBeenCalledWith("open3dcalc_pwless_customers_v1");
    await expect(hasPersistedNewPiiRecord()).resolves.toBe(true);
  });

  it("blocks load and save when the route gate is refused, without fallback", async () => {
    const route = installRoute({
      capability: async () => ({ available: false, reason: "blocked" }),
    });
    const storage = createNewPiiPersistStorage<{ value: string }>("quotes");

    await expect(
      storage.setItem("open3dcalc_quotes_v1", {
        state: { value: "Synthetic quote" },
        version: 1,
      }),
    ).rejects.toThrow();
    await expect(storage.getItem("open3dcalc_quotes_v1")).rejects.toThrow();
    expect(route.load).not.toHaveBeenCalled();
    expect(route.save).not.toHaveBeenCalled();
  });

  it("blocks persistence while withdrawal is pending", async () => {
    const route = installRoute();
    const storage = createNewPiiPersistStorage<{ value: string }>("history");
    setWithdrawalPending(true);

    await expect(
      storage.setItem("open3dcalc_history_v2", {
        state: { value: "Synthetic history" },
        version: 2,
      }),
    ).rejects.toThrow();
    await expect(storage.getItem("open3dcalc_history_v2")).rejects.toThrow();
    expect(route.capability).not.toHaveBeenCalled();
    expect(route.load).not.toHaveBeenCalled();
    expect(route.save).not.toHaveBeenCalled();
  });

  it("wires all three Desktop stores to passwordless keys without touching legacy localStorage", async () => {
    const values = new Map<string, string>();
    const route = installRoute({
      load: async (key) => values.get(key) ?? null,
      save: async (key, value) => {
        values.set(key, value);
      },
    });
    const getItem = vi.spyOn(localStorage, "getItem");
    const setItem = vi.spyOn(localStorage, "setItem");
    const removeItem = vi.spyOn(localStorage, "removeItem");
    installNewPiiStorageForDesktop();

    await rehydratePiiStores();
    useCustomerStore.getState().addCustomer({
      name: "Synthetic customer",
      company: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });
    useQuoteStore.getState().addQuote({
      title: "Synthetic quote",
      customerId: "synthetic-customer",
      customerSnapshot: { name: "Synthetic customer" },
      items: [],
      globalDiscountPercent: 0,
      validUntil: "",
      paymentTerms: "",
      deliveryEstimate: "",
    });
    useHistoryStore.getState().addEntry({
      type: "fdm",
      name: "Synthetic history",
      summary: "Synthetic only",
      totalCost: 1,
      sellPrice: 2,
      profit: 1,
      result: {} as HistoryEntry["result"],
      snapshot: null,
    });

    await vi.waitFor(() => {
      expect(values.has("open3dcalc_pwless_customers_v1")).toBe(true);
      expect(values.has("open3dcalc_pwless_quotes_v1")).toBe(true);
      expect(values.has("open3dcalc_pwless_history_v1")).toBe(true);
    });
    expect([...values.keys()].sort()).toEqual([
      "open3dcalc_pwless_customers_v1",
      "open3dcalc_pwless_history_v1",
      "open3dcalc_pwless_quotes_v1",
    ]);
    expect(route.save).toHaveBeenCalledTimes(3);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  describe("fail-closed install when a store has no persist middleware", () => {
    it("skips (never throws) when a mocked store drops persist entirely", () => {
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      try {
        // A test double or a broken module import carries no persist slice; the
        // installer runs at import time, so throwing here would crash the app.
        expect(installNewPiiStorageOnStore({}, "customers")).toBe(false);
        expect(installNewPiiStorageOnStore(null, "quotes")).toBe(false);
        expect(installNewPiiStorageOnStore(undefined, "history")).toBe(false);
      } finally {
        warn.mockRestore();
      }
    });

    it("skips when persist exists but setOptions is not a function", () => {
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      try {
        expect(
          installNewPiiStorageOnStore<unknown>({ persist: {} }, "customers"),
        ).toBe(false);
      } finally {
        warn.mockRestore();
      }
    });

    it("installs storage and reports success when persist.setOptions is present", () => {
      const setOptions = vi.fn();
      expect(
        installNewPiiStorageOnStore({ persist: { setOptions } }, "history"),
      ).toBe(true);
      expect(setOptions).toHaveBeenCalledTimes(1);
      const [options] = setOptions.mock.calls[0];
      expect(options.storage).toBeDefined();
      expect(typeof options.storage.getItem).toBe("function");
    });
  });
});
