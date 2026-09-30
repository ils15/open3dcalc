import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineSection } from "../MachineSection";
import type { CalculatorState } from "@/shared/stores/calculatorStore";

const createMockStore = (
  overrides: Partial<CalculatorState> = {},
): CalculatorState =>
  ({
    fdmMachine: {
      enabled: true,
      machineCost: 3000,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    },
    resinMachine: {
      enabled: true,
      machineCost: 3500,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    },
    setFdmMachine: vi.fn(),
    setResinMachine: vi.fn(),
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

describe("MachineSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const store = createMockStore();
    render(<MachineSection {...defaultProps} store={store} />);
    expect(screen.getByTestId("section-header")).toBeInTheDocument();
  });

  it("displays the section title via renderSectionHeader", () => {
    const store = createMockStore();
    render(<MachineSection {...defaultProps} store={store} />);
    expect(screen.getByTestId("section-header")).toHaveTextContent(
      "calc.machine",
    );
  });

  it("goes three-up on wide containers via the @form3 token", () => {
    // Machine is one of the four field groups widened to three columns.
    // @form3 is ADDITIVE on the grid: below it the grid stays 2-up.
    const store = createMockStore();
    const { container } = render(
      <MachineSection {...defaultProps} store={store} />,
    );
    const grid = container.querySelector("div.grid");
    expect(grid?.className).toContain("grid grid-cols-1");
    expect(grid?.className).toContain("@form:grid-cols-2");
    expect(grid?.className).toContain("@form3:grid-cols-3");
  });

  it("re-spans the maintenance banner and cost row to the full three columns", () => {
    // Both wide children must carry BOTH spans: @form:col-span-2 keeps them
    // full width at 2-up, @form3:col-span-3 keeps them full width at 3-up.
    const store = createMockStore({
      fdmMachine: {
        enabled: true,
        machineCost: 3000,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: true,
        maintenanceCost: 50,
      },
    });
    const { container } = render(
      <MachineSection {...defaultProps} store={store} />,
    );
    const grid = container.querySelector("div.grid");
    const banner = screen.getByText("calc.maintenance").closest("div")!;
    expect(banner.className).toContain("@form:col-span-2");
    expect(banner.className).toContain("@form3:col-span-3");
    // The maintenance-cost row only renders when the toggle is on; it is the grid
    // child wrapping the calc.maintenanceCost input, not the first spinbutton.
    const costRow = Array.from(grid!.children).find((c) =>
      c.textContent?.includes("calc.maintenanceCost"),
    )!;
    expect(costRow).toBeDefined();
    expect((costRow as HTMLElement).className).toContain("@form:col-span-2");
    expect((costRow as HTMLElement).className).toContain("@form3:col-span-3");
    // Both are direct children of the grid, so the spans actually apply.
    expect(banner.parentElement).toBe(grid);
    expect(costRow.parentElement).toBe(grid);
  });

  it("shows machine cost, depreciation, and hours inputs (3 spinbuttons)", () => {
    const store = createMockStore();
    render(<MachineSection {...defaultProps} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs.length).toBe(3);
  });

  it("shows maintenance toggle", () => {
    const store = createMockStore();
    render(<MachineSection {...defaultProps} store={store} />);
    const toggle = screen.getByRole("button", { name: /ativar|desativar/i });
    expect(toggle).toBeInTheDocument();
  });

  it("hides maintenance cost input when maintenance is disabled", () => {
    const store = createMockStore({
      fdmMachine: {
        enabled: true,
        machineCost: 3000,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
    });
    render(<MachineSection {...defaultProps} store={store} />);
    // Only 3 inputs (cost, depreciation, hours) - no maintenance cost
    expect(screen.getAllByRole("spinbutton").length).toBe(3);
  });

  it("shows maintenance cost input when maintenance is enabled", () => {
    const store = createMockStore({
      fdmMachine: {
        enabled: true,
        machineCost: 3000,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: true,
        maintenanceCost: 50,
      },
    });
    render(<MachineSection {...defaultProps} store={store} />);
    // 4 inputs (cost, depreciation, hours, maintenance cost)
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs.length).toBe(4);
    expect(inputs[3]).toHaveValue(50);
  });

  it("displays FDM machine values when isFDM is true", () => {
    const store = createMockStore({
      fdmMachine: {
        enabled: true,
        machineCost: 3000,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
    });
    render(<MachineSection {...defaultProps} isFDM={true} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(3000);
    expect(inputs[1]).toHaveValue(36);
    expect(inputs[2]).toHaveValue(200);
  });

  it("displays resin machine values when isFDM is false", () => {
    const store = createMockStore({
      resinMachine: {
        enabled: true,
        machineCost: 3500,
        depreciationMonths: 24,
        hoursPerMonth: 150,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
    });
    render(<MachineSection {...defaultProps} isFDM={false} store={store} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(3500);
    expect(inputs[1]).toHaveValue(24);
    expect(inputs[2]).toHaveValue(150);
  });
});
