import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";

/**
 * Recent-calculation history with its own clear confirmation.
 *
 * Reads the history store directly: the card is fully self-contained so the
 * panel never has to thread history state through props.
 */
export function HistoryCard() {
  const { t, i18n } = useTranslation();
  const { format: fmtCurrency } = useCurrency();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { clearHistory, entries, historyCount } = useHistoryStore(
    useShallow((s) => ({
      clearHistory: s.clearHistory,
      entries: s.entries,
      historyCount: s.entries.length,
    })),
  );

  const recentEntries = entries.slice(0, 3);

  if (recentEntries.length === 0) return null;

  return (
    <>
      <div className="surface-elevated rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t("calc.history")} ({historyCount})
          </span>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-[10px] sm:text-xs text-[var(--critical)]/70 hover:text-[var(--critical)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
          >
            {t("calc.clearHistory")}
          </button>
        </div>
        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
          {recentEntries.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]"
            >
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>
                  {new Date(item.timestamp).toLocaleDateString(
                    i18n.resolvedLanguage || i18n.language,
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </span>
                <span className="uppercase font-bold tracking-wider">
                  {item.type}
                </span>
              </div>
              <div className="font-medium text-[var(--text-primary)] text-xs truncate mb-1">
                {item.summary}
              </div>
              <div className="flex justify-between">
                <span className={`font-mono text-xs ${item.profit < 0 ? "text-[var(--margin-negative)]" : "text-[var(--margin)]"}`}>
                  {fmtCurrency(item.profit)}
                </span>
                <span className="text-[var(--revenue)] font-mono font-bold text-xs">
                  {fmtCurrency(item.sellPrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        title={t("calc.clearHistory")}
        message={t("calc.clearConfirm")}
        variant="danger"
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          clearHistory();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
}
