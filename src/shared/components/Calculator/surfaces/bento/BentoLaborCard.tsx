import { HandCoins } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import type { LaborCosts } from "@/shared/types";
import { BentoCard } from "./BentoCard";
import { BentoMetric } from "./BentoMetric";

export interface BentoLaborCardProps {
  readonly labor: LaborCosts;
  readonly laborCost: number;
  readonly extrasCost: number;
}

/** Setup, post-processing, hourly rate and extras in one labour summary. */
export function BentoLaborCard({
  labor,
  laborCost,
  extrasCost,
}: BentoLaborCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const minutesLabel = (minutes: number): string => t("bento.minuteCount", { count: minutes });

  return (
    <BentoCard title={t("bento.cards.labor")} icon={HandCoins}>
      <dl className="grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.setup")}
          value={minutesLabel(labor.setupTimeMinutes)}
          tone="labor"
        />
        <BentoMetric
          label={t("bento.fields.postProcessing")}
          value={minutesLabel(labor.postProcessingTimeMinutes)}
          tone="labor"
        />
        <BentoMetric
          label={t("bento.fields.hourlyRate")}
          value={`${format(labor.hourlyRate)} / h`}
          tone="labor"
        />
        <BentoMetric
          label={t("bento.fields.laborCost")}
          value={format(laborCost)}
          tone="labor"
        />
        <BentoMetric
          label={t("bento.fields.extras")}
          value={format(extrasCost)}
          tone="other"
        />
      </dl>
    </BentoCard>
  );
}
