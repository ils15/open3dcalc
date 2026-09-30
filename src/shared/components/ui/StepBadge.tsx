export type StepBadgeSize = "sm" | "md" | "lg";

export interface StepBadgeProps {
  /** 1-based position. Purely a number, so it needs no translation. */
  readonly step: number;
  /** Paints the accent fill used by the Guided wizard's current step. */
  readonly current?: boolean;
  readonly size?: StepBadgeSize;
}

const SIZE_CLASS: Record<StepBadgeSize, string> = {
  sm: "h-4 w-4 text-[9px]",
  md: "h-5 w-5 text-[10px]",
  lg: "h-6 w-6 text-[11px]",
};

/**
 * Circular numeral shared by the Guided wizard stepper and the Classic section
 * navigation, so the two never drift apart visually.
 *
 * `aria-hidden` is deliberate and load-bearing: the numeral is a redundant cue
 * beside a name that is already spoken. Leaving it exposed would rewrite every
 * accessible name in the Classic nav from "Material" to "1 Material".
 */
export function StepBadge({
  step,
  current = false,
  size = "lg",
}: StepBadgeProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="step-badge"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${
        SIZE_CLASS[size]
      } ${
        current
          ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)]"
          : "bg-[var(--color-bg-elevated)]"
      }`}
    >
      {step}
    </span>
  );
}
