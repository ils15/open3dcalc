import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { HistoryEntry } from "@/shared/types";
import { materials } from "@/shared/lib/materials";
import { printers as printerCatalog } from "@/shared/lib/printers";
import { useHistoryStore } from "@/shared/stores/historyStore";

/**
 * Phase 7p: read-only aggregation of `HistoryEntry[]` for the chart layer.
 *
 * ## Why the aggregators are pure and exported
 *
 * The four `by*` functions below take `entries` as a parameter and return
 * plain data. No store, no JSX, no i18n lookup: `locale` (for `Intl`) and `t`
 * (for translated fallbacks) arrive as arguments. That is what makes this unit
 * deterministic under test — a test needs neither a store provider nor an i18n
 * provider. `useFinancialBreakdown.ts:82-150` sets the precedent by keeping
 * `buildChartSegments` pure and handing it `t`.
 *
 * {@link useHistoryAggregates} is then only the memoized envelope that reads
 * the store and forwards the current locale.
 *
 * ## The `quantity` rule (Phase 7p trap A1)
 *
 * `HistoryEntry.sellPrice` / `totalCost` / `profit` are **per unit**, and
 * `result.unitWeight` is **per unit** too — `calculatorStore.compute.ts:104-129`
 * *divides* the batch when `qty > 1`; `CalculationResult` and `HistoryEntry`
 * carry no batch field at all (`types/index.ts:274-303`, `:310-321`). So every
 * sum here adds the stored value as-is and **never multiplies by
 * `snapshot.quantity`**. This is what the app already shows the user
 * (`Dashboard.tsx:172-173`, `:324-331`, `historyStore.ts:145`, `:165`);
 * multiplying here would be an unauthorized visual regression. The prototype
 * models the opposite (batch totals, `Example/src/types.ts:117,125-128`), which
 * is why treating `sellPrice` as a batch total under-counts by 10x and
 * multiplying by `quantity` over-counts by 10x. Both directions are wrong; this
 * file takes the one the app is on.
 *
 * Accepted consequence: with per-unit weight the demo's 10-unit batch (60 g
 * each, ~68 g with purge) lands in the `medium` bucket, not `bulk`. Only the
 * absolute totals and the weight bucket move — the ratios (`profitPerGram`,
 * `pricePerGram`, `roiPercent`) are scale-invariant and unchanged.
 */

/** One month of the trailing window, oldest first. */
export interface MonthlyAggregate {
  /** `YYYY-MM`, in local civil time. */
  readonly monthKey: string;
  readonly year: number;
  /** 0-11. */
  readonly monthIndex: number;
  /** Localized short month name. */
  readonly label: string;
  readonly revenue: number;
  readonly cost: number;
  readonly profit: number;
  readonly count: number;
  readonly isCurrentMonth: boolean;
}

/** One civil quarter of the trailing window, oldest first. */
export interface QuarterlyAggregate {
  /** `YYYY-Qn`. */
  readonly quarterKey: string;
  readonly year: number;
  /** 1-4. */
  readonly quarter: number;
  /** `Q1'26` — locale-neutral, so not translated. */
  readonly label: string;
  readonly revenue: number;
  readonly cost: number;
  readonly profit: number;
  readonly count: number;
  readonly isCurrentQuarter: boolean;
  /**
   * Quarter-over-quarter revenue change in percent. `null` when the previous
   * quarter is outside the window or had no revenue — never `0` (which would
   * read as "flat") and never `Infinity`.
   */
  readonly qoqPercent: number | null;
}

export type WeightBracketId = "light" | "medium" | "heavy" | "bulk";

/** A per-job weight band. Half-open `[min, max)`, last one is the catch-all. */
export interface WeightBracket {
  readonly id: WeightBracketId;
  /** i18n key the component resolves — labels are never hardcoded here. */
  readonly labelKey: string;
  readonly min: number;
  readonly max: number;
}

/**
 * The four verified cut points from `MaterialEfficiencyHeatmap.tsx:41-46`.
 * These are per job, matching the prototype field name `printWeightGrams`.
 * Only `labelKey` replaces the prototype's pt-BR `label`; the numbers are
 * unchanged and no new band is invented.
 */
export const WEIGHT_BUCKETS: readonly WeightBracket[] = [
  { id: "light", labelKey: "history.aggregates.weight.light", min: 0, max: 50 },
  {
    id: "medium",
    labelKey: "history.aggregates.weight.medium",
    min: 50,
    max: 150,
  },
  {
    id: "heavy",
    labelKey: "history.aggregates.weight.heavy",
    min: 150,
    max: 300,
  },
  {
    id: "bulk",
    labelKey: "history.aggregates.weight.bulk",
    min: 300,
    max: 99999,
  },
];

/** Aggregated totals for one material inside one weight band. */
export interface MaterialCell {
  readonly bracketId: WeightBracketId;
  readonly count: number;
  /** Sum of `result.unitWeight`. Never multiplied by quantity — see the A1 note. */
  readonly totalGrams: number;
  readonly revenue: number;
  readonly cost: number;
  readonly profit: number;
  /** `profit / totalGrams`, `0` when the band holds no grams. */
  readonly profitPerGram: number;
  /** `revenue / totalGrams`, `0` when the band holds no grams. */
  readonly pricePerGram: number;
  /** `profit / cost * 100`, `0` when the band cost is not positive. */
  readonly roiPercent: number;
}

/** One material row. Only materials with at least one job are produced. */
export interface MaterialAggregate {
  /** Normalized key, e.g. `pla_silk`. */
  readonly key: string;
  /** Catalog display name, falling back to `key` when the catalog misses. */
  readonly label: string;
  readonly process: "fdm" | "resin" | "unknown";
  readonly count: number;
  /** Always one cell per bracket, in bracket order — including empty ones. */
  readonly cells: readonly MaterialCell[];
  /** Highest `profitPerGram` among non-empty cells, or `null`. */
  readonly bestCell: MaterialCell | null;
}

/** One printer's totals. */
export interface PrinterAggregate {
  readonly printerId: string;
  /** Catalog name; the raw id when the printer is no longer in the catalog. */
  readonly name: string;
  /** Catalog brand; empty when the printer is no longer in the catalog. */
  readonly brand: string;
  readonly count: number;
  readonly revenue: number;
  readonly cost: number;
  readonly profit: number;
  /** `profit / revenue * 100`, `0` when revenue is not positive. */
  readonly marginPercent: number;
  /** Billable hours: `totalHoursForProfit`, else `estimatedPrintTime`. */
  readonly hours: number;
  /** `profit / hours`, `0` when hours is not positive. */
  readonly profitPerHour: number;
  /** Sum of `result.unitWeight` — per unit, see the A1 note. */
  readonly totalGrams: number;
}

/** Shape returned by {@link useHistoryAggregates}. */
export interface HistoryAggregates {
  readonly monthly: MonthlyAggregate[] | null;
  readonly quarterly: QuarterlyAggregate[] | null;
  readonly material: MaterialAggregate[] | null;
  readonly printer: PrinterAggregate[] | null;
}

/** `printerId` bucket for entries whose snapshot did not record a printer. */
const UNKNOWN_PRINTER_ID = "unknown";

/** Translator signature, so callers can pass a raw key in tests. */
export type TranslateFn = (key: string) => string;

/** `numerator / denominator`, `0` when the denominator is not positive. */
function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** `numerator / denominator * 100`, `0` when the denominator is not positive. */
function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

/** Localized short month name for a local civil month. */
function monthLabel(year: number, monthIndex: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(
    new Date(year, monthIndex, 1),
  );
}

/**
 * Normalizes a free-form material label into a stable key.
 *
 * `MaterialStateFDM.type` and `MaterialStateResin.type` are plain `string`
 * (`types/index.ts:86`, `:139`) — the 23-member `MaterialType` union is never
 * applied on the state path. What actually lands in history is a mixture of
 * catalog ids and display names: the demo dataset writes `"PETG"`,
 * `"PLA Silk"`, `"TPU 95A"`, `"Standard"`, `"Water Washable"`
 * (`demoDataset.ts:542,557,572,588,603,618,635,652,668,683,698`). Lower-casing
 * and folding punctuation to `_` makes those collide with the catalog ids
 * (`pla_silk`, `tpu_95a`, `water_washable`) so the label can be resolved.
 *
 * Known limitation: the rule is deliberately ASCII-only, so a name with
 * diacritics (e.g. `"Resina Fundível"`) normalizes to an unrelated key and
 * falls back to the key itself. That is the honest outcome — an unmatched name
 * should not be guessed into a catalog entry. A second known limitation:
 * `"PLA+"` folds to `pla` and therefore merges with `pla`.
 */
function normalizeMaterialKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Billable hours for one entry, guarded at zero on both candidates. */
function billableHoursFor(entry: HistoryEntry): number {
  const hours =
    entry.result.totalHoursForProfit ?? entry.result.estimatedPrintTime;
  return hours > 0 ? hours : 0;
}

/**
 * Aggregates the trailing `months` calendar months, oldest first.
 *
 * Returns `null` when there are no entries — a chart that draws a line at `0`
 * asserts the user made zero money (`Dashboard.tsx:160-180` already returns
 * `null` for the same reason). Buckets inside a non-empty series are always
 * present with `count: 0`: a gap on the X axis is a render bug, not honesty.
 *
 * Bucketing is civil and local. `toISOString()` is never used — it would shift
 * the bucket by the UTC offset and place a late-evening job in the next month.
 */
export function byMonth(
  entries: readonly HistoryEntry[],
  locale: string,
  months = 6,
): MonthlyAggregate[] | null {
  if (entries.length === 0) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const buckets = new Map<string, MonthlyAggregate>();
  // Oldest first. `now.getMonth() - i` rolls into the previous year on its own.
  for (let i = months - 1; i >= 0; i--) {
    const anchor = new Date(currentYear, currentMonth - i, 1);
    const year = anchor.getFullYear();
    const monthIndex = anchor.getMonth();
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    buckets.set(monthKey, {
      monthKey,
      year,
      monthIndex,
      label: monthLabel(year, monthIndex, locale),
      revenue: 0,
      cost: 0,
      profit: 0,
      count: 0,
      isCurrentMonth: year === currentYear && monthIndex === currentMonth,
    });
  }

  for (const entry of entries) {
    const local = new Date(entry.timestamp);
    const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue; // Outside the window.
    const next: MonthlyAggregate = {
      ...bucket,
      revenue: bucket.revenue + entry.sellPrice,
      cost: bucket.cost + entry.totalCost,
      profit: bucket.profit + entry.profit,
      count: bucket.count + 1,
    };
    buckets.set(key, next);
  }

  return [...buckets.values()];
}

/**
 * Aggregates the trailing `quarters` **civil** quarters, oldest first.
 *
 * Civil, not fiscal: the app has no notion of a fiscal quarter anywhere, and a
 * configurable quarter start would be a new domain input — a product decision,
 * not a hook decision. A civil `quarter` is reversible; hardcoding "Jan-Mar is
 * Q1" across four charts is not. `qoqPercent` is `null` when the previous
 * quarter had no revenue, so "no baseline" never renders as "flat".
 */
export function byQuarter(
  entries: readonly HistoryEntry[],
  locale: string,
  quarters = 8,
): QuarterlyAggregate[] | null {
  if (entries.length === 0) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const buckets = new Map<string, QuarterlyAggregate>();
  for (let i = quarters - 1; i >= 0; i--) {
    const anchor = new Date(currentYear, currentMonth - i * 3, 1);
    const year = anchor.getFullYear();
    const quarter = Math.floor(anchor.getMonth() / 3) + 1;
    const quarterKey = `${year}-Q${quarter}`;
    buckets.set(quarterKey, {
      quarterKey,
      year,
      quarter,
      label: `Q${quarter}'${String(year).slice(-2)}`,
      revenue: 0,
      cost: 0,
      profit: 0,
      count: 0,
      isCurrentQuarter:
        year === currentYear && quarter === Math.floor(currentMonth / 3) + 1,
      qoqPercent: null,
    });
  }

  for (const entry of entries) {
    const local = new Date(entry.timestamp);
    const year = local.getFullYear();
    const quarter = Math.floor(local.getMonth() / 3) + 1;
    const bucket = buckets.get(`${year}-Q${quarter}`);
    if (!bucket) continue;
    buckets.set(`${year}-Q${quarter}`, {
      ...bucket,
      revenue: bucket.revenue + entry.sellPrice,
      cost: bucket.cost + entry.totalCost,
      profit: bucket.profit + entry.profit,
      count: bucket.count + 1,
    });
  }

  // QoQ walks oldest → newest so `previous` is the bucket before it.
  const series = [...buckets.values()];
  return series.map((bucket, index) => {
    if (index === 0) return bucket;
    const previous = series[index - 1];
    if (previous.revenue <= 0) return bucket;
    return {
      ...bucket,
      qoqPercent:
        ((bucket.revenue - previous.revenue) / previous.revenue) * 100,
    };
  });
}

/**
 * Builds the material x weight-band grid.
 *
 * Rows are **derived from the entries that exist**, never from a fixed
 * `MaterialType` list. A 23-row grid keyed on the union would silently drop
 * every resin material (those ids enter the catalog through
 * `as unknown as MaterialType`, `materials.ts:30-37`) and every display-name
 * entry. Only rows with at least one job are returned, so the component — not
 * the aggregator — owns rendering a complete grid.
 *
 * Returns `null` when nothing is derivable, including when every entry has
 * `snapshot === null`: that is the one null-guard that matters most here,
 * because there is no way to know the material without a snapshot.
 */
export function byMaterial(
  entries: readonly HistoryEntry[],
  brackets: readonly WeightBracket[] = WEIGHT_BUCKETS,
): MaterialAggregate[] | null {
  if (entries.length === 0 || brackets.length === 0) return null;

  interface Row {
    key: string;
    label: string;
    process: "fdm" | "resin" | "unknown";
    count: number;
    cells: Map<WeightBracketId, MaterialCell>;
  }

  const rows = new Map<string, Row>();

  for (const entry of entries) {
    const snapshot = entry.snapshot;
    // Most important null-guard in this file: without a snapshot there is no
    // material, so the entry cannot appear in the grid at all.
    if (snapshot === null) continue;

    // `resinMaterial` is not optional in the type (`:349`), but `?.` is
    // mandatory: the snapshot round-trips through persisted JSON and
    // `historyStore.ts:219` accepts an arbitrary imported payload.
    const rawType =
      entry.type === "resin"
        ? snapshot.resinMaterial?.type
        : snapshot.fdmMaterial?.type;
    if (!rawType) continue;

    const key = normalizeMaterialKey(rawType);
    if (!key) continue;

    const grams = entry.result.unitWeight > 0 ? entry.result.unitWeight : 0;
    // Half-open [min, max), last bracket is the catch-all
    // (MaterialEfficiencyHeatmap.tsx:102).
    const bracket =
      brackets.find((b) => grams >= b.min && grams < b.max) ??
      brackets[brackets.length - 1];

    let row = rows.get(key);
    if (!row) {
      const catalog = materials.find((m) => m.id === key);
      row = {
        key,
        // Never getMaterial with a blind default: an unmatched name keeps its
        // own key as the label instead of borrowing another material's name.
        label: catalog?.name ?? key,
        process: catalog?.type ?? entry.type,
        count: 0,
        cells: new Map(),
      };
      for (const b of brackets) {
        row.cells.set(b.id, {
          bracketId: b.id,
          count: 0,
          totalGrams: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          profitPerGram: 0,
          pricePerGram: 0,
          roiPercent: 0,
        });
      }
      rows.set(key, row);
    }

    const cell = row.cells.get(bracket.id);
    if (!cell) continue;
    row.cells.set(bracket.id, {
      ...cell,
      count: cell.count + 1,
      totalGrams: cell.totalGrams + grams,
      revenue: cell.revenue + entry.sellPrice,
      cost: cell.cost + entry.totalCost,
      profit: cell.profit + entry.profit,
    });
    row.count += 1;
  }

  if (rows.size === 0) return null;

  return [...rows.values()].map((row) => {
    const cells: MaterialCell[] = brackets.map(
      (b) =>
        row.cells.get(b.id) ?? {
          bracketId: b.id,
          count: 0,
          totalGrams: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          profitPerGram: 0,
          pricePerGram: 0,
          roiPercent: 0,
        },
    );
    // Ratios are derived per cell so a band with no grams yields 0, never NaN.
    const withRatios = cells.map((cell) => ({
      ...cell,
      profitPerGram: ratio(cell.profit, cell.totalGrams),
      pricePerGram: ratio(cell.revenue, cell.totalGrams),
      roiPercent: percent(cell.profit, cell.cost),
    }));
    const bestCell =
      withRatios.reduce<MaterialCell | null>((best, cell) => {
        if (cell.count === 0) return best;
        if (!best || cell.profitPerGram > best.profitPerGram) return cell;
        return best;
      }, null) ?? null;

    return {
      key: row.key,
      label: row.label,
      process: row.process,
      count: row.count,
      cells: withRatios,
      bestCell,
    };
  });
}

/**
 * Aggregates per printer, sorted by `profitPerHour` descending.
 *
 * Catalog resolution uses `printerCatalog.find`, never `getPrinter()`:
 * `getPrinter()` falls back to `?? printers[0]` (`printers.ts:1349-1351`) and
 * `printers[0]` is the A1 Mini — so a deleted printer id would silently merge
 * into an "A1 Mini" bucket carrying another machine's numbers. An unresolved id
 * keeps its own id as the name instead.
 *
 * `t` is a parameter so the `snapshot === null` fallback can be translated
 * without a literal string in this file.
 */
export function byPrinter(
  entries: readonly HistoryEntry[],
  t: TranslateFn,
  limit?: number,
): PrinterAggregate[] | null {
  if (entries.length === 0) return null;

  const rows = new Map<
    string,
    {
      count: number;
      revenue: number;
      cost: number;
      profit: number;
      hours: number;
      totalGrams: number;
    }
  >();

  for (const entry of entries) {
    const printerId = entry.snapshot?.selectedPrinterId || UNKNOWN_PRINTER_ID;
    const row = rows.get(printerId) ?? {
      count: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      hours: 0,
      totalGrams: 0,
    };
    const grams = entry.result.unitWeight > 0 ? entry.result.unitWeight : 0;
    rows.set(printerId, {
      count: row.count + 1,
      revenue: row.revenue + entry.sellPrice,
      cost: row.cost + entry.totalCost,
      profit: row.profit + entry.profit,
      hours: row.hours + billableHoursFor(entry),
      totalGrams: row.totalGrams + grams,
    });
  }

  const aggregates: PrinterAggregate[] = [...rows.entries()].map(
    ([printerId, row]) => {
      const profile = printerCatalog.find((p) => p.id === printerId);
      const isUnknown = printerId === UNKNOWN_PRINTER_ID;
      return {
        printerId,
        name:
          profile?.name ??
          (isUnknown ? t("history.aggregates.printerUnknown") : printerId),
        brand: profile?.brand ?? "",
        count: row.count,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        marginPercent: percent(row.profit, row.revenue),
        hours: row.hours,
        profitPerHour: ratio(row.profit, row.hours),
        totalGrams: row.totalGrams,
      };
    },
  );

  aggregates.sort((a, b) => b.profitPerHour - a.profitPerHour);
  return limit !== undefined ? aggregates.slice(0, limit) : aggregates;
}

/**
 * Memoized envelope over the four pure aggregators.
 *
 * The locale and the translator come from `useTranslation()` here and are
 * handed to the pure functions as arguments, which is what lets the tests
 * exercise the math without an i18n provider.
 */
export function useHistoryAggregates(): HistoryAggregates {
  const { t, i18n } = useTranslation();
  const entries = useHistoryStore((s) => s.entries);
  const locale = i18n.resolvedLanguage || i18n.language || "en-US";

  return useMemo<HistoryAggregates>(
    () => ({
      monthly: byMonth(entries, locale),
      quarterly: byQuarter(entries, locale),
      material: byMaterial(entries),
      printer: byPrinter(entries, t),
    }),
    [entries, locale, t],
  );
}
