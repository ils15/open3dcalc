import { useState } from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useTutorialTabNavigation } from "../useTutorialTabNavigation";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import {
  TOURS,
  dispatchTutorialNavigate,
  type TutorialTab,
} from "@/shared/components/ui/tutorialTours";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

// ── Mocks (Tutorial's presentational deps — the engine itself is real) ──────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
        }
      }
      return text;
    },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("lucide-react", () => ({
  X: () => <span data-testid="icon-x">X</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">{"<"}</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">{">"}</span>,
}));

// jsdom ships no layout engine, so scrollIntoView is absent — the engine calls
// it the moment the anchor mounts. Install a no-op before any tour renders.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// ── Unit tests: validation ───────────────────────────────────────────────────

describe("useTutorialTabNavigation", () => {
  beforeEach(() => {
    localStorage.clear();
    useTutorialStore.setState({
      isActive: false,
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      completedTours: [],
      sessionDismissed: false,
    });
  });

  it("switches tab when the engine dispatches a known tab", () => {
    const setActiveTab = vi.fn();
    renderHook(() => useTutorialTabNavigation(setActiveTab));

    dispatchTutorialNavigate("dashboard");

    expect(setActiveTab).toHaveBeenCalledTimes(1);
    expect(setActiveTab).toHaveBeenCalledWith("dashboard");
  });

  it("ignores an unknown tab id instead of blanking the surface", () => {
    const setActiveTab = vi.fn();
    renderHook(() => useTutorialTabNavigation(setActiveTab));

    dispatchTutorialNavigate("no-such-tab" as unknown as TutorialTab);

    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("ignores a payload that is not a string", () => {
    const setActiveTab = vi.fn();
    renderHook(() => useTutorialTabNavigation(setActiveTab));

    window.dispatchEvent(
      new CustomEvent<unknown>("open3dcalc:tutorial-navigate", {
        detail: { tab: "dashboard" },
      }),
    );

    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    const setActiveTab = vi.fn();
    const { unmount } = renderHook(() =>
      useTutorialTabNavigation(setActiveTab),
    );

    unmount();
    dispatchTutorialNavigate("inventory");

    expect(setActiveTab).not.toHaveBeenCalled();
  });

  // ── E2E-ish: navigate-before-spotlight, the cross-tab risk of the plan ────
  // Both platform Apps install this hook and render the requested surface; the
  // harness below is the smallest App-shaped version of that. A cross-tab step
  // is started *after* render (the realistic flow: the user opens a tour from
  // the header), so the listener is already attached when the engine navigates.

  describe("cross-tab spotlight resolution", () => {
    const ORIGINAL_STEPS = TOURS["dashboard-kpis"];

    beforeEach(() => {
      // A step whose anchor only exists once the App switched to dashboard.
      TOURS["dashboard-kpis"] = [
        {
          key: "kpi-revenue",
          tab: "dashboard",
          target: '[data-tutorial="kpi-revenue"]',
        },
      ];
    });

    afterEach(() => {
      TOURS["dashboard-kpis"] = ORIGINAL_STEPS;
      useTutorialStore.setState({ isActive: false });
    });

    it("switches tab and then resolves the anchor spotlight", async () => {
      render(<CrossTabHarness />);
      useTutorialStore.getState().startTour("dashboard-kpis");

      // 1. the navigate event reached the App-level tab switch...
      await vi.waitFor(() =>
        expect(screen.getByTestId("active-tab").textContent).toBe("dashboard"),
      );

      // 2. ...which mounted the anchor, so the spotlight resolves instead of
      //    degrading to the missing-anchor card.
      await vi.waitFor(
        () =>
          expect(
            document.querySelector('[data-testid="tutorial-overlay"]'),
          ).not.toBeNull(),
        { timeout: 2500 },
      );

      expect(
        screen.getByTestId("tutorial-anchor-kpi-revenue"),
      ).toBeInTheDocument();
    });

    it("degrades to a centered card when the anchor never mounts", async () => {
      render(<CrossTabHarness mountAnchor={false} />);
      useTutorialStore.getState().startTour("dashboard-kpis");

      await vi.waitFor(() =>
        expect(screen.getByTestId("active-tab").textContent).toBe("dashboard"),
      );

      await vi.waitFor(
        () =>
          expect(
            document.querySelector('[data-testid="tutorial-overlay"]'),
          ).toBeNull(),
        { timeout: 2500 },
      );

      // The tab switch still happened; the tour stays usable without the hole.
      expect(screen.getByTestId("active-tab").textContent).toBe("dashboard");
      expect(useTutorialStore.getState().isActive).toBe(true);
    });
  });
});

// ── Harness: the smallest App-shaped surface ────────────────────────────────

function CrossTabHarness({ mountAnchor = true }: { mountAnchor?: boolean }) {
  const [tab, setTab] = useState<TutorialTab>("calculator");
  useTutorialTabNavigation(setTab);

  return (
    <div>
      <span data-testid="active-tab">{tab}</span>
      {tab === "dashboard" && mountAnchor && (
        <div
          data-tutorial="kpi-revenue"
          data-testid="tutorial-anchor-kpi-revenue"
        >
          Revenue
        </div>
      )}
      <Tutorial />
    </div>
  );
}
