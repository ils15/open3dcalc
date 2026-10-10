import { Zap, RotateCcw, X } from "lucide-react";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useState } from "react";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { useTranslation } from "react-i18next";

const BANNER_KEY = "open3dcalc_quickstart_dismissed";

export function QuickStartBanner({
  compact = false,
}: { compact?: boolean } = {}) {
  const { t } = useTranslation();
  const setQuickStart = useCalculatorStore((s) => s.setQuickStart);
  const resetCalculator = useCalculatorStore((s) => s.resetCalculator);
  const [dismissed, setDismissed] = useState(
    () => guardedStorage.getItem(BANNER_KEY) === "true",
  );

  const dismiss = () => {
    setDismissed(true);
    guardedStorage.setItem(BANNER_KEY, "true");
  };

  if (dismissed) return null;

  if (compact) {
    return (
      <div
        role="group"
        aria-label={t("quickStart.title")}
        className="quick-start-actions hidden items-center gap-1 lg:inline-flex"
      >
        <button
          onClick={resetCalculator}
          title={t("quickStart.clearFields")}
          aria-label={t("quickStart.clearFields")}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] px-2 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={setQuickStart}
          title={t("quickStart.fillExample")}
          aria-label={t("quickStart.fillExample")}
          className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg bg-[var(--accent-fill)] px-2.5 text-[11px] font-semibold text-[var(--accent-fill-fg)] shadow-sm transition-colors hover:bg-[var(--accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Zap className="h-3.5 w-3.5" />
          {t("quickStart.example")}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="quickstart-banner"
      className="quick-start-banner surface rounded-xl p-2.5 sm:p-4 border border-[var(--color-accent)]/20 bg-gradient-to-r from-[var(--color-accent)]/5 to-transparent relative"
    >
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        aria-label={t("quickStart.dismiss")}
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex flex-col items-start gap-2 pr-11 min-[24rem]:flex-row min-[24rem]:items-center min-[24rem]:gap-1.5 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="min-w-0 text-[10px] sm:text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1 sm:gap-1.5">
            <Zap className="w-3 h-3 shrink-0 sm:w-3.5 sm:h-3.5 text-[var(--color-accent)]" />
            <span className="truncate" title={t("quickStart.title")}>
              {t("quickStart.title")}
            </span>
          </p>
          <p id="quickstart-description" className="sr-only">
            {t("quickStart.description")}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end min-[24rem]:self-auto">
          <button
            onClick={resetCalculator}
            className="min-h-[44px] min-w-[44px] px-2 sm:min-w-0 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-1"
            aria-label={t("quickStart.clearFields")}
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t("quickStart.clear")}</span>
          </button>
          <button
            onClick={setQuickStart}
            aria-describedby="quickstart-description"
            className="min-h-[44px] px-2.5 sm:px-5 py-2 rounded-xl text-[10px] sm:text-xs font-semibold bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-fill-hover)] transition-colors shadow-md shadow-[var(--color-accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1"
            aria-label={t("quickStart.fillExample")}
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {t("quickStart.example")}
          </button>
        </div>
      </div>
    </div>
  );
}
