import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExportActionsCard } from "../ExportActionsCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CalculationResult } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const exportQuoteJson = vi.fn();
const downloadQuoteJson = vi.fn();

vi.mock("@/shared/lib/quoteApi", () => ({
  exportQuoteJson: (...args: unknown[]) => exportQuoteJson(...args),
  downloadQuoteJson: (...args: unknown[]) => downloadQuoteJson(...args),
}));

interface MockDemoState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockDemo: MockDemoState = {
  isActive: false,
  enter: vi.fn(),
  exit: vi.fn(),
};

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(
    (selector?: (s: MockDemoState) => unknown) =>
      selector ? selector(mockDemo) : mockDemo,
    { getState: () => mockDemo },
  ),
}));

const results: CalculationResult = {
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

function seedStore() {
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName: "Vaso Teste",
    quantity: 1,
    results: { ...results },
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
}

beforeEach(() => {
  localStorage.clear();
  seedStore();
  mockDemo.isActive = false;
  vi.restoreAllMocks();
});

describe("ExportActionsCard — chrome", () => {
  it("renders the save, PDF, CSV, quote and share actions", () => {
    render(<ExportActionsCard />);

    expect(screen.getByText("calc.saveSettings")).toBeInTheDocument();
    expect(screen.getByText("calc.exportPdf")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("results.exportQuote")).toBeInTheDocument();
    expect(screen.getByText("results.shareLink")).toBeInTheDocument();
  });

  it("keeps the tutorial hook for onboarding tours", () => {
    const { container } = render(<ExportActionsCard />);

    expect(container.querySelector('[data-tutorial="export"]')).not.toBeNull();
  });
});

describe("ExportActionsCard — demo marking", () => {
  it("marks the export area while demo is active", () => {
    mockDemo.isActive = true;
    render(<ExportActionsCard />);

    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();
  });

  it("shows no marking while demo is inactive", () => {
    render(<ExportActionsCard />);

    expect(screen.queryByText("demo.export.badge")).not.toBeInTheDocument();
  });
});

describe("ExportActionsCard — save", () => {
  it("persists the settings and confirms with a saved state", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.spyOn(
      useCalculatorStore.getState(),
      "saveSettings",
    );
    render(<ExportActionsCard />);

    await user.click(screen.getByText("calc.saveSettings"));

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByText("calc.saved")).toBeInTheDocument();
  });
});

describe("ExportActionsCard — guarded exports", () => {
  it("blocks the quote export with explanatory feedback in demo", async () => {
    const user = userEvent.setup();
    mockDemo.isActive = true;
    const onExportBlocked = vi.fn();
    render(<ExportActionsCard onExportBlocked={onExportBlocked} />);

    await user.click(screen.getByText("results.exportQuote"));

    expect(onExportBlocked).toHaveBeenCalledWith("demo.export.blockedTitle");
    expect(exportQuoteJson).not.toHaveBeenCalled();
    expect(downloadQuoteJson).not.toHaveBeenCalled();
  });

  it("emits the quote when demo is inactive", async () => {
    const user = userEvent.setup();
    render(<ExportActionsCard />);

    await user.click(screen.getByText("results.exportQuote"));

    expect(exportQuoteJson).toHaveBeenCalledTimes(1);
    expect(downloadQuoteJson).toHaveBeenCalledTimes(1);
  });

  it("blocks the share link in demo", async () => {
    const user = userEvent.setup();
    mockDemo.isActive = true;
    const onExportBlocked = vi.fn();
    render(<ExportActionsCard onExportBlocked={onExportBlocked} />);

    await user.click(screen.getByRole("button", { name: "results.shareLink" }));

    expect(onExportBlocked).toHaveBeenCalledWith("demo.export.blockedTitle");
    expect(screen.queryByText("results.linkCopied")).not.toBeInTheDocument();
  });

  it("copies the share link and confirms when demo is inactive", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ExportActionsCard />);

    await user.click(screen.getByRole("button", { name: "results.shareLink" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("results.linkCopied")).toBeInTheDocument();
  });
});
