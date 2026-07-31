import { Info, AlertCircle } from 'lucide-react'
import { useId } from 'react'
import { Tooltip } from '@/shared/components/ui/Tooltip'

interface InputGroupProps {
  label: string
  value: number | string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  unit?: string
  placeholder?: string
  tooltip?: string
  prefix?: string
  step?: string
  className?: string
  error?: string | null
}

export function InputGroup({
  label, value, onChange, type = 'text', unit, placeholder,
  tooltip, prefix, step, className = '', error,
}: InputGroupProps) {
  const id = useId()

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-start gap-2 min-h-[2.5rem]">
        <label htmlFor={id} className={`text-[12px] font-semibold uppercase tracking-wider ${error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
          {label}
        </label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] cursor-help" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {prefix && (
          <span className="text-[var(--color-text-muted)] text-[11px] font-mono shrink-0 w-8 text-center">{prefix}</span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className={`flex-1 min-w-0 bg-[var(--color-bg-elevated)] border rounded-lg text-sm text-[var(--color-text-primary)] min-h-[44px] px-2.5 transition-all placeholder:text-[var(--color-text-muted)]/70 focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/50'
              : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-accent)]/60 focus:ring-[var(--color-accent)]'
          }`}
        />
        {unit && (
          <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-8 shrink-0">{unit}</span>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--color-danger)] mt-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

interface SelectGroupProps {
  label: string
  value: string
  onChange: (val: string) => void
  options: { label: string; value: string; image?: string }[]
}

export function SelectGroup({ label, value, onChange, options }: SelectGroupProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12px] sm:text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-[0.95rem] text-[var(--color-text-primary)] min-h-[44px] px-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 outline-none transition-all appearance-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
