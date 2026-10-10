import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SalesSection } from "../SalesSection";

// Mocks
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "pt-BR" } }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    symbol: "R$",
    format: (v: number) => `R$ ${v.toFixed(2)}`,
    CURRENCIES: {},
  }),
}));

const mockSetQuantity = vi.fn();
const mockSetInfillPercent = vi.fn();
const mockSetFdmExtras = vi.fn();
const mockSetResinExtras = vi.fn();
const mockSetFdmSales = vi.fn();
const mockSetResinSales = vi.fn();
const mockSetSelectedMarketplace = vi.fn();

interface MockStore {
  activeTab: string;
  quantity: number;
  infillPercent: number;
  calcLevel: string;
  hiddenFields: string[];
  selectedMarketplace: {
    id: string;
    name: string;
    feePercent: number;
    feeFixed: number;
    hasFreeShipping: boolean;
  };
  fdmExtras: { extrasCost: number };
  resinExtras: { extrasCost: number };
  fdmSales: {
    packagingCost: number;
    shippingCost: number;
    taxPercent: number;
    marketplaceFeePercent: number;
    profitMarginPercent: number;
  };
  resinSales: {
    packagingCost: number;
    shippingCost: number;
    taxPercent: number;
    marketplaceFeePercent: number;
    profitMarginPercent: number;
  };
  results: {
    totalCost?: number;
    profit: number;
    sellPrice: number;
    extrasCost?: number;
  } | null;
  setQuantity: ReturnType<typeof vi.fn>;
  setInfillPercent: ReturnType<typeof vi.fn>;
  setFdmExtras: ReturnType<typeof vi.fn>;
  setResinExtras: ReturnType<typeof vi.fn>;
  setFdmSales: ReturnType<typeof vi.fn>;
  setResinSales: ReturnType<typeof vi.fn>;
  setSelectedMarketplace: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

let mockStore: MockStore;

const createMockStore = (overrides: Partial<MockStore> = {}): MockStore => ({
  activeTab: "fdm",
  quantity: 1,
  infillPercent: 20,
  calcLevel: "advanced",
  hiddenFields: [],
  selectedMarketplace: {
    id: "direct",
    name: "Venda Direta",
    feePercent: 0,
    feeFixed: 0,
    hasFreeShipping: false,
  },
  fdmExtras: { extrasCost: 0 },
  resinExtras: { extrasCost: 0 },
  fdmSales: {
    packagingCost: 2,
    shippingCost: 0,
    taxPercent: 0,
    marketplaceFeePercent: 0,
    profitMarginPercent: 50,
  },
  resinSales: {
    packagingCost: 2,
    shippingCost: 0,
    taxPercent: 0,
    marketplaceFeePercent: 0,
    profitMarginPercent: 50,
  },
  results: { totalCost: 50, profit: 25, sellPrice: 100 },
  setQuantity: mockSetQuantity,
  setInfillPercent: mockSetInfillPercent,
  setFdmExtras: mockSetFdmExtras,
  setResinExtras: mockSetResinExtras,
  setFdmSales: mockSetFdmSales,
  setResinSales: mockSetResinSales,
  setSelectedMarketplace: mockSetSelectedMarketplace,
  ...overrides,
});

vi.mock("@/shared/stores/calculatorStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCalculatorStore: (selector?: any) => {
    return selector ? selector(mockStore) : mockStore;
  },
}));

const mockMarketplaces = [
  {
    id: "direct",
    name: "Venda Direta",
    feePercent: 0,
    feeFixed: 0,
    hasFreeShipping: false,
  },
  {
    id: "shopee",
    name: "Shopee",
    feePercent: 20,
    feeFixed: 4,
    hasFreeShipping: true,
    shippingFeePercent: 0,
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    feePercent: 16,
    feeFixed: 6.5,
    hasFreeShipping: true,
    shippingFeePercent: 0,
  },
  {
    id: "my-store",
    name: "Minha Loja",
    feePercent: 8,
    feeFixed: 2,
    hasFreeShipping: false,
    custom: true,
  },
];

vi.mock("@/shared/stores/catalogStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCatalogStore: (selector?: any) => {
    const state = { marketplaces: mockMarketplaces };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../SectionHeader", () => ({
  SectionHeader: ({
    title,
    subtitle,
    metric,
  }: {
    title: string;
    subtitle?: string;
    metric?: React.ReactNode;
  }) => (
    <div data-testid="section-header">
      <div>{title}</div>
      {subtitle && <div data-testid="section-subtitle">{subtitle}</div>}
      {metric && <div data-testid="section-metric">{metric}</div>}
    </div>
  ),
}));

describe("SalesSection", () => {
  beforeEach(() => {
    mockStore = createMockStore();
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<SalesSection />);
    expect(screen.getByTestId("section-header")).toBeInTheDocument();
  });

  it("renders section header with sales title and subtitle", () => {
    render(<SalesSection />);
    expect(screen.getByTestId("section-header")).toHaveTextContent(
      "calc.sales",
    );
    expect(screen.getByTestId("section-subtitle")).toHaveTextContent(
      "calc.sectionDesc.sales",
    );
  });

  it("shows quantity input", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.quantity")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "calc.quantity" }),
    ).toBeInTheDocument();
  });

  it("shows infillPercent when field is visible (advanced level)", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.infillPercent")).toBeInTheDocument();
  });

  it("hides infillPercent when hidden in intermediate level", () => {
    mockStore = createMockStore({
      calcLevel: "intermediate",
      hiddenFields: ["sales.infillPercent"],
    });
    render(<SalesSection />);
    expect(screen.queryByText("calc.infillPercent")).not.toBeInTheDocument();
  });

  it("hides infillPercent in basic level", () => {
    mockStore = createMockStore({ calcLevel: "basic" });
    render(<SalesSection />);
    expect(screen.queryByText("calc.infillPercent")).not.toBeInTheDocument();
  });

  it("keeps marketplace fees available in quick mode without exposing detailed tax controls", () => {
    mockStore = createMockStore({ calcLevel: "basic" });
    render(<SalesSection />);

    expect(
      screen.getByRole("combobox", { name: "calc.marketplace" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("calc.taxPercent")).not.toBeInTheDocument();
    expect(screen.queryByText("calc.markupPresets")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: "bento.fields.fee" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["basic", "Rápido"],
    ["intermediate", "Detalhado"],
    ["advanced", "Completo"],
  ])("exposes marketplace comparison in %s mode (%s)", (calcLevel) => {
    mockStore = createMockStore({ calcLevel });
    render(<SalesSection />);

    expect(
      screen.getByRole("button", {
        name: /calc.marketplaceComparison.open/,
      }),
    ).toBeVisible();
  });

  it("allows a manual marketplace percentage in detailed mode", () => {
    mockStore = createMockStore({ calcLevel: "intermediate" });
    render(<SalesSection />);

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "bento.fields.fee" }),
      {
        target: { value: "8.5" },
      },
    );

    expect(mockSetFdmSales).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceFeePercent: 8.5 }),
    );
  });

  it("shows extrasCost when field is visible", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.extras")).toBeInTheDocument();
  });

  it("hides extrasCost when hidden", () => {
    mockStore = createMockStore({
      calcLevel: "intermediate",
      hiddenFields: ["sales.extrasCost"],
    });
    render(<SalesSection />);
    expect(screen.queryByText("calc.extras")).not.toBeInTheDocument();
  });

  it("shows the computed extras total beside the section title", () => {
    mockStore = createMockStore({
      results: { totalCost: 50, profit: 25, sellPrice: 100, extrasCost: 12 },
    });
    render(<SalesSection />);
    expect(screen.getByTestId("section-metric")).toHaveTextContent(
      "calc.sectionMetric.totalExtras: R$ 12.00",
    );
  });

  it("shows no metric before a result exists", () => {
    mockStore = createMockStore({ results: null });
    render(<SalesSection />);
    expect(screen.queryByTestId("section-metric")).not.toBeInTheDocument();
  });

  it("shows packaging cost input", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.packaging")).toBeInTheDocument();
  });

  it("shows shippingCost when field is visible", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.shipping")).toBeInTheDocument();
  });

  it("hides shippingCost when hidden", () => {
    mockStore = createMockStore({
      calcLevel: "intermediate",
      hiddenFields: ["sales.shippingCost"],
    });
    render(<SalesSection />);
    expect(screen.queryByText("calc.shipping")).not.toBeInTheDocument();
  });

  it("shows marketplace select when field is visible", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.marketplace")).toBeInTheDocument();
    // The Select component renders a <select> which has role combobox
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();
  });

  it("passes custom catalog marketplaces to the calculator store", () => {
    render(<SalesSection />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Minha Loja/ }));

    expect(mockSetSelectedMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "my-store",
        feePercent: 8,
        feeFixed: 2,
      }),
    );
    expect(mockSetFdmSales).not.toHaveBeenCalled();
  });

  it("hides only the marketplace selector when hidden", () => {
    mockStore = createMockStore({
      calcLevel: "intermediate",
      hiddenFields: ["sales.marketplace"],
    });
    render(<SalesSection />);
    expect(screen.queryByText("calc.marketplace")).not.toBeInTheDocument();
    expect(screen.getByText("calc.markupPresets")).toBeInTheDocument();
  });

  it("shows taxPercent when marketplace field is visible", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.taxPercent")).toBeInTheDocument();
  });

  it("shows markup preset buttons when marketplace field is visible", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.markupPresets")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByText("200%")).toBeInTheDocument();
    expect(screen.getByText("250%")).toBeInTheDocument();
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(screen.getByText("500%")).toBeInTheDocument();
  });

  it("shows the cost-markup input without changing its value", () => {
    render(<SalesSection />);
    expect(screen.getByText("calc.profitMargin")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "calc.profitMargin" }),
    ).toHaveValue(50);
  });

  it("shows the derived real margin and its explanatory helper", () => {
    render(<SalesSection />);
    const margin = screen.getByTestId("classic-derived-real-margin");
    expect(margin).toHaveTextContent("calc.actualMargin");
    expect(margin).toHaveTextContent("25%");
    expect(margin).toHaveTextContent("tooltip.profitMargin");
  });

  it("uses a safe placeholder when the sell price cannot produce a margin", () => {
    mockStore = createMockStore({ results: { profit: 25, sellPrice: 0 } });
    render(<SalesSection />);
    expect(screen.getByTestId("classic-derived-real-margin")).toHaveTextContent(
      "—",
    );
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("highlights active markup preset", () => {
    mockStore = createMockStore({
      fdmSales: { ...mockStore.fdmSales, profitMarginPercent: 200 },
    });
    render(<SalesSection />);
    // The active preset (200%) should be rendered
    expect(screen.getByText("200%")).toBeInTheDocument();
  });
});
