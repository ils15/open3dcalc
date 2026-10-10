import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  customerRehydrate: vi.fn(async () => undefined),
  historyRehydrate: vi.fn(async () => undefined),
  quoteRehydrate: vi.fn(async () => undefined),
  restoreSnapshot: vi.fn(),
  seedDefaults: vi.fn(),
  storageRead: vi.fn(() => null),
  vaultInstall: vi.fn(),
  vaultRehydrate: vi.fn(),
  vaultCapability: vi.fn(),
}));

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("@/shared/lib/manifestStorage", () => ({
  guardedStorage: {
    getItem: startup.storageRead,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: startup.restoreSnapshot,
}));
vi.mock("@/shared/lib/crypto/piiStoreHydration", () => ({
  didPiiWritesCommit: vi.fn(),
  getPiiStoreHydrationStatus: startup.vaultCapability,
  installPiiStoreRuntimeEnvironment: startup.vaultInstall,
  readPiiPersistedRecord: vi.fn(),
  rehydratePiiStoresIfUnlocked: startup.vaultRehydrate,
  setBetaReadabilityChecker: vi.fn(),
  resetBetaReadabilityCheckerForTests: vi.fn(),
}));
vi.mock("@/shared/stores/customerStore", () => ({
  useCustomerStore: { persist: { rehydrate: startup.customerRehydrate } },
}));
vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: { persist: { rehydrate: startup.historyRehydrate } },
}));
vi.mock("@/shared/stores/quoteStore", () => ({
  useQuoteStore: { persist: { rehydrate: startup.quoteRehydrate } },
}));
vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: {
    getState: () => ({ calculationIssues: [], quantity: 1 }),
    setState: vi.fn(),
  },
}));
vi.mock("@/shared/stores/calculatorStore.helpers", () => ({
  persistCalculatorSettings: vi.fn(),
}));
vi.mock("@/shared/stores/calculatorStore.validation", () => ({
  computeValidatedStoreResults: vi.fn(),
}));
vi.mock("@/shared/lib/calculationState", () => ({
  isPersistableCalculationState: () => true,
}));
vi.mock("@/shared/lib/calculationLink", () => ({
  getSharedCalculation: () => null,
}));
vi.mock("@/shared/lib/printers", () => ({ printers: [] }));
vi.mock("@/shared/lib/marketplace", () => ({
  marketplaces: [],
  findMarketplace: (id: string, available: Array<{ id: string }> = []) =>
    available.find((marketplace) => marketplace.id === id),
}));
vi.mock("@/shared/lib/initialWorkshopSeed", () => ({
  seedDefaultStudioDataIfEmpty: startup.seedDefaults,
}));
vi.mock("@/shared/stores/tutorialStore", () => ({
  useTutorialStore: {
    getState: () => ({ isCompleted: true, isActive: false }),
  },
}));
vi.mock("@/shared/stores/layoutStore", () => ({
  useLayoutStore: Object.assign(
    (selector: (state: { layoutMode: string }) => unknown) =>
      selector({ layoutMode: "guided" }),
    { getState: () => ({ layoutMode: "guided" }) },
  ),
}));
vi.mock("@/shared/hooks/useTutorialTabNavigation", () => ({
  useTutorialTabNavigation: vi.fn(),
}));

import { useAppInit } from "../useAppInit";

beforeEach(() => {
  Object.values(startup).forEach((spy) => spy.mockClear());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAppInit Beta startup boundary", () => {
  it("hydrates plaintext stores without consent, keyring, or vault startup", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    await act(async () => {
      renderHook(() => useAppInit(vi.fn()));
    });

    await waitFor(() => {
      expect(startup.customerRehydrate).toHaveBeenCalledOnce();
      expect(startup.historyRehydrate).toHaveBeenCalledOnce();
      expect(startup.quoteRehydrate).toHaveBeenCalledOnce();
    });

    expect(startup.restoreSnapshot).not.toHaveBeenCalled();
    expect(startup.seedDefaults).not.toHaveBeenCalled();
    expect(startup.storageRead).not.toHaveBeenCalled();
    expect(startup.vaultInstall).not.toHaveBeenCalled();
    expect(startup.vaultRehydrate).not.toHaveBeenCalled();
    expect(startup.vaultCapability).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});
