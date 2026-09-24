import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TutorialLauncher } from "../TutorialLauncher";
import { MobileSettingsSheet } from "@/platform/web/components/MobileSettingsSheet";
import {
  TOUR_IDS,
  isTourAvailable,
} from "@/shared/components/ui/tutorialTours";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";

// ── Mocks ────────────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, string> = {
  "tutorial.launcher.title": "Tutoriais",
  "tutorial.launcher.completed": "concluído",
  "tutorial.launcher.classicOnly": "Disponível apenas no layout Clássico",
  "nav.settings": "Configurações",
  "nav.tutorial": "Tutorial",
  "settings.currency": "Moeda",
  "nav.language": "Idioma",
  "tutorial.tours.calc-basico.title": "Calculadora básica",
  "tutorial.tours.calc-basico.description": "Tour de início.",
  "tutorial.tours.upload-3d-preview.title": "Upload e pré-visualização",
  "tutorial.tours.upload-3d-preview.description": "Tour do STL.",
  "tutorial.tours.inventario-bobinas.title": "Inventário de bobinas",
  "tutorial.tours.inventario-bobinas.description": "Tour do inventário.",
  "tutorial.tours.dashboard-kpis.title": "Dashboard de KPIs",
  "tutorial.tours.dashboard-kpis.description": "Tour do dashboard.",
  "tutorial.tours.orcamentos-clientes.title": "Orçamentos e clientes",
  "tutorial.tours.orcamentos-clientes.description": "Tour de orçamentos.",
  "tutorial.tours.nivel-avancado.title": "Nível avançado",
  "tutorial.tours.nivel-avancado.description": "Tour do nível avançado.",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => TRANSLATIONS[key] ?? key,
    i18n: {
      language: "pt-BR",
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("lucide-react", () => ({
  BookOpen: () => <span data-testid="icon-book">B</span>,
  ChevronDown: () => <span data-testid="icon-chevron">v</span>,
  Check: () => <span data-testid="icon-check">✓</span>,
  DollarSign: () => <span data-testid="icon-dollar">$</span>,
  Globe: () => <span data-testid="icon-globe">G</span>,
  Info: () => <span data-testid="icon-info">I</span>,
}));

vi.mock("@/shared/components/Header/LayoutSwitcher", () => ({
  LayoutSwitcher: () => <div data-testid="layout-switcher" />,
}));

vi.mock("@/platform/web/SecondaryNavigation", () => ({
  SecondaryNavigation: () => <nav data-testid="secondary-navigation" />,
}));

const AVAILABLE_TOURS = TOUR_IDS.filter(isTourAvailable);

describe("TutorialLauncher", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ layoutMode: "classic" });
    useTutorialStore.setState({
      isActive: false,
      activeTour: "calc-basico",
      currentStep: 1,
      completedSteps: [],
      completedTours: [],
      sessionDismissed: false,
    });
  });

  it("renders a single trigger button until opened", () => {
    render(<TutorialLauncher />);

    expect(
      screen.getByRole("button", { name: "Tutoriais" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it.each(["guided", "bento"] as const)(
    "keeps the launcher focusable but inactive in %s layout",
    (layoutMode) => {
      useLayoutStore.setState({ layoutMode });
      render(<TutorialLauncher />);

      const trigger = screen.getByRole("button", { name: "Tutoriais" });
      expect(trigger).toHaveAttribute("aria-disabled", "true");
      expect(trigger).toHaveAttribute("tabindex", "0");
      expect(trigger).toHaveAccessibleDescription(
        "Disponível apenas no layout Clássico",
      );
      expect(trigger).toHaveTextContent(
        "Disponível apenas no layout Clássico",
      );
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(useTutorialStore.getState().isActive).toBe(false);
    },
  );

  it("lists one item per tour that has steps", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(
      AVAILABLE_TOURS.length,
    );
    expect(
      screen.getByRole("menuitem", { name: /Calculadora básica/ }),
    ).toBeInTheDocument();
  });

  it("lists every tour once the registry is fully filled (U9)", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    // U9 filled nivel-avancado, the last placeholder: the registry has no empty
    // tour left, so the launcher exposes one entry per TOUR_IDS. The permanent
    // "no tour is left empty" guard in tutorialTours.test.tsx keeps it that way.
    expect(screen.getAllByRole("menuitem")).toHaveLength(TOUR_IDS.length);
    expect(
      screen.getByRole("menuitem", { name: /Nível avançado/ }),
    ).toBeInTheDocument();
  });

  it("starts the chosen tour and closes the menu", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    fireEvent.click(
      screen.getByRole("menuitem", { name: /Calculadora básica/ }),
    );

    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.activeTour).toBe("calc-basico");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("marks finished tours as completed", () => {
    useTutorialStore.setState({ completedTours: ["calc-basico"] });

    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    const item = screen.getByRole("menuitem", { name: /Calculadora básica/ });
    expect(item).toHaveAccessibleName(/concluído/);
    expect(item.querySelector('[data-testid="icon-check"]')).not.toBeNull();
  });

  it("leaves unfinished tours without the completion mark", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    const item = screen.getByRole("menuitem", { name: /Calculadora básica/ });
    expect(item).not.toHaveAccessibleName(/concluído/);
    expect(item.querySelector('[data-testid="icon-check"]')).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<TutorialLauncher />);
    const trigger = screen.getByRole("button", { name: "Tutoriais" });
    fireEvent.click(trigger);

    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when clicking outside the menu", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it.each(["guided", "bento"] as const)(
    "keeps the mobile settings tutorial entry focusable but inactive in %s layout",
    (layoutMode) => {
      useLayoutStore.setState({ layoutMode });
      const onClose = vi.fn();
      render(
        <MobileSettingsSheet
          open
          onClose={onClose}
          onInternalNavigate={vi.fn()}
        />,
      );

      const trigger = screen.getByRole("button", { name: "Tutorial" });
      expect(trigger).toHaveAttribute("aria-disabled", "true");
      expect(trigger).toHaveAttribute("tabindex", "0");
      expect(trigger).toHaveAccessibleDescription(
        "Disponível apenas no layout Clássico",
      );
      expect(trigger).toHaveTextContent(
        "Disponível apenas no layout Clássico",
      );

      fireEvent.click(trigger);
      expect(useTutorialStore.getState().isActive).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("starts the tutorial from mobile settings in Classic", () => {
    const onClose = vi.fn();
    render(
      <MobileSettingsSheet
        open
        onClose={onClose}
        onInternalNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));

    expect(useTutorialStore.getState().isActive).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
