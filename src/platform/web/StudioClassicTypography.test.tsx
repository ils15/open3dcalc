/**
 * Typographic scale lock for the Studio's Classic surface.
 *
 * The owner spec brings the Example/CatalogTab typographic hierarchy into the
 * Studio: page header (h1 text-xl) > major section cards (h2 text-lg, "fina"
 * semibold weight) > cards (text-base) > items (text-sm). The Classic surface's
 * section headers were the outlier (text-xs font-bold), visually disconnected
 * from the Guided step headings and the CatalogTab sections.
 *
 * Rendered from the REAL render root (App → StudioLayout →
 * StudioCalculatorView, no Studio mocks) so the assertion covers what the app
 * actually shows. Harness mirrors App.tutorialAnchors.test.tsx.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useConsentStore } from "@/shared/stores/consentStore";

beforeEach(async () => {
  localStorage.clear();
  useLayoutStore.setState({ layoutMode: "classic" });
  await useConsentStore.getState().giveConsent();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// These tests assert the rendered surfaces and their typography, not the
// timing of page transitions. Keep navigation synchronous so the dashboard
// assertion is deterministic in the full coverage suite as well as in a
// focused local run.
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

describe("Studio Classic surface — section card header scale", () => {
  it("renders the section headers at the h2 text-lg scale (Example/CatalogTab reference)", () => {
    render(<App />);

    // The classic calculator must be on screen — otherwise the query below
    // could match some other surface.
    expect(
      screen.getByText(/INSUMO & CONSUMO DE MATERIAL/i),
    ).toBeInTheDocument();

    const sectionTitles = [
      "1. INSUMO & CONSUMO DE MATERIAL",
      "2. TEMPO DE MÁQUINA, CURA & ENERGIA",
    ];

    for (const title of sectionTitles) {
      const heading = screen.getByRole("heading", { name: title });
      expect(heading.tagName).toBe("H2");
      expect(heading.className).toContain("text-lg");
      expect(heading.className).toContain("font-semibold");
      expect(heading.className).not.toContain("text-xs");
    }
  });
});

describe("Studio calculator mode selector placement", () => {
  it("keeps presentation modes with calculator content and changes the active surface", () => {
    render(<App />);

    const main = screen.getByRole("main");
    const modeGroup = within(main).getByRole("group", {
      name: "Modo da calculadora",
    });
    expect(
      screen
        .getByRole("banner")
        .querySelector('[aria-label="Modo da calculadora"]'),
    ).toBeNull();
    expect(
      within(modeGroup).getByRole("button", { name: "Clássico" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Bento" }));

    expect(useLayoutStore.getState().layoutMode).toBe("bento");
    expect(
      within(screen.getByRole("main")).getByRole("group", {
        name: "Modo da calculadora",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("button", {
        name: "Clássico",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Studio views — card header scale", () => {
  it("renders dashboard card headers at the text-base card scale, one step below the page header", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<App />);

    // Navigate to the Dashboard the way the user does (sidebar owns module
    // navigation); the swap lands a frame after the click.
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    await vi.waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Painel de Gestão/i }),
      ).toBeInTheDocument();
    });

    for (const title of [
      "Dashboard em Tempo Real (Base Limpa)",
      "Desempenho Financeiro",
    ]) {
      const heading = screen.getByRole("heading", { name: title });
      expect(heading.tagName).toBe("H2");
      expect(heading.className).toContain("text-base");
      expect(heading.className).not.toContain("text-sm");
    }
  });
});
