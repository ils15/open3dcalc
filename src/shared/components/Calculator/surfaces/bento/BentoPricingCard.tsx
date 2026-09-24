import { BadgeDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import type { CalculationResult, SalesParameters } from "@/shared/types";
import { BentoCard } from "./BentoCard";
import { BentoMetric } from "./BentoMetric";

export interface BentoPricingCardProps {
  readonly result: CalculationResult;
  readonly sales: SalesParameters;
  readonly quantity: number;
  readonly breakEvenPrice: number;
  readonly profit: number;
}

/** Commercial assumptions and break-even signals; no calculation is performed here. */
export function BentoPricingCard({
  result,
  sales,
  quantity,
  breakEvenPrice,
  profit,
}: BentoPricingCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const percent = (value: number): string => `${value.toLocaleString()}%`;
  const marginTone = result.actualMargin < 0 ? "negative" : "margin";

  return (
    <BentoCard
      title={t("bento.cards.pricing")}
      icon={BadgeDollarSign}
      className="lg:col-span-2"
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BentoMetric
          label={t("bento.fields.targetMargin")}
          value={percent(result.targetMarginPercent)}
          tone="margin"
        />
        <BentoMetric
          label={t("bento.fields.actualMargin")}
          value={percent(result.actualMargin)}
          tone={marginTone}
        />
        <BentoMetric
          label={t("bento.fields.fee")}
          value={percent(sales.marketplaceFeePercent)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.tax")}
          value={percent(sales.taxPercent)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.failure")}
          value={format(result.failureCost)}
          tone="failure"
        />
        <BentoMetric
          label={t("bento.fields.quantity")}
          value={quantity.toLocaleString()}
          tone="neutral"
        />
        <BentoMetric
          label={t("bento.fields.breakEven")}
          value={format(breakEvenPrice)}
          tone="margin"
        />
        <BentoMetric
          label={t("bento.fields.profit")}
          value={format(profit)}
          tone={profit < 0 ? "negative" : "revenue"}
        />
      </dl>
    </BentoCard>
  );
}
