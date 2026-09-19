import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ResultsPanel } from "../ResultsPanel";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import type { CalculationResult } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

const exportQuoteJson = vi.fn();
const downloadQuoteJson = vi.fn();

vi.mock("@/shared/lib/quoteApi", () => ({
  exportQuoteJson: (...args: unknown[]) => exportQuoteJson(...args),
  downloadQuoteJson: (...args: unknown[]) => downloadQuoteJson(...args),
}));

// Demo store: toggled per test through mockState.isActive.
interface MockDemoModeState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockState: MockDemoModeState = {
  isActive: false,
  enter: vi.fn(),
  exit: vi.fn(),
};

function mockDemoModeStore(): MockDemoModeState;
function mockDemoModeStore<T>(selector: (state: MockDemoModeState) => T): T;
function mockDemoModeStore(
  selector?: (state: MockDemoModeState) => unknown,
): unknown {
  return selector ? selector(mockState) : mockState;
}

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(mockDemoModeStore, {
    getState: () => mockState,
  }),
}));

const baseResults: CalculationResult = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 0,
  extrasCost: 2,
  postProcessingCost: 0,
  subtotal: 40,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.1,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 5,
  targetMarginPercent: 50,
  breakEvenPrice: 60,
  actualMargin: 28.33,
  carbonFootprintGrams: 100,
  profitPerHour: 6,
  totalHoursForProfit: 5,
};

const salesParams = {
  packagingCost: 0,
  shippingCost: 0,
  taxPercent: 10,
  marketplaceFeePercent: 5,
  profitMarginPercent: 50,
  volumeDiscounts: [],
};

function seedStore(productName = "Vaso Teste") {
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName,
    selectedSpoolId: null,
    fdmSales: { ...salesParams },
    results: { ...baseResults },
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useHistoryStore.setState({ entries: [] });
  useFilamentInventory.setState({
    spools: [
      {
        id: "s1",
        brand: "MarcaX",
        material: "PLA",
        color: "Preto",
        colorHex: "#111111",
        weightGrams: 1000,
        originalWeightGrams: 1000,
        costPerKg: 120,
        diameterMm: 1.75,
        dateAdded: Date.now(),
        notes: "",
        status: "in_stock",
        purchaseStore: "",
      },
    ],
  });
  useProductInventory.setState({ products: [] });
}

describe("ResultsPanel — demo export guard", () => {
  const onBlocked = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    seedStore();
    mockState.isActive = false;
    vi.clearAllMocks();
  });

  it("marks the export area while demo is active", () => {
    mockState.isActive = true;

    render(<ResultsPanel variant="mobile" onExportBlocked={onBlocked} />);

    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();
  });

  it("shows no marking while demo is inactive", () => {
    render(<ResultsPanel variant="mobile" onExportBlocked={onBlocked} />);

    expect(screen.queryByText("demo.export.badge")).not.toBeInTheDocument();
  });

  it.each([
    ["calc.exportPdf"],
    ["CSV"],
    ["results.exportQuote"],
  ])("blocks the %s export with explanatory feedback", async (label) => {
    mockState.isActive = true;
    const user = userEvent.setup();

    render(<ResultsPanel variant="mobile" onExportBlocked={onBlocked} />);

    await user.click(screen.getByText(label));

    expect(onBlocked).toHaveBeenCalledWith("demo.export.blockedTitle");
    expect(exportQuoteJson).not.toHaveBeenCalled();
    expect(downloadQuoteJson).not.toHaveBeenCalled();
  });

  it("blocks the share link with explanatory feedback", async () => {
    mockState.isActive = true;
    const user = userEvent.setup();

    render(<ResultsPanel variant="mobile" onExportBlocked={onBlocked} />);

    await user.click(screen.getByLabelText("results.shareLink"));

    expect(onBlocked).toHaveBeenCalledWith("demo.export.blockedTitle");
  });

  it("keeps exports working while demo is inactive", async () => {
    const user = userEvent.setup();

    render(<ResultsPanel variant="mobile" onExportBlocked={onBlocked} />);

    await user.click(screen.getByText("results.exportQuote"));

    expect(onBlocked).not.toHaveBeenCalled();
    expect(exportQuoteJson).toHaveBeenCalledTimes(1);
    expect(downloadQuoteJson).toHaveBeenCalledTimes(1);
  });
});
