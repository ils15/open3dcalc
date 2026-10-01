import { useTranslation } from "react-i18next";
import { AlertTriangle, Focus, TrendingUp } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
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
 * The pill is hidden entirely when there is neither a calculated result nor
 * history: `formatCurrency` answers "no value" with an em dash, and a floating
 * badge full of dashes is noise. Absent beats empty.
 */
export function QuickStatusPill(): React.ReactElement | null {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const results = useCalculatorStore((s) => s.results);
  const entries = useHistoryStore((s) => s.entries);
  const lowStockCount = useSpoolStore((s) => s.getLowStockSpools(100).length);
  const focusMode = useFocusMode();

  if (!results && entries.length === 0) return null;

  const revenue = entries.reduce((sum, entry) => sum + entry.sellPrice, 0);

  return (
    <div
      role="group"
      data-testid="quick-status-pill"
      aria-label={t("quickActions.pillLabel")}
      className="fixed bottom-4 right-40 sm:right-44 z-30 flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl select-none"
    >
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
