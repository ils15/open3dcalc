import { useState, useEffect, useMemo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from './RechartsLazy'
import { useCurrency } from '@/shared/hooks/useCurrency'

const DASHBOARD_KEY = 'open3dcalc_dashboard_v1'

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6']

function loadDashboardSettings() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(DASHBOARD_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDashboardSettings(data: Record<string, unknown>) {
  try {
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify(data))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
const dateStrToEpoch = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

const epochToDateStr = (epoch: number | null): string => {
  if (epoch === null) return ''
  const d = new Date(epoch)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const store = useCalculatorStore()
  const results = store.results
  const fixedCosts = store.fixedCosts
  const { format: formatMoney, symbol: currencySymbol } = useCurrency()
  const historyEntries = useHistoryStore(s => s.entries)

  // Local date range filter state (independent from history store)
  const [dashboardDateFrom, setDashboardDateFrom] = useState<number | null>(null)
  const [dashboardDateTo, setDashboardDateTo] = useState<number | null>(null)

  // Filter entries by date range
  const filteredEntries = useMemo(() => {
    let result = historyEntries
    if (dashboardDateFrom !== null) {
      result = result.filter(e => e.timestamp >= dashboardDateFrom)
    }
    if (dashboardDateTo !== null) {
      const endOfDay = dashboardDateTo + 86_399_999 // 23:59:59.999
      result = result.filter(e => e.timestamp <= endOfDay)
    }
    return result
  }, [historyEntries, dashboardDateFrom, dashboardDateTo])

  // Load saved values on mount
  const saved = useMemo(() => loadDashboardSettings(), [])

  const [printsPerMonth, setPrintsPerMonth] = useState(() => (saved.printsPerMonth as number) ?? 30)
  const [buyPrice, setBuyPrice] = useState(() => (saved.buyPrice as string) ?? '')
  const [targetSellPrice, setTargetSellPrice] = useState(() => (saved.targetSellPrice as string) ?? '')

  // Persist to localStorage on change
  useEffect(() => {
    saveDashboardSettings({ printsPerMonth, buyPrice, targetSellPrice })
  }, [printsPerMonth, buyPrice, targetSellPrice])

  const handleInput = (value: string, setter: (v: number) => void) => {
    setter(value === '' ? 0 : parseFloat(value) || 0)
  }

  const monthlyProjection = results ? {
    revenue: results.sellPrice * printsPerMonth,
    cost: results.totalCost * printsPerMonth,
    profit: results.profit * printsPerMonth,
    annualProfit: results.profit * printsPerMonth * 12,
  } : null

  // Break-even calculation
  const breakEven = results && fixedCosts.enabled && fixedCosts.monthlyCost > 0 ? {
    variableCostPerUnit: results.totalCost,
    sellPrice: results.sellPrice,
    marginPerUnit: results.sellPrice - results.totalCost,
    monthlyFixedCost: fixedCosts.monthlyCost,
  } : null

  const breakEvenUnits = breakEven && breakEven.marginPerUnit > 0
    ? Math.ceil(breakEven.monthlyFixedCost / breakEven.marginPerUnit)
    : null

  const breakEvenRevenue = breakEvenUnits !== null && breakEven
    ? breakEvenUnits * breakEven.sellPrice
    : null

  // Average margin from history (filtered)
  const avgMargin = useMemo(() => {
    const margins = filteredEntries
      .filter(e => e.sellPrice > 0)
      .map(e => (e.profit / e.sellPrice) * 100)
    if (margins.length === 0) return null
    return margins.reduce((a, b) => a + b, 0) / margins.length
  }, [filteredEntries])

  // Profit trend data (filtered)
  const trendData = useMemo(() => {
    const sorted = [...filteredEntries]
      .sort((a, b) => a.timestamp - b.timestamp)
    const locale = i18n.resolvedLanguage || i18n.language
    return sorted.map(e => ({
      date: new Date(e.timestamp).toLocaleDateString(locale),
      profit: Math.round(e.profit * 100) / 100,
    }))
  }, [filteredEntries, i18n.resolvedLanguage, i18n.language])

  const printVsBuy = results && buyPrice ? {
    printCost: results.totalCost,
    buyPrice: parseFloat(buyPrice) || 0,
    cheaper: results.totalCost <= (parseFloat(buyPrice) || 0) ? 'print' as const : 'buy' as const,
    savings: Math.abs(results.totalCost - (parseFloat(buyPrice) || 0)),
    savingsPercent: (parseFloat(buyPrice) || 0) > 0 ? (Math.abs(results.totalCost - (parseFloat(buyPrice) || 0)) / (parseFloat(buyPrice) || 0)) * 100 : 0,
  } : null

  const reverseMargin = results && targetSellPrice ? {
    targetPrice: parseFloat(targetSellPrice) || 0,
    actualMargin: results.totalCost > 0 && (parseFloat(targetSellPrice) || 0) > 0
      ? (((parseFloat(targetSellPrice) || 0) - results.totalCost - results.taxAmount - results.marketplaceFee) / (parseFloat(targetSellPrice) || 0)) * 100
      : 0,
    profit: (parseFloat(targetSellPrice) || 0) - results.totalCost - results.taxAmount - results.marketplaceFee,
  } : null

  if (!results) {
    return (
      <div className="space-y-5">
        <div className="surface rounded-xl p-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('nav.dashboard')}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('calc.noCosts')}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[t('dashboard.totalCost'), t('dashboard.salePrice'), t('dashboard.profit'), t('dashboard.roi')].map(label => (
            <div key={label} className="surface rounded-xl p-4 text-center hover:-translate-y-0.5 transition-transform">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</p>
              <p className="text-lg font-extrabold text-[var(--color-text-muted)]">---</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const chartData = [
    { name: t('breakdown.material'), value: results.materialCost },
    { name: t('breakdown.energy'), value: results.energyCost },
    { name: t('breakdown.depreciation'), value: results.machineCost },
    { name: t('breakdown.maintenance'), value: results.consumablesCost },
    { name: t('breakdown.labor'), value: results.laborCost },
    { name: t('breakdown.packaging'), value: results.totalCost - results.subtotal - results.failureCost > 0 ? results.totalCost - results.subtotal - results.failureCost : 0 },
    { name: t('breakdown.finishing'), value: results.postProcessingCost },
  ].filter(d => d.value > 0)

  const roi = results.totalCost > 0 ? (results.profit / results.totalCost) * 100 : 0

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="surface rounded-xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t('dashboard.totalCost')}</p>
          <p className="text-lg font-extrabold text-pink-400">{formatMoney(results.totalCost)}</p>
        </div>
        <div className="surface rounded-xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t('dashboard.salePrice')}</p>
          <p className="text-lg font-extrabold text-[var(--color-success)]">{formatMoney(results.sellPrice)}</p>
        </div>
        <div className="surface rounded-xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t('dashboard.profit')}</p>
          <p className={`text-lg font-extrabold ${results.profit >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
            {formatMoney(results.profit)}
          </p>
        </div>
        <div className="surface rounded-xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t('dashboard.roi')}</p>
          <p className={`text-lg font-extrabold ${roi >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {roi.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="surface rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('dashboard.dateFrom')}</label>
            <input type="date" value={epochToDateStr(dashboardDateFrom)}
              onChange={e => setDashboardDateFrom(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('dashboard.dateTo')}</label>
            <input type="date" value={epochToDateStr(dashboardDateTo)}
              onChange={e => setDashboardDateTo(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
          </div>
          {(dashboardDateFrom !== null || dashboardDateTo !== null) && (
            <button onClick={() => { setDashboardDateFrom(null); setDashboardDateTo(null) }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] transition-colors">
              {t('dashboard.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Cost Breakdown Chart */}
      <Suspense fallback={<div className="surface rounded-xl p-4"><p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('dashboard.loadingCharts')}</p></div>}>
        {chartData.length > 1 && (
          <div className="surface rounded-xl p-4">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">{t('breakdown.title')}</p>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={false}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      formatter={(value: unknown) => formatMoney(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {chartData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--color-text-secondary)]">{d.name}</span>
                    <span className="text-[var(--color-text-primary)] font-semibold ml-auto">{formatMoney(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Suspense>

      {/* Monthly Projection */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('calc.monthlyProjection')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.printsPerMonth')} value={printsPerMonth}
            onChange={v => handleInput(v, val => setPrintsPerMonth(val > 0 ? val : 1))} type="number" unit="un" />
          <div className="grid grid-cols-2 gap-3">
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.monthlyRevenue')}</p>
              <p className="text-sm font-bold text-[var(--color-success)]">{monthlyProjection ? formatMoney(monthlyProjection.revenue) : '---'}</p>
            </div>
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.monthlyCost')}</p>
              <p className="text-sm font-bold text-pink-400">{monthlyProjection ? formatMoney(monthlyProjection.cost) : '---'}</p>
            </div>
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.monthlyProfit')}</p>
              <p className={`text-sm font-bold ${monthlyProjection && monthlyProjection.profit >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
                {monthlyProjection ? formatMoney(monthlyProjection.profit) : '---'}
              </p>
            </div>
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.annualProfit')}</p>
              <p className={`text-sm font-bold ${monthlyProjection && monthlyProjection.annualProfit >= 0 ? 'text-cyan-400' : 'text-[var(--color-danger)]'}`}>
                {monthlyProjection ? formatMoney(monthlyProjection.annualProfit) : '---'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Break-Even Card */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.breakEven')}</h3>
        {breakEven ? (
          breakEvenUnits !== null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="surface rounded-xl p-4 text-center">
                <p className="text-[10px] text-[var(--color-text-muted)]">{t('dashboard.breakEvenUnits')}</p>
                <p className="text-lg font-extrabold text-cyan-400">{breakEvenUnits} {t('common.units')}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {formatMoney(breakEven.monthlyFixedCost)} / {formatMoney(breakEven.marginPerUnit)}
                </p>
              </div>
              <div className="surface rounded-xl p-4 text-center">
                <p className="text-[10px] text-[var(--color-text-muted)]">{t('dashboard.breakEvenRevenue')}</p>
                <p className="text-lg font-extrabold text-[var(--color-success)]">
                  {breakEvenRevenue !== null ? formatMoney(breakEvenRevenue) : '---'}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {breakEvenUnits} x {formatMoney(breakEven.sellPrice)}
                </p>
              </div>
            </div>
          ) : (
            <div className="surface rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--color-danger)]">{t('dashboard.cantBreakEven')}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {t('breakdown.material')}: {formatMoney(breakEven.variableCostPerUnit)} / {t('dashboard.salePrice')}: {formatMoney(breakEven.sellPrice)}
              </p>
            </div>
          )
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
            {t('calc.fixedCost.title')} {t('common.noData')}
          </p>
        )}
      </div>

      {/* Average Margin Card */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.avgMargin')}</h3>
        {avgMargin !== null ? (
          <div className="text-center">
            <p className={`text-3xl font-black ${avgMargin >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {avgMargin >= 0 ? '+' : ''}{avgMargin.toFixed(1)}%
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              {t('calc.history')}: {filteredEntries.length} {t('common.entries')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-2">{t('dashboard.noHistory')}</p>
        )}
      </div>

      {/* Profit Trend Chart */}
      <Suspense fallback={<div className="surface rounded-xl p-5"><p className="text-sm text-[var(--color-text-muted)] text-center py-16">{t('dashboard.loadingCharts')}</p></div>}>
        <div className="surface rounded-xl p-5">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.trend')}</h3>
          {trendData.length > 1 ? (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown) => formatMoney(Number(value))}
                    labelStyle={{ color: 'var(--color-text-secondary)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                    dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#a5b4fc', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-8">{t('dashboard.noHistory')}</p>
          )}
        </div>
      </Suspense>

      {/* Target Margin Mode */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('calc.targetMarginMode')}</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('calc.targetMarginDesc')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.sellPriceTarget')} value={targetSellPrice}
            onChange={v => setTargetSellPrice(v)} type="number" prefix={currencySymbol} />
          <div className="grid grid-cols-2 gap-3">
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.actualMargin')}</p>
              <p className={`text-sm font-bold ${reverseMargin && reverseMargin.actualMargin >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {reverseMargin ? `${reverseMargin.actualMargin.toFixed(1)}%` : '---'}
              </p>
            </div>
            <div className="surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">Lucro</p>
              <p className={`text-sm font-bold ${reverseMargin && reverseMargin.profit >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
                {reverseMargin ? formatMoney(reverseMargin.profit) : '---'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print vs Buy */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('calc.printVsBuy')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.buyPrice')} value={buyPrice}
            onChange={v => setBuyPrice(v)} type="number" prefix={currencySymbol} />
          {printVsBuy && (
            <div className="grid grid-cols-2 gap-3">
              <div className="surface rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.cheaper')}</p>
                <p className="text-sm font-bold text-cyan-400">
                  {printVsBuy.cheaper === 'print' ? t('calc.printCheaper') : t('calc.buyCheaper')}
                </p>
              </div>
              <div className="surface rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-text-muted)]">{t('calc.savings')}</p>
                <p className="text-sm font-bold text-[var(--color-success)]">
                  {formatMoney(printVsBuy.savings)} ({printVsBuy.savingsPercent.toFixed(0)}%)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
