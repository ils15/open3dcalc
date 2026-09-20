import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Tutorial } from "../Tutorial";
import { TOURS } from "../tutorialTours";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
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
      expect(
        ANCHORS,
        `anchor ${anchor} must exist in FilamentInventory`,
      ).toContain(anchor);
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

// ── U5: dashboard-kpis (dashboard tab — cross-tab anchors) ──────────────────

describe("tour: dashboard-kpis", () => {
  const ANCHORS = [
    "dashboard-summary",
    "dashboard-date-range",
    "dashboard-kpis",
    "dashboard-projection",
  ];

  beforeEach(() => {
    localStorage.clear();
    resetTutorialStore();
  });

  it("registry wires six steps that all hop to the dashboard tab", () => {
    const steps = TOURS["dashboard-kpis"];
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.key)).toEqual([
      "dash-intro",
      "dash-summary",
      "dash-date-range",
      "dash-kpis",
      "dash-projection",
      "dash-complete",
    ]);
    for (const step of steps) {
      if (!step.target) continue;
      expect(step.target.startsWith('[data-tutorial="')).toBe(true);
      const anchor = step.target.slice('[data-tutorial="'.length, -2);
      expect(ANCHORS, `anchor ${anchor} must exist in Dashboard`).toContain(
        anchor,
      );
      expect(step.tab).toBe("dashboard");
    }
  });

  it("navigates to the dashboard tab and resolves every anchor spotlight", async () => {
    render(<TabHarness tab="dashboard" anchors={ANCHORS} />);
    useTutorialStore.getState().startTour("dashboard-kpis");

    // 1. Centered intro card lands while the harness is still on calculator.
    expect(
      await screen.findByText("tutorial.steps.dash-intro.title"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Passo 1 de 6")).toBeInTheDocument();

    // 2. First anchored step: the engine dispatches the navigate event, the
    // harness switches to dashboard, the anchor mounts and the spotlight
    // resolves (no degraded card).
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.dash-summary.title"),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByTestId("active-tab").textContent).toBe("dashboard"),
    );
    expect(screen.getByTestId("anchor-dashboard-summary")).toBeInTheDocument();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).not.toBeNull(),
      { timeout: 2500 },
    );

    // 3→5. Remaining anchored steps stay on the dashboard surface.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.dash-date-range.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-tab").textContent).toBe("dashboard");

    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.dash-kpis.title"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.dash-projection.title"),
    ).toBeInTheDocument();

    // 6. Centered closing card: "Concluir" replaces "Próximo" on the last step.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.dash-complete.title"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("tutorial.finish"));
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.completedTours).toContain("dashboard-kpis");
  });
});

// ── U8: orcamentos-clientes (quotes → customers — the two-tab tour) ──────────

const U8_QUOTES_ANCHORS = ["quotes-list", "quote-new", "quote-form-customer"];
const U8_CUSTOMERS_ANCHORS = ["customers-list", "customer-new"];

// The engine's `TabHarness` renders a single tab; this tour hops between two, so
// it needs a harness that mounts each surface's anchors when the navigate event
// lands on it.
function QuotesCustomersHarness() {
  const [activeTab, setActiveTab] = useState<TutorialTab>("calculator");
  useTutorialTabNavigation(setActiveTab);

  const anchors: Partial<Record<TutorialTab, string[]>> = {
    quotes: U8_QUOTES_ANCHORS,
    customers: U8_CUSTOMERS_ANCHORS,
  };
  const visible = anchors[activeTab] ?? [];

  return (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      {visible.map((anchor) => (
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

// Locale lookup kept untyped so the JSON imports stay indexable without an index
// signature — same trick as src/shared/i18n/__tests__/locales.test.ts.
function lookup(dict: unknown, ...path: string[]): unknown {
  let node: unknown = dict;
  for (const part of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("tour: orcamentos-clientes", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTutorialStore();
  });

  it("registry wires eight steps that hop between the quotes and customers tabs", () => {
    const steps = TOURS["orcamentos-clientes"];
    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.key)).toEqual([
      "qc-intro",
      "qc-list",
      "qc-new",
      "qc-customer",
      "cs-intro",
      "cs-list",
      "cs-new",
      "qc-complete",
    ]);

    for (const step of steps) {
      // R3 guard: Tutorial.tsx returns on `!step.target` BEFORE the level switch,
      // so a `level` on a centered card would be silently dropped. This tour is
      // pure cross-tab navigation and must never set `level` — the guard below is
      // the tripwire if that ever changes (nivel-avancado, U9, owns the level
      // variant of this rule).
      expect(
        step.level,
        `${step.key}: a level switch needs a non-null target (R3)`,
      ).toBeUndefined();

      if (!step.target) continue;
      expect(step.target.startsWith('[data-tutorial="')).toBe(true);
      const anchor = step.target.slice('[data-tutorial="'.length, -2);
      expect(
        [...U8_QUOTES_ANCHORS, ...U8_CUSTOMERS_ANCHORS],
        `anchor ${anchor} must exist in QuoteSection/CustomerTab`,
      ).toContain(anchor);
      // qc-* lives on the quotes tab, cs-* on customers — the engine navigates
      // to this tab before it retries the selector.
      expect(step.tab).toBe(
        step.key.startsWith("cs-") ? "customers" : "quotes",
      );
    }
  });

  it("resolves a title and description for every step in both locales", () => {
    const steps = TOURS["orcamentos-clientes"];
    for (const { key } of steps) {
      for (const [locale, dict] of [
        ["pt-BR", ptBR],
        ["en-US", enUS],
      ] as const) {
        const title = lookup(dict, "tutorial", "steps", key, "title");
        const description = lookup(
          dict,
          "tutorial",
          "steps",
          key,
          "description",
        );
        expect(typeof title, `${locale} tutorial.steps.${key}.title`).toBe(
          "string",
        );
        expect(
          (title as string).length,
          `${locale} tutorial.steps.${key}.title`,
        ).toBeGreaterThan(0);
        expect(
          typeof description,
          `${locale} tutorial.steps.${key}.description`,
        ).toBe("string");
        expect(
          (description as string).length,
          `${locale} tutorial.steps.${key}.description`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("walks quotes then customers, resolving every anchor spotlight", async () => {
    render(<QuotesCustomersHarness />);
    useTutorialStore.getState().startTour("orcamentos-clientes");

    // 1. Centered intro card while the harness is still on calculator.
    expect(
      await screen.findByText("tutorial.steps.qc-intro.title"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Passo 1 de 8")).toBeInTheDocument();

    // 2. First anchored step: the engine dispatches the navigate event, the
    // harness switches to quotes, the list anchor mounts and the spotlight
    // resolves (no degraded card).
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.qc-list.title"),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByTestId("active-tab").textContent).toBe("quotes"),
    );
    expect(screen.getByTestId("anchor-quotes-list")).toBeInTheDocument();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).not.toBeNull(),
      { timeout: 2500 },
    );

    // 3→4. New-quote button and the form's customer selector stay on quotes.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.qc-new.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-tab").textContent).toBe("quotes");

    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.qc-customer.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-tab").textContent).toBe("quotes");

    // 5. Centered customers intro. A centered card cannot navigate (the engine
    // returns on `!step.target` before dispatching), so the hop to customers
    // happens on the next anchored step.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.cs-intro.title"),
    ).toBeInTheDocument();

    // 6. First customers-anchored step hops the tour to the customers tab.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.cs-list.title"),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByTestId("active-tab").textContent).toBe("customers"),
    );
    expect(screen.getByTestId("anchor-customers-list")).toBeInTheDocument();

    // 7. New-customer button stays on customers.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.cs-new.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-tab").textContent).toBe("customers");

    // 8. Centered closing card: "Concluir" replaces "Próximo" on the last step.
    fireEvent.click(screen.getByText("tutorial.next"));
    expect(
      await screen.findByText("tutorial.steps.qc-complete.title"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("tutorial.finish"));
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.completedTours).toContain("orcamentos-clientes");
  });
});
