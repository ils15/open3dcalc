import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaborSection } from "../LaborSection";
import type { CalculatorState } from "@/shared/stores/calculatorStore";

const createMockStore = (
  overrides: Partial<CalculatorState> = {},
): CalculatorState =>
  ({
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 15,
      postProcessingTimeMinutes: 20,
      hourlyRate: 25,
    },
    resinLabor: {
      enabled: true,
      setupTimeMinutes: 10,
      postProcessingTimeMinutes: 15,
      hourlyRate: 25,
    },
    setFdmLabor: vi.fn(),
    setResinLabor: vi.fn(),
    ...overrides,
  }) as unknown as CalculatorState;

const defaultProps = {
  renderSectionHeader: vi.fn((_Icon, title) => (
    <div data-testid="section-header">{title}</div>
  )),
  t: (key: string) => key,
  currencySymbol: "R$",
  handleInput: vi.fn(),
  isFDM: true,
};

describe("LaborSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const store = createMockStore();
    render(<LaborSection {...defaultProps} store={store} />);
    expect(screen.getByTestId("section-header")).toBeInTheDocument();
  });

  it("displays the section title via renderSectionHeader", () => {
    const store = createMockStore();
    render(<LaborSection {...defaultProps} store={store} />);
    expect(screen.getByTestId("section-header")).toHaveTextContent(
      "calc.labor",
    );
  });

  it("goes three-up on wide containers via the @form3 token", () => {
    // Labor is one of the four field groups widened to three columns. The
    // @form3 token is ADDITIVE: below it the grid stays at @form:grid-cols-2,
    // so both utilities must be present.
    const store = createMockStore();
    const { container } = render(
      <LaborSection {...defaultProps} store={store} />,
    );
    const grid = container.querySelector("div.grid");
    expect(grid?.className).toContain("grid grid-cols-1");
    expect(grid?.className).toContain("@form:grid-cols-2");
    expect(grid?.className).toContain("@form3:grid-cols-3");
    // Two rows of two become one row of three: no child needs to span, and
    // adding a span here would break the single row.
    for (const child of Array.from(grid!.children)) {
      expect((child as HTMLElement).className).not.toContain("col-span");
    }
  });

  it("shows three input fields (setup, post, hourly)", () => {
    const store = createMockStore();
    render(<LaborSection {...defaultProps} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs.length).toBe(3);
  });

  it("displays FDM labor values when isFDM is true", () => {
    const store = createMockStore({
      fdmLabor: {
        enabled: true,
        setupTimeMinutes: 15,
        postProcessingTimeMinutes: 20,
        hourlyRate: 30,
      },
    });
    render(<LaborSection {...defaultProps} isFDM={true} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(15); // setup
    expect(inputs[1]).toHaveValue(20); // post
    expect(inputs[2]).toHaveValue(30); // hourly
  });

  it("displays resin labor values when isFDM is false", () => {
    const store = createMockStore({
      resinLabor: {
        enabled: true,
        setupTimeMinutes: 10,
        postProcessingTimeMinutes: 15,
        hourlyRate: 25,
      },
    });
    render(<LaborSection {...defaultProps} isFDM={false} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(10);
    expect(inputs[1]).toHaveValue(15);
    expect(inputs[2]).toHaveValue(25);
  });
});
