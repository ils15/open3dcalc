import { Info, AlertCircle } from "lucide-react";
import { useId } from "react";
import { Tooltip } from "@/shared/components/ui/Tooltip";

interface InputGroupProps {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  unit?: string;
  placeholder?: string;
  tooltip?: string;
  prefix?: string;
  step?: string;
  className?: string;
  error?: string | null;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function InputGroup({
  label,
  value,
  onChange,
  type = "text",
  unit,
  placeholder,
  tooltip,
  prefix,
  step,
  className = "",
  error,
  onBlur,
  onFocus,
}: InputGroupProps) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-start gap-2 min-h-[2.5rem]">
        <label
          htmlFor={id}
          className={`text-[12px] font-semibold uppercase tracking-wider ${error ? "text-[var(--critical)]" : "text-[var(--text-secondary)]"}`}
        >
          {label}
        </label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <Info className="w-3.5 h-3.5 text-[var(--text-muted)] cursor-help" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {prefix && (
          <span className="text-[var(--text-muted)] text-[11px] font-mono shrink-0 w-8 text-center">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder={placeholder}
          step={step}
          className={`flex-1 min-w-0 bg-[var(--surface-input)] border rounded-lg text-sm text-[var(--text-primary)] min-h-[44px] px-2.5 transition-all placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-disabled)] ${
            error
              ? "border-[var(--critical)]/60 focus:border-[var(--critical)] focus:ring-[var(--critical)]/50"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]/60 focus:ring-[var(--accent)]"
          }`}
        />
        {unit && (
          <span className="text-[11px] font-mono text-[var(--text-muted)] w-8 shrink-0">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <div
          id={`${id}-error`}
          className="flex items-center gap-1 text-[11px] text-[var(--critical)] mt-0.5"
          role="alert"
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface SelectGroupProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string; image?: string }[];
}

export function SelectGroup({
  label,
  value,
  onChange,
  options,
}: SelectGroupProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[12px] sm:text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl text-[0.95rem] text-[var(--text-primary)] min-h-[44px] px-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/60 outline-none transition-all appearance-none cursor-pointer disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-disabled)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
