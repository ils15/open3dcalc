import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Identity `t` — these tests assert keys; string content is locked by the
    // wizard.* parity block in locales.test.ts (RED-first convention).
    t: (k: string) => k,
    i18n: { language: "pt-BR" },
  }),
}));

import { useWizardStore } from "@/shared/stores/wizardStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { initialState } from "@/shared/stores/__tests__/calculatorStore.test-utils";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { formatCurrency, resolveCurrency } from "@/shared/lib/currency";
import { GuidedWizard } from "@/shared/components/Wizard/GuidedWizard";

/**
 * W4 — end-to-end behaviour of the guided wizard surface.
 *
 * The wizard is a collection UI over the real calculator store: step 4 must show
 * `result.totalCost` produced by the real calculation layer, never a parallel
 * computation. These tests walk the full 4-step journey.
 */

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState(initialState, true);
  useLayoutStore.setState({ layoutMode: "guided" });
  useWizardStore.setState({
    step: 1,
    direction: "forward",
    errors: {},
    seeded: false,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function nextButton(): HTMLElement {
  return screen.getByRole("button", { name: "wizard.nav.next" });
}
function prevButton(): HTMLElement {
  return screen.getByRole("button", { name: "wizard.nav.previous" });
}

describe("GuidedWizard — structure", () => {
  it("renders an accessible region with a progress label", () => {
    render(<GuidedWizard />);
    expect(
      screen.getByRole("region", { name: "wizard.regionLabel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("wizard.stepOf")).toBeInTheDocument();
  });

  it("renders all four steps in the stepper and marks step 1 current", () => {
    render(<GuidedWizard />);
    for (const n of ["1", "2", "3", "4"]) {
      expect(
        screen.getByRole("button", { name: `wizard.steps.${n}.title` }),
      ).toBeInTheDocument();
    }
    const current = screen
      .getByRole("button", { name: "wizard.steps.1.title" })
      .closest("[aria-current]");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("shows the step 1 heading and disables Previous on the first step", () => {
    render(<GuidedWizard />);
    expect(
      screen.getByRole("heading", { name: "wizard.steps.1.title" }),
    ).toBeInTheDocument();
    expect(prevButton()).toBeDisabled();
  });
});

describe("GuidedWizard — advancing with validation", () => {
  it("advances to step 2 when the current step is valid", () => {
    render(<GuidedWizard />);
    fireEvent.click(nextButton());
    expect(useWizardStore.getState().step).toBe(2);
    expect(
      screen.getByRole("heading", { name: "wizard.steps.2.title" }),
    ).toBeInTheDocument();
  });

  it("blocks an invalid step and surfaces the field error", () => {
    render(<GuidedWizard />);
    const weight = screen.getByLabelText("wizard.fields.weightGrams.label");
    fireEvent.change(weight, { target: { value: "0" } });

    fireEvent.click(nextButton());

    expect(useWizardStore.getState().step).toBe(1);
    expect(screen.getByRole("alert")).toHaveTextContent("wizard.errors.positive");
  });

  it("clears the error once the field is fixed", () => {
    render(<GuidedWizard />);
    const weight = screen.getByLabelText("wizard.fields.weightGrams.label");
    fireEvent.change(weight, { target: { value: "0" } });
    fireEvent.click(nextButton());
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(weight, { target: { value: "150" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves focus to the step heading after advancing (WCAG focus management)", () => {
    render(<GuidedWizard />);
    fireEvent.click(nextButton());
    expect(document.activeElement).toHaveAttribute("id", "wizard-step-heading");
  });
});

describe("GuidedWizard — going back", () => {
  it("returns to the previous step and re-enables backward navigation", () => {
    render(<GuidedWizard />);
    fireEvent.click(nextButton());
    expect(useWizardStore.getState().step).toBe(2);

    fireEvent.click(prevButton());

    expect(useWizardStore.getState().step).toBe(1);
    expect(prevButton()).toBeDisabled();
  });

  it("navigates backward via the stepper without re-validating", () => {
    render(<GuidedWizard />);
    act(() => {
      useWizardStore.getState().goTo(3);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "wizard.steps.1.title" }),
    );

    expect(useWizardStore.getState().step).toBe(1);
  });
});

describe("GuidedWizard — keyboard navigation", () => {
  it("ArrowRight advances and ArrowLeft goes back", () => {
    render(<GuidedWizard />);
    const region = screen.getByRole("region", { name: "wizard.regionLabel" });

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(useWizardStore.getState().step).toBe(2);

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(useWizardStore.getState().step).toBe(1);
  });

  it("ignores arrow keys while an input has focus so typing is not hijacked", () => {
    render(<GuidedWizard />);
    const weight = screen.getByLabelText("wizard.fields.weightGrams.label");
    weight.focus();

    fireEvent.keyDown(weight, { key: "ArrowRight" });

    expect(useWizardStore.getState().step).toBe(1);
  });

  it("does not advance past an invalid step via the keyboard", () => {
    render(<GuidedWizard />);
    fireEvent.change(screen.getByLabelText("wizard.fields.weightGrams.label"), {
      target: { value: "0" },
    });
    const region = screen.getByRole("region", { name: "wizard.regionLabel" });

    fireEvent.keyDown(region, { key: "ArrowRight" });

    expect(useWizardStore.getState().step).toBe(1);
  });
});

describe("GuidedWizard — result & graduation", () => {
  it("step 4 shows the real calculator result (no parallel computation)", () => {
    render(<GuidedWizard />);
    act(() => {
      useWizardStore.getState().goTo(4);
    });

    const results = useCalculatorStore.getState().results;
    expect(results).not.toBeNull();
    // The wizard renders with the same currency resolution the app uses.
    const currency = resolveCurrency(
      useCalculatorStore.getState().currency,
      "pt-BR",
    );

    expect(screen.getByTestId("wizard-total-cost").textContent).toContain(
      formatCurrency(results!.totalCost, currency),
    );
    expect(screen.getByTestId("wizard-sell-price").textContent).toContain(
      formatCurrency(results!.sellPrice, currency),
    );
    expect(screen.getByTestId("wizard-profit").textContent).toContain(
      formatCurrency(results!.profit, currency),
    );
  });

  it("Finish commits the draft and graduates to the classic layout", () => {
    render(<GuidedWizard />);
    act(() => {
      useWizardStore.getState().goTo(4);
    });

    fireEvent.click(screen.getByRole("button", { name: "wizard.nav.finish" }));

    expect(useLayoutStore.getState().layoutMode).toBe("classic");
    expect(useCalculatorStore.getState().productName).toBe(
      useWizardStore.getState().draft.productName,
    );
  });

  it("Exit returns to the classic layout without committing", () => {
    render(<GuidedWizard />);
    const before = useCalculatorStore.getState().fdmMaterial.weightUsed;

    fireEvent.click(screen.getByRole("button", { name: "wizard.nav.exit" }));

    expect(useLayoutStore.getState().layoutMode).toBe("classic");
    expect(useCalculatorStore.getState().fdmMaterial.weightUsed).toBe(before);
  });
});

describe("GuidedWizard — reduced motion", () => {
  it("animates step transitions by default", () => {
    render(<GuidedWizard />);
    expect(screen.getByTestId("wizard-step-panel")).toHaveClass(
      "wizard-step-enter",
    );
  });

  it("drops the enter animation when the user prefers reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    render(<GuidedWizard />);
    expect(screen.getByTestId("wizard-step-panel")).not.toHaveClass(
      "wizard-step-enter",
    );
  });
});
