/**
 * Typographic scale lock for the Studio's Classic surface.
 *
 * The shared calculator's section headings stay at the h2 text-lg scale in
 * Studio, and its three complexity levels progressively reveal fields.
 *
 * Rendered from the real render root (App → StudioLayout → CalculatorSurface,
 * no Studio mocks) so these assertions cover what users actually see.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import i18n from "@/shared/i18n/i18n";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

beforeEach(async () => {
  localStorage.clear();
  useLayoutStore.setState({ layoutMode: "classic" });
  useCalculatorStore.setState({ calcLevel: "basic", activeTab: "fdm" });
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

describe("Studio Classic surface — shared calculator parity", () => {
  it("renders shared section headers at the h2 text-lg scale", () => {
    render(<App />);

    expect(screen.getByTestId("calculator-inputs")).toBeInTheDocument();
    const heading = screen
      .getByTestId("calculator-inputs")
      .querySelector("#section-material h2");
    if (!heading) throw new Error("shared material section heading missing");
    expect(heading.tagName).toBe("H2");
    expect(heading.className).toContain("text-lg");
    expect(heading.className).toContain("font-semibold");
    expect(heading.className).not.toContain("text-xs");
  });

  it("progressively reveals fields in Rápido, Detalhado, and Completo", () => {
    render(<App />);

    const levelButton = (key: string) =>
      screen.getByRole("button", { name: i18n.t(key) });

    expect(levelButton("calc.quick")).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("#section-failure")).toBeNull();
    expect(document.querySelector("#section-hardware")).toBeNull();

    fireEvent.click(levelButton("calc.detailed"));
    expect(levelButton("calc.detailed")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.querySelector("#section-failure")).toBeInTheDocument();
    expect(document.querySelector("#section-hardware")).toBeNull();
    expect(document.querySelector("#section-machine")).toBeNull();

    fireEvent.click(levelButton("calc.complete"));
    expect(levelButton("calc.complete")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const section of [
      "hardware",
      "machine",
      "fixedCost",
      "labor",
      "ops",
    ]) {
      expect(document.querySelector(`#section-${section}`)).toBeInTheDocument();
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
