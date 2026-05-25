import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useHistoryStore } from '@/stores/historyStore'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { HistoryEntry } from '@/types'
import {
  X, Layers, Zap, Printer, Wrench, HardHat, Monitor,
  Paintbrush, DollarSign, Store, Tags, TrendingUp, Search, FileJson,
  RotateCcw,
} from 'lucide-react'

function formatMoney(value: number) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface DetailModalProps {
  entry: HistoryEntry | null
  onClose: () => void
}

function DetailModal({ entry, onClose }: DetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do produto"
    >
      <div
        ref={dialogRef}
        className="glass rounded-2xl p-6 w-[90%] max-w-md max-h-[80vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold gradient-text">{entry.name}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-white flex items-center justify-center p-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-colors hover:bg-white/5"
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
    <div className={`flex justify-between items-center border-b border-white/5 pb-1.5 pt-1 ${bold ? 'font-bold' : ''}`}>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="w-3.5 h-3.5 flex items-center justify-center text-gray-500">{icon}</span>
        <span className={bold ? 'text-gray-300' : ''}>{label}</span>
      </div>
      <span className={bold ? 'text-indigo-400' : 'text-gray-200'}>{value}</span>
    </div>
  )
}

interface HistoryTabProps {
  onLoadToCalculator?: () => void
}

export function HistoryTab({ onLoadToCalculator }: HistoryTabProps) {
  const { t } = useTranslation()
  const store = useHistoryStore()
  const [search, setSearch] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Sync local search state with store
  useEffect(() => {
    store.setSearch(search)
  }, [search])

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

  // Filter type tabs
  const filterTabs = [
    { key: 'all' as const, label: 'Todos' },
    { key: 'fdm' as const, label: 'FDM' },
    { key: 'resin' as const, label: 'Resina' },
  ]

  return (
    <div className="glass rounded-2xl p-5 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
        {t('history.title')}
      </h2>

      {/* Filter type tabs */}
      <div className="flex gap-2 mb-4">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => store.setFilterType(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              store.filterType === tab.key
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <select
          value={store.sortBy}
          onChange={e => store.setSortBy(e.target.value as 'date' | 'price' | 'profit' | 'name')}
          className="bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="date">Data</option>
          <option value="price">Preço</option>
          <option value="profit">Lucro</option>
          <option value="name">Nome</option>
        </select>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('history.search')}
          className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-xl text-sm text-white h-12 pl-10 pr-4 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/60 transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">{t('history.empty')}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filtered.map(entry => (
            <div key={entry.id} className="glass rounded-xl p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm font-semibold">{entry.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(entry.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  <span className="ml-2 uppercase text-[10px] text-indigo-400/60">{entry.type}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-400">{formatMoney(entry.sellPrice)}</span>
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
                  className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  {t('history.details')}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="p-1.5 text-xs rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none flex items-center justify-center"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleExport}
        className="w-full mt-4 py-2.5 rounded-xl text-sm glass text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center justify-center gap-2"
      >
        <FileJson className="w-4 h-4" />
        {t('history.exportJson')}
      </button>

      <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
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
