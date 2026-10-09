import { ArrowDown, Edit3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

export interface BentoHeaderProps {
  readonly projectName: string;
  /** Kept as an accessible jump label; the visible price lives in the response. */
  readonly finalPrice: string;
  readonly hasResults: boolean;
}

/** Surface context and a keyboard-accessible jump to the financial response. */
export function BentoHeader({
  projectName,
  finalPrice,
  hasResults,
}: BentoHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const setProductName = useCalculatorStore((s) => s.setProductName);

  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-4 shadow-[var(--shadow-md)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="min-w-0 flex-1 max-w-lg"
          aria-label={`${t("bento.projectClient")}: ${projectName || t("bento.unnamedProject")}`}
        >
          <label
            htmlFor="bento-project-input"
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-1"
          >
            {t("bento.projectClient")}
          </label>
          <div className="relative flex items-center">
            <input
              id="bento-project-input"
              type="text"
              value={projectName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t("bento.unnamedProject")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2 text-base font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <Edit3 className="w-4 h-4 text-[var(--text-muted)] absolute right-3 pointer-events-none" />
          </div>
        </div>

        {hasResults && (
          <a
            href="#bento-results"
            aria-label={`${t("bento.finalPrice")}: ${finalPrice}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text-inverse)] outline-none hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-overlay)] transition-all shadow-md active:scale-95 shrink-0"
          >
            {t("bento.viewSummary")}
            <ArrowDown aria-hidden="true" className="size-4" />
          </a>
        )}
      </div>
    </header>
  );
}
