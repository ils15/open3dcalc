/**
 * H-4 (residual) — the calculator's MAIN history path is gated on the vault.
 *
 * The path that creates a history entry from the calculator is:
 *
 *   ProductActionsCard "Add to history"
 *     → calculatorStore.addToHistory()
 *       → historyStore.addEntry()
 *
 * Before this fix the vault refused the WRITE at persistence but the entry
 * still landed in memory: `HistoryCard` rendered a ghost the user lost on
 * reload, and no `PiiWriteRefusalNotice` was mounted on the calculator/results
 * surface to explain it. These specs render the REAL stores and the REAL gate
 * and pin the four behaviors:
 *
 *  - locked      → `addToHistory` creates NO entry and the refusal is recorded
 *                  and rendered on the results surface;
 *  - unavailable → same, with the capability reason;
 *  - unlocked    → the entry is created AND persisted, and no notice appears;
 *  - demo session→ the write is deliberately NOT blocked (ephemeral by design).
 *
 * Falsifiability: the "no ghost entry" assertions fail without the gate, which
 * is the whole point of the fix.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) =>
      arg && typeof arg === "object"
        ? `${key} ${Object.values(arg).join(" ")}`
        : key,
    i18n: { resolvedLanguage: "pt", language: "pt" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (value: number) => `R$ ${value.toFixed(2)}`,
    symbol: "R$",
    currency: "BRL",
  }),
}));

vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

// Side-effect import registers the history store's persist handle.
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import { ResultsPanel } from "@/shared/components/Results/ResultsPanel";
import type { CalculationResult } from "@/shared/types";
import {
  PII_STORE_KEY,
  configurePiiStoreRuntime,
  getLastPiiWriteRefusal,
  installPiiStoreRuntimeEnvironment,
  readPiiPersistedRecord,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
  whenPiiWritesSettled,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import {
  resetPiiStoreGateForTests,
  setDemoSuppressedForPiiGate,
} from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const PASS = "senha-sintetica-calc-gate-7783";

const baseResults: CalculationResult = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 0,
  extrasCost: 2,
  postProcessingCost: 0,
  subtotal: 40,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.1,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 5,
  targetMarginPercent: 50,
  breakEvenPrice: 60,
  actualMargin: 28.33,
  carbonFootprintGrams: 100,
  profitPerHour: 6,
  totalHoursForProfit: 5,
};

const baseSalesParams = {
  packagingCost: 0,
  shippingCost: 0,
  taxPercent: 10,
  marketplaceFeePercent: 5,
  profitMarginPercent: 50,
  volumeDiscounts: [],
};

function seedCalculator(productName = "Peça Bloqueada") {
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName,
    selectedSpoolId: null,
    fdmSales: { ...baseSalesParams },
    results: { ...baseResults },
    // Reset the dedupe guard: a previous spec's successful save must not make
    // this spec's addToHistory a silent duplicate no-op.
    lastHistoryKey: null,
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useHistoryStore.setState({ entries: [] });
  useFilamentInventory.setState({ spools: [] });
  useProductInventory.setState({ products: [] });
}

describe("H-4 residual — calculator history write gate", () => {
  let idb: ReturnType<typeof createFakeIndexedDb>;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  function lockVault(): void {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
  }

  function makeVaultUnavailable(): void {
    configurePiiStoreRuntime({
      indexedDb: idb.factory,
      environment: { ...PII_STORE_ENVIRONMENT, webCryptoAvailable: false },
    });
    installPiiStoreRuntimeEnvironment();
  }

  /** The save group holds the notice; scoping keeps PriceHeroCard alerts out. */
  function saveGroup(): HTMLElement {
    return screen.getByTestId("action-group-save");
  }

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    localStorage.clear();
    seedCalculator();
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  it("locked: addToHistory creates no ghost entry and records the refusal", () => {
    lockVault();

    useCalculatorStore.getState().addToHistory();

    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.history,
      reason: "profile_locked",
    });
  });

  it("locked: clicking add-to-history keeps the history empty and shows the notice", async () => {
    lockVault();
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.addHistorySeparate" }),
    );

    const alert = await within(saveGroup()).findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.writeRefusedTitle");
    expect(alert).toHaveTextContent("history.title");
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("unavailable: addToHistory creates no ghost entry and reports the capability reason", () => {
    makeVaultUnavailable();

    useCalculatorStore.getState().addToHistory();

    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.history,
      reason: "web_crypto_unavailable",
    });
  });

  it("unavailable: clicking add-to-history shows the capability refusal", async () => {
    makeVaultUnavailable();
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.addHistorySeparate" }),
    );

    const alert = await within(saveGroup()).findByRole("alert");
    expect(alert).toHaveTextContent("web_crypto_unavailable");
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("unlocked: addToHistory creates the entry and persists it, with no refusal", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());
    useHistoryStore.setState({ entries: [] });

    useCalculatorStore.getState().addToHistory();

    expect(useHistoryStore.getState().entries).toHaveLength(1);
    expect(useHistoryStore.getState().entries[0].name).toBe("Peça Bloqueada");
    expect(getLastPiiWriteRefusal()).toBeNull();

    await whenPiiWritesSettled();
    const persisted = await readPiiPersistedRecord(PII_STORE_KEY.history);
    expect(persisted).not.toBeNull();
    expect(persisted).toContain("Peça Bloqueada");
  });

  it("unlocked: clicking add-to-history saves and shows no notice", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());
    useHistoryStore.setState({ entries: [] });
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.addHistorySeparate" }),
    );

    expect(useHistoryStore.getState().entries).toHaveLength(1);
    expect(within(saveGroup()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("demo session: the write is not blocked and shows no notice", () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
    setDemoSuppressedForPiiGate(true);

    useCalculatorStore.getState().addToHistory();

    expect(useHistoryStore.getState().entries).toHaveLength(1);
    render(<ResultsPanel variant="mobile" />);
    expect(within(saveGroup()).queryByRole("alert")).not.toBeInTheDocument();
  });
});
