import { useTranslation } from "react-i18next";
import { AlertTriangle, Focus, TrendingUp } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { useFocusMode } from "./NavigationContext";

/**
 * The floating workshop-status pill — the app's copy of the prototype's
 * `MiniDashOverlay` collapsed pill (`MiniDashOverlay.tsx:142-179`), with the
 * fleet segment dropped rather than faked.
 *
 * Three segments, each backed by something the app already owns:
 *   - revenue: a reduce over `HistoryEntry.sellPrice`, the same field
 *     `useHistoryAggregates` aggregates at :293 and :351
 *   - low stock: `spoolStore.getLowStockSpools(threshold)` (:261) applying the
 *     one low-stock rule (:93)
 *   - Focus Mode: `focusMode.enter`, the same transition `FocusModeButton`
 *     triggers (:48)
 *
 * **Its own accessible name for the Focus segment, not `focusMode.enter`.**
 * Reusing that string gave the pill a SECOND control named exactly like the one
 * already wired into four chrome surfaces, so a screen reader heard "Modo Foco,
 * button" twice with nothing to tell them apart, and every suite that queried
 * the entry control by name matched two nodes. The pill is a floating summary,
 * not a settings surface, so it says what it is (`pillFocus`) instead.
 *
 * **Threshold: 100g, not the prototype's 250g.** The prototype filters at 250g
 * (`MiniDashOverlay.tsx:124`); the app filters at 100g
 * (`FilamentInventory.tsx:396`). Showing both on one screen would mean two
 * different numbers for "low filament", so the app's own number wins here — a
 * deliberate divergence from the prototype, not an oversight.
 *
 * **Fleet omitted.** The prototype's `2/6 máq.` needs a machine-fleet store,
 * which the owner deferred. A fake zero would be a lie, and a placeholder
 * segment is worse than a missing one.
 *
 * **The revenue segment is absent, not zero.** `entries.reduce` always returns a
 * number and `formatCurrency(0)` answers `R$ 0,00`, so a fresh profile with no
 * history rendered `R$ 0,00` — a formatted zero standing in for a value that does
 * not exist. The comment this replaces claimed `formatCurrency` answers "no
 * value" with an em dash and that the pill hid itself when there was neither a
 * result nor history. Both claims were false: `calculatorStore.ts:217` computes
 * `results` while BUILDING the store, so `results` is a populated
 * `CalculationResult` from the first render, and the guard
 * `if (!results && entries.length === 0) return null` could never fire. The
 * em dash it was written to prevent never appeared either. What is actually
 * absent is the revenue SEGMENT, so that is what is hidden — the docstring's
 * own rule ("absent beats empty") applied to the segment where the missing
 * value lives rather than to the whole pill.
 *
 * **Low stock and Focus stay.** `0` low spools is a real measurement, not an
 * empty value, and Focus is actionable with or without history. Only revenue
 * depends on history, so only revenue is conditional.
 */
export function QuickStatusPill(): React.ReactElement | null {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const entries = useHistoryStore((s) => s.entries);
  const lowStockCount = useSpoolStore((s) => s.getLowStockSpools(100).length);
  const focusMode = useFocusMode();

  // `results` is deliberately NOT read. `calculatorStore.ts:217` computes it
  // while building the store, so it is populated from the first render and any
  // guard on it is unreachable — see the docstring. History is the only input
  // that is genuinely absent on load.
  const hasHistory = entries.length > 0;
  const revenue = entries.reduce((sum, entry) => sum + entry.sellPrice, 0);

  return (
    <div
      role="group"
      data-testid="quick-status-pill"
      aria-label={t("quickActions.pillLabel")}
      className="fixed bottom-4 right-40 sm:right-44 z-30 flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl select-none"
    >
      {hasHistory && (
        <>
          <span
            data-testid="pill-segment-revenue"
            className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-secondary)]"
          >
            <TrendingUp
              className="w-3 h-3 text-[var(--color-accent)]"
              aria-hidden="true"
            />
            {format(revenue)}
          </span>

          <span
            aria-hidden="true"
            className="w-px h-3.5 bg-[var(--color-border)]"
          />
        </>
      )}

      <span
        data-testid="pill-segment-lowstock"
        className={`flex items-center gap-1.5 text-[11px] font-mono ${
          lowStockCount > 0
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-text-secondary)]"
        }`}
      >
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        {lowStockCount}
      </span>

      <span
        aria-hidden="true"
        className="w-px h-3.5 bg-[var(--color-border)]"
      />

      <button
        type="button"
        data-testid="pill-segment-focus"
        onClick={focusMode.enter}
        aria-label={t("quickActions.pillFocus")}
        title={t("quickActions.pillFocus")}
        className="flex items-center gap-1.5 min-h-[32px] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-primary)] rounded-full hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        <Focus className="w-3 h-3" aria-hidden="true" />
        {t("quickActions.pillFocusShort")}
      </button>
    </div>
  );
}
