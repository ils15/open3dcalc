import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";

import { effectiveTareGrams, remainingNetGrams } from "@/shared/lib/filamentRemaining";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { BentoCard } from "./BentoCard";
import { BentoMetric } from "./BentoMetric";

export interface BentoMaterialCardProps {
  readonly materialType: string;
  readonly unitWeight: number;
  readonly costPerKg: number;
  readonly materialCost: number;
  readonly selectedSpoolId: string | null;
}

/** Material economics plus a gauge backed by the user's actual spool inventory. */
export function BentoMaterialCard({
  materialType,
  unitWeight,
  costPerKg,
  materialCost,
  selectedSpoolId,
}: BentoMaterialCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { format } = useCurrency();
  const spools = useSpoolStore((state) => state.spools);
  const spool =
    spools.find((item) => item.id === selectedSpoolId) ??
    spools.find(
      (item) =>
        item.status === "in_stock" &&
        item.material.toLowerCase() === materialType.toLowerCase(),
    ) ??
    null;

  const numberLocale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const formatNumber = (value: number): string =>
    value.toLocaleString(numberLocale, { maximumFractionDigits: 1 });

  let gauge: React.ReactNode = (
    <p className="rounded-xl bg-[var(--surface-sunken)] p-3 text-sm text-[var(--text-secondary)]">
      {t("bento.noSpool")}
    </p>
  );

  if (spool) {
    const tare = effectiveTareGrams(spool, spool.tareGrams);
    const remaining = remainingNetGrams(spool, spool.tareGrams);
    const originalNet = Math.max(0, spool.originalWeightGrams - tare);
    const percentage =
      originalNet > 0 ? Math.min(100, Math.max(0, Math.round((remaining / originalNet) * 100))) : 0;
    const remainingLabel = t("bento.remainingWeight", {
      weight: formatNumber(remaining),
    });
    const valueText = t("bento.spoolValueText", {
      remaining: formatNumber(remaining),
      original: formatNumber(originalNet),
      percentage,
    });
    const spoolName = t("bento.spoolName", {
      brand: spool.brand,
      material: spool.material,
      color: spool.color,
    });

    gauge = (
      <div className="rounded-xl bg-[var(--surface-sunken)] p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[var(--text-primary)]">{spoolName}</span>
          <span className="shrink-0 text-[var(--text-secondary)]">
            {remainingLabel}
          </span>
        </div>
        <progress
          role="progressbar"
          aria-label={spoolName}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          aria-valuetext={valueText}
          value={percentage}
          max={100}
          className="h-2 w-full overflow-hidden rounded-full accent-[var(--color-cost-filament)]"
        />
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{valueText}</p>
      </div>
    );
  }

  return (
    <BentoCard title={t("bento.cards.material")} icon={Boxes}>
      <dl className="grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.preset")}
          value={materialType}
          tone="filament"
        />
        <BentoMetric
          label={t("bento.fields.weight")}
          value={`${formatNumber(unitWeight)} g`}
          tone="filament"
        />
        <BentoMetric
          label={t("bento.fields.costPerKg")}
          value={format(costPerKg)}
          tone="cost"
        />
        <BentoMetric
          label={t("bento.fields.materialCost")}
          value={format(materialCost)}
          tone="cost"
        />
      </dl>
      <div className="mt-3">{gauge}</div>
    </BentoCard>
  );
}
