import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QuickStartBanner } from "../QuickStartBanner";

// Mock the calculator store
const mockSetQuickStart = vi.fn();
const mockResetCalculator = vi.fn();

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setQuickStart: mockSetQuickStart,
      resetCalculator: mockResetCalculator,
    }),
}));

// D2: the banner must resolve every string via `t()`. Returning the raw key
// makes the assertions encode the i18n key rather than a hardcoded PT literal
// (the previous suite asserted "Quer ver como funciona?" directly).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("QuickStartBanner", () => {
  it("renders the title via the i18n key", () => {
    render(<QuickStartBanner />);
    expect(screen.getByText("quickStart.title")).toBeInTheDocument();
  });

  it("renders the description via the i18n key", () => {
    render(<QuickStartBanner />);
    expect(screen.getByText("quickStart.description")).toBeInTheDocument();
  });

  it('renders the "fill with example" button', () => {
    render(<QuickStartBanner />);
    expect(
      screen.getByRole("button", { name: "quickStart.fillExample" }),
    ).toBeInTheDocument();
  });

  it('renders the "clear" button', () => {
    render(<QuickStartBanner />);
    expect(
      screen.getByRole("button", { name: "quickStart.clearFields" }),
    ).toBeInTheDocument();
  });

  it("calls setQuickStart when the example button is clicked", () => {
    render(<QuickStartBanner />);
    fireEvent.click(
      screen.getByRole("button", { name: "quickStart.fillExample" }),
    );
    expect(mockSetQuickStart).toHaveBeenCalledTimes(1);
  });

  it("calls resetCalculator when the clear button is clicked", () => {
    render(<QuickStartBanner />);
    fireEvent.click(
      screen.getByRole("button", { name: "quickStart.clearFields" }),
    );
    expect(mockResetCalculator).toHaveBeenCalledTimes(1);
  });

  it("renders no hardcoded Portuguese literal (D2 leak guard)", () => {
    const { container } = render(<QuickStartBanner />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(
      /Quer ver como funciona|Preencha a calculadora|Limpar|Exemplo/,
    );
  });
});
