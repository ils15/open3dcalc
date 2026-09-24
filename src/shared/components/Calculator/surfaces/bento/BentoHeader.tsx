import { ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface BentoHeaderProps {
  readonly projectName: string;
  readonly finalPrice: string;
}

/** Surface-level context and a keyboard-accessible jump to the financial card. */
export function BentoHeader({
  projectName,
  finalPrice,
}: BentoHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const displayProject = projectName.trim() || t("bento.unnamedProject");

  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-4 shadow-[var(--shadow-md)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="min-w-0"
          aria-label={`${t("bento.projectClient")}: ${displayProject}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {t("bento.projectClient")}
          </p>
          <p className="mt-1 truncate text-lg font-bold text-[var(--text-primary)]">
            {displayProject}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div aria-label={`${t("bento.finalPrice")}: ${finalPrice}`}>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {t("bento.finalPrice")}
            </p>
            <p className="text-xl font-black text-[var(--color-revenue)]">
              {finalPrice}
            </p>
          </div>
          <a
            href="#bento-summary"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text-inverse)] outline-none hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-overlay)]"
          >
            {t("bento.viewSummary")}
            <ArrowDown aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
