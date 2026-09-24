import { useId } from "react";

export interface BentoToggleFieldProps {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** Accessible checkbox row for compact binary cost assumptions. */
export function BentoToggleField({
  label,
  description,
  checked,
  onChange,
}: BentoToggleFieldProps): React.ReactElement {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <label
      htmlFor={id}
      className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3 sm:col-span-2"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
        <span
          id={descriptionId}
          className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]"
        >
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        aria-describedby={descriptionId}
        className="size-5 shrink-0 accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-sunken)]"
      />
    </label>
  );
}
