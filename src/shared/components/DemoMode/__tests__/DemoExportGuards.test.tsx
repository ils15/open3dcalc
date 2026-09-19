import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Under test ───────────────────────────────────────────────────────────
import { HistoryTab } from "@/shared/components/Calculator/HistoryTab/HistoryTab";
import { CustomerTab } from "@/shared/components/Catalog/CustomerTab";
import { ProductInventory } from "@/shared/components/Catalog/ProductInventory";
import { QuoteSection } from "@/shared/components/Calculator/QuoteSection";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { exportExecutivePdf } from "@/shared/lib/pdfExport";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useProductInventory } from "@/shared/stores/productInventory";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import type { QuoteFormData } from "@/shared/types";
import type { ExecutiveReportData } from "@/shared/lib/ExecutiveReportDoc";

// ── Shared mocks ─────────────────────────────────────────────────────────
// O guard vive no choke point e lê `demoModeStore.getState()`; mockar o store
// propaga o bloqueio para todo path automaticamente (ResultsPanel pattern).
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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (v: number) => `R$ ${v.toFixed(2)}`,
    symbol: "R$",
    currency: "BRL",
  }),
}));

// @react-pdf/renderer: cobre tanto o import estático dos Docs quanto o
// dinâmico do handler de orçamento — em demo, `pdf()` nunca é alcançado.
// vi.hoisted: a factory do vi.mock é elevada acima das consts do arquivo,
// então `pdf` precisa ser criado antes dela para ficar acessível nos dois.
const { pdf } = vi.hoisted(() => ({
  pdf: vi.fn(() => ({ toBlob: vi.fn().mockResolvedValue(new Blob([])) })),
}));
vi.mock("@react-pdf/renderer", () => ({
  pdf,
  Document: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  Image: ({ src }: { src: string }) => <img src={src} alt="" />,
  Font: { register: vi.fn() },
}));

// History store (padrão do HistoryTab.test.tsx)
const mockStoreActions = {
  exportJson: vi.fn(() => "[]"),
  importJson: vi.fn(() => ({ imported: 0, skipped: 0 })),
  getFilteredEntries: vi.fn(() => []),
  removeEntry: vi.fn(),
  getEntry: vi.fn(),
  setFilterType: vi.fn(),
  setSortBy: vi.fn(),
  setSearch: vi.fn(),
  setDateFrom: vi.fn(),
  setDateTo: vi.fn(),
};

vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: vi.fn(() => ({
    entries: [],
    filterType: "all",
    sortBy: "date",
    dateFrom: null,
    dateTo: null,
    search: "",
    ...mockStoreActions,
  })),
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: {
    getState: vi.fn(() => ({ loadHistoryItem: vi.fn() })),
  },
}));

// Customer store (padrão do CustomerTab.test.tsx)
const mockCustomerActions = {
  exportCustomers: vi.fn(() => "{}"),
  searchCustomers: vi.fn(() => []),
  getAllCustomers: vi.fn(() => []),
};

vi.mock("@/shared/stores/customerStore", () => ({
  useCustomerStore: vi.fn(() => ({
    customers: [],
    searchQuery: "",
    ...mockCustomerActions,
  })),
}));

// ── Suite ────────────────────────────────────────────────────────────────
describe("demo export guards — choke points B1..B5", () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    mockState.isActive = false;
    createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    useProductInventory.setState({ products: [] });
    useQuoteStore.setState({ quotes: [], nextNumber: 1, searchQuery: "", statusFilter: "all" });
  });

  afterEach(() => {
    createObjectURL.mockRestore();
  });

  it("B1 — history JSON export is blocked at the choke point", async () => {
    mockState.isActive = true;
    const user = userEvent.setup();

    render(<HistoryTab />);

    // Sinalização violeta visível na aba, igual ao ResultsPanel.
    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();

    await user.click(screen.getByText("history.exportJson"));

    expect(mockStoreActions.exportJson).toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("B2 — quote PDF export is blocked before rendering anything", async () => {
    mockState.isActive = true;
    const user = userEvent.setup();

    const data: QuoteFormData = {
      title: "Orçamento Teste",
      items: [],
      globalDiscountPercent: 0,
      validUntil: "",
      paymentTerms: "",
      deliveryEstimate: "",
    };
    useQuoteStore.getState().addQuote(data);

    render(<QuoteSection />);

    // Abre o orçamento e tenta exportar PDF.
    await user.click(screen.getByLabelText("Visualizar"));
    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();

    await user.click(screen.getByText("Exportar PDF"));

    // O guard dispara ANTES do import dinâmico de @react-pdf.
    expect(pdf).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("B3 — customer JSON export is blocked at the choke point", async () => {
    mockState.isActive = true;
    const user = userEvent.setup();

    render(<CustomerTab />);

    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();

    await user.click(screen.getByText("customers.export"));

    expect(mockCustomerActions.exportCustomers).toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("B4 — executive report PDF is blocked before rendering anything", async () => {
    mockState.isActive = true;

    await exportExecutivePdf({} as ExecutiveReportData, "pt-BR", "BRL");

    expect(pdf).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("B5 — product CSV export is blocked at the choke point", async () => {
    mockState.isActive = true;
    const user = userEvent.setup();

    render(<ProductInventory />);

    expect(screen.getByText("demo.export.badge")).toBeInTheDocument();

    await user.click(screen.getByText("products.exportCsv"));

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("sink — a blocked export surfaces an explanatory toast", () => {
    mockState.isActive = true;

    render(<DemoExportBlockedToast />);

    // Sem sink registrado o bloqueio acontece em silêncio; aqui o toast
    // assinado deve explicar a recusa.
    act(() => {
      guardExport();
    });

    expect(screen.getByText("demo.export.blockedTitle")).toBeInTheDocument();
  });

  it("non-demo — exports still funnel through to the disk", async () => {
    const user = userEvent.setup();

    render(<ProductInventory />);

    expect(screen.queryByText("demo.export.badge")).not.toBeInTheDocument();

    await user.click(screen.getByText("products.exportCsv"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
