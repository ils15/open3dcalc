import { useTranslation } from "react-i18next";

import { effectiveTareGrams, remainingNetGrams } from "@/shared/lib/filamentRemaining";
import type { FilamentSpool } from "@/shared/stores/spoolStore";

export interface BentoSpoolGaugeProps {
  readonly spool: FilamentSpool | null;
}

/** Accessible remaining-filament gauge sourced from the real inventory spool. */
export function BentoSpoolGauge({ spool }: BentoSpoolGaugeProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const numberLocale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const formatNumber = (value: number): string =>
    value.toLocaleString(numberLocale, { maximumFractionDigits: 1 });

  if (!spool) {
    return (
      <p className="rounded-xl bg-[var(--surface-sunken)] p-3 text-sm text-[var(--text-secondary)]">
        {t("bento.noSpool")}
      </p>
    );
  }

  const tare = effectiveTareGrams(spool, spool.tareGrams);
  const remaining = remainingNetGrams(spool, spool.tareGrams);
  const originalNet = Math.max(0, spool.originalWeightGrams - tare);
  const percentage =
    originalNet > 0
      ? Math.min(100, Math.max(0, Math.round((remaining / originalNet) * 100)))
      : 0;
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

  return (
    <div className="rounded-xl bg-[var(--surface-sunken)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-[var(--text-primary)]">{spoolName}</span>
        <span className="shrink-0 text-[var(--text-secondary)]">{remainingLabel}</span>
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
