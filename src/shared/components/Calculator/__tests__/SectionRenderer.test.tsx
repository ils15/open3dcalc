import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/shared/i18n/i18n";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

vi.mock("../sections/MaterialSection", () => ({
  MaterialSection: () => <div data-testid="material-section" />,
}));
vi.mock("../sections/PrintSection", () => ({
  PrintSection: () => <div data-testid="print-section" />,
}));
vi.mock("../sections/FailureSection", () => ({
  FailureSection: () => <div data-testid="failure-section" />,
}));
vi.mock("../sections/HardwareSection", () => ({
  HardwareSection: () => <div data-testid="hardware-section" />,
}));
vi.mock("../sections/MachineSection", () => ({
  MachineSection: () => <div data-testid="machine-section" />,
}));
vi.mock("../sections/FixedCostsSection", () => ({
  FixedCostsSection: () => <div data-testid="fixed-cost-section" />,
}));
vi.mock("../sections/LaborSection", () => ({
  LaborSection: () => <div data-testid="labor-section" />,
}));
vi.mock("../sections/OpsSection", () => ({
  OpsSection: () => <div data-testid="ops-section" />,
}));
vi.mock("../sections/SalesSection", () => ({
  SalesSection: () => <div data-testid="sales-section" />,
}));
vi.mock("@/shared/components/Results/ResultsPanel", () => ({
  ResultsPanel: () => <div data-testid="results-panel" />,
}));

import { SectionRenderer } from "../SectionRenderer";

const rendererProps = {
  t: (key: string) => key,
  currencySymbol: "R$",
  handleInput: vi.fn(),
  isFDM: true,
  showSpoolSelector: false,
  setShowSpoolSelector: vi.fn(),
  inventorySpools: [],
  catalogMaterials: [],
  catalogPrinters: [],
  handlePrinterSelect: vi.fn(),
};

beforeEach(() => {
  useCalculatorStore.setState({ calcLevel: "advanced", hiddenFields: [] });
});

describe("SectionRenderer field customization", () => {
  it("mounts exactly one field customization control in Classic", () => {
    render(<SectionRenderer {...rendererProps} />);

    const controls = screen.getAllByRole("button", {
      name: i18n.t("calc.customizeFields"),
    });
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveAttribute("aria-expanded", "false");
  });
});
