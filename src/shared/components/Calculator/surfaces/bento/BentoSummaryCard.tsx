import { CircleDollarSign, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import {
  deriveRealMarginPercent,
  formatRealMarginPercent,
  SAFE_MARGIN_PLACEHOLDER,
} from "@/shared/lib/realMargin";
import { BentoCard } from "./BentoCard";
import { BentoMetric } from "./BentoMetric";

export interface BentoSummaryCardProps {
  readonly sellPrice: number;
  readonly totalCost: number;
  readonly taxAmount: number;
  readonly marketplaceFee: number;
  readonly totalFees: number;
  readonly profit: number;
  readonly hasResult: boolean;
  readonly onSave: () => void;
}

/** Final financial roll-up and the surface's history CTA. */
export function BentoSummaryCard({
  sellPrice,
  totalCost,
  taxAmount,
  marketplaceFee,
  totalFees,
  profit,
  hasResult,
  onSave,
}: BentoSummaryCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { format } = useCurrency();
  const reducedMotion = useReducedMotion();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const realMargin = deriveRealMarginPercent(profit, sellPrice);
  const formatSafeAmount = (value: number): string =>
    Number.isFinite(value) ? format(value) : SAFE_MARGIN_PLACEHOLDER;
  const marginTone =
    realMargin === null ? "neutral" : realMargin < 0 ? "negative" : "margin";
  const profitTone = !Number.isFinite(profit)
    ? "neutral"
    : profit < 0
      ? "negative"
      : "revenue";
  const motionClass = reducedMotion
    ? "transition-none"
    : "transition-colors duration-150";

  return (
    <BentoCard title={t("bento.cards.summary")} icon={CircleDollarSign} id="bento-summary">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <BentoMetric
          label={t("bento.fields.sellPrice")}
          value={formatSafeAmount(sellPrice)}
          tone="revenue"
          valueClassName="text-2xl sm:text-3xl"
        />
        <BentoMetric
          label={t("bento.fields.totalCost")}
          value={formatSafeAmount(totalCost)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.taxAmount")}
          value={formatSafeAmount(taxAmount)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.marketplaceFeeAmount")}
          value={formatSafeAmount(marketplaceFee)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.totalFees")}
          value={formatSafeAmount(totalFees)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.profit")}
          value={formatSafeAmount(profit)}
          tone={profitTone}
        />
        <BentoMetric
          label={t("bento.fields.actualMargin")}
          value={formatRealMarginPercent(realMargin, locale)}
          tone={marginTone}
          valueClassName="text-lg"
        />
      </dl>
      <button
        type="button"
        disabled={!hasResult}
        onClick={onSave}
        className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text-inverse)] outline-none hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-60 ${motionClass}`}
      >
        <FolderOpen aria-hidden="true" className="size-4" />
        {t("bento.saveHistory")}
      </button>
    </BentoCard>
  );
}
