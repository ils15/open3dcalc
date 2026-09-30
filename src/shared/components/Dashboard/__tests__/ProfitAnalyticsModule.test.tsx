import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProfitAnalyticsModule } from "../ProfitAnalyticsModule";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import type {
  CalculationResult,
  CalculationSnapshot,
  HistoryEntry,
} from "@/shared/types";

// ---------------------------------------------------------------------------
// External dependencies. The component is deliberately free of both: it takes
// `entries` as a prop instead of reading `useHistoryStore` (the Dashboard has
// its own date filter, and `useHistoryAggregates`' envelope reads the store
// raw at useHistoryAggregates.ts:591), and i18n reaches it only through the
// pure aggregators it imports directly.
// ---------------------------------------------------------------------------

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (v: number) => `R$ ${v.toFixed(2)}`,
    symbol: "R$",
    currency: "BRL",
  }),
}));

/**
 * Identity translator that RECORDS its arguments.
 *
 * There is no i18next instance here (the component must stay testable without a
 * provider), so `t` cannot pluralize on its own: it returns the key it was
 * given. Recording the arguments is what lets the orphan tests assert the thing
 * the component actually decides — which key, and with which `count` — instead
 * of asserting on a plural suffix this mock would have to reimplement to
 * produce.
 */
const translateCalls = vi.hoisted(
  () => [] as [string, Record<string, unknown> | undefined][],
);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      translateCalls.push([key, opts]);
      return key;
    },
    i18n: { resolvedLanguage: "pt", language: "pt" },
  }),
}));

/** Every `t(key, opts)` call the component made, filtered to one key. */
function callsFor(key: string): (Record<string, unknown> | undefined)[] {
  return translateCalls
    .filter(([called]) => called === key)
    .map(([, opts]) => opts);
}

// ---------------------------------------------------------------------------
// Entry factories — copied from useHistoryAggregates.test.ts:19-105, NOT
// imported from it: a test helper living in another suite's __tests__ folder is
// a hidden coupling that breaks when that suite is refactored.
// ---------------------------------------------------------------------------

function makeResult(
  overrides: Partial<CalculationResult> = {},
): CalculationResult {
  return {
    materialCost: 10,
    energyCost: 2,
    machineCost: 3,
    hardwareCost: 1,
    consumablesCost: 1,
    laborCost: 20,
    softwareCost: 1,
    failureCost: 4,
    extrasCost: 2,
    postProcessingCost: 5,
    subtotal: 49,
    totalCost: 60,
    sellPrice: 105.88,
    profit: 30,
    marketplaceFee: 5.29,
    taxAmount: 10.59,
    costPerGram: 0.71,
    costPerUnit: 60,
    unitWeight: 85,
    estimatedPrintTime: 7,
    targetMarginPercent: 30,
    breakEvenPrice: 70,
    actualMargin: 28.3,
    carbonFootprintGrams: 120,
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<CalculationSnapshot> = {},
): CalculationSnapshot {
  return {
    id: "snap-1",
    timestamp: 0,
    type: "fdm",
    summary: "",
    fdmMaterial: {
      type: "PLA Silk",
      weightUsed: 85,
      purgeWeight: 8,
      costPerKg: 90,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      printTimeHours: 7,
    } as CalculationSnapshot["fdmPrintParams"],
    resinMaterial: {
      type: "Standard",
      volumeUsedMl: 10,
      costPerLiter: 180,
      density: 1.1,
      wasteMarginPercent: 10,
    },
    resinPrintParams: {
      printTimeHours: 7,
    } as CalculationSnapshot["resinPrintParams"],
    selectedPrinterId: "bambu_a1_mini",
    productName: "Bracket",
    quantity: 1,
    ...overrides,
  } as CalculationSnapshot;
}

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "e1",
    timestamp: new Date(2026, 1, 10, 12, 0, 0).getTime(),
    type: "fdm",
    name: "Bracket",
    summary: "",
    totalCost: 60,
    sellPrice: 100,
    profit: 40,
    result: makeResult(),
    snapshot: makeSnapshot(),
    ...overrides,
  };
}

/** One entry per material, revenue 100 and cost varying to set the margin. */
function entryForMaterial(
  material: string,
  opts: { profit: number; revenue?: number; hours?: number; id?: string },
): HistoryEntry {
  const revenue = opts.revenue ?? 100;
  const profit = opts.profit;
  return makeEntry({
    id: opts.id ?? material,
    sellPrice: revenue,
    profit,
    totalCost: revenue - profit,
    result: makeResult({
      sellPrice: revenue,
      profit,
      totalHoursForProfit: opts.hours ?? 4,
    }),
    snapshot: makeSnapshot({
      fdmMaterial: {
        type: material,
        weightUsed: 85,
        purgeWeight: 8,
        costPerKg: 90,
        density: 1.24,
        spoolEfficiency: 98,
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  translateCalls.length = 0;
});

describe("ProfitAnalyticsModule — estado vazio", () => {
  it("1. não renderiza nada (e nenhum número) quando não há entradas", () => {
    const { container } = render(<ProfitAnalyticsModule entries={[]} />);

    expect(container).toBeEmptyDOMElement();
    // A number would be the failure mode: an empty history must not read as
    // "you made R$ 0,00".
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe("ProfitAnalyticsModule — órfãs", () => {
  it("2. conta as entradas sem material a partir de entries.length, não de sum(rows.count)", () => {
    // Every entry lacks a snapshot, so `byMaterial` drops all of them and
    // `sum(rows.count)` is 0 — exactly the case ROADMAP:1201 asks to surface.
    const orphans = [
      makeEntry({ id: "o1", snapshot: null }),
      makeEntry({ id: "o2", snapshot: null }),
      makeEntry({ id: "o3", snapshot: null }),
    ];
    render(<ProfitAnalyticsModule entries={orphans} />);

    const panel = screen.getByRole("tabpanel");
    // 3 entries, 0 rows -> the material view has nothing to rank.
    expect(within(panel).getByText("common.noData")).toBeInTheDocument();
    expect(
      within(panel).getByTestId("profit-analytics-orphan-count"),
    ).toBeInTheDocument();
    // The load-bearing assertion: 3, not 0. Reading `sum(rows.count)` back
    // would pass `{ count: 0 }` here and the line would never render at all.
    expect(callsFor("history.analytics.orphanCount")).toEqual([{ count: 3 }]);
  });

  it("2b. distingue uma órfã de três — o par _one/_other existe e difere", () => {
    render(<ProfitAnalyticsModule entries={[makeEntry({ snapshot: null })]} />);

    expect(callsFor("history.analytics.orphanCount")).toEqual([{ count: 1 }]);

    // The component passes the count and lets i18next pick the suffix, so the
    // pair has to be a real pair: two distinct strings that both interpolate
    // it. Identical `_one`/`_other` values would pass a key-parity test while
    // printing "3 entrada" to the user.
    const analytics = ptBR.history.analytics as unknown as Record<
      string,
      string
    >;
    expect(analytics.orphanCount_one).not.toBe(analytics.orphanCount_other);
    expect(analytics.orphanCount_one).toContain("{{count}}");
    expect(analytics.orphanCount_other).toContain("{{count}}");
  });

  it("2c. some a contagem de órfãs no modo impressora, onde a linha 'unknown' já as nomeia", async () => {
    const user = userEvent.setup();
    render(
      <ProfitAnalyticsModule
        entries={[
          makeEntry({ snapshot: null }),
          makeEntry({ id: "o2", snapshot: null }),
        ]}
      />,
    );

    // 2 orphans in material mode, then the line is gone in printer mode.
    expect(callsFor("history.analytics.orphanCount")).toEqual([{ count: 2 }]);

    await user.click(screen.getByTestId("profit-analytics-tab-printer"));

    // `getByRole` hands back a raw `HTMLElement`; `queryByTestId` is a Testing
    // Library method, not a DOM one. Without the `within(...)` this line threw
    // and took 239-244 down with it — the printer-mode orphan suppression was
    // never actually asserted by anything.
    const panel = screen.getByRole("tabpanel");
    // `getByRole` hands back a raw `HTMLElement`; `queryByTestId` is a Testing
    // Library method, not a DOM one, so it needs the `within(...)` wrapper the
    // lines below already use. Without it this line threw and took the two
    // printer-mode assertions down with it: the orphan suppression was never
    // actually asserted by anything.
    expect(
      within(panel).queryByTestId("profit-analytics-orphan-count"),
    ).not.toBeInTheDocument();
    // The unnamed printer is a visible, named row instead — `byPrinter` files
    // every snapshot-less entry under it.
    expect(
      within(panel).getByText("history.aggregates.printerUnknown"),
    ).toBeInTheDocument();
    expect(panel.querySelectorAll("[data-row-key]")).toHaveLength(1);
  });
});

describe("ProfitAnalyticsModule — guarda de lista vazia do agregador", () => {
  it("3. trata byMaterial devolvendo [] como conjunto vazio, não como crash", () => {
    // `byMaterial` is typed `MaterialAggregate[] | null` but the component must
    // not lean on `null` as its only "nothing here" signal — an empty array is
    // the same truth told differently.
    render(<ProfitAnalyticsModule entries={[makeEntry({ snapshot: null })]} />);

    const panel = screen.getByRole("tabpanel");
    expect(panel.querySelectorAll("[data-row-key]")).toHaveLength(0);
    expect(within(panel).getByText("common.noData")).toBeInTheDocument();
    expect(screen.queryByTestId("profit-analytics")).not.toBe(null);
  });
});

describe("ProfitAnalyticsModule — paridade de locale", () => {
  it("4. en-US tem exatamente as mesmas chaves que pt-BR em history.analytics", () => {
    // Only `tutorial.launcher` has an automatic parity lock. A key missing in
    // en-US does not fail any test and renders the raw key to the user, so this
    // comparison is the only net.
    const pt = ptBR.history.analytics as Record<string, string>;
    const en = enUS.history.analytics as Record<string, string>;

    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.keys(pt)).toHaveLength(24);

    // Key parity alone is a weak net: a key present in both files with an empty
    // string on one side renders as a blank label — silent, and it satisfies the
    // comparison above. So the values have to be checked too.
    const blankIn = (bundle: Record<string, string>): string[] =>
      Object.entries(bundle)
        .filter(([, value]) => typeof value !== "string" || value.trim() === "")
        .map(([key]) => key);

    expect(blankIn(pt)).toEqual([]);
    expect(blankIn(en)).toEqual([]);
  });
});

describe("ProfitAnalyticsModule — ordenação", () => {
  it("5. ordena materiais por margem descendente", () => {
    render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 20 }),
          entryForMaterial("PETG", { profit: 60 }),
          entryForMaterial("ABS", { profit: 40 }),
        ]}
      />,
    );

    const rows = screen
      .getByRole("tabpanel")
      .querySelectorAll("[data-row-key]");
    const labels = Array.from(rows).map(
      (row) =>
        within(row as HTMLElement).getByTestId("profit-analytics-row-label")
          .textContent,
    );

    expect(labels).toEqual(["PETG", "ABS", "PLA Silk"]);
  });

  it("6. empate de margem tem ordem reprodutível por key, em dois renders", () => {
    const entries = [
      entryForMaterial("PLA Silk", { profit: 50 }),
      entryForMaterial("ABS", { profit: 50 }),
      entryForMaterial("PETG", { profit: 50 }),
    ];
    // `data-row-key` is on the row itself, so read the attribute rather than
    // querying a descendant (a `^=` prefix selector would also have matched the
    // `profit-analytics-row-label` span nested inside each row).
    const orderIn = (container: HTMLElement): (string | null)[] =>
      Array.from(container.querySelectorAll("[data-row-key]")).map((row) =>
        row.getAttribute("data-row-key"),
      );

    const first = render(<ProfitAnalyticsModule entries={entries} />);
    const orderA = orderIn(first.container);
    first.unmount();

    const second = render(<ProfitAnalyticsModule entries={entries} />);
    const orderB = orderIn(second.container);

    // All three margins are 50/100, so only the key tiebreak can order them.
    expect(orderA).toEqual(["abs", "petg", "pla_silk"]);
    expect(orderB).toEqual(orderA);
  });
});

describe("ProfitAnalyticsModule — escala das barras", () => {
  it("7. a primeira linha fica em 100% e a última abaixo de 100%", () => {
    render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 20 }),
          entryForMaterial("PETG", { profit: 60 }),
          entryForMaterial("ABS", { profit: 40 }),
        ]}
      />,
    );

    const bars = screen.getAllByRole("img");
    const widths = bars.map((bar) => (bar as HTMLElement).style.width);

    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe("100%");
    expect(widths[2]).not.toBe("100%");
    expect(Number.parseFloat(widths[2]!)).toBeLessThan(100);
  });

  it("8. margem 140% satura em 100% em vez de estourar o trilho", () => {
    render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 140 }),
          entryForMaterial("PETG", { profit: 20 }),
        ]}
      />,
    );

    const widths = screen
      .getAllByRole("img")
      .map((bar) => (bar as HTMLElement).style.width);

    expect(widths[0]).toBe("100%");
    // A 140/20 ratio would be 700% without the clamp.
    expect(widths[1]).toBe("14.29%");
    expect(widths.every((w) => Number.parseFloat(w!) <= 100)).toBe(true);
  });

  it("8b. margem negativa zera a barra em vez de desenhar para fora", () => {
    render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 50 }),
          entryForMaterial("PETG", { profit: -100 }),
        ]}
      />,
    );

    const widths = screen
      .getAllByRole("img")
      .map((bar) => (bar as HTMLElement).style.width);

    expect(widths[1]).toBe("0%");
  });
});

describe("ProfitAnalyticsModule — sem Recharts", () => {
  it("9. não monta nenhum wrapper de gráfico de biblioteca", () => {
    render(
      <ProfitAnalyticsModule
        entries={[entryForMaterial("PLA Silk", { profit: 40 })]}
      />,
    );

    expect(document.querySelector(".recharts-wrapper")).toBeNull();
    expect(
      screen
        .getByTestId("profit-analytics")
        .querySelector("svg.recharts-surface"),
    ).toBeNull();
  });
});

describe("ProfitAnalyticsModule — cores", () => {
  /**
   * A real regex over real `innerHTML`, not a tautology: if the component ever
   * emits a literal hex this fails. It has to be a *sweep*, though — the first
   * version only rendered the default material tab, so a hex introduced solely
   * in the printer branch, solely on the orphan line, solely inside a KPI card,
   * or solely in a future empty state would have sailed through.
   *
   * Each case also asserts it rendered something. A "no hex here" check over an
   * empty container is true for free, and would be exactly the kind of assertion
   * that makes this file look greener than it is.
   */
  it("10. não emite nenhum hex em nenhum estado alcançável", async () => {
    const user = userEvent.setup();
    const HEX = /#[0-9a-f]{3,6}\b/i;

    // Two materials on distinct printers, plus two snapshot-less entries: one
    // fixture that puts the orphan line, the KPI row, both tabs and the bar
    // fills on screen at once.
    const withOrphans = [
      entryForMaterial("PLA Silk", { profit: 40, revenue: 100, id: "p1" }),
      entryForMaterial("PETG", { profit: 20, revenue: 100, id: "p2" }),
      makeEntry({ id: "o1", snapshot: null }),
      makeEntry({ id: "o2", snapshot: null }),
    ];

    // --- 1. material tab: rows, bars, KPI row and the orphan line -----------
    const { container, unmount } = render(
      <ProfitAnalyticsModule entries={withOrphans} />,
    );

    // Non-vacuity: this state must actually be populated.
    expect(container.querySelectorAll("[data-row-key]")).toHaveLength(2);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    for (const kpi of [
      "profit-analytics-kpi-top-material",
      "profit-analytics-kpi-top-printer",
      "profit-analytics-kpi-weighted-margin",
      "profit-analytics-kpi-avg-per-hour",
    ]) {
      expect(screen.getByTestId(kpi)).toBeInTheDocument();
    }
    expect(
      screen.getByTestId("profit-analytics-orphan-count"),
    ).toBeInTheDocument();

    expect(container.innerHTML).not.toMatch(HEX);

    // --- 2. printer tab: different branch, different bar scale --------------
    await user.click(screen.getByTestId("profit-analytics-tab-printer"));

    // Non-vacuity, and proof this is a different branch: the orphan line is
    // suppressed here and `byPrinter` added the snapshot-less entries.
    expect(
      within(screen.getByRole("tabpanel")).queryByTestId(
        "profit-analytics-orphan-count",
      ),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-row-key]")).toHaveLength(2);
    expect(
      screen.getByText("history.aggregates.printerUnknown"),
    ).toBeInTheDocument();

    expect(container.innerHTML).not.toMatch(HEX);

    unmount();

    // --- 3. material tab with NO orphan line --------------------------------
    // The same material state as (1), minus the one sub-branch that renders a
    // differently-classed paragraph.
    const noOrphans = render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 40, revenue: 100, id: "p1" }),
          entryForMaterial("PETG", { profit: 20, revenue: 100, id: "p2" }),
        ]}
      />,
    );

    expect(
      within(screen.getByRole("tabpanel")).queryByTestId(
        "profit-analytics-orphan-count",
      ),
    ).not.toBeInTheDocument();
    expect(noOrphans.container.querySelectorAll("[data-row-key]")).toHaveLength(
      2,
    );

    expect(noOrphans.container.innerHTML).not.toMatch(HEX);
    noOrphans.unmount();

    // --- 4. empty state -----------------------------------------------------
    // Today `entries.length === 0` returns null, so this is vacuous by
    // construction. It is kept deliberately: the first version of this file
    // proved nothing about a state that renders, and the empty state is the
    // first thing a later change ("show a helpful hint instead of nothing")
    // would touch.
    const empty = render(<ProfitAnalyticsModule entries={[]} />);
    expect(empty.container).toBeEmptyDOMElement();
    expect(empty.container.innerHTML).not.toMatch(HEX);
  });
});

describe("ProfitAnalyticsModule — troca de aba", () => {
  it("11. trocar de aba reordena o painel sem remontar o componente", async () => {
    const user = userEvent.setup();
    render(
      <ProfitAnalyticsModule
        entries={[
          entryForMaterial("PLA Silk", { profit: 40 }),
          entryForMaterial("PETG", { profit: 60 }),
        ]}
      />,
    );

    const section = screen.getByTestId("profit-analytics");
    expect(
      section.querySelector('[data-testid="profit-analytics-row-pla_silk"]'),
    ).not.toBeNull();

    await user.click(screen.getByTestId("profit-analytics-tab-printer"));

    // Same DOM node: the section identity proves no unmount happened.
    expect(screen.getByTestId("profit-analytics")).toBe(section);
    // The previous panel's rows are gone, not merely hidden.
    expect(
      section.querySelector('[data-testid="profit-analytics-row-pla_silk"]'),
    ).toBeNull();
    expect(
      section.querySelector(
        '[data-testid="profit-analytics-row-bambu_a1_mini"]',
      ),
    ).not.toBeNull();
  });
});

describe("ProfitAnalyticsModule — ARIA", () => {
  it("12. monta a relação tablist / tab / tabpanel completa", async () => {
    const user = userEvent.setup();
    render(
      <ProfitAnalyticsModule
        entries={[entryForMaterial("PLA Silk", { profit: 40 })]}
      />,
    );

    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAccessibleName("history.analytics.tabsLabel");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("aria-controls", "profit-analytics-panel");
    }
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "profit-analytics-panel");
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0]!.id);

    await user.click(tabs[1]!);
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      tabs[1]!.id,
    );
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });
});

describe("ProfitAnalyticsModule — regra A1", () => {
  it("13. receita exibida é entry.sellPrice por unidade, nunca ×quantity", () => {
    render(
      <ProfitAnalyticsModule
        entries={[
          makeEntry({
            sellPrice: 100,
            profit: 40,
            totalCost: 60,
            snapshot: makeSnapshot({ quantity: 10 }),
          }),
        ]}
      />,
    );

    const row = screen.getByTestId("profit-analytics-row-pla_silk");
    // Regex, not an exact string: the metric reads
    // "rowRevenue: R$ 100.00" as one element's text, split across text nodes.
    // Per unit: R$ 100,00. ×10 would read R$ 1000,00.
    expect(within(row).getByText(/R\$ 100\.00/)).toBeInTheDocument();
    expect(within(row).queryByText(/R\$ 1000\.00/)).toBeNull();
    // And the profit is per unit too — 40, not 400.
    expect(within(row).getByText(/R\$ 40\.00/)).toBeInTheDocument();
    expect(within(row).queryByText(/R\$ 400\.00/)).toBeNull();
  });
});

describe("ProfitAnalyticsModule — rótulo acessível da barra", () => {
  it("14. nomeia o fill com role=img + aria-label, não com title", () => {
    render(
      <ProfitAnalyticsModule
        entries={[entryForMaterial("PLA Silk", { profit: 50, revenue: 80 })]}
      />,
    );

    // 50/80 = 62.5%. `title=` would not be an accessible name here.
    expect(
      screen.getByRole("img", { name: "PLA Silk: 62.5%" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("img", { name: "PLA Silk: 62.5%" })
        .getAttribute("title"),
    ).toBeNull();
  });
});

describe("ProfitAnalyticsModule — KPIs", () => {
  it("15. a margem ponderada vem das linhas de impressora, não das de material", () => {
    // Both printers in one bucket, so the printer rows and the entries agree —
    // the margin is 50/150. `byMaterial` also sums to 150 here, which is what
    // makes the assertion below a real guard: mutate the component to read the
    // material rows and this still passes unless the material set differs, so
    // the orphan below is the load-bearing half.
    const withOrphan = [
      entryForMaterial("PLA Silk", { profit: 50, revenue: 100 }),
      entryForMaterial("PETG", { profit: 50, revenue: 100 }),
      makeEntry({
        id: "orphan",
        snapshot: null,
        sellPrice: 100,
        profit: 100,
        totalCost: 0,
      }),
    ];
    render(<ProfitAnalyticsModule entries={withOrphan} />);

    // Printer rows cover all three entries (byPrinter files the orphan under
    // "unknown"), so the weighted margin is 200/300 = 66.67%.
    // Material rows exclude the orphan, so they would read 100/200 = 50%.
    expect(
      screen.getByTestId("profit-analytics-kpi-weighted-margin"),
    ).toHaveTextContent("66.7%");
    expect(
      screen.getByTestId("profit-analytics-kpi-weighted-margin"),
    ).not.toHaveTextContent("50.0%");
  });

  it("15b. rotula o KPI pelo método, para não colidir com a 'Margem Média' do Dashboard", () => {
    render(
      <ProfitAnalyticsModule
        entries={[entryForMaterial("PLA Silk", { profit: 40 })]}
      />,
    );

    const kpi = screen.getByTestId("profit-analytics-kpi-weighted-margin");
    expect(
      within(kpi).getByText("history.analytics.kpiWeightedMargin"),
    ).toBeInTheDocument();
    // The Dashboard's own card is an unweighted arithmetic mean (Dashboard.tsx:160-166).
    expect(kpi).not.toHaveTextContent("dashboard.kpis.avgMargin");
  });
});

describe("ProfitAnalyticsModule — uma única entrada", () => {
  it("16. uma entrada produz uma linha por modo, barra em 100%, e nenhum NaN/Infinity", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProfitAnalyticsModule
        entries={[entryForMaterial("PLA Silk", { profit: 40 })]}
      />,
    );

    expect(
      screen.getByRole("tabpanel").querySelectorAll("[data-row-key]"),
    ).toHaveLength(1);
    expect((screen.getByRole("img") as HTMLElement).style.width).toBe("100%");

    await user.click(screen.getByTestId("profit-analytics-tab-printer"));
    expect(
      screen.getByRole("tabpanel").querySelectorAll("[data-row-key]"),
    ).toHaveLength(1);
    expect(screen.getByRole("img").getAttribute("style")).toContain(
      "width: 100%",
    );

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });
});
