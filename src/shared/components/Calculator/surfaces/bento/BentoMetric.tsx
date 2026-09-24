export type BentoMetricTone =
  | "neutral"
  | "cost"
  | "revenue"
  | "margin"
  | "negative"
  | "filament"
  | "energy"
  | "machine"
  | "labor"
  | "failure"
  | "other";

export interface BentoMetricProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: BentoMetricTone;
}

const TONE_CLASS: Record<BentoMetricTone, string> = {
  neutral: "text-[var(--text-primary)]",
  cost: "text-[var(--color-cost)]",
  revenue: "text-[var(--color-revenue)]",
  margin: "text-[var(--color-margin)]",
  negative: "text-[var(--color-margin-negative)]",
  filament: "text-[var(--color-cost-filament)]",
  energy: "text-[var(--color-cost-energy)]",
  machine: "text-[var(--color-cost-machine)]",
  labor: "text-[var(--color-cost-labor)]",
  failure: "text-[var(--color-cost-failure)]",
  other: "text-[var(--color-cost-other)]",
};

/** A labelled value: color reinforces meaning but never carries it alone. */
export function BentoMetric({
  label,
  value,
  tone = "neutral",
}: BentoMetricProps): React.ReactElement {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--surface-sunken)] p-3">
      <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd
        aria-label={`${label}: ${value}`}
        className={`mt-1 break-words text-sm font-bold ${TONE_CLASS[tone]}`}
      >
        {value}
      </dd>
    </div>
  );
}
