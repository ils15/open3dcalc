import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  restoreSnapshot: vi.fn(),
  seedDefaults: vi.fn(),
}));

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("@/shared/lib/manifestStorage", () => ({
  guardedStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: startup.restoreSnapshot,
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

describe("useAppInit Beta startup", () => {
  it("loads the user's local profile without seeding demo business data", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    await act(async () => {
      renderHook(() => useAppInit(vi.fn()));
    });

    expect(startup.restoreSnapshot).toHaveBeenCalledOnce();
    expect(startup.seedDefaults).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});
