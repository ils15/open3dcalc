import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid3x3, X } from "lucide-react";

import {
  byMaterial,
  WEIGHT_BUCKETS,
  type MaterialAggregate,
  type MaterialCell,
} from "@/shared/hooks/useHistoryAggregates";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { HistoryEntry } from "@/shared/types";

export interface HeatmapSelection {
  readonly materialKey: string;
  readonly materialLabel: string;
  readonly bracketLabel: string;
  readonly cell: MaterialCell;
}

export interface MaterialEfficiencyHeatmapProps {
  /**
   * The already-filtered history, not the store.
   *
   * Same reason, and therefore the same contract, as
   * `ProfitAnalyticsModuleProps.entries`: the `useHistoryAggregates()`
   * envelope reads `useHistoryStore` raw (`:608`) and ignores the Dashboard's
   * date filter (`Dashboard.tsx:94-104`), so a section fed by it would answer a
   * different question than the cards above it on the same screen.
   */
  readonly entries: readonly HistoryEntry[];
  readonly className?: string;
}

type HeatmapRung = "loss" | "empty" | "weak" | "strong" | "best";

/**
 * The five rungs of a DIVERGENT scale anchored at zero, not a sequential one.
 *
 * `HistoryEntry.profit` is a plain `number` (`types/index.ts:318`) and selling
 * below cost is the case this app exists to prevent, so `profitPerGram` can be
 * negative and has to be legible as such. The prototype's one-directional scale
 * (`Example/…/MaterialEfficiencyHeatmap.tsx:137-148`) had cuts at
 * 0.25/0.40/0.60/0.80, which drops a negative value into the coldest bucket —
 * indistinguishable from a cell near zero — while the legend calls that rung
 * "Baixo", a false claim. The app already branches on sign where it matters
 * (`Dashboard.tsx:704`, `:780`).
 *
 * MEASURED, not estimated (`src/shared/__tests__/helpers/contrast.ts` maths,
 * compositing each background over the panel surface `--color-bg-surface`):
 *
 *   rung        background            ink                   light    dark
 *   prejuízo    --color-danger-muted   --color-danger         5.89:1  8.52:1
 *   vazio       --surface-sunken       --color-text-muted     5.17:1  7.85:1
 *   fraco       --color-warning-muted  --color-warning        6.84:1  8.83:1
 *   forte       --color-success-muted  --color-success        5.21:1  7.83:1
 *   melhor      --color-success        --color-text-inverse   5.48:1 10.23:1
 *
 * Every pair clears AA_NORMAL_TEXT (4.5:1) in both themes. **Light is the
 * reference theme**: it is the default, and in all five rows the light ratio is
 * the lower of the two, so light passing is what makes dark pass.
 *
 * Two of these names are not the ones the design note named, and measurement is
 * why. `--color-positive` is declared only inside `@theme inline`
 * (`tokens.css:557`) — a Tailwind build-time mapping, not a runtime custom
 * property, so `bg-[var(--color-positive)]` would paint nothing — and
 * `--color-positive-muted` does not exist anywhere in the repo. The runtime
 * alias layer (`tokens.css:510-516`) already exposes both roles as
 * `--color-success` / `--color-success-muted`, mirroring
 * `--color-warning-muted` and `--color-danger-muted`, so those are the names
 * used here.
 *
 * The "melhor" ink was resolved by measurement rather than invented. The
 * obvious guess, `--color-text-primary`, FAILS on this background in both
 * themes (3.23:1 light, 1.75:1 dark). `--color-text-inverse` is the token whose
 * job is "text on a saturated fill", and it flips per theme on its own.
 */
const RUNG_CLASS: Record<HeatmapRung, { cell: string; swatch: string }> = {
  loss: {
    cell: "bg-[var(--color-danger-muted)] text-[var(--color-danger)]",
    swatch: "bg-[var(--color-danger-muted)]",
  },
  empty: {
    cell: "bg-[var(--surface-sunken)] text-[var(--color-text-muted)]",
    swatch: "bg-[var(--surface-sunken)]",
  },
  weak: {
    cell: "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
    swatch: "bg-[var(--color-warning-muted)]",
  },
  strong: {
    cell: "bg-[var(--color-success-muted)] text-[var(--color-success)]",
    swatch: "bg-[var(--color-success-muted)]",
  },
  best: {
    cell: "bg-[var(--color-success)] text-[var(--color-text-inverse)]",
    swatch: "bg-[var(--color-success)]",
  },
};

/** The four rungs the legend names. "vazio" is absence, not a level. */
const LEGEND_RUNGS: readonly { rung: HeatmapRung; labelKey: string }[] = [
  { rung: "loss", labelKey: "history.heatmap.legendLoss" },
  { rung: "weak", labelKey: "history.heatmap.legendWeak" },
  { rung: "strong", labelKey: "history.heatmap.legendStrong" },
  { rung: "best", labelKey: "history.heatmap.legendBest" },
];

/**
 * The row's zero-anchored maximum: `max(0, max(profitPerGram))`.
 *
 * The floor at 0 is what keeps a row that only loses money from inverting its
 * own scale, and it mirrors `shareOfBest` (`useHistoryAggregates.ts:128-131`),
 * which already collapses a non-positive best to 0 and so never divides by
 * zero. When the best is not positive there is no "melhor" — nothing in the row
 * beat zero — so the floor rung is "fraco" rather than a meaningless highlight.
 *
 * `bestCell` skips `count === 0` (`:495-500`), so the maximum is over populated
 * cells only. It is the same cell the hook already elected, which is why the
 * colour and the row's own idea of "best" cannot disagree.
 */
function bestPerGramOf(aggregate: MaterialAggregate): number {
  const best = aggregate.bestCell?.profitPerGram ?? 0;
  return Number.isFinite(best) && best > 0 ? best : 0;
}

function rungOf(
  cell: MaterialCell,
  bestCell: MaterialCell | null,
  best: number,
): HeatmapRung {
  // `count === 0` is tested FIRST and on its own, because `profitPerGram` is 0
  // for an empty band for a reason unrelated to the metric: a band with no jobs
  // has no grams to divide by (`:491`). Reading that 0 as a real value would
  // paint absence as a measurement. Conversely, a band that HAS jobs and breaks
  // even is not empty — it is the floor rung, and it says so.
  if (cell.count === 0) return "empty";
  if (cell.profitPerGram < 0) return "loss";
  // Identity, not value equality: the hook keeps the FIRST maximum (strict `>`
  // at `:498`), so a tie has exactly one winner and "Melhor da linha" is
  // singular.
  if (best > 0 && bestCell !== null && cell.bracketId === bestCell.bracketId) {
    return "best";
  }
  if (best <= 0) return "weak";
  return cell.profitPerGram < best / 2 ? "weak" : "strong";
}

interface HeatmapRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly best: number;
  readonly bestCell: MaterialCell | null;
  readonly cells: readonly MaterialCell[];
}

/**
 * Profit per gram, per material, per weight band.
 *
 * A semantic `<table>`, not `role="grid"`. ROADMAP:1464 asked for
 * `role="grid"` + `aria-pressed`; that was declined because the prototype only
 * made the cell a `<button>` in order to open a drawer
 * (`Example/…:342-354`), and a cell whose value is visible TEXT needs no
 * button, no arrow-key model and no pressed state to be readable — the colour
 * becomes a redundant reinforcement of a number that is already printed there.
 * The five tables this app already ships are all plain `<table>`
 * (`MaterialComparison.tsx:170`, `ProductInventory.tsx:360`,
 * `InfillCalculator.tsx:186`, `QuoteSection.tsx:736`,
 * `StlPreview.tsx:1225`), and `MaterialComparison.tsx:170-221` even puts its
 * `<button>` in the header, for sorting, leaving the cells as text.
 *
 * The drill-down is kept, as a `<button>` INSIDE the cell carrying its own
 * `aria-label`, and only for populated cells.
 *
 * No charting library: five rungs of a CSS class.
 */
export function MaterialEfficiencyHeatmap({
  entries,
  className,
}: MaterialEfficiencyHeatmapProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [selection, setSelection] = useState<HeatmapSelection | null>(null);

  // `byMaterial` returns Map insertion order (`:473`), so ordering is the
  // consumer's. Ranked by the same number the colour ranks by — the row's best
  // `profitPerGram` — descending, with `key` ascending to break ties so the
  // order is reproducible between renders.
  const rows = useMemo<HeatmapRow[]>(
    () =>
      (byMaterial(entries) ?? [])
        .map((aggregate) => ({
          key: aggregate.key,
          label: aggregate.label,
          count: aggregate.count,
          best: bestPerGramOf(aggregate),
          bestCell: aggregate.bestCell,
          cells: aggregate.cells,
        }))
        .sort((a, b) => b.best - a.best || a.key.localeCompare(b.key)),
    [entries],
  );

  /**
   * Entries `byMaterial` could not place: no snapshot, so no material
   * (`:404-407`). `sum(rows.count)` is precisely what went missing, so reading
   * it back would report 0 orphans and hide the gap; the only formula that
   * works subtracts it from `entries.length`.
   */
  const orphanCount =
    entries.length - rows.reduce((sum, row) => sum + row.count, 0);

  // An empty history is not a grid of zeroes, and `ProfitAnalyticsModule`
  // returns null for the same reason (`:253`). The guard is on `entries`, not on
  // `rows`, and that distinction is load-bearing: `byMaterial` returns `null` —
  // never `[]` — both for "no entries" and for "entries exist but none has a
  // material" (`:390`, `:471`). Bailing on `rows` would swallow the second case
  // whole, and with it the orphan line that exists precisely to say those
  // entries went missing. That gap is what ROADMAP:1201 asks to be surfaced.
  if (entries.length === 0) return null;

  const metricLabel = t("history.heatmap.metricLabel");
  const gramsLabel = t("common.grams");
  const hasRows = rows.length > 0;

  return (
    <section
      data-testid="material-efficiency-heatmap"
      aria-label={t("history.heatmap.title")}
      className={`surface rounded-xl p-4 ${className ?? ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Grid3x3
            className="size-5 shrink-0 text-[var(--color-accent)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("history.heatmap.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("history.heatmap.subtitle")}
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

      {hasRows ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                {t("history.heatmap.tableLabel")}
              </caption>
              <thead>
                <tr className="text-[var(--color-text-muted)]">
                  <th scope="col" className="py-1.5 pr-2 font-medium">
                    {t("comparison.material")}
                  </th>
                  {WEIGHT_BUCKETS.map((bucket) => (
                    <th
                      key={bucket.id}
                      scope="col"
                      className="px-1.5 py-1.5 text-center font-medium"
                    >
                      {t(bucket.labelKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} data-testid={`heatmap-row-${row.key}`}>
                    {/*
                  `role="group"` on the row — the `ProfitAnalyticsModule`
                  pattern — is deliberately NOT ported. There it sat on an
                  `<li>`, which has no table semantics to destroy. On a `<tr>`
                  it would override the implicit `row` role and pull the grid
                  out of the table's own navigation model, which is the exact
                  thing the no-`role="grid"` decision preserves. `<th
                  scope="row">` is the semantic equivalent.
                */}
                    <th
                      scope="row"
                      className="py-1.5 pr-2 text-left font-medium text-[var(--color-text-primary)]"
                    >
                      {row.label}
                    </th>
                    {WEIGHT_BUCKETS.map((bucket) => {
                      const cell = row.cells.find(
                        (candidate) => candidate.bracketId === bucket.id,
                      );
                      if (!cell) return null;
                      const rung = rungOf(cell, row.bestCell, row.best);
                      const testid = `heatmap-cell-${row.key}-${bucket.id}`;
                      const band = t(bucket.labelKey);
                      const box = `rounded-md px-1.5 py-1.5 text-center ${RUNG_CLASS[rung].cell}`;

                      // Empty band: a label, and deliberately NOT a zero. Nothing
                      // was measured here, so no number and no job count.
                      if (cell.count === 0) {
                        return (
                          <td
                            key={bucket.id}
                            data-testid={testid}
                            data-rung={rung}
                            className="p-0.5"
                          >
                            <div className={box}>
                              <span className="text-[10px]">
                                {t("history.heatmap.cellEmpty")}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const value = formatCurrency(cell.profitPerGram);
                      return (
                        <td
                          key={bucket.id}
                          data-testid={testid}
                          data-rung={rung}
                          className="p-0.5"
                        >
                          <button
                            type="button"
                            data-testid={`heatmap-cell-button-${row.key}-${bucket.id}`}
                            onClick={() =>
                              setSelection({
                                materialKey: row.key,
                                materialLabel: row.label,
                                bracketLabel: band,
                                cell,
                              })
                            }
                            className={`w-full transition-colors hover:ring-1 hover:ring-[var(--color-accent)] ${box}`}
                            aria-label={t("history.heatmap.cellLabel", {
                              material: row.label,
                              band,
                              value,
                              count: cell.count,
                            })}
                          >
                            <span className="block font-mono tabular-nums">
                              {value}
                            </span>
                            <span className="block text-[10px] opacity-80">
                              {t("history.analytics.jobCount", {
                                count: cell.count,
                              })}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
        The legend names each rung in TEXT, in a `<li>`, in document order. The
        prototype carried the whole mapping in `title=` (`:348`) — not an
        accessible name, and unreachable by keyboard. That anti-pattern is the
        one `ProfitAnalyticsModule` killed, so it does not come back here.
      */}
          <ul
            data-testid="heatmap-legend"
            aria-label={t("history.heatmap.legendLabel")}
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5"
          >
            {LEGEND_RUNGS.map(({ rung, labelKey }) => (
              <li
                key={rung}
                data-testid={`heatmap-legend-${rung}`}
                className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]"
              >
                <span
                  aria-hidden="true"
                  className={`size-3 shrink-0 rounded border border-[var(--border-subtle)] ${RUNG_CLASS[rung].swatch}`}
                />
                <span>{t(labelKey)}</span>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {`${metricLabel} · ${gramsLabel}`}
          </p>
        </>
      ) : (
        // Entries exist but none carries a resolvable material. A bare table
        // here would render zero rows and read as "nothing to show" — the
        // orphan line below is the actual answer, so the empty grid is not
        // drawn at all.
        <p
          data-testid="heatmap-no-data"
          className="mt-3 text-xs text-[var(--color-text-muted)]"
        >
          {t("common.noData")}
        </p>
      )}

      {orphanCount > 0 && (
        <p
          data-testid="heatmap-orphan-count"
          className="mt-1 text-[11px] text-[var(--color-text-muted)]"
        >
          {t("history.analytics.orphanCount", { count: orphanCount })}
        </p>
      )}

      {/*
        Drill-down. `aria-live="polite"` so the panel announces itself: the
        button that opened it is the cell the user is already focused on, so
        the panel's content is otherwise not announced at all. The sign is
        carried by the number `formatCurrency` already produces — no `+`
        prefix, which the prototype forced onto negative cells too
        (`:305`, `:408`). The job count goes through i18next, so one job does
        not read "1 jobs".
      */}
      {selection && (
        <div
          data-testid="heatmap-drilldown"
          aria-live="polite"
          className="mt-3 animate-fade-up rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-surface)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {`${selection.materialLabel} · ${selection.bracketLabel}`}
            </span>
            <button
              type="button"
              onClick={() => setSelection(null)}
              aria-label={t("common.close")}
              className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-[var(--border-subtle)] p-2">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {metricLabel}
              </p>
              <p
                className={`font-mono text-sm font-semibold tabular-nums ${
                  selection.cell.profitPerGram < 0
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-success)]"
                }`}
              >
                {formatCurrency(selection.cell.profitPerGram)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--border-subtle)] p-2">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {`${t("common.grams")} · ${t("history.analytics.rowProfit")}`}
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                {`${formatCurrency(selection.cell.profit)} ${t("common.grams")}`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {t("history.analytics.jobCount", {
              count: selection.cell.count,
            })}
          </p>
        </div>
      )}
    </section>
  );
}
