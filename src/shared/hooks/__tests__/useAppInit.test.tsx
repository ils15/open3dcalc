import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageGetItem = vi.hoisted(() => vi.fn());
const storageSetItem = vi.hoisted(() => vi.fn());
const storageRemoveItem = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/manifestStorage", () => ({
  guardedStorage: {
    getItem: storageGetItem,
    setItem: storageSetItem,
    removeItem: storageRemoveItem,
  },
}));

vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));

vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: {
    getState: () => ({ entries: [], addEntry: vi.fn() }),
  },
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: {
    getState: () => ({}),
    setState: vi.fn(),
  },
}));

vi.mock("@/shared/stores/calculatorStore.compute", () => ({
  computeStoreResults: vi.fn(),
}));

vi.mock("@/shared/lib/calculationLink", () => ({
  getSharedCalculation: vi.fn(() => null),
}));

vi.mock("@/shared/lib/printers", () => ({ printers: [] }));
vi.mock("@/shared/lib/marketplace", () => ({ marketplaces: [] }));
vi.mock("@/shared/hooks/useTutorialTabNavigation", () => ({
  useTutorialTabNavigation: vi.fn(),
}));

import { useAppInit } from "../useAppInit";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

describe("useAppInit tutorial auto-start", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    storageGetItem.mockImplementation((key: string) =>
      key === "open3dcalc_onboarded" ? "1" : null,
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

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

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
});
