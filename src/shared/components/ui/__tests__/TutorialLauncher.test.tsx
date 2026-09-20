import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TutorialLauncher } from "../TutorialLauncher";
import {
  TOUR_IDS,
  isTourAvailable,
} from "@/shared/components/ui/tutorialTours";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

// ── Mocks ────────────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, string> = {
  "tutorial.launcher.title": "Tutoriais",
  "tutorial.launcher.completed": "concluído",
  "tutorial.tours.calc-basico.title": "Calculadora básica",
  "tutorial.tours.calc-basico.description": "Tour de início.",
  "tutorial.tours.upload-3d-preview.title": "Upload e pré-visualização",
  "tutorial.tours.upload-3d-preview.description": "Tour do STL.",
  "tutorial.tours.inventario-bobinas.title": "Inventário de bobinas",
  "tutorial.tours.inventario-bobinas.description": "Tour do inventário.",
  "tutorial.tours.dashboard-kpis.title": "Dashboard de KPIs",
  "tutorial.tours.dashboard-kpis.description": "Tour do dashboard.",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => TRANSLATIONS[key] ?? key,
  }),
}));

vi.mock("lucide-react", () => ({
  BookOpen: () => <span data-testid="icon-book">B</span>,
  ChevronDown: () => <span data-testid="icon-chevron">v</span>,
  Check: () => <span data-testid="icon-check">✓</span>,
}));

const AVAILABLE_TOURS = TOUR_IDS.filter(isTourAvailable);

describe("TutorialLauncher", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("hides tours the registry has not filled yet", () => {
    render(<TutorialLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Tutoriais" }));

    // Unfilled tours never expose a launcher entry — a dead end in the menu.
    expect(
      screen.queryByRole("menuitem", { name: /nivel-avancado/i }),
    ).not.toBeInTheDocument();
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
});
