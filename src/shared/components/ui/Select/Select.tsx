import { useState, useEffect, useId, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useFloating,
  offset,
  flip,
  shift,
  size,
  autoUpdate,
  FloatingPortal,
  useMergeRefs,
} from '@floating-ui/react'
import { Search, Check, ChevronDown } from 'lucide-react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { useDismissablePopover } from '@/shared/hooks/useDismissablePopover'

export interface SelectOption {
  value: string
  label: string
  image?: string
  /** Hex de um swatch de cor — renderiza um círculo colorido no item e no trigger. */
  color?: string
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
  /** @deprecated O menu agora é sempre portado — a prop é aceita por compatibilidade da API pública. */
  portal?: boolean
  className?: string
}

/** Altura máxima do menu em desktop; em mobile vira fração da viewport. */
const MENU_MAX_HEIGHT = 420
/** Largura (px) em que o menu vira bottom sheet. */
const MOBILE_BREAKPOINT = '(max-width: 640px)'

function getMonogram(text: string): string {
  const words = text.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

/**
 * Menu em bottom sheet abaixo de 640px. Precisa ser reativo (girar tela,
 * redimensionar janela) — segue o mesmo padrão do useReducedMotion.
 */
function useMobileSheet(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(MOBILE_BREAKPOINT).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(MOBILE_BREAKPOINT)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobile
}

export function Select({
  value, onChange, options, label, placeholder,
  search = true, groups = false, className = '',
}: SelectProps) {
  const id = useId()
  const prefersReduced = useReducedMotion()
  const isMobile = useMobileSheet()

  const { open, setOpen, toggle, close, triggerRef, contentRef } = useDismissablePopover<HTMLButtonElement>()
  const [query, setQuery] = useState('')
  const [focusIdx, setFocusIdx] = useState(-1)

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

  const { x, y, strategy, refs } = useFloating({
    placement: 'bottom-start',
    open,
    onOpenChange: setOpen,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, rects, elements }) {
          const el = elements.floating
          if (isMobile) {
            // Largura/altura vêm do sheet (left/right + max-h da classe).
            el.style.maxHeight = ''
            el.style.width = ''
            return
          }
          el.style.maxHeight = `${Math.max(0, Math.min(availableHeight, MENU_MAX_HEIGHT))}px`
          el.style.width = `${rects.reference.width}px`
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

  const setTriggerRef = useMergeRefs([triggerRef, refs.setReference])
  const setContentRef = useMergeRefs([contentRef, refs.setFloating])

  // Toda abertura passa pelo clique no trigger — reseta busca/foco ali
  // (em vez de num effect), cobrindo Escape/click-outside/seleção.
  const handleTriggerClick = useCallback(() => {
    if (!open) {
      setQuery('')
      setFocusIdx(-1)
    }
    toggle()
  }, [open, toggle])

  // Seta/Enter — Escape e click-outside vêm do useDismissablePopover.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
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
    if (open && focusIdx >= 0 && contentRef.current) {
      const el = contentRef.current.querySelector(`[data-index="${focusIdx}"]`)
      el?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [focusIdx, open, contentRef])

  const floatingStyle: CSSProperties = isMobile
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 'var(--z-dropdown)' }
    : { position: strategy, top: y ?? 0, left: x ?? 0, zIndex: 'var(--z-dropdown)' }

  const triggerContent = (
    <button
      ref={setTriggerRef}
      id={`${id}-trigger`}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={`${id}-listbox`}
      aria-label={label}
      onClick={handleTriggerClick}
      className={`w-full flex items-center gap-2.5 surface border ${open ? 'border-[var(--color-accent)]/60' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'} rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/60 ${className}`}
    >
      {selected?.color ? (
        <span
          aria-hidden="true"
          className="w-6 h-6 rounded-full shrink-0 border border-[var(--color-border)]"
          style={{ backgroundColor: selected.color }}
        />
      ) : (selected?.group || selected?.image) && (
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

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <div className="min-h-[2.5rem] flex items-start">
        <label htmlFor={`${id}-trigger`} className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </label>
      </div>
      {triggerContent}
      <FloatingPortal>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={setContentRef}
              id={`${id}-listbox`}
              role="listbox"
              aria-label={label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.15, ease: 'easeOut' }}
              style={floatingStyle}
              className={`flex flex-col surface border border-[var(--color-border)] shadow-2xl overflow-hidden ${
                isMobile ? 'rounded-t-2xl max-h-[60dvh]' : 'rounded-xl'
              }`}
            >
              {search && (
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] shrink-0">
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
              <div className="flex-1 min-h-0 overflow-y-auto py-1">
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
      </FloatingPortal>
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
      {opt.color ? (
        <span
          aria-hidden="true"
          className="w-6 h-6 rounded-full shrink-0 border border-[var(--color-border)]"
          style={{ backgroundColor: opt.color }}
        />
      ) : (opt.group || opt.image) && (
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
