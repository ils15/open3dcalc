import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageGetItem = vi.hoisted(() => vi.fn());
const storageSetItem = vi.hoisted(() => vi.fn());
const storageRemoveItem = vi.hoisted(() => vi.fn());
const storageValues = vi.hoisted(() => new Map<string, string>());
const calculatorSetState = vi.hoisted(() => vi.fn());
const calculatorState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const sharedCalculation = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/shared/lib/manifestStorage", () => ({
  guardedStorage: {
    getItem: (key: string) => storageGetItem(key),
    setItem: (key: string, value: string) => storageSetItem(key, value),
    removeItem: (key: string) => storageRemoveItem(key),
  },
  manifestStorage: () => ({
    getItem: (key: string) => {
      const value = storageGetItem(key);
      return value === null ? null : JSON.parse(value);
    },
    setItem: (key: string, value: unknown) =>
      storageSetItem(key, JSON.stringify(value)),
    removeItem: (key: string) => storageRemoveItem(key),
  }),
  isElectronRuntime: () => true,
  stablePiiPersistStorage: () => ({
    getItem: (key: string) => {
      const value = storageGetItem(key);
      return value === null ? null : JSON.parse(value);
    },
    setItem: (key: string, value: unknown) =>
      storageSetItem(key, JSON.stringify(value)),
    removeItem: (key: string) => storageRemoveItem(key),
  }),
}));

vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: {
    getState: () =>
      calculatorState.current ?? {
        quantity: 1,
        calculationIssues: [],
      },
    setState: calculatorSetState,
  },
}));

vi.mock("@/shared/stores/calculatorStore.compute", () => ({
  computeStoreResults: vi.fn(),
}));

vi.mock("@/shared/lib/calculationLink", () => ({
  getSharedCalculation: vi.fn(() => sharedCalculation.current),
}));

vi.mock("@/shared/lib/printers", () => ({
  printers: [],
  getPrinter: vi.fn((id: string) => ({
    id: id || "generic-fdm",
    name: "Mock Printer",
    power: 200,
    investment: 2500,
    usefulLife: 3000,
    maintenanceRate: 0.05,
    technology: "fdm",
  })),
}));
vi.mock("@/shared/lib/marketplace", () => ({ marketplaces: [] }));
vi.mock("@/shared/hooks/useTutorialTabNavigation", () => ({
  useTutorialTabNavigation: vi.fn(),
}));

import { useAppInit } from "../useAppInit";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import type { HistoryEntry } from "@/shared/types";
import {
  configurePiiStoreRuntime,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
  whenPiiWritesSettled,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  createPiiStore,
  lockAllPiiStores,
  PII_VAULT_STORE,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import { setPiiStoreEnvironment } from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

/**
 * The legacy migration no longer writes PII to `localStorage`: the three stores
 * persist through the encrypted vault. So these specs provision a capable vault
 * and assert the migrated history reaches it, while the durable marker, the
 * resume-after-interruption path and the verify-before-delete ordering are
 * asserted exactly as before.
 */
const HISTORY_VAULT_KEY = "open3dcalc_history_v2";
const VAULT_PASS = "senha-sintética-useappinit-4242";

function createCombinedLegacyFixtures() {
  const result = (totalCost: number, sellPrice: number) => ({
    materialCost: totalCost * 0.4,
    energyCost: totalCost * 0.05,
    machineCost: totalCost * 0.1,
    hardwareCost: totalCost * 0.03,
    consumablesCost: totalCost * 0.02,
    laborCost: totalCost * 0.1,
    softwareCost: totalCost * 0.01,
    failureCost: totalCost * 0.02,
    extrasCost: totalCost * 0.03,
    postProcessingCost: totalCost * 0.04,
    subtotal: totalCost,
    totalCost,
    sellPrice,
    profit: sellPrice - totalCost,
    marketplaceFee: sellPrice * 0.03,
    taxAmount: sellPrice * 0.02,
    costPerGram: totalCost / 50,
    costPerUnit: totalCost,
    unitWeight: 50,
    estimatedPrintTime: 2.5,
    targetMarginPercent: 50,
    breakEvenPrice: totalCost,
    actualMargin: ((sellPrice - totalCost) / sellPrice) * 100,
    carbonFootprintGrams: totalCost * 0.2,
  });

  const productSnapshot = {
    type: "resin" as const,
    summary: "Resina âmbar • 🧪",
    selectedPrinterId: "legacy-resin-printer",
    resinMaterial: { type: "Resina UV", color: "âmbar" },
  };
  const product = {
    id: "legacy-product-compat-01",
    timestamp: 1_700_000_000_301,
    name: "Vaso 🪷",
    result: result(17.25, 34.5),
    snapshot: productSnapshot,
  };
  const historyOne = {
    id: "legacy-history-compat-01",
    timestamp: 1_700_000_000_401,
    type: "fdm" as const,
    summary: "PETG café • 🫘",
    totalCost: 12.4,
    sellPrice: 24.8,
    profit: 12.4,
    result: result(12.4, 24.8),
    snapshot: {
      type: "fdm" as const,
      summary: "PETG café • 🫘",
      selectedPrinterId: "legacy-fdm-printer",
      fdmMaterial: { type: "PETG", color: "café" },
    },
  };
  const historyTwo = {
    id: "legacy-history-compat-02",
    timestamp: 1_700_000_000_402,
    type: "resin" as const,
    summary: "Resina • 東京 🗼",
    totalCost: 31.6,
    sellPrice: 63.2,
    profit: 31.6,
    result: result(31.6, 63.2),
    snapshot: {
      type: "resin" as const,
      summary: "Resina • 東京 🗼",
      selectedPrinterId: "legacy-history-printer",
      resinMaterial: { type: "透明レジン", color: "青" },
    },
  };

  const expectedProduct = {
    id: product.id,
    timestamp: product.timestamp,
    type: product.snapshot.type,
    name: product.name,
    summary: product.snapshot.summary,
    totalCost: product.result.totalCost,
    sellPrice: product.result.sellPrice,
    profit: product.result.sellPrice - product.result.totalCost,
    result: product.result,
    snapshot: product.snapshot,
  };
  const expectedHistoryOne = {
    ...historyOne,
    name: historyOne.summary,
  };
  const expectedHistoryTwo = {
    ...historyTwo,
    name: historyTwo.summary,
  };

  return {
    productSource: JSON.stringify([product]),
    historySource: JSON.stringify([historyOne, historyTwo]),
    expectedEntries: [expectedHistoryTwo, expectedHistoryOne, expectedProduct],
  };
}

describe("useAppInit tutorial auto-start", () => {
  let vaultIdb: ReturnType<typeof createFakeIndexedDb>;
  const vaultOptions = () => ({
    indexedDb: vaultIdb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  /**
   * Unlock the vault and wake the migration's target store.
   *
   * The migration now persists history through the vault, so a spec that wants
   * to observe the migrated records must have a capable, unlocked vault. Timers
   * are real here because the fake IndexedDB resolves on a macrotask; the
   * spec's own fake timers are installed afterwards.
   */
  async function unlockVault(): Promise<void> {
    vi.useRealTimers();
    await unlockPiiStoresAndRehydrate(VAULT_PASS, vaultOptions());
    await settleWrites();
    // Simulate a fresh profile: the store starts empty. Drain the resulting
    // empty-state write so it cannot race the migration's own write.
    useHistoryStore.setState({ entries: [] });
    await settleWrites();
  }

  /**
   * Wait until the migration stops touching storage — a CONDITION, not a drain.
   *
   * ## Why the vault drain alone is not a barrier
   *
   * `whenPiiWritesSettled()` only sees writes the gate recorded in
   * `observedWriteTails` (`src/shared/lib/crypto/piiStoreHydration.ts:300`),
   * and it keeps just the LAST promise per persist key (`:302`). The migration's
   * own tail past its final put is in none of that: `didPiiWritesCommit()`
   * (`useAppInit.ts:309`) is followed by `readPiiPersistedRecord()`
   * (`:310`) — an IndexedDB READ, never registered as a write tail
   * (`piiStoreHydration.ts:334-343`) — and only then by
   * `guardedStorage.removeItem(MIGRATION_PROGRESS_KEY)` (`useAppInit.ts:355`).
   *
   * Each fake-IDB request costs at least one macrotask
   * (`src/shared/test/fakeIndexedDb.ts:146,299`), so the fixed
   * `setTimeout(resolve, 0)` hops this helper used to interleave do NOT
   * reliably cover `open → get → decrypt` on a loaded event loop. The tail
   * therefore outlived the spec that started it and landed on the NEXT spec's
   * `storageRemoveItem` mock — `vi.clearAllMocks()` resets the recorder but
   * cannot stop an already-scheduled chain. That is why
   * "recovers the complete legacy history after the second persistence write
   * fails" failed in CI with
   * `expected "vi.fn()" to not be called with
   * ['open3dcalc_migration_progress_v2']` while `storageValues` still held the
   * marker (the fresh migration had already re-written it at
   * `useAppInit.ts:495`).
   *
   * Waiting for storage to go QUIET covers a chain of any length: each new
   * `setItem`/`removeItem` resets the idle counter, so a tail that is still
   * working keeps pushing the window forward. It terminates because a
   * migration performs finitely many writes.
   */
  async function waitForStorageQuiet(): Promise<void> {
    const writeCount = (): number =>
      storageSetItem.mock.calls.length + storageRemoveItem.mock.calls.length;
    let previous = writeCount();
    let idle = 0;
    while (idle < 5) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const current = writeCount();
      idle = current === previous ? idle + 1 : 0;
      previous = current;
    }
  }

  /** Drain the vault write queue through a macrotask the fake IDB commits on. */
  async function settleWrites(): Promise<void> {
    await whenPiiWritesSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await whenPiiWritesSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await whenPiiWritesSettled();
    // The vault queue is drained; the migration's own untracked tail may not be.
    await waitForStorageQuiet();
  }

  /** The migrated history entries as they now live, read from the vault. */
  async function vaultHistoryEntries(): Promise<unknown[]> {
    const raw = await createPiiStore(HISTORY_VAULT_KEY, vaultOptions()).read();
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { state?: { entries?: unknown } };
    return Array.isArray(parsed.state?.entries) ? parsed.state.entries : [];
  }

  /**
   * Make the Nth vault write FAIL, at the storage layer.
   *
   * The plaintext `localStorage` write is gone, so an interrupted startup can
   * only be modelled at the VAULT write — which is where the migration's
   * durability check now runs. Failing inside the IndexedDB double means the
   * rejection travels through the real gate (`commit_failed`), so the gate's
   * write barrier observes it exactly as it would in production.
   */
  function installVaultFailureOnNthWrite(failOn: number | null): {
    writes: number;
  } {
    vaultIdb.failPutsOnCall(failOn);
    return {
      get writes() {
        return vaultIdb.putCalls();
      },
    };
  }

  /**
   * Interrupt the vault write that would COMMIT THE COMPLETE SET.
   *
   * `installVaultFailureOnNthWrite` counts puts GLOBALLY, so a stray same-key
   * write (a leaked empty-state persist) can consume the armed slot: the
   * failure then lands on the FIRST migration write, the SECOND commits the
   * full set, verification passes legitimately and the recovery marker is
   * removed — which is exactly the interruption model the spec exists to
   * defend. The fix anchors on the WRITE rather than on an ordinal.
   *
   * The double sees only the SEALED record, so the anchor is the migration's
   * deterministic payload-size progression: it persists the legacy history one
   * entry per write, so each successive record is strictly larger than the one
   * already stored. Failing the put that (a) has already grown past the
   * pre-migration record and (b) is itself larger than what is stored now
   * always targets the committing write, whatever same-key write came first.
   */
  function installVaultFailureOnCommittingWrite(): {
    interrupted: number;
  } {
    const baseline = vaultIdb.raw(PII_VAULT_STORE, HISTORY_VAULT_KEY);
    const baselineLength = typeof baseline === "string" ? baseline.length : 0;
    const state = { interrupted: 0 };
    vaultIdb.failPutsMatching((key, value) => {
      if (key !== HISTORY_VAULT_KEY) return false;
      const stored = vaultIdb.raw(PII_VAULT_STORE, key);
      const storedLength = typeof stored === "string" ? stored.length : 0;
      const valueLength = typeof value === "string" ? value.length : 0;
      const commitsPastPrefix =
        storedLength > baselineLength && valueLength > storedLength;
      if (commitsPastPrefix) state.interrupted += 1;
      return commitsPastPrefix;
    });
    return {
      get interrupted() {
        return state.interrupted;
      },
    };
  }

  beforeEach(() => {
    vaultIdb = createFakeIndexedDb();
    setPiiStoreEnvironment(PII_STORE_ENVIRONMENT);
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(vaultOptions());
    zeroizeSessionPassphrase();

    vi.clearAllMocks();
    storageValues.clear();
    storageGetItem.mockImplementation(
      (key: string) => storageValues.get(key) ?? null,
    );
    storageSetItem.mockImplementation((key: string, value: string) => {
      storageValues.set(key, value);
    });
    storageRemoveItem.mockImplementation((key: string) => {
      storageValues.delete(key);
    });
    useHistoryStore.setState({ entries: [] });
    sharedCalculation.current = null;
    calculatorState.current = null;
    vi.useFakeTimers();
    localStorage.clear();
    storageGetItem.mockImplementation((key: string) =>
      key === "open3dcalc_onboarded" ? "1" : (storageValues.get(key) ?? null),
    );
    useLayoutStore.setState({ layoutMode: "classic" });
    useTutorialStore.setState({
      isActive: false,
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      completedTours: [],
      sessionDismissed: false,
    });
  });

  afterEach(async () => {
    // Unmount first: an effect still mounted here can issue a fire-and-forget
    // vault write that would otherwise land inside the NEXT spec's armed
    // window and shift its injected failure. Drain those writes before the
    // runtime is reset, or "settled" would only mean "abandoned".
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    await whenPiiWritesSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await whenPiiWritesSettled();
    // …and then wait for the migration's UNTRACKED tail (`readPiiPersistedRecord`
    // → `removeItem`, `useAppInit.ts:310,355`) to finish touching storage. The
    // two drains above are not a barrier for it: that read is never registered
    // as a write tail (`piiStoreHydration.ts:334`), so on a loaded event loop it
    // can outlive this spec and record a `removeItem` on the NEXT spec's mock —
    // which is what failed CI here. See `waitForStorageQuiet`.
    await waitForStorageQuiet();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  /**
   * Let the fire-and-forget migration settle.
   *
   * `migrateLegacyData()` runs in an effect and must not block render, so the
   * legacy path (no vault) resolves over microtasks. Draining the queue is what
   * a spec awaits before asserting what the migration did.
   */
  async function flushMigration(): Promise<void> {
    await whenPiiWritesSettled();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it.each(["guided", "bento"] as const)(
    "does not auto-start the tutorial in %s layout",
    (layoutMode) => {
      useLayoutStore.setState({ layoutMode });
      renderHook(() => useAppInit(vi.fn()));

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(useTutorialStore.getState().isActive).toBe(false);
    },
  );

  it("auto-starts the tutorial in Classic", () => {
    renderHook(() => useAppInit(vi.fn()));

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(useTutorialStore.getState().isActive).toBe(true);
  });

  it("forces AMS off from a shared URL while preserving its slots", () => {
    const slots = [
      {
        enabled: true,
        materialType: "PETG",
        costPerKg: 90,
        weightUsedGrams: 42,
        purgeWeightGrams: 4,
        transitionPurgeGrams: 3,
        density: 1.27,
        spoolEfficiency: 97,
        color: "#00ff00",
      },
    ];
    sharedCalculation.current = {
      activeTab: "fdm",
      fdmAmsEnabled: true,
      fdmAmsSlots: slots,
    };
    window.location.hash = "#shared-calculation";

    renderHook(() => useAppInit(vi.fn()));

    expect(calculatorSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        fdmAmsEnabled: false,
        fdmAmsSlots: slots,
      }),
    );
    expect(window.location.hash).toBe("");
  });

  it("routes go-products events and removes the listener on unmount", () => {
    const navigate = vi.fn();
    const { unmount } = renderHook(() => useAppInit(navigate));

    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("products");

    unmount();
    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("saves the currency and retains older settings fields on beforeunload", () => {
    const oldSettings = JSON.stringify({
      quantity: 3,
      futureUserField: { keep: true },
    });
    storageGetItem.mockImplementation((key: string) => {
      if (key === "open3dcalc_settings_v2") return oldSettings;
      return key === "open3dcalc_onboarded" ? "1" : null;
    });
    calculatorState.current = {
      quantity: 3,
      calculationIssues: [],
      currency: "GBP",
      selectedPrinter: { id: "printer-legacy" },
      selectedMarketplace: { id: "marketplace-legacy" },
    };

    const { unmount } = renderHook(() => useAppInit(vi.fn()));
    act(() => window.dispatchEvent(new Event("beforeunload")));
    unmount();

    const settingsWrite = storageSetItem.mock.calls.find(
      ([key]) => key === "open3dcalc_settings_v2",
    );
    expect(settingsWrite).toBeDefined();
    const saved = JSON.parse(settingsWrite![1] as string) as Record<
      string,
      unknown
    >;
    expect(saved.currency).toBe("GBP");
    expect(saved.quantity).toBe(3);
    expect(saved.futureUserField).toEqual({ keep: true });
  });

  it("does not delete the current product-store wrapper when history is empty", () => {
    const wrapper = JSON.stringify({
      state: { products: [{ id: "product-1", name: "Peça salva" }] },
      version: 1,
    });
    storageValues.set("open3dcalc_products", wrapper);

    renderHook(() => useAppInit(vi.fn()));

    expect(storageValues.get("open3dcalc_products")).toBe(wrapper);
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it("migrates literal legacy products without removing the source before verifying the entries", async () => {
    const result = {
      totalCost: 12.5,
      sellPrice: 25,
      profit: 12.5,
      materialCost: 8,
      energyCost: 1,
      machineCost: 2,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 0.5,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 12.5,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.25,
      costPerUnit: 12.5,
      unitWeight: 50,
      estimatedPrintTime: 2,
      targetMarginPercent: 50,
      breakEvenPrice: 12.5,
      actualMargin: 50,
      carbonFootprintGrams: 3,
    };
    const snapshot = { type: "resin" as const, summary: "Resina • azul" };
    const legacyProducts = [
      {
        id: "legacy-product-7",
        timestamp: 1_700_000_000_007,
        name: "Peça 🧪",
        result,
        snapshot,
      },
    ];
    storageValues.set("open3dcalc_products", JSON.stringify(legacyProducts));
    const expectedEntry = {
      id: "legacy-product-7",
      timestamp: 1_700_000_000_007,
      type: "resin",
      name: "Peça 🧪",
      summary: "Resina • azul",
      totalCost: 12.5,
      sellPrice: 25,
      profit: 12.5,
      result,
      snapshot,
    };
    let verifiedAtRemoval = false;
    storageRemoveItem.mockImplementation((key: string) => {
      if (key === "open3dcalc_products") {
        verifiedAtRemoval =
          JSON.stringify(useHistoryStore.getState().entries) ===
          JSON.stringify([expectedEntry]);
      }
      storageValues.delete(key);
    });

    renderHook(() => useAppInit(vi.fn()));
    // The migration is fire-and-forget so it cannot block render.
    await flushMigration();

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual(expectedEntry);
    expect(verifiedAtRemoval).toBe(true);
    expect(storageValues.has("open3dcalc_products")).toBe(false);

    renderHook(() => useAppInit(vi.fn()));
    await flushMigration();
    expect(useHistoryStore.getState().entries).toEqual(migrated);
  });

  it("keeps unconvertible legacy product records instead of dropping their source", () => {
    const raw = JSON.stringify([
      { id: "legacy-without-result", name: "Salvo" },
    ]);
    storageValues.set("open3dcalc_products", raw);

    renderHook(() => useAppInit(vi.fn()));

    expect(storageValues.get("open3dcalc_products")).toBe(raw);
    expect(useHistoryStore.getState().entries).toEqual([]);
    expect(storageRemoveItem).not.toHaveBeenCalledWith("open3dcalc_products");
  });

  it("retains and verifies legacy history in its destination without deleting the legacy key", async () => {
    const result = {
      totalCost: 18,
      sellPrice: 36,
      profit: 18,
      materialCost: 12,
      energyCost: 2,
      machineCost: 2,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 1,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 18,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.3,
      costPerUnit: 18,
      unitWeight: 60,
      estimatedPrintTime: 3,
      targetMarginPercent: 50,
      breakEvenPrice: 18,
      actualMargin: 50,
      carbonFootprintGrams: 4,
    };
    const snapshot = { type: "fdm" as const, summary: "PETG café" };
    // The legacy key is compatibility INPUT, and copy-and-never-delete keeps it.
    const legacySource = JSON.stringify([
      {
        id: "legacy-history-9",
        timestamp: 1_700_000_000_009,
        type: "fdm",
        summary: "PETG café",
        totalCost: 18,
        sellPrice: 36,
        profit: 18,
        result,
        snapshot,
      },
    ]);
    storageValues.set("open3dcalc_history_v2", legacySource);

    await unlockVault();
    renderHook(() => useAppInit(vi.fn()));
    await flushMigration();
    await settleWrites();

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual({
      id: "legacy-history-9",
      timestamp: 1_700_000_000_009,
      type: "fdm",
      name: "PETG café",
      summary: "PETG café",
      totalCost: 18,
      sellPrice: 36,
      profit: 18,
      result,
      snapshot,
    });

    // The migrated history now lives in the VAULT, not in localStorage.
    await expect(vaultHistoryEntries()).resolves.toEqual(migrated);
    // And the legacy key is retained read-only, never deleted.
    expect(storageValues.get("open3dcalc_history_v2")).toBe(legacySource);

    // Idempotent on a second startup.
    renderHook(() => useAppInit(vi.fn()));
    await flushMigration();
    await settleWrites();
    expect(useHistoryStore.getState().entries).toEqual(migrated);
  });

  it("recovers the complete legacy history after the second persistence write fails", async () => {
    const historyKey = "open3dcalc_history_v2";
    // W4.4: the CURRENT marker is the value-free progress key; the PII-bearing
    // legacy key is asserted to stay absent.
    const recoveryKey = "open3dcalc_migration_progress_v2";
    const legacyPiiMarker = "open3dcalc_migration_done_v2";
    const resultOne = {
      materialCost: 8,
      energyCost: 1,
      machineCost: 2,
      hardwareCost: 0.5,
      consumablesCost: 0.25,
      laborCost: 1.5,
      softwareCost: 0.75,
      failureCost: 0.1,
      extrasCost: 0.2,
      postProcessingCost: 0.3,
      subtotal: 14.6,
      totalCost: 14.6,
      sellPrice: 29.2,
      profit: 14.6,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.2,
      costPerUnit: 14.6,
      unitWeight: 40,
      estimatedPrintTime: 2,
      targetMarginPercent: 50,
      breakEvenPrice: 14.6,
      actualMargin: 50,
      carbonFootprintGrams: 2,
    };
    const resultTwo = {
      ...resultOne,
      materialCost: 12,
      subtotal: 23,
      totalCost: 23,
      sellPrice: 46,
      profit: 23,
      costPerGram: 0.46,
      costPerUnit: 23,
      unitWeight: 50,
      estimatedPrintTime: 3.5,
      carbonFootprintGrams: 5,
    };
    const snapshotOne = {
      type: "resin" as const,
      summary: "Resina • azul 🧪",
      selectedPrinterId: "printer-resina",
      resinMaterial: { type: "Resina UV", color: "azul" },
    };
    const snapshotTwo = {
      type: "fdm" as const,
      summary: "PETG café 🫘",
      selectedPrinterId: "printer-fdm",
      fdmMaterial: { type: "PETG", color: "café" },
    };
    const legacyHistory = [
      {
        id: "legacy-history-resin-01",
        timestamp: 1_700_000_000_101,
        type: "resin" as const,
        summary: "Resina • azul 🧪",
        totalCost: 14.6,
        sellPrice: 29.2,
        profit: 14.6,
        result: resultOne,
        snapshot: snapshotOne,
      },
      {
        id: "legacy-history-fdm-02",
        timestamp: 1_700_000_000_202,
        type: "fdm" as const,
        summary: "PETG café 🫘",
        totalCost: 23,
        sellPrice: 46,
        profit: 23,
        result: resultTwo,
        snapshot: snapshotTwo,
      },
    ];
    const expectedOne = {
      id: "legacy-history-resin-01",
      timestamp: 1_700_000_000_101,
      type: "resin",
      name: "Resina • azul 🧪",
      summary: "Resina • azul 🧪",
      totalCost: 14.6,
      sellPrice: 29.2,
      profit: 14.6,
      result: resultOne,
      snapshot: snapshotOne,
    };
    const expectedTwo = {
      id: "legacy-history-fdm-02",
      timestamp: 1_700_000_000_202,
      type: "fdm",
      name: "PETG café 🫘",
      summary: "PETG café 🫘",
      totalCost: 23,
      sellPrice: 46,
      profit: 23,
      result: resultTwo,
      snapshot: snapshotTwo,
    };
    const expectedEntries = [expectedTwo, expectedOne];
    const originalSource = JSON.stringify(legacyHistory);
    // The legacy key is compatibility INPUT, retained read-only. It is never
    // written by the migration.
    storageValues.set(historyKey, originalSource);
    expect(storageValues.get(historyKey)).toBe(originalSource);
    expect(storageValues.has(recoveryKey)).toBe(false);

    // A capable, unlocked vault: the migration's destination.
    await unlockVault();
    // Interrupt the write that would COMMIT THE COMPLETE SET, anchored on the
    // payload the migration persists rather than on a global put ordinal.
    const interruption = installVaultFailureOnCommittingWrite();

    renderHook(() => useAppInit(vi.fn()));

    // The interruption settled on the committing write: the first migration
    // write is durable and the second (the complete set) never landed.
    await vi.waitFor(async () => {
      expect(await vaultHistoryEntries()).toHaveLength(1);
    });
    // Wait for the CONDITION, not for a fixed drain: `vaultHistoryEntries()`
    // only proves the FIRST put committed, and the refused second put issues no
    // storage write, so `waitForStorageQuiet()` cannot observe it. Reading
    // `interruption.interrupted` before the refusing put had run was the other
    // way this spec could flake.
    await vi.waitFor(() => expect(interruption.interrupted).toBe(1));
    await settleWrites();

    // The durable recovery marker SURVIVED so the next startup can resume from
    // the intact source — but it is VALUE-FREE (W4.4): it carries no record.
    expect(storageValues.has(recoveryKey)).toBe(true);
    expect(JSON.parse(storageValues.get(recoveryKey)!)).toEqual({
      type: "open3dcalc-history-v2-progress",
      v: 1,
    });
    // No raw legacy content in the persisted marker value.
    expect(storageValues.get(recoveryKey)).not.toContain(
      "legacy-history-resin-01",
    );
    // The PII-bearing legacy marker was NEVER written.
    expect(storageValues.has(legacyPiiMarker)).toBe(false);
    expect(storageValues.get(historyKey)).toBe(originalSource);
    expect(storageRemoveItem).not.toHaveBeenCalledWith(recoveryKey);
    // NO plaintext PII write: the legacy history key was never written.
    expect(storageSetItem).not.toHaveBeenCalledWith(
      historyKey,
      expect.anything(),
    );

    // The vault holds the prefix that committed before the failure: exactly one
    // entry, the first one migrated.
    const prefix = await vaultHistoryEntries();
    expect(prefix).toHaveLength(1);
    expect(prefix[0]).toEqual(expectedOne);

    // Simulate a fresh app process resuming from the durable marker. Timers are
    // already real (unlockVault switched them); the next write succeeds.
    storageSetItem.mockClear();
    useHistoryStore.setState({ entries: prefix as unknown as HistoryEntry[] });
    // Disarm the content-anchored interruption so the resume can commit.
    vaultIdb.failPutsMatching(null);

    let markerRemovedAfterVerification = false;
    storageRemoveItem.mockImplementation((key: string) => {
      if (key === recoveryKey) {
        markerRemovedAfterVerification =
          JSON.stringify(useHistoryStore.getState().entries) ===
          JSON.stringify(expectedEntries);
      }
      storageValues.delete(key);
    });

    renderHook(() => useAppInit(vi.fn()));

    await vi.waitFor(() => expect(storageValues.has(recoveryKey)).toBe(false));
    await settleWrites();

    // Every entry recovered, including the one written before the failure.
    const recovered = useHistoryStore.getState().entries;
    expect(recovered).toHaveLength(2);
    expect(new Set(recovered.map((entry) => entry.id)).size).toBe(2);
    expect(recovered).toEqual(expectedEntries);
    expect(recovered.find((entry) => entry.id === expectedOne.id)).toEqual(
      expectedOne,
    );
    expect(recovered.find((entry) => entry.id === expectedTwo.id)).toEqual(
      expectedTwo,
    );
    // The marker was cleared only AFTER the verification saw the full set.
    expect(markerRemovedAfterVerification).toBe(true);
    expect(storageValues.has(recoveryKey)).toBe(false);
    // The recovered entries are durable in the vault.
    await expect(vaultHistoryEntries()).resolves.toEqual(expectedEntries);
    // Still no plaintext PII write to the legacy history key.
    expect(storageSetItem).not.toHaveBeenCalledWith(
      historyKey,
      expect.anything(),
    );

    // Idempotent: a third startup neither duplicates nor re-writes.
    renderHook(() => useAppInit(vi.fn()));
    await settleWrites();
    expect(useHistoryStore.getState().entries).toEqual(expectedEntries);
    expect(useHistoryStore.getState().entries).toHaveLength(2);
  });

  it("migrates both supported legacy sources with all records and remains idempotent", async () => {
    const { productSource, historySource, expectedEntries } =
      createCombinedLegacyFixtures();
    storageValues.set("open3dcalc_products", productSource);
    storageValues.set("open3dcalc_history_v2", historySource);

    await unlockVault();
    renderHook(() => useAppInit(vi.fn()));
    // The migration is fire-and-forget and awaits the vault write before it
    // clears the marker and drops the product source, so wait for that outcome
    // rather than for a fixed number of ticks.
    await vi.waitFor(() =>
      expect(storageValues.has("open3dcalc_products")).toBe(false),
    );

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(3);
    expect(new Set(migrated.map((entry) => entry.id)).size).toBe(3);
    expect(migrated).toEqual(expectedEntries);
    expect(migrated.map((entry) => entry.id)).toEqual([
      "legacy-history-compat-02",
      "legacy-history-compat-01",
      "legacy-product-compat-01",
    ]);
    expect(migrated[0].snapshot).toEqual(expectedEntries[0].snapshot);
    expect(migrated[1].result).toEqual(expectedEntries[1].result);
    expect(migrated[2].snapshot).toEqual(expectedEntries[2].snapshot);
    // The independent legacy PRODUCT source is removed once migration verifies;
    // the history source is input and copy-and-never-delete retains it.
    expect(storageValues.has("open3dcalc_products")).toBe(false);
    expect(storageValues.has("open3dcalc_migration_done_v2")).toBe(false);
    expect(storageValues.get("open3dcalc_history_v2")).toBe(historySource);

    // The migrated records now live in the VAULT.
    await expect(vaultHistoryEntries()).resolves.toEqual(expectedEntries);

    // Idempotent: a second startup neither duplicates nor re-writes.
    const vaultAfterMigration = await vaultHistoryEntries();
    renderHook(() => useAppInit(vi.fn()));
    await settleWrites();
    expect(useHistoryStore.getState().entries).toEqual(expectedEntries);
    await expect(vaultHistoryEntries()).resolves.toEqual(vaultAfterMigration);
  });

  it("records a value-free drift fingerprint when the migration commits", async () => {
    const historyKey = "open3dcalc_history_v2";
    const fingerprintKey = "open3dcalc_migration_fingerprint_v1";
    const result = {
      totalCost: 6,
      sellPrice: 12,
      profit: 6,
      materialCost: 3,
      energyCost: 0.5,
      machineCost: 1,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 0.5,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 6,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.12,
      costPerUnit: 6,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 6,
      actualMargin: 50,
      carbonFootprintGrams: 1,
    };
    const canary = "SENTINEL-DRIFT-FINGERPRINT-CANARY";
    storageValues.set(
      historyKey,
      JSON.stringify([
        {
          id: "drift-history-01",
          timestamp: 1_700_000_000_701,
          type: "fdm",
          summary: canary,
          totalCost: 6,
          sellPrice: 12,
          profit: 6,
          result,
          snapshot: null,
        },
      ]),
    );

    await unlockVault();
    renderHook(() => useAppInit(vi.fn()));
    await vi.waitFor(() =>
      expect(storageValues.has(fingerprintKey)).toBe(true),
    );
    await settleWrites();

    const raw = storageValues.get(fingerprintKey);
    expect(raw).toBeDefined();
    // Counts only, and no legacy content leaks into the fingerprint.
    expect(JSON.parse(raw as string)).toEqual({
      type: "open3dcalc-migration-fingerprint",
      v: 1,
      history: 1,
      products: null,
    });
    expect(raw).not.toContain(canary);
  });

  it("recovers both original sources after a durable product write and partial history write", async () => {
    const historyKey = "open3dcalc_history_v2";
    const productKey = "open3dcalc_products";
    const recoveryKey = "open3dcalc_migration_progress_v2";
    const legacyPiiMarker = "open3dcalc_migration_done_v2";
    const { productSource, historySource, expectedEntries } =
      createCombinedLegacyFixtures();
    storageValues.set(productKey, productSource);
    storageValues.set(historyKey, historySource);

    await unlockVault();
    // Fail the THIRD vault write issued by the migration. The combined import
    // writes the history entries first and the converted product after; the
    // third is the product, so the interruption lands after a durable prefix.
    const counter = installVaultFailureOnNthWrite(3);

    renderHook(() => useAppInit(vi.fn()));

    await vi.waitFor(() => expect(counter.writes).toBe(3));
    await settleWrites();

    // The durable recovery marker SURVIVED so the next startup can resume from
    // the intact sources — but it is VALUE-FREE (W4.4): it carries no record.
    expect(storageValues.has(recoveryKey)).toBe(true);
    expect(JSON.parse(storageValues.get(recoveryKey)!)).toEqual({
      type: "open3dcalc-history-v2-progress",
      v: 1,
    });
    expect(storageValues.get(recoveryKey)).not.toContain(
      "legacy-product-compat-01",
    );
    // The PII-bearing legacy marker was NEVER written.
    expect(storageValues.has(legacyPiiMarker)).toBe(false);
    expect(storageValues.get(productKey)).toBe(productSource);
    expect(storageValues.get(historyKey)).toBe(historySource);
    expect(storageRemoveItem).not.toHaveBeenCalledWith(productKey);
    expect(storageRemoveItem).not.toHaveBeenCalledWith(recoveryKey);

    // The vault holds the prefix that committed before the failure: the
    // converted product and the first history entry, in migration order. The
    // third write (the second history entry) never landed.
    const prefix = await vaultHistoryEntries();
    expect(prefix).toHaveLength(2);
    expect((prefix as Array<{ id: string }>).map((entry) => entry.id)).toEqual([
      "legacy-history-compat-01",
      "legacy-product-compat-01",
    ]);
    // The in-memory store holds the full converted set even though the last
    // write failed; the marker is what guarantees it gets re-persisted.
    expect(useHistoryStore.getState().entries).toHaveLength(3);

    // Fresh process resuming from the marker. Writes succeed this time.
    useHistoryStore.setState({ entries: prefix as unknown as HistoryEntry[] });
    storageSetItem.mockClear();
    installVaultFailureOnNthWrite(null);

    let sourcesRemovedAfterVerification = false;
    storageRemoveItem.mockImplementation((key: string) => {
      if (key === productKey) {
        // The product source is dropped only after the full migrated set is in
        // the store, verified by id SET (order is not what durability means).
        const inStore = useHistoryStore.getState().entries;
        sourcesRemovedAfterVerification =
          inStore.length === expectedEntries.length &&
          new Set(inStore.map((entry) => entry.id)).size ===
            expectedEntries.length &&
          expectedEntries.every((expected) =>
            inStore.some((entry) => entry.id === expected.id),
          ) &&
          // ...and the durable marker is still retained at this point, so a
          // crash between the two removals is still recoverable.
          storageValues.has(recoveryKey);
      }
      storageValues.delete(key);
    });

    renderHook(() => useAppInit(vi.fn()));

    await vi.waitFor(() => expect(storageValues.has(productKey)).toBe(false));
    await settleWrites();

    const recovered = useHistoryStore.getState().entries;
    expect(recovered).toHaveLength(3);
    expect(new Set(recovered.map((entry) => entry.id)).size).toBe(3);
    expect(recovered).toEqual(expectedEntries);
    // Both sources were dropped only after the full set was verified durable.
    expect(storageRemoveItem).toHaveBeenCalledWith(productKey);
    expect(storageValues.get(productKey)).toBeUndefined();
    expect(storageValues.has(recoveryKey)).toBe(false);
    expect(sourcesRemovedAfterVerification).toBe(true);
    // The recovered set is durable in the vault.
    await expect(vaultHistoryEntries()).resolves.toEqual(expectedEntries);
    // No plaintext PII write: the legacy history key was never written.
    expect(storageSetItem).not.toHaveBeenCalledWith(
      historyKey,
      expect.anything(),
    );

    // Idempotent on a third startup.
    renderHook(() => useAppInit(vi.fn()));
    await settleWrites();
    expect(useHistoryStore.getState().entries).toEqual(expectedEntries);
  });

  it("preserves entries added after an interruption when resuming from the live source", async () => {
    const historyKey = "open3dcalc_history_v2";
    const recoveryKey = "open3dcalc_migration_progress_v2";
    const result = {
      totalCost: 7,
      sellPrice: 14,
      profit: 7,
      materialCost: 3,
      energyCost: 0.5,
      machineCost: 1,
      hardwareCost: 0.5,
      consumablesCost: 0,
      laborCost: 1,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 7,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.14,
      costPerUnit: 7,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 7,
      actualMargin: 50,
      carbonFootprintGrams: 2,
    };
    const legacy = (id: string, timestamp: number) => ({
      id,
      timestamp,
      type: "fdm" as const,
      summary: `Legado ${id}`,
      totalCost: 7,
      sellPrice: 14,
      profit: 7,
      result,
      snapshot: null,
    });
    // The interrupted run left the value-free progress marker and the intact
    // copy-without-delete source.
    storageValues.set(
      historyKey,
      JSON.stringify([legacy("legacy-history-resume-01", 1_700_000_000_601)]),
    );
    storageValues.set(
      recoveryKey,
      JSON.stringify({ type: "open3dcalc-history-v2-progress", v: 1 }),
    );

    await unlockVault();

    // Between the interruption and this resume the user created a history entry;
    // it is already in the store (vault-hydrated) and must survive the resume.
    const userEntry: HistoryEntry = {
      id: "user-entry-after-interrupt",
      timestamp: 1_700_000_900_000,
      type: "fdm",
      name: "Peça do usuário",
      summary: "Peça do usuário",
      totalCost: 5,
      sellPrice: 10,
      profit: 5,
      result,
      snapshot: null,
    };
    useHistoryStore.setState({ entries: [userEntry] });
    await settleWrites();

    renderHook(() => useAppInit(vi.fn()));
    await vi.waitFor(() => expect(storageValues.has(recoveryKey)).toBe(false));
    await settleWrites();

    const entries = useHistoryStore.getState().entries;
    const ids = entries.map((entry) => entry.id);
    // Idempotent MERGE: the user's entry AND the legacy records are present,
    // with no duplicate.
    expect(ids).toContain("user-entry-after-interrupt");
    expect(ids).toContain("legacy-history-resume-01");
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries).toHaveLength(2);
  });

  it("consumes and clears a LEGACY PII marker, resuming from its embedded source", async () => {
    const historyKey = "open3dcalc_history_v2";
    const legacyMarkerKey = "open3dcalc_migration_done_v2";
    const result = {
      totalCost: 9,
      sellPrice: 18,
      profit: 9,
      materialCost: 3,
      energyCost: 1,
      machineCost: 1,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 1,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 3,
      subtotal: 9,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.18,
      costPerUnit: 9,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 9,
      actualMargin: 50,
      carbonFootprintGrams: 2,
    };
    const expected = {
      id: "legacy-marker-hist-01",
      timestamp: 1_700_000_000_501,
      type: "fdm",
      name: "Legado • cinza",
      summary: "Legado • cinza",
      totalCost: 9,
      sellPrice: 18,
      profit: 9,
      result,
      snapshot: null,
    };
    // A marker as an OLD build wrote it: the raw source is embedded (PII).
    const legacyMarker = JSON.stringify({
      type: "open3dcalc-history-v2-backup",
      source: JSON.stringify([
        {
          id: "legacy-marker-hist-01",
          timestamp: 1_700_000_000_501,
          type: "fdm",
          summary: "Legado • cinza",
          totalCost: 9,
          sellPrice: 18,
          profit: 9,
          result,
          snapshot: null,
        },
      ]),
      baseEntries: [],
    });
    storageValues.set(legacyMarkerKey, legacyMarker);
    // No live history key: recovery must read the marker's embedded source.
    expect(storageValues.has(historyKey)).toBe(false);

    await unlockVault();

    let legacyMarkerClearedAfterVerification = false;
    storageRemoveItem.mockImplementation((key: string) => {
      if (key === legacyMarkerKey) {
        legacyMarkerClearedAfterVerification =
          JSON.stringify(useHistoryStore.getState().entries) ===
          JSON.stringify([expected]);
      }
      storageValues.delete(key);
    });

    renderHook(() => useAppInit(vi.fn()));

    await vi.waitFor(() =>
      expect(storageValues.has(legacyMarkerKey)).toBe(false),
    );
    await settleWrites();

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual(expected);
    await expect(vaultHistoryEntries()).resolves.toEqual([expected]);
    // The legacy marker was cleared only AFTER the full set verified.
    expect(legacyMarkerClearedAfterVerification).toBe(true);
    expect(storageValues.has(legacyMarkerKey)).toBe(false);
    // Read compatibility: the marker is READ and REMOVED, never rewritten.
    expect(storageSetItem).not.toHaveBeenCalledWith(
      legacyMarkerKey,
      expect.anything(),
    );
    // No new PII marker was written in its place.
    expect(storageValues.has("open3dcalc_migration_progress_v2")).toBe(false);
  });

  it("merges the legacy marker source with live entries and never resurrects a stale base entry", async () => {
    const legacyMarkerKey = "open3dcalc_migration_done_v2";
    const result = {
      totalCost: 9,
      sellPrice: 18,
      profit: 9,
      materialCost: 3,
      energyCost: 1,
      machineCost: 1,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 1,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 3,
      subtotal: 9,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.18,
      costPerUnit: 9,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 9,
      actualMargin: 50,
      carbonFootprintGrams: 2,
    };
    // A marker as an OLD build wrote it: the raw source is embedded (PII), and
    // `baseEntries` is a STALE snapshot of what the store held at that time.
    const legacyRecord = {
      id: "legacy-marker-merge-01",
      timestamp: 1_700_000_000_901,
      type: "fdm",
      summary: "Legado • merge",
      totalCost: 9,
      sellPrice: 18,
      profit: 9,
      result,
      snapshot: null,
    };
    const staleBaseEntry = {
      id: "legacy-base-deleted-01",
      timestamp: 1_700_000_000_902,
      type: "fdm",
      name: "Apagada pelo usuário",
      summary: "Apagada pelo usuário",
      totalCost: 1,
      sellPrice: 2,
      profit: 1,
      result,
      snapshot: null,
    };
    storageValues.set(
      legacyMarkerKey,
      JSON.stringify({
        type: "open3dcalc-history-v2-backup",
        source: JSON.stringify([legacyRecord]),
        baseEntries: [staleBaseEntry],
      }),
    );

    await unlockVault();

    // Between the interruption and this resume the user created a history entry
    // AND deleted the one the stale snapshot still holds. A MERGE must keep the
    // former and must NOT resurrect the latter.
    const userEntry: HistoryEntry = {
      id: "user-entry-after-marker-interrupt",
      timestamp: 1_700_000_900_100,
      type: "fdm",
      name: "Peça do usuário",
      summary: "Peça do usuário",
      totalCost: 5,
      sellPrice: 10,
      profit: 5,
      result,
      snapshot: null,
    };
    useHistoryStore.setState({ entries: [userEntry] });
    await settleWrites();

    renderHook(() => useAppInit(vi.fn()));
    await vi.waitFor(() =>
      expect(storageValues.has(legacyMarkerKey)).toBe(false),
    );
    await settleWrites();

    const entries = useHistoryStore.getState().entries;
    const ids = entries.map((entry) => entry.id);
    // The user's entry AND the marker's embedded legacy record survive…
    expect(ids).toContain("user-entry-after-marker-interrupt");
    expect(ids).toContain("legacy-marker-merge-01");
    // …the stale base snapshot does NOT resurrect a deletion…
    expect(ids).not.toContain("legacy-base-deleted-01");
    // …and there is no duplicate.
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries).toHaveLength(2);
    await expect(vaultHistoryEntries()).resolves.toHaveLength(2);
  });

  it("does not duplicate an id-less legacy record already in the store on resume", async () => {
    const historyKey = "open3dcalc_history_v2";
    const recoveryKey = "open3dcalc_migration_progress_v2";
    const result = {
      totalCost: 4,
      sellPrice: 8,
      profit: 4,
      materialCost: 2,
      energyCost: 0.5,
      machineCost: 0.5,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 0.5,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 0.5,
      subtotal: 4,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.08,
      costPerUnit: 4,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 4,
      actualMargin: 50,
      carbonFootprintGrams: 1,
    };
    // The legacy record carries NO id — a shape an old build could produce.
    storageValues.set(
      historyKey,
      JSON.stringify([
        {
          timestamp: 1_700_000_000_951,
          type: "fdm",
          summary: "Sem id • legado",
          totalCost: 4,
          sellPrice: 8,
          profit: 4,
          result,
          snapshot: null,
        },
      ]),
    );
    storageValues.set(
      recoveryKey,
      JSON.stringify({ type: "open3dcalc-history-v2-progress", v: 1 }),
    );

    await unlockVault();

    // The interrupted run already converted and stored this record; `addEntry`
    // assigned it a GENERATED id, so an id-set cannot recognize it on resume.
    const alreadyMigrated: HistoryEntry = {
      id: "hist_seeded_generated_01",
      timestamp: 1_700_000_000_951,
      type: "fdm",
      name: "Sem id • legado",
      summary: "Sem id • legado",
      totalCost: 4,
      sellPrice: 8,
      profit: 4,
      result,
      snapshot: null,
    };
    useHistoryStore.setState({ entries: [alreadyMigrated] });
    await settleWrites();

    renderHook(() => useAppInit(vi.fn()));
    await vi.waitFor(() => expect(storageValues.has(recoveryKey)).toBe(false));
    await settleWrites();

    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("hist_seeded_generated_01");
  });

  it("clears the value-free progress marker when no legacy source remains", async () => {
    const progressKey = "open3dcalc_migration_progress_v2";
    // An interrupted run left the value-free flag, but the source is gone (a
    // corrupt profile). The flag must be cleared so it cannot stall startup.
    storageValues.set(
      progressKey,
      JSON.stringify({ type: "open3dcalc-history-v2-progress", v: 1 }),
    );

    renderHook(() => useAppInit(vi.fn()));
    await flushMigration();

    expect(storageValues.has(progressKey)).toBe(false);
    expect(useHistoryStore.getState().entries).toEqual([]);
  });
});
