import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from "@/i18n/i18n"
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import {
  FolderOpen, Save, FileText, BarChart2, CheckCircle2, ScrollText,
} from 'lucide-react'
import { exportQuoteJson, downloadQuoteJson } from '@/lib/quoteApi'

interface ResultsPanelProps {
  variant: 'sidebar' | 'mobile'
}

export function ResultsPanel({ variant }: ResultsPanelProps) {
  const { t } = useTranslation()
  const results = useCalculatorStore(s => s.results)
  if (!results) return null
  const productName = useCalculatorStore(s => s.productName)
  const addToHistory = useCalculatorStore(s => s.addToHistory)
  const clearHistory = useHistoryStore(s => s.clearHistory)
  const recentEntries = useHistoryStore(s => s.entries.slice(0, 3))
  const saveSettings = useCalculatorStore(s => s.saveSettings)
  const activeTab = useCalculatorStore(s => s.activeTab)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const isFDM = activeTab === 'fdm'

  const chartData = useMemo((): { name: string; value: number; color: string }[] => {
    const items = [
      { name: 'Material', value: results.materialCost, color: isFDM ? '#38bdf8' : '#a855f7' },
      { name: 'Energia', value: results.energyCost, color: '#facc15' },
      { name: 'Máquina', value: results.machineCost, color: '#94a3b8' },
      { name: 'Hardware', value: results.hardwareCost, color: '#f97316' },
      { name: 'Acabamento', value: results.postProcessingCost, color: '#22d3ee' },
      { name: 'Consumíveis', value: results.consumablesCost, color: '#06b6d4' },
      { name: 'Software', value: results.softwareCost, color: '#818cf8' },
      { name: 'Mão de Obra', value: results.laborCost, color: '#f472b6' },
      { name: 'Falha', value: results.failureCost, color: '#f87171' },
      { name: 'Extras', value: results.extrasCost, color: '#cbd5e1' },
    ].filter(d => d.value > 0.01)
    return items
  }, [results, isFDM])

  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR'
  const fmtCurrency = (val: number) => (val || 0).toLocaleString(locale, { style: 'currency', currency: 'BRL' })

  const isSidebar = variant === 'sidebar'

  const handleExportQuote = () => {
    if (!results) return
    const state = useCalculatorStore.getState()
    const name = state.productName || 'Cotação Open3DCalc'
    const qty = state.quantity || 1
    const isFdm = state.activeTab === 'fdm'
    const pkg = isFdm ? state.fdmSales.packagingCost : state.resinSales.packagingCost
    const ship = isFdm ? state.fdmSales.shippingCost : state.resinSales.shippingCost
    const json = exportQuoteJson(results, name, qty, pkg || 0, ship || 0)
    downloadQuoteJson(json, `quote_${Date.now()}.json`)
  }

  const content = (
    <>
      <div className="result-hero rounded-2xl p-4 sm:p-5 text-center">
        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400/70 mb-2">{t('calc.sellPrice')}</div>
        <div className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">{fmtCurrency(results.sellPrice)}</div>
        {results.taxAmount > 0 && (
          <div className="text-xs sm:text-sm text-emerald-500/80 mt-2">incl. {fmtCurrency(results.taxAmount)} em taxas/marketplace</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl p-4 sm:p-5 bg-white/5 border border-white/10 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t('calc.costPerGram')}</div>
          <div className="text-base sm:text-lg font-black text-cyan-400 font-mono">{results.costPerGram > 0 ? fmtCurrency(results.costPerGram) + '/g' : '---'}</div>
        </div>
        <div className="rounded-xl p-4 sm:p-5 bg-white/5 border border-white/10 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t('breakdown.failure')}</div>
          <div className="text-base sm:text-lg font-black text-red-400 font-mono">{results.failureCost > 0 ? fmtCurrency(results.failureCost) : '---'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl p-4 sm:p-5 bg-white/5 border border-white/10 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t('calc.totalCost')}</div>
          <div className="text-lg sm:text-xl font-black text-green-400 font-mono">{fmtCurrency(results.totalCost)}</div>
        </div>
        <div className="rounded-xl p-4 sm:p-5 bg-orange-900/20 border border-orange-800/30 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400/70 mb-1">{t('calc.profit')}</div>
          <div className="text-lg sm:text-xl font-black text-orange-400 font-mono">{fmtCurrency(results.profit)}</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="glass-elevated rounded-2xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t('calc.costDistribution')}</div>
          <div className="space-y-3">
            {chartData.map(item => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs sm:text-sm text-gray-400">{item.name}</span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-white">{fmtCurrency(item.value)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${results.totalCost > 0 ? (item.value / results.totalCost) * 100 : 0}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-4 w-full ${isSidebar ? 'h-44 sm:h-48' : 'h-48 sm:h-56'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="40%" cy="50%" innerRadius={isSidebar ? 48 : 52} outerRadius={isSidebar ? 68 : 72} paddingAngle={3} dataKey="value">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => fmtCurrency(value)}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#e2e8f0', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }} />
                <Legend layout="vertical" verticalAlign="middle" align="right"
                  iconType="circle" wrapperStyle={{ fontSize: '11px', maxWidth: '42%' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <button onClick={() => addToHistory()}
        className="w-full py-3 rounded-xl text-sm sm:text-[15px] font-semibold transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      >
        <FolderOpen className="w-4 h-4" />
        {t('calc.addHistory')}
      </button>

      {recentEntries.length > 0 && (
        <div className="glass-elevated rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-gray-500">{t('calc.history')} ({recentEntries.length})</span>
            <button onClick={() => setShowClearConfirm(true)}
              className="text-[10px] sm:text-xs text-red-400/70 hover:text-red-400 transition-colors">
              {t('calc.clearHistory')}
            </button>
          </div>
          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {recentEntries.map(item => (
              <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{new Date(item.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="uppercase font-bold tracking-wider">{item.type}</span>
                </div>
                <div className="font-medium text-gray-200 text-xs truncate mb-1">{item.summary}</div>
                <div className="flex justify-between">
                  <span className="text-orange-400 font-mono text-xs">{fmtCurrency(item.profit)}</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">{fmtCurrency(item.sellPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => { saveSettings(); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000) }}
          className={`py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center justify-center gap-1.5 ${
            saveStatus === 'saved'
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}>
          {saveStatus === 'saved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saveStatus === 'saved' ? t('calc.saved') : t('calc.saveSettings')}
        </button>
        <button onClick={async () => { const { exportPdf } = await import('@/lib/pdfExport'); exportPdf(results) }}
          className="py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-700 text-white hover:bg-slate-600 transition-all focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none flex items-center justify-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> {t('calc.exportPdf')}
        </button>
        <button onClick={async () => { const { exportResultToCsv, downloadCsv } = await import('@/lib/csvExport'); const csv = exportResultToCsv(results, productName || 'open3dcalc'); downloadCsv(csv, 'open3dcalc_resultado.csv') }}
          className="py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-teal-700 text-white hover:bg-teal-600 transition-all focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none flex items-center justify-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" /> CSV
        </button>
        <button onClick={handleExportQuote}
          className="py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-amber-700 text-white hover:bg-amber-600 transition-all focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none flex items-center justify-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5" /> {t('results.exportQuote')}
        </button>
      </div>
    </>
  )

  const withDialogs = (
    <>
      {content}
      <ConfirmDialog
        open={showClearConfirm}
        title="Limpar histórico"
        message={t('calc.clearConfirm') || 'Limpar histórico?'}
        variant="danger"
        confirmLabel="Limpar"
        cancelLabel="Cancelar"
        onConfirm={() => { clearHistory(); setShowClearConfirm(false) }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  )

  if (isSidebar) {
    return withDialogs
  }

  return <div className="space-y-4 lg:hidden">{withDialogs}</div>
}
