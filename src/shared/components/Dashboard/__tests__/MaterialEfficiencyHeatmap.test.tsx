import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MaterialEfficiencyHeatmap } from "../MaterialEfficiencyHeatmap";
import { WEIGHT_BUCKETS } from "@/shared/hooks/useHistoryAggregates";
import {
  AA_NORMAL_TEXT,
  compositeOver,
  contrastRatio,
  resolveTokenHex,
  resolveTokenLayers,
} from "@/shared/__tests__/helpers/contrast";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import type {
  CalculationResult,
  CalculationSnapshot,
  HistoryEntry,
} from "@/shared/types";

// ---------------------------------------------------------------------------
// External dependencies. The component is deliberately free of both: it takes
// `entries` as a prop rather than reading `useHistoryStore` (the Dashboard owns
// the date filter, and the `useHistoryAggregates()` envelope reads the store raw
// at `useHistoryAggregates.ts:608`), so it stays testable with neither a store
// nor an i18n provider.
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
 * There is no i18next instance here, so `t` cannot pluralize on its own: it
 * returns the key it was handed. Recording the arguments is what lets the
 * orphan and band tests assert what the component actually decides — which key,
 * and with which `count` — instead of asserting on a plural suffix this mock
 * would have to reimplement to produce.
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

function callsFor(key: string): (Record<string, unknown> | undefined)[] {
  return translateCalls
    .filter(([called]) => called === key)
    .map(([, opts]) => opts);
}

// ---------------------------------------------------------------------------
// Entry factories — copied from ProfitAnalyticsModule.test.tsx:67-179, NOT
// imported from it: a helper living in another suite's `__tests__` folder is a
// hidden coupling that breaks when that suite is refactored.
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
  } as CalculationResult;
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

/**
 * One job, positioned by its own `unitWeight` and its own `profit`.
 *
 * `unitWeight` is the A1 rule (`useHistoryAggregates.ts:24-43`): weight is a
 * per-JOB figure and is never multiplied by `quantity`, so a `quantity: 10`
 * fixture must still aggregate 60 g — not 600 g.
 */
function job(opts: {
  material?: string;
  unitWeight: number;
  profit: number;
  id: string;
  quantity?: number;
  snapshot?: CalculationSnapshot | null;
}): HistoryEntry {
  const sellPrice = 100;
  return {
    id: opts.id,
    timestamp: new Date(2026, 1, 10, 12, 0, 0).getTime(),
    type: "fdm",
    name: "Bracket",
    summary: "",
    totalCost: sellPrice - opts.profit,
    sellPrice,
    profit: opts.profit,
    result: makeResult({
      sellPrice,
      profit: opts.profit,
      totalCost: sellPrice - opts.profit,
      unitWeight: opts.unitWeight,
      totalHoursForProfit: 4,
    }),
    snapshot:
      opts.snapshot === undefined
        ? makeSnapshot({
            fdmMaterial: {
              type: opts.material ?? "PLA Silk",
              weightUsed: opts.unitWeight,
              purgeWeight: 8,
              costPerKg: 90,
              density: 1.24,
              spoolEfficiency: 98,
            },
            quantity: opts.quantity ?? 1,
          })
        : opts.snapshot,
  } as HistoryEntry;
}

beforeEach(() => {
  vi.clearAllMocks();
  translateCalls.length = 0;
});

// ---------------------------------------------------------------------------

describe("MaterialEfficiencyHeatmap — estado vazio", () => {
  it("1. não renderiza nada, e nenhum número, sem entradas", () => {
    const { container } = render(<MaterialEfficiencyHeatmap entries={[]} />);

    expect(container).toBeEmptyDOMElement();
    // A digit anywhere would be the failure mode: an empty history must not
    // read as a grid of zeroes. Swapping the early return for an "empty grid"
    // puts four "0.00" cells per row on screen and fails here.
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe("MaterialEfficiencyHeatmap — órfãs", () => {
  it("2. conta a partir de entries.length quando byMaterial devolve null", () => {
    // No snapshot on any entry, so `byMaterial` returns `null` (`:390`, `:471`)
    // — not `[]`. 3 entries, 0 rows: reading `sum(rows.count)` back would pass
    // `{ count: 0 }` and the orphan line would never render at all.
    const orphans = [
      job({ id: "o1", unitWeight: 40, profit: 10, snapshot: null }),
      job({ id: "o2", unitWeight: 40, profit: 10, snapshot: null }),
      job({ id: "o3", unitWeight: 40, profit: 10, snapshot: null }),
    ];
    const { container } = render(
      <MaterialEfficiencyHeatmap entries={orphans} />,
    );

    // 0 rows and no legend — there is no grid to scale.
    expect(container.querySelectorAll("tr")).toHaveLength(0);
    expect(screen.queryByTestId("heatmap-legend")).not.toBeInTheDocument();
    // The load-bearing assertion: 3, not 0.
    expect(callsFor("history.analytics.orphanCount")).toEqual([{ count: 3 }]);
  });

  it("3. distingue uma órfã de três — o par _one/_other difere e ambos interpolam", () => {
    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "o1", unitWeight: 40, profit: 10, snapshot: null }),
          job({ id: "o2", unitWeight: 40, profit: 10, snapshot: null }),
          job({ id: "o3", unitWeight: 40, profit: 10, snapshot: null }),
          job({ id: "o4", unitWeight: 40, profit: 10, snapshot: null }),
        ]}
      />,
    );
    expect(callsFor("history.analytics.orphanCount")).toEqual([{ count: 4 }]);

    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "solo", unitWeight: 40, profit: 10, snapshot: null }),
        ]}
      />,
    );
    expect(callsFor("history.analytics.orphanCount")).toEqual([
      { count: 4 },
      { count: 1 },
    ]);

    // Two distinct strings that both interpolate `count`. Identical `_one` /
    // `_other` values would pass a key-parity test while printing "3 entrada".
    const analytics = ptBR.history.analytics as unknown as Record<
      string,
      string
    >;
    const enAnalytics = enUS.history.analytics as unknown as Record<
      string,
      string
    >;
    for (const bundle of [analytics, enAnalytics]) {
      expect(bundle.orphanCount_one).not.toBe(bundle.orphanCount_other);
      expect(bundle.orphanCount_one).toContain("{{count}}");
      expect(bundle.orphanCount_other).toContain("{{count}}");
    }
  });
});

describe("MaterialEfficiencyHeatmap — rungs da escala", () => {
  it("4. prejuízo é visível, com cor própria, distinta da melhor e da vazia", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "win", material: "PLA Silk", unitWeight: 20, profit: 60 }),
          job({ id: "lose", material: "PETG", unitWeight: 60, profit: -30 }),
        ]}
      />,
    );

    const loss = screen.getByTestId("heatmap-cell-petg-medium");
    const best = screen.getByTestId("heatmap-cell-pla_silk-light");

    // The negative value is IN THE TEXT, not merely coloured: -30 / 60 g.
    expect(loss.textContent).toContain("R$ -0.50");
    expect(loss.getAttribute("data-rung")).toBe("loss");
    expect(best.getAttribute("data-rung")).toBe("best");

    // Three distinct rungs => three distinct class strings. Collapsing loss
    // into the cold end of a sequential scale (`Math.min(1, ppg / max)`, the
    // prototype's `:137-148`) makes `data-rung` "weak" and fails here.
    const classOf = (el: HTMLElement): string =>
      el.querySelector("button, div")?.className ?? "";
    expect(new Set([classOf(loss), classOf(best)]).size).toBe(2);
    expect(container.innerHTML).not.toContain("Math.min");
  });

  it("5. lucro zero com count > 0 é o rung neutro, não o de vazio", () => {
    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "win", material: "PLA Silk", unitWeight: 20, profit: 60 }),
          // Breaks even: 0 profit over 60 g => profitPerGram is exactly 0, and
          // `count` is 1. Using `count === 0` as the ONLY emptiness test would
          // put this in "empty"; using `profitPerGram === 0` would.
          job({ id: "flat", material: "PLA Silk", unitWeight: 60, profit: 0 }),
        ]}
      />,
    );

    const flat = screen.getByTestId("heatmap-cell-pla_silk-medium");
    expect(flat.textContent).toContain("R$ 0.00");
    expect(flat.getAttribute("data-rung")).toBe("weak");
    expect(flat.getAttribute("data-rung")).not.toBe("empty");
    // It is a real measurement, so the job count IS printed.
    expect(flat.textContent).toContain("history.analytics.jobCount");
    // The band with no jobs at all is the one that reads empty.
    expect(
      screen
        .getByTestId("heatmap-cell-pla_silk-heavy")
        .getAttribute("data-rung"),
    ).toBe("empty");
  });

  it("6. faixa vazia mostra rótulo e NENHUM número — nunca 0,00", () => {
    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "one", material: "PLA Silk", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    const empty = screen.getByTestId("heatmap-cell-pla_silk-medium");
    expect(empty.textContent).toContain("history.heatmap.cellEmpty");
    // The whole failure surface: rendering an unpopulated cell as its zero
    // value prints "R$ 0.00" and this regex catches it.
    expect(empty.textContent).not.toMatch(/\d/);
    expect(empty.textContent).not.toContain("0.00");
    // And it is not a button — there is nothing to drill into.
    expect(
      screen.queryByTestId("heatmap-cell-button-pla_silk-medium"),
    ).not.toBeInTheDocument();
  });

  it("7. grade 1×1 tem 1 linha, 4 células, 3 vazias e nenhum NaN/Infinity", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "solo", material: "PLA Silk", unitWeight: 20, profit: 6 }),
        ]}
      />,
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelectorAll("tbody td")).toHaveLength(4);
    expect(
      container.querySelectorAll('tbody td[data-rung="empty"]'),
    ).toHaveLength(3);
    // A single cell makes `best` equal to that cell, so any `best / 2` or
    // invented floor (`Math.max(1, …)`, prototype `:137`) shows up here.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/NaN|Infinity|-Infinity/);
  });
});

describe("MaterialEfficiencyHeatmap — superfície de cor", () => {
  it("8. nenhum hex em 4 estados, cada um com asserção de não-vacuidade", () => {
    // `designTokenMigration.test.ts` is a 15-file allowlist and does NOT cover
    // this component, so this is the only net against a raw hex slipping in.
    const states: ReadonlyArray<{ name: string; entries: HistoryEntry[] }> = [
      {
        name: "métrica alta",
        entries: [
          job({ id: "hi", material: "PLA Silk", unitWeight: 20, profit: 600 }),
        ],
      },
      {
        name: "negativa",
        entries: [
          job({ id: "neg", material: "PETG", unitWeight: 60, profit: -300 }),
        ],
      },
      {
        name: "tudo vazio",
        entries: [
          job({ id: "e1", unitWeight: 20, profit: 10, snapshot: null }),
          job({ id: "e2", unitWeight: 20, profit: 10, snapshot: null }),
        ],
      },
      {
        name: "1×1",
        entries: [
          job({ id: "solo", material: "PLA Silk", unitWeight: 20, profit: 6 }),
        ],
      },
    ];

    for (const state of states) {
      const { container, unmount } = render(
        <MaterialEfficiencyHeatmap entries={state.entries} />,
      );
      // Non-vacuity, per state. `innerHTML` of an empty container is "" and
      // matches no hex, so without this the assertion below would pass for the
      // wrong reason.
      expect(
        container.innerHTML.length,
        `estado "${state.name}" renderizou vazio`,
      ).toBeGreaterThan(0);
      expect(
        container.innerHTML,
        `estado "${state.name}" não renderizou nada`,
      ).toContain("<");

      const hex = container.innerHTML.match(/#[0-9a-fA-F]{3,8}\b/);
      expect(hex, `hex cru no estado "${state.name}": ${hex?.[0]}`).toBeNull();
      unmount();
    }
  });
});

describe("MaterialEfficiencyHeatmap — paridade de locale", () => {
  it("9. en-US tem as mesmas chaves que pt-BR em history.heatmap, nenhuma em branco", () => {
    // Only `tutorial.launcher` has an automatic parity lock, and putting these
    // under `history.analytics` would break the `toHaveLength(24)` guard in
    // ProfitAnalyticsModule.test.tsx:298. A new namespace touches neither, so
    // this comparison is the only net — a key missing in en-US renders raw.
    const pt = ptBR.history.heatmap as Record<string, string>;
    const en = enUS.history.heatmap as Record<string, string>;

    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.keys(pt)).toHaveLength(11);

    // Key parity alone is weak: a key present in both with a blank value on one
    // side satisfies the comparison above and renders an empty label.
    const blankIn = (bundle: Record<string, string>): string[] =>
      Object.entries(bundle)
        .filter(([, value]) => typeof value !== "string" || value.trim() === "")
        .map(([key]) => key);

    expect(blankIn(pt)).toEqual([]);
    expect(blankIn(en)).toEqual([]);
  });

  it("10. as 4 chaves history.aggregates.weight.* seguem íntegras e resolvidas por t(bucket.labelKey)", () => {
    const weightPt = (ptBR.history.aggregates as Record<string, unknown>)
      .weight as Record<string, string>;
    const weightEn = (enUS.history.aggregates as Record<string, unknown>)
      .weight as Record<string, string>;

    // The buckets still point at those keys, unmodified. Truncating
    // WEIGHT_BUCKETS or hardcoding a pt-BR literal breaks this.
    expect(WEIGHT_BUCKETS.map((b) => b.labelKey)).toEqual([
      "history.aggregates.weight.light",
      "history.aggregates.weight.medium",
      "history.aggregates.weight.heavy",
      "history.aggregates.weight.bulk",
    ]);
    expect(Object.keys(weightPt).sort()).toEqual([
      "bulk",
      "heavy",
      "light",
      "medium",
    ]);
    expect(Object.keys(weightEn).sort()).toEqual([
      "bulk",
      "heavy",
      "light",
      "medium",
    ]);

    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "one", material: "PLA Silk", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    // Each band header went through `t(bucket.labelKey)`.
    for (const bucket of WEIGHT_BUCKETS) {
      expect(callsFor(bucket.labelKey).length).toBeGreaterThan(0);
      expect(
        screen.getByRole("columnheader", { name: bucket.labelKey }),
      ).toBeInTheDocument();
    }
  });
});

describe("MaterialEfficiencyHeatmap — acessibilidade", () => {
  it("11. <table> semântica, sem role=grid, com th scope=col nas 4 faixas", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "one", material: "PLA Silk", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("caption")).not.toBeNull();
    // ROADMAP:1464 asked for `role="grid"`. The five shipped tables have none
    // and arrow-key navigation in this app belongs to tablists
    // (CatalogTab.tsx:41-44), not to a grid.
    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    for (const bucket of WEIGHT_BUCKETS) {
      const th = screen.getByRole("columnheader", { name: bucket.labelKey });
      expect(th.getAttribute("scope")).toBe("col");
    }
    // The row header stays a row header: the ProfitAnalytics `role="group"` on
    // an `<li>` does not port to a `<tr>`, which would kill the `row` role.
    const rowHeader = screen.getByRole("rowheader");
    expect(rowHeader.getAttribute("scope")).toBe("row");
  });

  it("12. a célula anuncia o valor por texto, o botão tem aria-label, e não há title=", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "one", material: "PLA Silk", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    // 60 / 20 g = 3.00. The value is native text, so a screen reader announces
    // it in table context with no ARIA at all.
    const cell = screen.getByTestId("heatmap-cell-pla_silk-light");
    expect(cell.textContent).toContain("R$ 3.00");

    const button = screen.getByTestId("heatmap-cell-button-pla_silk-light");
    expect(button.getAttribute("aria-label")).toBe("history.heatmap.cellLabel");
    expect(callsFor("history.heatmap.cellLabel")).toEqual([
      {
        material: expect.any(String),
        band: "history.aggregates.weight.light",
        value: "R$ 3.00",
        count: 1,
      },
    ]);

    // `title=` is the prototype's anti-pattern (`:348`) and is not an
    // accessible name. One anywhere in the tree fails this.
    expect(container.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("13. a legenda nomeia os 4 rungs em texto, em ordem, sem title no swatch", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "one", material: "PLA Silk", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    const legend = screen.getByTestId("heatmap-legend");
    const items = Array.from(legend.querySelectorAll("li"));
    expect(items).toHaveLength(4);
    // Document order: prejuízo, fraco, forte, melhor.
    expect(items.map((li) => li.textContent)).toEqual([
      "history.heatmap.legendLoss",
      "history.heatmap.legendWeak",
      "history.heatmap.legendStrong",
      "history.heatmap.legendBest",
    ]);
    // The swatch is decorative; the NAME is the text beside it, not `title`.
    const swatches = legend.querySelectorAll("span[aria-hidden='true']");
    expect(swatches).toHaveLength(4);
    for (const swatch of swatches) {
      expect(swatch.getAttribute("title")).toBeNull();
    }
    expect(container.querySelectorAll("[title]")).toHaveLength(0);
  });
});

describe("MaterialEfficiencyHeatmap — regra A1", () => {
  it("14. quantity 10 não multiplica o peso: a célula fica em 'medium' e o valor é por grama", () => {
    render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({
            id: "batch",
            material: "PLA Silk",
            unitWeight: 60,
            profit: 60,
            quantity: 10,
          }),
        ]}
      />,
    );

    // 60 g per job => [50,150) => medium. ×10 would be 600 g => "bulk", and the
    // prototype's `printWeightGrams * quantity` (`:98-99`) put it there.
    const medium = screen.getByTestId("heatmap-cell-pla_silk-medium");
    expect(medium).toBeInTheDocument();
    expect(screen.queryByTestId("heatmap-cell-pla_silk-bulk")).toHaveAttribute(
      "data-rung",
      "empty",
    );

    // 60 / 60 g = 1.00. With ×10 the grams would be 600 and this would read
    // 0.10 — a ten-fold lie about efficiency.
    expect(medium.textContent).toContain("R$ 1.00");
    expect(medium.textContent).not.toContain("R$ 0.10");
  });
});

describe("MaterialEfficiencyHeatmap — drill-down e piso da escala", () => {
  it("18. o drill-down abre na célula, pinta pelo sinal e fecha", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "win", material: "PLA Silk", unitWeight: 20, profit: 60 }),
          job({ id: "lose", material: "PETG", unitWeight: 60, profit: -30 }),
        ]}
      />,
    );

    expect(screen.queryByTestId("heatmap-drilldown")).not.toBeInTheDocument();

    // The losing cell first: the prototype painted a negative ROI with
    // `text-emerald-400` (`:404`), so the colour is the thing under test here.
    await user.click(screen.getByTestId("heatmap-cell-button-petg-medium"));

    const panel = screen.getByTestId("heatmap-drilldown");
    expect(panel.getAttribute("aria-live")).toBe("polite");
    expect(panel.textContent).toContain("PETG");
    expect(panel.textContent).toContain("history.aggregates.weight.medium");
    expect(panel.textContent).toContain("R$ -0.50");
    // Colour by SIGN, not by a fixed success colour.
    expect(panel.innerHTML).toContain("text-[var(--color-danger)]");
    expect(panel.innerHTML).not.toContain("text-[var(--color-success)]");
    // No invented `+` sign: the prototype forced one onto negative cells too
    // (`:305`, `:408`), which is a lie about direction.
    expect(panel.textContent).not.toMatch(/\+\s*R\$/);

    // A profitable cell reads the other colour.
    await user.click(screen.getByTestId("heatmap-cell-button-pla_silk-light"));
    expect(screen.getByTestId("heatmap-drilldown").innerHTML).toContain(
      "text-[var(--color-success)]",
    );

    await user.click(
      within(screen.getByTestId("heatmap-drilldown")).getByRole("button", {
        name: "common.close",
      }),
    );
    expect(screen.queryByTestId("heatmap-drilldown")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("19. uma linha que não ganha nada nunca recebe o rung 'melhor'", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          // Best is -0.50 and 0.00; the zero-anchored `max(0, best)` is 0, so
          // there is no "melhor" to award and the floor rung is "fraco".
          job({ id: "flat", material: "PLA Silk", unitWeight: 20, profit: 0 }),
          job({ id: "neg", material: "PLA Silk", unitWeight: 60, profit: -30 }),
        ]}
      />,
    );

    const flat = screen.getByTestId("heatmap-cell-pla_silk-light");
    const neg = screen.getByTestId("heatmap-cell-pla_silk-medium");

    expect(flat.getAttribute("data-rung")).toBe("weak");
    expect(neg.getAttribute("data-rung")).toBe("loss");
    // The highlight rung must be unreachable when nothing beat zero: without
    // the `best <= 0` guard the zero cell would divide to `ppg < best / 2` as
    // `0 < 0`, read false, and paint itself "forte" — or worse, "melhor".
    expect(container.querySelectorAll('[data-rung="best"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-rung="strong"]')).toHaveLength(0);
  });
});

describe("MaterialEfficiencyHeatmap — ordenação", () => {
  it("17. ordena por melhor lucro por grama da linha, desc, com key asc no empate", () => {
    // `byMaterial` hands back Map INSERTION order (`useHistoryAggregates.ts:473`)
    // and does not sort, so the order on screen is decided entirely here.
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          // Insertion order is pla, petg, abs — deliberately NOT the display
          // order, so an unsorted component is caught.
          job({ id: "a", material: "PLA Silk", unitWeight: 20, profit: 20 }),
          // 60/20 g = 3.00
          job({ id: "b", material: "PETG", unitWeight: 20, profit: 60 }),
          // 60/20 g = 3.00 too — a tie with PETG, broken by key: "abs" < "petg".
          job({ id: "c", material: "ABS", unitWeight: 20, profit: 60 }),
        ]}
      />,
    );

    const keys = Array.from(
      container.querySelectorAll("[data-testid^='heatmap-row-']"),
    ).map((row) =>
      row.getAttribute("data-testid")?.replace("heatmap-row-", ""),
    );
    // PETG and ABS both reach 3.00 and sort above PLA's 1.00; the tie is
    // resolved by key ascending, so the order is reproducible between renders.
    expect(keys).toEqual(["abs", "petg", "pla_silk"]);
  });
});

describe("MaterialEfficiencyHeatmap — superfície e contraste", () => {
  it("15. sem Recharts: nenhum wrapper .recharts é montado", () => {
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "win", material: "PLA Silk", unitWeight: 20, profit: 60 }),
          job({ id: "loss", material: "PETG", unitWeight: 60, profit: -30 }),
        ]}
      />,
    );

    // The component is `div`s with a class; `RechartsLazy.tsx` needs no new
    // export and the charting library must not load for this panel.
    expect(container.querySelector(".recharts-wrapper")).toBeNull();
  });

  it("16. os 5 pares medidos no Passo 1 são os que o componente emite, e todos passam 4.5:1", () => {
    // One render that exercises all five rungs at once.
    const { container } = render(
      <MaterialEfficiencyHeatmap
        entries={[
          job({ id: "a", material: "PLA Silk", unitWeight: 20, profit: 60 }),
          job({ id: "b", material: "PLA Silk", unitWeight: 60, profit: 15 }),
          job({ id: "c", material: "PLA Silk", unitWeight: 200, profit: 400 }),
          job({ id: "d", material: "PETG", unitWeight: 60, profit: -30 }),
        ]}
      />,
    );

    // rung -> the background/ink pair the design note specifies. These are the
    // pairs whose ratios are published in the component's header comment.
    const EXPECTED: Record<
      string,
      { bg: string; ink: string; light: number; dark: number }
    > = {
      loss: {
        bg: "--color-danger-muted",
        ink: "--color-danger",
        light: 5.89,
        dark: 8.52,
      },
      empty: {
        bg: "--surface-sunken",
        ink: "--color-text-muted",
        light: 5.17,
        dark: 7.85,
      },
      weak: {
        bg: "--color-warning-muted",
        ink: "--color-warning",
        light: 6.84,
        dark: 8.83,
      },
      strong: {
        bg: "--color-success-muted",
        ink: "--color-success",
        light: 5.21,
        dark: 7.83,
      },
      best: {
        bg: "--color-success",
        ink: "--color-text-inverse",
        light: 5.48,
        dark: 10.23,
      },
    };

    // Every rung is present in this render, or the sweep below is vacuous.
    const present = new Set(
      Array.from(container.querySelectorAll("[data-rung]")).map((el) =>
        el.getAttribute("data-rung"),
      ),
    );
    expect([...present].sort()).toEqual([
      "best",
      "empty",
      "loss",
      "strong",
      "weak",
    ]);

    // `__tests__` -> Dashboard -> components -> shared -> src
    const css = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "styles", "tokens.css"),
      "utf8",
    );

    for (const [rung, pair] of Object.entries(EXPECTED)) {
      const cell = container.querySelector(`[data-rung="${rung}"]`);
      const box = cell?.querySelector("button, div");
      const className = box?.className ?? "";
      // The component EMITS the measured pair, rather than merely mentioning it
      // in a comment.
      expect(className, `rung ${rung} não usa ${pair.bg}`).toContain(
        `bg-[var(${pair.bg})]`,
      );
      expect(className, `rung ${rung} não usa ${pair.ink}`).toContain(
        `text-[var(${pair.ink})]`,
      );

      for (const theme of ["light", "dark"] as const) {
        const bgLayers = resolveTokenLayers(css, theme, pair.bg);
        const inkHex = resolveTokenHex(css, theme, pair.ink);
        expect(bgLayers, `${pair.bg} não resolve em ${theme}`).not.toBeNull();
        expect(inkHex, `${pair.ink} não resolve em ${theme}`).not.toBeNull();

        // A wash has no single colour, so composite it over the panel surface
        // before measuring — the same maths the published numbers used.
        const panel = resolveTokenHex(css, theme, "--color-bg-surface")!;
        const bg =
          bgLayers!.alpha < 1 ? compositeOver(bgLayers!, panel) : bgLayers!.hex;
        const measured = contrastRatio(inkHex!, bg);

        expect(
          measured,
          `${rung} em ${theme}: ${measured.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        // The published number is the measured one, to 2dp.
        expect(measured).toBeCloseTo(pair[theme], 1);
      }
    }
  });
});
