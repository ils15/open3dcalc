import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Tutorial } from "../Tutorial";
import { TOURS } from "../tutorialTours";
import { useTutorialTabNavigation } from "@/shared/hooks/useTutorialTabNavigation";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import type { TutorialTab } from "../tutorialTours";

// ── Mocks (the engine is real; only its presentational deps are stubbed) ────

const TRANSLATIONS: Record<string, string> = {
  "tutorial.stepOf": "Passo {{current}} de {{total}}",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = TRANSLATIONS[key] ?? key;
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

// jsdom has no layout engine, so scrollIntoView is absent — the engine calls it
// the moment an anchor resolves. Install a no-op before any tour renders.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// ── Harness: the smallest App-shaped surface ────────────────────────────────
// Both platform Apps own the active tab and render the surface the engine
// navigates to. The tour is started AFTER render (the realistic flow: the user
// picks it from the header launcher), so the navigate listener is attached
// before the engine dispatches.

function TabHarness({ tab, anchors }: { tab: TutorialTab; anchors: string[] }) {
  const [activeTab, setActiveTab] = useState<TutorialTab>("calculator");
  useTutorialTabNavigation(setActiveTab);

  return (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      {activeTab === tab &&
        anchors.map((anchor) => (
          <div
            key={anchor}
            data-tutorial={anchor}
            data-testid={`anchor-${anchor}`}
          />
        ))}
      <Tutorial />
    </div>
  );
}

function resetTutorialStore() {
  useTutorialStore.setState({
    isActive: false,
    isCompleted: false,
    activeTour: "calc-basico",
    currentStep: 1,
    completedSteps: [],
    completedTours: [],
    sessionDismissed: false,
  });
}

// ── U4: inventario-bobinas (inventory tab — cross-tab anchors) ──────────────

describe("tour: inventario-bobinas", () => {
  const ANCHORS = [
    "inventory-add",
    "inventory-search",
    "inventory-filters",
    "inventory-grid",
  ];

  beforeEach(() => {
    localStorage.clear();
    resetTutorialStore();
  });

  it("registry wires six steps that all hop to the inventory tab", () => {
    const steps = TOURS["inventario-bobinas"];
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.key)).toEqual([
      "inv-intro",
      "inv-add",
      "inv-search",
      "inv-filters",
      "inv-grid",
      "inv-complete",
    ]);
    // Anchored steps must carry the inventory tab so the engine navigates
    // before spotting; centered cards (intro/complete) need no hop.
    for (const step of steps) {
      if (!step.target) continue;
      expect(step.target.startsWith('[data-tutorial="')).toBe(true);
      const anchor = step.target.slice('[data-tutorial="'.length, -2);
      expect(ANCHORS, `anchor ${anchor} must exist in FilamentInventory`).toContain(
        anchor,
      );
      expect(step.tab).toBe("inventory");
    }
  });

  it("navigates to the inventory tab and resolves every anchor spotlight", async () => {
    render(<TabHarness tab="inventory" anchors={ANCHORS} />);
    useTutorialStore.getState().startTour("inventario-bobinas");

    // 1. Centered intro card lands while the harness is still on calculator.
    expect(
      await screen.findByText("tutorial.steps.inv-intro.title"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Passo 1 de 6")).toBeInTheDocument();

    // 2. First anchored step: the engine dispatches the navigate event, the
    // harness switches to inventory, the anchor mounts and the spotlight
    // resolves (no degraded card).
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.inv-add.title"),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByTestId("active-tab").textContent).toBe("inventory"),
    );
    expect(screen.getByTestId("anchor-inventory-add")).toBeInTheDocument();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).not.toBeNull(),
      { timeout: 2500 },
    );

    // 3→5. Remaining anchored steps stay on the inventory surface.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.inv-search.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-tab").textContent).toBe("inventory");

    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.inv-filters.title"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.inv-grid.title"),
    ).toBeInTheDocument();

    // 6. Centered closing card: "Concluir" replaces "Próximo" on the last step.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.inv-complete.title"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("tutorial.finish"));
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.completedTours).toContain("inventario-bobinas");
  });
});

// ── U3: upload-3d-preview (calculator tab — same-tab anchors) ───────────────

describe("tour: upload-3d-preview", () => {
  const ANCHORS = ["stl-dropzone", "stl-samples", "stl-viewport"];

  beforeEach(() => {
    localStorage.clear();
    resetTutorialStore();
  });

  it("registry wires five steps against the three StlPreview anchors", () => {
    const steps = TOURS["upload-3d-preview"];
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.key)).toEqual([
      "upload-intro",
      "upload-dropzone",
      "upload-samples",
      "upload-viewport",
      "upload-complete",
    ]);
    // Every anchored step targets a data-tutorial the component actually mounts.
    for (const step of steps) {
      if (!step.target) continue;
      expect(step.target.startsWith('[data-tutorial="')).toBe(true);
      const anchor = step.target.slice('[data-tutorial="'.length, -2);
      expect(ANCHORS, `anchor ${anchor} must exist in StlPreview`).toContain(
        anchor,
      );
      // The tour lives on the calculator surface — no cross-tab hop needed.
      expect(step.tab).toBeUndefined();
    }
  });

  it("walks every step, resolving the same-tab anchors without degrading", async () => {
    render(<TabHarness tab="calculator" anchors={ANCHORS} />);
    useTutorialStore.getState().startTour("upload-3d-preview");

    // 1. Centered intro card. (The store update lands outside React's act()
    // batch, so the first card read is async; fireEvent-driven steps below
    // flush inside their own act().)
    expect(
      await screen.findByText("tutorial.steps.upload-intro.title"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Passo 1 de 5")).toBeInTheDocument();

    // 2. Anchored step on the same tab: the spotlight resolves immediately.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.upload-dropzone.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("anchor-stl-dropzone")).toBeInTheDocument();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).not.toBeNull(),
      { timeout: 2500 },
    );

    // 3→4. Remaining anchored steps stay on the calculator surface.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.upload-samples.title"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.upload-viewport.title"),
    ).toBeInTheDocument();

    // 5. Centered closing card: "Concluir" replaces "Próximo" on the last step.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.upload-complete.title"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("tutorial.finish"));
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.completedTours).toContain("upload-3d-preview");
  });
});
