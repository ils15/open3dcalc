import { useTranslation } from "react-i18next";
import { AlertTriangle, Focus, HelpCircle } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useFocusMode } from "./NavigationContext";

export function QuickStatusPill(): React.ReactElement | null {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const entries = useHistoryStore((s) => s.entries);
  const lowStockCount = useSpoolStore((s) => s.getLowStockSpools(100).length);
  const focusMode = useFocusMode();

  const hasHistory = entries.length > 0;
  const revenue = hasHistory
    ? entries.reduce((sum, entry) => sum + entry.sellPrice, 0)
    : 0;

  return (
    <>
      {/* ── FLOATING STUDIO BOTTOM PILL ── */}
      <div
        role="group"
        data-testid="quick-status-pill"
        aria-label={t("quickActions.pillLabel")}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2.5 px-3 py-1.5 rounded-full border border-[#1e293b] bg-[#0b1120]/95 backdrop-blur-md shadow-2xl select-none whitespace-nowrap text-xs text-slate-200"
      >
        {/* Pulse Dot + Mini-Dash */}
        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mini-Dash</span>
        </div>

        {/* Revenue (only when history exists) */}
        {hasHistory && (
          <span
            data-testid="pill-segment-revenue"
            className="font-mono font-semibold text-slate-200 text-[11px]"
          >
            {format(revenue)}
          </span>
        )}

        {/* Low Stock Warning */}
        <span
          data-testid="pill-segment-lowstock"
          className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60"
        >
          <AlertTriangle
            className="w-3 h-3 text-amber-400"
            aria-hidden="true"
          />
          {lowStockCount}{" "}
          {t("quickActions.lowStock", { defaultValue: "baixos" })}
        </span>

        {/* Focus Mode */}
        <button
          type="button"
          data-testid="pill-segment-focus"
          onClick={focusMode.enter}
          aria-label={t("quickActions.pillFocus")}
          title={t("quickActions.pillFocus")}
          className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium px-2 py-0.5 rounded-full hover:bg-purple-950/30 transition-colors"
        >
          <Focus className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
          Modo Foco
        </button>

        {/* Help button */}
        <button
          type="button"
          onClick={() => useTutorialStore.getState().startTutorial()}
          aria-label={t("quickActions.pillHelp", {
            defaultValue: "Ajuda / Tutorial",
          })}
          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white rounded-full transition-colors"
          title="Ajuda / Tutorial"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}
