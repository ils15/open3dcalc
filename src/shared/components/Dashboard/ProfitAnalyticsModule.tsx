import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Printer, TrendingUp } from "lucide-react";

import {
  byMaterial,
  byPrinter,
  type MaterialAggregate,
  type PrinterAggregate,
} from "@/shared/hooks/useHistoryAggregates";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { formatWeight } from "@/shared/lib/format";
import type { HistoryEntry } from "@/shared/types";

export interface ProfitAnalyticsModuleProps {
  /**
   * The already-filtered history, not the store.
   *
   * `useHistoryAggregates()` would read `useHistoryStore(s => s.entries)` raw
   * (`:591`) and ignore the Dashboard's date-range filter
   * (`Dashboard.tsx:93-103`), while the KPI row above this section is computed
   * from that filter. The section would answer a different question than the
   * cards beside it, on the same screen. Taking `entries` as a prop keeps the
   * panel and the cards on one answer, and keeps the component testable with
   * neither a store nor an i18n provider: the two aggregators below are pure
   * functions handed `t` as an argument.
   */
  readonly entries: readonly HistoryEntry[];
  readonly className?: string;
}

type AnalyticsViewMode = "material" | "printer";

/**
 * One bar row, normalized across both views.
 *
 * `MaterialAggregate` has no margin field, so `marginPercent` is derived here
 * from the cell sums rather than added to the hook: the hook is the single
 * owner of "what an aggregate is", and a derived ratio for one consumer is not
 * an aggregate.
 */
interface AnalyticsRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly revenue: number;
  readonly profit: number;
  /** `profit / revenue * 100`, 0 when revenue is not positive. */
  readonly marginPercent: number;
  readonly hours: number;
  readonly profitPerHour: number;
  /** Material rows only; printers have no weight breakdown to show. */
  readonly totalGrams: number | null;
}

const VIEW_OPTIONS: readonly {
  readonly mode: AnalyticsViewMode;
  readonly labelKey: string;
  readonly icon: typeof Layers;
}[] = [
  { mode: "material", labelKey: "history.analytics.tabMaterial", icon: Layers },
  { mode: "printer", labelKey: "history.analytics.tabPrinter", icon: Printer },
];

/**
 * One hue, four alpha steps, applied as `opacity-*` over `bg-[var(--accent)]`.
 *
 * The bar fill is a graphical object, so WCAG 1.4.11 wants 3:1 against the
 * track behind it. Measured (`src/shared/__tests__/helpers/contrast.ts` maths,
 * accent composited over the track token):
 *
 *   step        light          dark
 *   opacity-100  5.51:1        6.75:1
 *   opacity-90   4.60:1        5.63:1
 *   opacity-80   3.81:1        4.60:1
 *   opacity-70   3.17:1        3.75:1
 *
 * Every rung clears 3:1 in both themes. This is why the track is
 * `--surface-sunken` and not the `--surface-overlay` that
 * `CostDistributionBars.tsx:73` uses: against `--surface-overlay` the alpha
 * floor for 3:1 is 0.65 light / 0.62 dark, which leaves the ladder a single
 * usable step. A groove is sunken anyway.
 *
 * The ladder is clamped by rank, not stretched by row count: rows past rank 3
 * share `opacity-70`, because bar length — not luminance — carries the ranking.
 * Luminance reinforces the order at the top of the list, where a reader
 * comparing two lengths by eye is least reliable, and it stays out of the way
 * everywhere else.
 */
const RANK_FILL_CLASS: readonly string[] = [
  "opacity-100",
  "opacity-90",
  "opacity-80",
  "opacity-70",
];

function rankFillClass(rank: number): string {
  return RANK_FILL_CLASS[Math.min(rank, RANK_FILL_CLASS.length - 1)]!;
}

/** `numerator / denominator * 100`, `0` when the denominator is not positive. */
function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

/** `numerator / denominator`, `0` when the denominator is not positive. */
function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Bar width as a share of the best row in this view, clamped to `[0, 100]`.
 *
 * Relative in BOTH modes. The prototype mixed the two: the material bar drew
 * absolute margin as a percentage of its own width
 * (`Example/src/components/ProfitAnalyticsModule.tsx:410`), while the printer bar
 * drew `profitPerHour / max`
 * (`Example/src/components/ProfitAnalyticsModule.tsx:482`), then labelled both
 * "relativa" / "Eficiência". Two bar scales sharing one screen is the bug;
 * picking the relative rule removes it.
 *
 * There is no invented floor (`Math.max(1, …)` is what made the prototype's
 * bars look nearly identical whenever the best margin was under 1). A
 * non-positive best means there is nothing to be relative to, so every bar
 * reads 0 — the same outcome `CostDistributionBars` gives for a zero total,
 * and never `NaN`.
 */
function shareOfBest(value: number, best: number): number {
  if (!(best > 0) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, ratio(value, best) * 100));
}

function toMaterialRow(aggregate: MaterialAggregate): AnalyticsRow {
  const revenue = aggregate.cells.reduce((sum, cell) => sum + cell.revenue, 0);
  const profit = aggregate.cells.reduce((sum, cell) => sum + cell.profit, 0);
  return {
    key: aggregate.key,
    label: aggregate.label,
    count: aggregate.count,
    revenue,
    profit,
    marginPercent: percent(profit, revenue),
    hours: aggregate.hours,
    profitPerHour: aggregate.profitPerHour,
    totalGrams: aggregate.cells.reduce((sum, cell) => sum + cell.totalGrams, 0),
  };
}

function toPrinterRow(aggregate: PrinterAggregate): AnalyticsRow {
  return {
    key: aggregate.printerId,
    label: aggregate.name,
    count: aggregate.count,
    revenue: aggregate.revenue,
    profit: aggregate.profit,
    marginPercent: aggregate.marginPercent,
    hours: aggregate.hours,
    profitPerHour: aggregate.profitPerHour,
    totalGrams: null,
  };
}

/**
 * Profitability by material and by printer, as CSS bars.
 *
 * Zero charting library: the whole module is `div`s with an inline `width`,
 * the pattern `CostDistributionBars.tsx:62-83` sets. Two tabs, not three: the
 * prototype's "top lucrativos" job list is out of scope, so the selector does
 * not offer a mode this component cannot answer.
 */
export function ProfitAnalyticsModule({
  entries,
  className,
}: ProfitAnalyticsModuleProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>("material");

  // `byMaterial` and `byPrinter` return `null` for "nothing derivable". An
  // empty array is the same truth told differently, so both shapes are
  // normalized to `[]` here and nothing below re-checks for `null`.
  const materialRows = useMemo(
    () => (byMaterial(entries) ?? []).map(toMaterialRow),
    [entries],
  );

  // `byPrinter` returns `profitPerHour` descending and is left that way:
  // re-sorting here would undo an ordering the hook already owns.
  const printerRows = useMemo(
    () => (byPrinter(entries, t) ?? []).map(toPrinterRow),
    [entries, t],
  );

  // `byMaterial` returns Map insertion order, so ordering is the consumer's.
  // Margin descending, then `key` ascending: without the tiebreak two rows
  // with the same margin would swap between renders and the bar order would
  // not be reproducible.
  const sortedMaterialRows = useMemo(
    () =>
      [...materialRows].sort(
        (a, b) =>
          b.marginPercent - a.marginPercent || a.key.localeCompare(b.key),
      ),
    [materialRows],
  );

  const rows = viewMode === "material" ? sortedMaterialRows : printerRows;

  /**
   * `byPrinter` buckets every entry, including the ones without a snapshot,
   * so its rows cover all of `entries` and `sum(rows.profit) === sum(entries.profit)`.
   * `byMaterial` drops those entries (`:400`) and therefore CANNOT feed a
   * global total — doing so would report a margin that silently excludes part
   * of the shop.
   */
  const totals = useMemo(() => {
    const revenue = printerRows.reduce((sum, row) => sum + row.revenue, 0);
    const profit = printerRows.reduce((sum, row) => sum + row.profit, 0);
    const hours = printerRows.reduce((sum, row) => sum + row.hours, 0);
    return {
      weightedMarginPercent: percent(profit, revenue),
      profitPerHour: ratio(profit, hours),
    };
  }, [printerRows]);

  /**
   * Entries `byMaterial` could not place: no snapshot, no resolvable material
   * type, or an empty normalized key. Counting them as
   * `entries.length - sum(rows.count)` is the only formula that works —
   * `sum(rows.count)` is precisely what went missing, so reading it back
   * reports 0 orphans and hides the gap ROADMAP:1201 requires showing.
   */
  const orphanCount =
    entries.length - materialRows.reduce((sum, row) => sum + row.count, 0);

  const bestMarginPercent = useMemo(
    () =>
      sortedMaterialRows.reduce(
        (best, row) => Math.max(best, row.marginPercent),
        0,
      ),
    [sortedMaterialRows],
  );
  const bestProfitPerHour = useMemo(
    () =>
      printerRows.reduce((best, row) => Math.max(best, row.profitPerHour), 0),
    [printerRows],
  );

  // An empty history is not a chart of zeroes. `byMonth`, `byQuarter` and
  // `CostDistributionBars` all return nothing here for the same reason, and the
  // Dashboard already states the empty case elsewhere.
  if (entries.length === 0) return null;

  const activeTabId = `profit-analytics-tab-${viewMode}`;
  const panelId = "profit-analytics-panel";
  const hoursLabel = t("common.hours");
  const noData = t("common.noData");
  const topMaterial = sortedMaterialRows[0];
  const topPrinter = printerRows[0];

  return (
    <section
      data-testid="profit-analytics"
      aria-label={t("history.analytics.title")}
      className={`surface rounded-xl p-4 ${className ?? ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp
            className="size-5 shrink-0 text-[var(--color-accent)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("history.analytics.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("history.analytics.subtitle")}
            </p>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("history.analytics.scopeFiltered", {
            count: entries.length,
            label: t("common.entries"),
          })}
        </p>
      </header>

      {/*
        tablist, not a group of `aria-pressed` buttons. `aria-pressed` is the
        app's pattern for a filter over content that stays visible
        (`SpoolShelf.tsx:169`, `ResultsSidebar.tsx:96`,
        `LayoutSwitcher.tsx:60`); here exactly one panel exists at a time, which
        is what `role="tab"` is for. Copied from `ResultsSidebar.tsx:138-183`.

        Known deviation, matching that precedent: the APG tabs pattern wants
        arrow-key navigation and a roving tabindex. `ResultsSidebar.tsx:144-162`
        implements neither — these tabs are reached with Tab and activated with
        Enter or Space, both of which a native `<button>` gives for free. The
        deviation is inherited, not introduced.
      */}
      <div
        role="tablist"
        aria-label={t("history.analytics.tabsLabel")}
        className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1"
      >
        {VIEW_OPTIONS.map(({ mode, labelKey, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            role="tab"
            id={`profit-analytics-tab-${mode}`}
            data-testid={`profit-analytics-tab-${mode}`}
            aria-selected={viewMode === mode}
            aria-controls={panelId}
            onClick={() => setViewMode(mode)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
              viewMode === mode
                ? "bg-[var(--color-bg-surface)] font-semibold text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div
          data-testid="profit-analytics-kpi-top-material"
          className="surface rounded-xl p-2.5"
        >
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.kpiTopMaterial")}
          </p>
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {topMaterial ? topMaterial.label : noData}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-secondary)]">
            {topMaterial ? `${topMaterial.marginPercent.toFixed(1)}%` : noData}
          </p>
        </div>

        <div
          data-testid="profit-analytics-kpi-top-printer"
          className="surface rounded-xl p-2.5"
        >
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.kpiTopPrinter")}
          </p>
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {topPrinter ? topPrinter.label : noData}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-secondary)]">
            {topPrinter
              ? `${formatCurrency(topPrinter.profitPerHour)} / ${hoursLabel}`
              : noData}
          </p>
        </div>

        {/*
          Labeled with the method on purpose. The Dashboard already shows an
          average margin twice (`:160-166` in the KPI row, `:960-982` as a card)
          and that number is the arithmetic mean of per-entry margins. This one
          is `sum(profit) / sum(revenue)`, weighted by revenue. Two different
          averages under a similar name is exactly the confusion the explicit
          "ponderada por receita" prevents.
        */}
        <div
          data-testid="profit-analytics-kpi-weighted-margin"
          className="surface rounded-xl p-2.5"
        >
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.kpiWeightedMargin")}
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
            {`${totals.weightedMarginPercent.toFixed(1)}%`}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.kpiWeightedMarginNote")}
          </p>
        </div>

        <div
          data-testid="profit-analytics-kpi-avg-per-hour"
          className="surface rounded-xl p-2.5"
        >
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.kpiAvgPerHour")}
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
            {`${formatCurrency(totals.profitPerHour)} / ${hoursLabel}`}
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={activeTabId}
        className="mt-3 min-w-0"
      >
        <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {viewMode === "material"
            ? t("history.analytics.groupMaterial")
            : t("history.analytics.groupPrinter")}
        </p>

        {rows.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {noData}
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {rows.map((row, index) => {
              const isMaterial = viewMode === "material";
              const width = isMaterial
                ? shareOfBest(row.marginPercent, bestMarginPercent)
                : shareOfBest(row.profitPerHour, bestProfitPerHour);
              // The bar's accessible name is the metric the bar ranks by, not
              // the share: a screen reader should hear the margin, and the
              // surrounding row already states the share. `title=` would not be
              // an accessible name at all.
              const barName = isMaterial
                ? `${row.label}: ${row.marginPercent.toFixed(1)}%`
                : `${row.label}: ${formatCurrency(row.profitPerHour)} / ${hoursLabel}`;

              return (
                <li
                  key={row.key}
                  data-testid={`profit-analytics-row-${row.key}`}
                  data-row-key={row.key}
                  role="group"
                  aria-label={`${row.label}: ${formatCurrency(row.revenue)}`}
                  className="min-w-0 space-y-1"
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
                    <span
                      data-testid="profit-analytics-row-label"
                      className="truncate text-[var(--color-text-secondary)]"
                    >
                      {row.label}
                    </span>
                    {/* The margin is the number the whole view is ranked by, so
                        it is labeled rather than left as a bare percentage
                        beside the material name. */}
                    <span className="shrink-0 font-mono text-[var(--color-text-primary)]">
                      {`${t("history.analytics.rowMargin")}: ${row.marginPercent.toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      role="img"
                      aria-label={barName}
                      className={`h-full rounded-full bg-[var(--color-accent)] ${rankFillClass(index)}`}
                      style={{ width: `${width.toFixed(2)}%` }}
                    />
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
                    <span>
                      {t("history.analytics.jobCount", { count: row.count })}
                    </span>
                    <span>
                      {t("history.analytics.rowRevenue")}:{" "}
                      {formatCurrency(row.revenue)}
                    </span>
                    <span>
                      {t("history.analytics.rowProfit")}:{" "}
                      {formatCurrency(row.profit)}
                    </span>
                    <span>
                      {t("history.analytics.rowPerHour")}:{" "}
                      {`${formatCurrency(row.profitPerHour)} / ${hoursLabel}`}
                    </span>
                    <span>
                      {t("history.analytics.rowHours")}:{" "}
                      {`${row.hours.toFixed(1)} ${hoursLabel}`}
                    </span>
                    {row.totalGrams !== null && (
                      // Grams, not "kg consumidos": the prototype's kg label
                      // restated a number the material efficiency heatmap owns,
                      // and it multiplied by quantity, which the A1 rule forbids.
                      <span>
                        {`${formatWeight(row.totalGrams)} ${t("common.grams")}`}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
          {viewMode === "material"
            ? t("history.analytics.barLegendMaterial")
            : t("history.analytics.barLegendPrinter")}
        </p>

        {/*
          Material mode only. In printer mode every entry already has a row —
          the ones without a snapshot land in the visible, named `unknown`
          bucket — so a count here would report as missing jobs that the panel
          is showing. `byMaterial` drops them (`:400`), which is why the
          formula subtracts from `entries.length`.
        */}
        {viewMode === "material" && orphanCount > 0 && (
          <p
            data-testid="profit-analytics-orphan-count"
            className="mt-1 text-[11px] text-[var(--color-text-muted)]"
          >
            {t("history.analytics.orphanCount", { count: orphanCount })}
          </p>
        )}
      </div>
    </section>
  );
}
