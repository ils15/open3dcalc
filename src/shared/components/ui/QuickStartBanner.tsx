import { Zap, RotateCcw, X } from 'lucide-react'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useState } from 'react'

const BANNER_KEY = 'open3dcalc_quickstart_dismissed'

export function QuickStartBanner() {
  const setQuickStart = useCalculatorStore((s) => s.setQuickStart)
  const resetCalculator = useCalculatorStore((s) => s.resetCalculator)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(BANNER_KEY) === 'true')

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(BANNER_KEY, 'true')
  }

  if (dismissed) return null

  return (
    <div className="surface rounded-xl p-3 sm:p-4 border border-[var(--color-accent)]/20 bg-gradient-to-r from-[var(--color-accent)]/5 to-transparent relative">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        aria-label="Dispensar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 pr-5">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            Quer ver como funciona?
          </p>
          <p className="text-[10px] sm:text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
            Preencha a calculadora com valores realistas para um exemplo de peça 3D
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={resetCalculator}
            className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1"
            aria-label="Limpar campos"
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Limpar</span>
          </button>
          <button
            onClick={setQuickStart}
            className="min-h-[44px] px-3 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors shadow-md shadow-[var(--color-accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1"
            aria-label="Preencher com exemplo"
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Exemplo
          </button>
        </div>
      </div>
    </div>
  )
}
