import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { ComparisonModal } from '@/shared/components/ui/ComparisonModal'
import { useCurrency } from '@/shared/hooks/useCurrency'
import type { HistoryEntry } from '@/shared/types'
import { Select } from '@/shared/components/ui/Select'
import {
  X, Layers, Zap, Printer, Wrench, HardHat, Monitor,
  Paintbrush, DollarSign, Store, Tags, TrendingUp, Search, FileJson,
  Upload, CheckSquare, RotateCcw, Clock,
} from 'lucide-react'
import { EmptyState } from '@/shared/components/ui/EmptyState'

interface DetailModalProps {
  entry: HistoryEntry | null
  onClose: () => void
}

function DetailModal({ entry, onClose }: DetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { format: formatMoney } = useCurrency()

  // Focus trap + ESC close
  useEffect(() => {
    if (!entry) return

    // Move focus to close button when modal opens
    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }

      // Focus trap
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [entry, onClose])

  if (!entry) return null

  const d = entry.result
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do produto"
    >
      <div
        ref={dialogRef}
        className="surface rounded-xl p-6 w-[90%] max-w-md max-h-[80vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold gradient-text">{entry.name}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center p-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none transition-colors hover:bg-[var(--color-bg-elevated)]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <Row icon={<DollarSign />} label="Preço Final" value={formatMoney(d.sellPrice)} bold />
          <Row icon={<Layers />} label="Material" value={formatMoney(d.materialCost)} />
          <Row icon={<Zap />} label="Energia" value={formatMoney(d.energyCost)} />
          <Row icon={<Printer />} label="Máquina" value={formatMoney(d.machineCost)} />
          <Row icon={<Wrench />} label="Hardware" value={formatMoney(d.hardwareCost)} />
          <Row icon={<HardHat />} label="Mão de Obra" value={formatMoney(d.laborCost)} />
          <Row icon={<Monitor />} label="Software" value={formatMoney(d.softwareCost)} />
          <Row icon={<Paintbrush />} label="Acabamento" value={formatMoney(d.postProcessingCost)} />
          <Row icon={<DollarSign />} label="Custo Total" value={formatMoney(d.totalCost)} bold />
          <Row icon={<Store />} label="Taxa Marketplace" value={formatMoney(d.marketplaceFee)} />
          <Row icon={<Tags />} label="Impostos" value={formatMoney(d.taxAmount)} />
          <Row icon={<TrendingUp />} label="Lucro Líquido" value={formatMoney(d.profit)} bold />
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, value, bold = false }: { icon: React.ReactNode; label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center border-b border-[var(--color-border)] pb-1.5 pt-1 ${bold ? 'font-bold' : ''}`}>
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        <span className="w-3.5 h-3.5 flex items-center justify-center text-[var(--color-text-muted)]">{icon}</span>
        <span className={bold ? 'text-[var(--color-text-secondary)]' : ''}>{label}</span>
      </div>
      <span className={bold ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}>{value}</span>
    </div>
  )
}

// Date conversion helpers
const dateStrToEpoch = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

const epochToDateStr = (epoch: number | null): string => {
  if (epoch === null) return ''
  const d = new Date(epoch)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

interface HistoryTabProps {
  onLoadToCalculator?: () => void
}

export function HistoryTab({ onLoadToCalculator }: HistoryTabProps) {
  const { t, i18n } = useTranslation()
  const { format: formatMoney } = useCurrency()
  const store = useHistoryStore()
  const setStoreSearch = store.setSearch
  const { dateFrom, dateTo, setDateFrom, setDateTo, entries } = store
  const [search, setSearch] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<string | null>(null)

  // Sync local search state with store
  useEffect(() => {
    setStoreSearch(search)
  }, [search, setStoreSearch])

  const filtered = store.getFilteredEntries()

  const handleLoadToCalculator = (entry: HistoryEntry) => {
    if (entry.snapshot) {
      useCalculatorStore.getState().loadHistoryItem(entry.snapshot)
      onLoadToCalculator?.()
    }
  }

  const handleExport = useCallback(() => {
    const data = store.exportJson()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'open3dcalc_export.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [store])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = store.importJson(ev.target?.result as string)
        if (result.imported === 0 && result.skipped === 0) {
          setImportResult(t('history.importError'))
        } else {
          setImportResult(t('history.importSuccess', { imported: result.imported, skipped: result.skipped }))
        }
      } catch {
        setImportResult(t('history.importError'))
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  useEffect(() => {
    if (!importResult) return
    const timer = setTimeout(() => setImportResult(null), 3000)
    return () => clearTimeout(timer)
  }, [importResult])

  const compareEntries = useMemo(() => {
    if (selectedForCompare.length !== 2) return []
    return selectedForCompare.map(id => store.getEntry(id)).filter(Boolean) as HistoryEntry[]
  }, [selectedForCompare, store])

  const toggleCompare = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  // Filter type tabs
  const filterTabs = [
    { key: 'all' as const, label: t('history.filters.all') },
    { key: 'fdm' as const, label: 'FDM' },
    { key: 'resin' as const, label: t('history.filters.resin') },
  ]

  return (
    <div className="surface rounded-xl p-5 animate-fade-in">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 border-b border-[var(--color-border)] pb-2">
        {t('history.title')}
      </h2>

      {/* Filter type tabs + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => store.setFilterType(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap ${
                store.filterType === tab.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select
            label=""
            value={store.sortBy}
            onChange={v => store.setSortBy(v as 'date' | 'price' | 'profit' | 'name')}
            options={[
              { label: t('history.sort.date'), value: 'date' },
              { label: t('history.sort.price'), value: 'price' },
              { label: t('history.sort.profit'), value: 'profit' },
              { label: t('history.sort.name'), value: 'name' },
            ]}
            search={false}
            className="w-28"
          />
          <button onClick={() => setShowComparison(true)} disabled={selectedForCompare.length !== 2}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1.5 ${
              selectedForCompare.length === 2 ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> {t('history.compare')} ({selectedForCompare.length}/2)
          </button>
        </div>
      </div>

      {/* Date range filter */}
      {entries.length > 0 && (
        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('history.dateFrom')}</label>
            <input
              type="date"
              value={epochToDateStr(dateFrom)}
              onChange={e => setDateFrom(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              aria-label={t('history.dateFrom')}
              className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-lg text-sm text-[var(--color-text-primary)] h-9 px-3 placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('history.dateTo')}</label>
            <input
              type="date"
              value={epochToDateStr(dateTo)}
              onChange={e => setDateTo(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              aria-label={t('history.dateTo')}
              className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-lg text-sm text-[var(--color-text-primary)] h-9 px-3 placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all w-40"
            />
          </div>
          {(dateFrom !== null || dateTo !== null) && (
            <button
              onClick={() => { setDateFrom(null); setDateTo(null) }}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[36px]"
            >
              {t('history.clearFilters')}
            </button>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('history.search')}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-12 pl-10 pr-4 placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nenhum cálculo salvo ainda"
          description="Seus cálculos aparecerão aqui após você salvá-los clicando em 'Salvar no Histórico' no painel de resultados."
        />
      ) : (
        <div className="space-y-2 max-h-[60vh] sm:max-h-80 overflow-y-auto">
          {filtered.map(entry => (
            <div key={entry.id} className={`surface rounded-xl p-3 flex items-center gap-3 hover:bg-[var(--color-bg-elevated)] transition-colors ${selectedForCompare.includes(entry.id) ? 'ring-2 ring-[var(--color-accent)]/50' : ''}`}>
              <input type="checkbox" checked={selectedForCompare.includes(entry.id)} onChange={() => toggleCompare(entry.id)}
                className="accent-[var(--color-accent)] w-4 h-4 flex-shrink-0 cursor-pointer" />
              <div>
                <p className="text-sm font-semibold">{entry.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {new Date(entry.timestamp).toLocaleDateString(i18n.resolvedLanguage || i18n.language, { hour: '2-digit', minute: '2-digit' })}
                  <span className="ml-2 uppercase text-[10px] text-[var(--color-accent)]/60">{entry.type}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--color-success)]">{formatMoney(entry.sellPrice)}</span>
                {entry.snapshot && (
                  <button
                    onClick={() => handleLoadToCalculator(entry)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none flex items-center gap-1"
                    title="Carregar na calculadora"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedEntry(entry)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  {t('history.details')}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="p-1.5 text-xs rounded-lg bg-red-600/20 text-[var(--color-danger)] hover:bg-red-600 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none flex items-center justify-center"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={handleExport}
          className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm surface text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2"
        >
          <FileJson className="w-4 h-4" /> {t('history.exportJson')}
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm surface text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" /> {t('history.importJson')}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
      {importResult && (
        <div className="mt-2 text-xs text-center text-[var(--color-success)] animate-fade-in">{importResult}</div>
      )}

      <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      {compareEntries.length === 2 && showComparison && (
        <ComparisonModal entryA={compareEntries[0]} entryB={compareEntries[1]} onClose={() => { setShowComparison(false); setSelectedForCompare([]) }} />
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Remover produto"
        message={t('history.deleteConfirm')}
        variant="danger"
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            store.removeEntry(confirmDeleteId)
          }
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
