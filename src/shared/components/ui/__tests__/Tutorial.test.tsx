import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Tutorial } from "../Tutorial";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import type { TourId, StepConfig, TutorialTab } from "../tutorialTours";

// ── Mocks ────────────────────────────────────────────────────────────

// Mock react-i18next with interpolation support
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "tutorial.steps.welcome.title": "Bem-vindo ao Open3DCalc!",
        "tutorial.steps.welcome.description": "Calculadora 3D completa.",
        "tutorial.steps.material.title": "Materiais",
        "tutorial.steps.material.description": "Selecione o filamento.",
        "tutorial.steps.print.title": "Parâmetros de Impressão",
        "tutorial.steps.print.description": "Defina o tempo.",
        "tutorial.steps.sales.title": "Precificação",
        "tutorial.steps.sales.description": "Configure a margem.",
        "tutorial.steps.results.title": "Resultados",
        "tutorial.steps.results.description": "Resultados calculados.",
        "tutorial.steps.export.title": "Exportar",
        "tutorial.steps.export.description": "Exporte seus dados.",
        "tutorial.steps.complete.title": "Tudo pronto!",
        "tutorial.steps.complete.description": "Você já sabe usar!",
        "tutorial.stepOf": "Passo {{current}} de {{total}}",
        "tutorial.next": "Próximo",
        "tutorial.previous": "Anterior",
        "tutorial.skip": "Pular",
        "tutorial.finish": "Concluir",
        "common.close": "Fechar",
        "tutorial.start": "Iniciar Tutorial",
        "tutorial.dismiss": "Dispensar",
      };
      let text = translations[key] ?? key;
      // Simple interpolation: replace {{var}} with params
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
        }
      }
      return text;
    },
  }),
}));

// Mock Floating UI
vi.mock("@floating-ui/react", () => ({
  useFloating: () => ({
    refs: { setFloating: vi.fn(), setReference: vi.fn() },
    floatingStyles: { position: "absolute", top: 0, left: 0 },
    placement: "right-start",
  }),
  offset: () => () => ({ x: 0, y: 0 }),
  flip: () => () => ({ x: 0, y: 0 }),
  shift: () => () => ({ x: 0, y: 0 }),
  autoUpdate: vi.fn(),
  FloatingPortal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { initial, animate, exit, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  X: () => <span data-testid="icon-x">X</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">{"<"}</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">{">"}</span>,
}));

// jsdom has no layout engine, so scrollIntoView is absent — the engine calls it
// the moment an anchor resolves. Install a no-op before any tour renders
// (tests that care spy on the element instance).
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// No real tour uses `level:` yet (nivel-avancado is empty until Fase 3), so the
// level-restore path would have zero coverage. The factory fills that tour with
// a synthetic level-gated step; the rest mirrors the real registry.
//
// The factory MUST stay synchronous: an async one (importOriginal) resolves
// only after the statically-imported store/component have already evaluated,
// so they would still see the real (empty) registry.
vi.mock("../tutorialTours", () => {
  const TOURS: Record<TourId, StepConfig[]> = {
    "calc-basico": [
      { key: "welcome", target: null },
      { key: "material", target: '[data-tutorial="material"]' },
      { key: "print", target: '[data-tutorial="print"]' },
      { key: "sales", target: '[data-tutorial="sales"]' },
      {
        key: "results",
        target: '[data-tutorial="results-sidebar"], [data-tutorial="results"]',
      },
      { key: "export", target: '[data-tutorial="export"]' },
      { key: "complete", target: null },
    ],
    "upload-3d-preview": [],
    "inventario-bobinas": [],
    "dashboard-kpis": [],
    "orcamentos-clientes": [],
    "nivel-avancado": [
      {
        key: "adv-level",
        target: '[data-tutorial="adv-anchor"]',
        level: "advanced",
      },
      { key: "adv-complete", target: null },
    ],
  };

  const TOUR_IDS: TourId[] = [
    "calc-basico",
    "upload-3d-preview",
    "inventario-bobinas",
    "dashboard-kpis",
    "orcamentos-clientes",
    "nivel-avancado",
  ];

  const TUTORIAL_TABS: TutorialTab[] = [
    "calculator",
    "dashboard",
    "infill",
    "inventory",
    "catalog",
    "history",
    "changelog",
    "quotes",
    "customers",
    "products",
    "privacy",
  ];

  const getTourSteps = (tourId: TourId): StepConfig[] => TOURS[tourId] ?? [];
  const getTourStepCount = (tourId: TourId): number =>
    (TOURS[tourId] ?? []).length;
  const isTourAvailable = (tourId: TourId): boolean =>
    getTourStepCount(tourId) > 0;

  const dispatchTutorialNavigate = (tab: TutorialTab): void => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<TutorialTab>("open3dcalc:tutorial-navigate", {
        detail: tab,
      }),
    );
  };

  return {
    TOUR_IDS,
    TUTORIAL_TABS,
    TOURS,
    DEFAULT_TOUR: "calc-basico",
    getTourSteps,
    getTourStepCount,
    isTourAvailable,
    TUTORIAL_NAVIGATE_EVENT: "open3dcalc:tutorial-navigate",
    dispatchTutorialNavigate,
  };
});

describe("Tutorial", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ layoutMode: "classic" });
    useTutorialStore.setState({
      isActive: false,
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      sessionDismissed: false,
    });
  });

  // ── Rendering ──────────────────────────────────────────────────
  it("renders nothing when not active", () => {
    const { container } = render(<Tutorial />);
    expect(container.innerHTML).toBe("");
  });

  it("renders tooltip card when active in Classic", () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    expect(screen.getByText("Bem-vindo ao Open3DCalc!")).toBeInTheDocument();
  });

  it("does not render outside Classic and safely cancels an active tour", () => {
    useLayoutStore.setState({ layoutMode: "guided" });
    useTutorialStore.getState().startTutorial();

    const { container } = render(<Tutorial />);

    expect(container.innerHTML).toBe("");
    expect(useTutorialStore.getState().isActive).toBe(false);
  });

  it("restores a borrowed calculator level when leaving Classic", () => {
    useCalculatorStore.setState({ calcLevel: "basic" });
    useTutorialStore.getState().startTour("nivel-avancado");
    render(<Tutorial />);
    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");

    act(() => {
      useLayoutStore.setState({ layoutMode: "bento" });
    });

    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useCalculatorStore.getState().calcLevel).toBe("basic");
  });

  it("stops keyboard and modal handling after leaving Classic", async () => {
    useTutorialStore.getState().startTutorial();
    const skipTutorialSpy = vi
      .spyOn(useTutorialStore.getState(), "skipTutorial")
      .mockImplementation(() => undefined);
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const { unmount } = render(<Tutorial />);
    const observed = { stepAfterKeyboard: 0, skipCalls: 0 };

    try {
      act(() => {
        useLayoutStore.setState({ layoutMode: "guided" });
      });
      fireEvent.keyDown(window, { key: "ArrowRight" });
      observed.stepAfterKeyboard = useTutorialStore.getState().currentStep;

      document.body.appendChild(modal);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      observed.skipCalls = skipTutorialSpy.mock.calls.length;
    } finally {
      modal.remove();
      skipTutorialSpy.mockRestore();
      unmount();
    }

    // The layout switch performs the one cancellation. No stale keyboard or
    // modal listener may advance or skip the hidden engine afterwards.
    expect(observed.skipCalls).toBe(1);
    expect(observed.stepAfterKeyboard).toBe(1);
  });

  it("shows step counter (1 / 7)", () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    expect(screen.getByText("Passo 1 de 7")).toBeInTheDocument();
  });

  // ── Navigation ─────────────────────────────────────────────────
  it('"Próximo" button advances to next step', () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    fireEvent.click(screen.getByText("Próximo"));
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    expect(screen.getByText("Passo 2 de 7")).toBeInTheDocument();
  });

  it('"Voltar" button goes to previous step', () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(3);
    render(<Tutorial />);
    // Should be on step 3 with "Anterior" button visible
    fireEvent.click(screen.getByLabelText("Anterior"));
    expect(screen.getByText("Passo 2 de 7")).toBeInTheDocument();
  });

  it('"Pular" button closes tutorial', () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    fireEvent.click(screen.getByText("Pular"));
    expect(useTutorialStore.getState().isActive).toBe(false);
  });

  it('last step shows "Concluir" instead of "Próximo"', () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(7);
    render(<Tutorial />);
    expect(screen.getByText("Concluir")).toBeInTheDocument();
    expect(screen.queryByText("Próximo")).not.toBeInTheDocument();
  });

  // ── Finish button ──────────────────────────────────────────────
  it('"Concluir" button finishes tutorial', () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(7);
    render(<Tutorial />);
    fireEvent.click(screen.getByText("Concluir"));
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.isCompleted).toBe(true);
  });

  // ── Close button ───────────────────────────────────────────────
  it("X close button finishes tutorial", () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    const closeButton = screen.getByLabelText("Fechar");
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useTutorialStore.getState().isCompleted).toBe(true);
  });

  // ── Spotlight overlay click ────────────────────────────────────
  it("clicking the overlay dismisses tutorial", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(2); // step 2 (material) has a spotlight target
    render(<Tutorial />);
    const overlay = document.querySelector('[data-testid="tutorial-overlay"]');
    expect(overlay).not.toBeNull();
    if (overlay) {
      fireEvent.click(overlay);
    }
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.sessionDismissed).toBe(true);
  });

  // ── Degraded fallback (missing anchor) ────────────────────────
  it("degrades to a centered card without overlay when the anchor never mounts", async () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(2); // "material" step — its anchor is NOT rendered
    render(<Tutorial />);

    // The card renders right away...
    expect(screen.getByText("Materiais")).toBeInTheDocument();

    // ...and once the retry loop gives up the overlay is suppressed instead of
    // blocking the tour on a surface that isn't rendered.
    await vi.waitFor(
      () => {
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).toBeNull();
      },
      { timeout: 2500 },
    );

    // The tour stays usable: card still on screen (centered), tour still active.
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    expect(useTutorialStore.getState().isActive).toBe(true);
  });

  // ── Keyboard: Escape ───────────────────────────────────────────
  it("Escape key closes tutorial", () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useTutorialStore.getState().isActive).toBe(false);
  });

  // ── Keyboard: ArrowRight ───────────────────────────────────────
  it("ArrowRight key advances to next step", () => {
    useTutorialStore.getState().startTutorial();
    render(<Tutorial />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Passo 2 de 7")).toBeInTheDocument();
  });

  // ── Keyboard: ArrowLeft ────────────────────────────────────────
  it("ArrowLeft key goes to previous step", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(3);
    render(<Tutorial />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Passo 2 de 7")).toBeInTheDocument();
  });

  // ── Session dismissed ──────────────────────────────────────────
  it("does not show tutorial if sessionDismissed is true (isActive false)", () => {
    useTutorialStore.setState({ isActive: false, sessionDismissed: true });
    const { container } = render(<Tutorial />);
    expect(container.innerHTML).toBe("");
  });

  it("does not show tutorial if sessionDismissed is true (isActive true)", () => {
    useTutorialStore.setState({ isActive: true, sessionDismissed: true });
    const { container } = render(<Tutorial />);
    expect(container.innerHTML).toBe("");
  });

  // ── Level restore ─────────────────────────────────────────────
  // `nivel-avancado` borrows the calculator level to unlock gated sections
  // and must give it back on every exit path — the tour must not change the
  // user's durable calculator settings.
  it("switches calcLevel for a level-gated step and restores it on finish", () => {
    useCalculatorStore.setState({ calcLevel: "basic" });
    useTutorialStore.getState().startTour("nivel-avancado");
    render(<Tutorial />);

    // Step 1 borrows the level...
    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");

    // Step 2 (centered card, no target) must not touch the level again.
    fireEvent.click(screen.getByText("Próximo"));
    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");

    // ...and finishing gives it back.
    fireEvent.click(screen.getByText("Concluir"));
    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useCalculatorStore.getState().calcLevel).toBe("basic");
  });

  it("restores calcLevel when the user skips the level-gated tour", () => {
    // A different starting level than the test above proves restore uses the
    // captured previous value, not a hardcoded default.
    useCalculatorStore.setState({ calcLevel: "intermediate" });
    useTutorialStore.getState().startTour("nivel-avancado");
    render(<Tutorial />);

    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");

    fireEvent.click(screen.getByText("Pular"));
    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useCalculatorStore.getState().calcLevel).toBe("intermediate");
  });

  // ── Spotlight anchor resolution ─────────────────────────────────
  // Regression coverage for two positioning bugs:
  //  1. stale one-shot rect (measured during render, never after scrollIntoView)
  //  2. document-order selector trap (the 2xl:hidden mobile `results` panel
  //     wins over `results-sidebar` and its zero DOMRect breaks placement)

  /** Elements appended to document.body by these tests — cleaned up per test. */
  const scratchEls: HTMLElement[] = [];

  afterEach(() => {
    for (const el of scratchEls) el.remove();
    scratchEls.length = 0;
  });

  function mountAnchor(attrs: Record<string, string>): HTMLElement {
    const el = document.createElement("div");
    for (const [name, value] of Object.entries(attrs))
      el.setAttribute(name, value);
    document.body.appendChild(el);
    scratchEls.push(el);
    return el;
  }

  it("re-measures the target after scrollIntoView so the card uses the post-scroll rect", () => {
    const anchor = mountAnchor({ "data-tutorial": "material" });

    // Pre-scroll rect sits far below the fold: every placement fails and the
    // card would fall back to screen center. Post-scroll rect is comfortably
    // in view: placement "right" → left = right + GAP = 314, top = 100.
    const preScroll = {
      x: 10,
      y: 2000,
      width: 100,
      height: 50,
      top: 2000,
      right: 110,
      bottom: 2050,
      left: 10,
    };
    const postScroll = {
      x: 200,
      y: 100,
      width: 100,
      height: 50,
      top: 100,
      right: 300,
      bottom: 150,
      left: 200,
    };
    let scrolled = false;
    anchor.getBoundingClientRect = vi.fn(() =>
      scrolled ? postScroll : preScroll,
    ) as unknown as () => DOMRect;
    anchor.scrollIntoView = vi.fn(() => {
      scrolled = true;
    });

    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(2); // material — has a spotlight target
    render(<Tutorial />);

    expect(anchor.scrollIntoView).toHaveBeenCalled();

    // The rect must be re-read AFTER the scroll: card anchored to postScroll.
    const card = screen.getByRole("dialog");
    expect(card.style.top).toBe("100px");
    expect(card.style.left).toBe("314px");
  });

  it("treats a hidden anchor as missing: overlay suppressed, card degrades", async () => {
    mountAnchor({ "data-tutorial": "material", style: "display: none" });

    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(2);
    render(<Tutorial />);

    // Degraded card: transform-centered, NOT positioned off a zero rect.
    const card = screen.getByRole("dialog");
    expect(card.style.transform).toContain("translate(-50%");

    // Hidden counts as missing: after the retry budget the overlay is
    // suppressed instead of cutting a 20×20 hole at the viewport corner.
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-testid="tutorial-overlay"]'),
        ).toBeNull(),
      { timeout: 2500 },
    );

    // The tour stays usable: card still on screen, still active.
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    expect(useTutorialStore.getState().isActive).toBe(true);
  });

  it("results step skips the hidden first match and spots the visible sidebar", () => {
    // Document order mirrors production: the 2xl:hidden mobile panel is
    // rendered BEFORE the sidebar, so a naive querySelector picks it first.
    mountAnchor({ "data-tutorial": "results", style: "display: none" });

    const sidebar = mountAnchor({ "data-tutorial": "results-sidebar" });
    const sidebarRect = {
      x: 650,
      y: 40,
      width: 200,
      height: 200,
      top: 40,
      right: 850,
      bottom: 240,
      left: 650,
    };
    sidebar.getBoundingClientRect = vi.fn(
      () => sidebarRect,
    ) as unknown as () => DOMRect;
    sidebar.scrollIntoView = vi.fn();

    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().goToStep(5); // results — selector-list target
    render(<Tutorial />);

    // placement "left" of the sidebar: left = 650 - CARD_W(300) - GAP(14) = 336
    const card = screen.getByRole("dialog");
    expect(card.style.top).toBe("40px");
    expect(card.style.left).toBe("336px");

    // Spotlight hole matches the sidebar rect (padded by 10px), not the corner.
    const overlay = document.querySelector('[data-testid="tutorial-overlay"]');
    expect(overlay).not.toBeNull();
    expect((overlay as HTMLElement).style.clipPath).toContain("640px 30px");
  });

  // ── Complete — hide ────────────────────────────────────────────
  it("does not show tutorial if already completed", () => {
    useTutorialStore.setState({
      isActive: false,
      isCompleted: true,
    });
    const { container } = render(<Tutorial />);
    expect(container.innerHTML).toBe("");
  });
});
