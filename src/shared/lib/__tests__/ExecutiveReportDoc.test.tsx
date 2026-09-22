import { describe, it, expect, vi, beforeEach } from "vitest";
import { pdf } from "@react-pdf/renderer";
import type { ExecutiveReportData } from "../ExecutiveReportDoc";

// ExecutiveReportDoc / ReportDoc only need these primitives; stubbing them lets
// us capture the props that reach the PDF without rendering it.
vi.mock("@react-pdf/renderer", () => ({
  Document: "div",
  Page: "div",
  View: "div",
  Text: "span",
  Image: "img",
  StyleSheet: { create: () => ({}) },
  pdf: vi.fn(() => ({
    toBlob: async () => new Blob([], { type: "application/pdf" }),
  })),
}));

vi.mock("../demoExportGuard", () => ({ guardExport: () => false }));
vi.mock("../download", () => ({ downloadBlob: vi.fn() }));

const pdfMock = vi.mocked(pdf);

function makeData(
  overrides: Partial<ExecutiveReportData> = {},
): ExecutiveReportData {
  return {
    period: { from: "2026-01-01", to: "2026-01-31" },
    entryCount: 4,
    totalRevenue: 1000,
    totalCost: 400,
    totalProfit: 600,
    avgMargin: 60,
    topPrinters: [{ name: "Ender 3", profit: 300, count: 3 }],
    topMaterials: [{ name: "PLA", count: 5 }],
    comparison: {
      revenue: { current: 1000, previous: 800, change: 25 },
      cost: { current: 400, previous: 300, change: 33 },
      profit: { current: 600, previous: 500, change: 20 },
    },
    ...overrides,
  };
}

/** Props the ExecutiveReportDoc actually received. */
function capturedDocProps(): Record<string, unknown> {
  const element = pdfMock.mock.calls[0]?.[0] as
    { props: Record<string, unknown> } | undefined;
  if (!element) throw new Error("pdf() was never called");
  return element.props;
}

describe("ExecutiveReportDoc", () => {
  it("module exports correctly", async () => {
    const mod = await import("../ExecutiveReportDoc");
    expect(mod.ExecutiveReportDoc).toBeDefined();
    expect(typeof mod.ExecutiveReportDoc).toBe("function");
  });

  it("pdfExport exports executive function", async () => {
    const mod = await import("../pdfExport");
    expect(mod.exportExecutivePdf).toBeDefined();
    expect(typeof mod.exportExecutivePdf).toBe("function");
  });
});

describe("exportExecutivePdf — locale/currency threading", () => {
  beforeEach(() => {
    pdfMock.mockClear();
  });

  it("keeps the locale/currency the caller resolved (no undefined clobbering)", async () => {
    const { exportExecutivePdf } = await import("../pdfExport");
    // Dashboard resolves these itself; the optional args are omitted at the
    // call site, so the export must not overwrite them with `undefined`.
    await exportExecutivePdf(makeData({ locale: "en-US", currency: "$" }));

    const props = capturedDocProps();
    expect(props.locale).toBe("en-US");
    expect(props.currency).toBe("$");
  });

  it("threads the currency symbol (never a raw ISO code)", async () => {
    const { exportExecutivePdf } = await import("../pdfExport");
    // ExecutiveReportDoc.formatMoney prefixes money with `currency`, so it must
    // be a symbol ("$") — a code ("BRL") would render "BRL 1.234,56".
    await exportExecutivePdf(makeData(), "en-US", "$");

    const props = capturedDocProps();
    expect(props.currency).toBe("$");
    expect(props.currency).not.toBe("BRL");
  });
});
