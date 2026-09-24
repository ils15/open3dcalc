import { CircleDollarSign, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
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
  const { t } = useTranslation();
  const { format } = useCurrency();

  return (
    <BentoCard title={t("bento.cards.summary")} icon={CircleDollarSign} id="bento-summary">
      <dl className="grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.sellPrice")}
          value={format(sellPrice)}
          tone="revenue"
        />
        <BentoMetric
          label={t("bento.fields.totalCost")}
          value={format(totalCost)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.taxAmount")}
          value={format(taxAmount)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.marketplaceFeeAmount")}
          value={format(marketplaceFee)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.totalFees")}
          value={format(totalFees)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.profit")}
          value={format(profit)}
          tone={profit < 0 ? "negative" : "revenue"}
        />
      </dl>
      <button
        type="button"
        disabled={!hasResult}
        onClick={onSave}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text-inverse)] outline-none hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FolderOpen aria-hidden="true" className="size-4" />
        {t("bento.saveHistory")}
      </button>
    </BentoCard>
  );
}
