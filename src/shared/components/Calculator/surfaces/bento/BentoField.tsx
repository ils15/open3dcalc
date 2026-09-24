import { useId } from "react";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

export interface BentoFieldOption {
  readonly label: string;
  readonly value: string;
}

export interface BentoFieldProps {
  readonly label: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly type?: "text" | "number";
  readonly options?: readonly BentoFieldOption[];
  readonly unit?: string;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly helper?: string;
  readonly placeholder?: string;
  readonly step?: string | number;
  readonly min?: string | number;
  readonly max?: string | number;
  readonly name?: string;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly onBlur?: () => void;
  readonly onFocus?: () => void;
}

/** Compact, token-backed control used by the editable Bento cards. */
export function BentoField({
  label,
  value,
  onChange,
  type = "text",
  options,
  unit,
  suffix,
  prefix,
  helper,
  placeholder,
  step,
  min,
  max,
  name,
  id,
  ariaLabel,
  disabled = false,
  required = false,
  className = "",
  onBlur,
  onFocus,
}: BentoFieldProps): React.ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-helper`;
  const describedBy = helper ? helperId : undefined;
  const reducedMotion = useReducedMotion();
  const transitionClass = reducedMotion
    ? "transition-none"
    : "transition-colors duration-150";
  const controlClass = `min-h-11 w-full min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-disabled)] ${transitionClass}`;

  const control = options ? (
    <select
      id={fieldId}
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onFocus={onFocus}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel ?? label}
      aria-describedby={describedBy}
      className={controlClass}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ) : (
    <input
      id={fieldId}
      name={name}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onFocus={onFocus}
      disabled={disabled}
      required={required}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      aria-label={ariaLabel ?? label}
      aria-describedby={describedBy}
      className={controlClass}
    />
  );

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={fieldId}
        className="text-xs font-semibold text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">
        {prefix && (
          <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
            {prefix}
          </span>
        )}
        {control}
        {(unit || suffix) && (
          <span className="shrink-0 text-xs font-medium text-[var(--text-secondary)]">
            {unit}
            {suffix}
          </span>
        )}
      </div>
      {helper && (
        <p id={helperId} className="text-[11px] leading-snug text-[var(--text-muted)]">
          {helper}
        </p>
      )}
    </div>
  );
}
