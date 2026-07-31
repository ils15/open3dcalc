import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown } from 'lucide-react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export interface SelectOption {
  value: string
  label: string
  image?: string
  subtitle?: string
  group?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label: string
  placeholder?: string
  search?: boolean
  groups?: boolean
  portal?: boolean
  className?: string
}

function getMonogram(text: string): string {
  const words = text.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

export function Select({
  value, onChange, options, label, placeholder,
  search = true, groups = false, portal = false, className = '',
}: SelectProps) {
  const id = useId()
  const prefersReduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusIdx, setFocusIdx] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.subtitle || '').toLowerCase().includes(q) ||
      (o.group || '').toLowerCase().includes(q)
    )
  }, [options, query])

  const grouped = useMemo(() => {
    if (!groups) return [{ group: '', items: filtered }]
    const map = new Map<string, SelectOption[]>()
    filtered.forEach(o => {
      const g = o.group || 'Outros'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(o)
    })
    return Array.from(map.entries()).map(([g, items]) => ({ group: g, items }))
  }, [filtered, groups])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setFocusIdx(-1)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); triggerRef.current?.focus(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < filtered.length) {
        onChange(filtered[focusIdx].value); close(); return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, focusIdx, onChange, close])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (portalRef.current?.contains(e.target as Node)) return
      if (listRef.current?.contains(e.target as Node)) return
      close()
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open, close])

  useEffect(() => {
    if (open && focusIdx >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${focusIdx}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx, open])

  const triggerContent = (
    <button
      ref={triggerRef}
      id={`${id}-trigger`}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={`${id}-listbox`}
      aria-label={label}
      onClick={() => setOpen(o => !o)}
      className={`w-full flex items-center gap-2.5 surface border ${open ? 'border-[var(--color-accent)]/60' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'} rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/60 ${className}`}
    >
      {(selected?.group || selected?.image) && (
        <div className="w-6 h-6 rounded-md bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-[var(--color-accent)] leading-none select-none">
          {getMonogram(selected.group || selected.label)}
        </div>
      )}
      <span className={`flex-1 text-left truncate ${selected ? '' : 'text-[var(--color-text-muted)]'}`}>
        {selected ? selected.label : (placeholder || label)}
      </span>
      {selected?.subtitle && (
        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 hidden sm:inline">{selected.subtitle}</span>
      )}
      <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )

  const dropdownContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-label={label}
          initial={{ opacity: 0, scaleY: 0.95, transformOrigin: 'top' }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.95 }}
          transition={{ duration: prefersReduced ? 0 : 0.15, ease: 'easeOut' }}
          className="z-50 w-full mt-1.5 surface border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden"
          style={portal ? { position: 'absolute', left: 0, top: '100%' } : {}}
        >
          {search && (
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setFocusIdx(0) }}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {grouped.length === 1 ? (
              grouped[0].items.map((opt, i) => (
                <OptionItem key={opt.value} opt={opt} idx={i} focusIdx={focusIdx} value={value}
                  onSelect={() => { onChange(opt.value); close() }} />
              ))
            ) : (
              grouped.map(g => (
                <div key={g.group}>
                  {g.group && (
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
                      {g.group}
                    </div>
                  )}
                  {g.items.map((opt, i) => (
                    <OptionItem key={opt.value} opt={opt} idx={i} focusIdx={focusIdx} value={value}
                      onSelect={() => { onChange(opt.value); close() }} />
                  ))}
                </div>
              ))
            )}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Nenhum resultado</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <div className="min-h-[2.5rem] flex items-start">
        <label htmlFor={`${id}-trigger`} className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </label>
      </div>
      {triggerContent}
      {portal ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  )
}

function OptionItem({ opt, idx, focusIdx, value, onSelect }: {
  opt: SelectOption; idx: number; focusIdx: number; value: string; onSelect: () => void
}) {
  const isFocused = focusIdx === idx
  const isSelected = value === opt.value

  return (
    <button
      role="option"
      aria-selected={isSelected}
      data-index={idx}
      onMouseEnter={() => {}}
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
        isFocused ? 'bg-[var(--color-accent)]/20 text-[var(--color-text-primary)]' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
      } ${isSelected ? 'text-[var(--color-text-primary)] font-semibold bg-[var(--color-accent)]/10' : ''}`}
    >
      {(opt.group || opt.image) && (
        <div className="w-6 h-6 rounded-md bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-[var(--color-accent)] leading-none select-none">
          {getMonogram(opt.group || opt.label)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="whitespace-normal break-words">{opt.label}</div>
        {opt.subtitle && <div className="text-[10px] text-[var(--color-text-muted)] truncate">{opt.subtitle}</div>}
      </div>
      {isSelected && <Check className="w-4 h-4 text-[var(--color-accent)] shrink-0" />}
    </button>
  )
}
