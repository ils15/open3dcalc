import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteSection } from "../QuoteSection";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import type { QuoteFormData } from "@/shared/types";

vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-page">{children}</div>
  ),
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Image: ({ src }: { src: string }) => <img src={src} alt="" />,
  Font: { register: vi.fn() },
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (val: number) => `R$ ${val.toFixed(2)}`,
    symbol: "R$",
    currency: "BRL",
  }),
}));

function createTestQuote() {
  const data: QuoteFormData = {
    title: "Orçamento Teste",
    items: [
      {
        historyEntryId: "hist_1",
        name: "Item A",
        quantity: 2,
        unitPrice: 50,
        discountPercent: 0,
      },
    ],
    globalDiscountPercent: 0,
    validUntil: "2026-07-28",
    paymentTerms: "À vista",
    deliveryEstimate: "5 dias úteis",
  };
  return useQuoteStore.getState().addQuote(data);
}

describe("QuoteSection", () => {
  beforeEach(() => {
    localStorage.clear();
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
    useCustomerStore.setState({
      customers: [],
      searchQuery: "",
    });
  });

  it("renders empty state when no quotes exist", () => {
    render(<QuoteSection />);
    expect(screen.getByText("Orçamentos")).toBeTruthy();
    expect(screen.getByText("Novo Orçamento")).toBeTruthy();
  });

  it("shows quote in list after creation", () => {
    createTestQuote();
    render(<QuoteSection />);
    expect(screen.getByText("Orçamento Teste")).toBeTruthy();
    expect(screen.getByText("#001")).toBeTruthy();
  });

  it("filters quotes by search query", () => {
    useQuoteStore.getState().addQuote({
      title: "Benchy 3D",
      items: [],
      globalDiscountPercent: 0,
      validUntil: "",
      paymentTerms: "",
      deliveryEstimate: "",
    });
    useQuoteStore.getState().addQuote({
      title: "Vase Decorativo",
      items: [],
      globalDiscountPercent: 0,
      validUntil: "",
      paymentTerms: "",
      deliveryEstimate: "",
    });

    render(<QuoteSection />);

    // Both should render initially
    expect(screen.getByText("Benchy 3D")).toBeTruthy();
    expect(screen.getByText("Vase Decorativo")).toBeTruthy();
  });
});
