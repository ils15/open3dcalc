import { useTranslation } from "react-i18next";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { CalculationResult } from "@/shared/types";

export interface Step4ResultProps {
  results: CalculationResult | null;
  onFinish: () => void;
}

export function Step4Result({
  results,
  onFinish,
}: Step4ResultProps): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="group"
        aria-label={t("wizard.result.title")}
      >
        <ResultCard
          testId="wizard-total-cost"
          label={t("wizard.result.totalCost")}
          value={format(results?.totalCost ?? 0)}
          emphasis
        />
        <ResultCard
          testId="wizard-sell-price"
          label={t("wizard.result.sellPrice")}
          value={format(results?.sellPrice ?? 0)}
        />
        <ResultCard
          testId="wizard-profit"
          label={t("wizard.result.profit")}
          value={format(results?.profit ?? 0)}
        />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("wizard.result.ctaHint")}
        </p>
        <button
          type="button"
          onClick={onFinish}
          className="min-h-11 rounded-lg bg-[var(--accent-fill)] px-5 font-semibold text-[var(--accent-fill-fg)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          {t("wizard.nav.finish")}
        </button>
      </div>
    </div>
  );
}

interface ResultCardProps {
  testId: string;
  label: string;
  value: string;
  emphasis?: boolean;
}

function ResultCard({
  testId,
  label,
  value,
  emphasis = false,
}: ResultCardProps): React.ReactElement {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border p-4 ${
        emphasis
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}
