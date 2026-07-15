import { useState, useEffect, useMemo, useRef, useCallback, Suspense, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import html2canvas from 'html2canvas'
import { exportExecutivePdf } from '@/shared/lib/pdfExport'
import type { ExecutiveReportData } from '@/shared/lib/ExecutiveReportDoc'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  const [exportingPdf, setExportingPdf] = useState(false)
  const trendChartRef = useRef<HTMLDivElement>(null)

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

  // ---------------------------------------------------------------------------
  // Top Printers (from filtered history)
  // ---------------------------------------------------------------------------
  const topPrintersData = useMemo(() => {
    const map = new Map<string, { profit: number; count: number }>()
    for (const e of filteredEntries) {
      const name = e.snapshot?.selectedPrinterId || (e.type === 'resin' ? 'Resin' : 'FDM')
      const existing = map.get(name) || { profit: 0, count: 0 }
      existing.profit += e.profit
      existing.count++
      map.set(name, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
  }, [filteredEntries])

  // ---------------------------------------------------------------------------
  // Top Materials (from filtered history)
  // ---------------------------------------------------------------------------
  const topMaterialsData = useMemo(() => {
    const map = new Map<string, { count: number; totalCost: number }>()
    for (const e of filteredEntries) {
      const type = e.snapshot?.fdmMaterial?.type || e.snapshot?.resinMaterial?.type || e.type
      const existing = map.get(type) || { count: 0, totalCost: 0 }
      existing.count++
      existing.totalCost += e.totalCost
      map.set(type, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name: name.toUpperCase(), ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [filteredEntries])

  // ---------------------------------------------------------------------------
  // Period Comparison: current month vs previous month
  // ---------------------------------------------------------------------------
  const periodComparison = useMemo(() => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()

    const current = filteredEntries.filter(e => e.timestamp >= currentMonthStart)
    const previous = filteredEntries.filter(e => e.timestamp >= prevMonthStart && e.timestamp < currentMonthStart)

    const sum = (arr: typeof filteredEntries, key: 'sellPrice' | 'totalCost' | 'profit') =>
      arr.reduce((s, e) => s + e[key], 0)

    const calcChange = (cur: number, prev: number): number | null => {
      if (prev === 0) return cur > 0 ? 100 : null
      return parseFloat((((cur - prev) / Math.abs(prev)) * 100).toFixed(1))
    }

    return [
      {
        key: 'revenue' as const,
        current: sum(current, 'sellPrice'),
        previous: sum(previous, 'sellPrice'),
      },
      {
        key: 'cost' as const,
        current: sum(current, 'totalCost'),
        previous: sum(previous, 'totalCost'),
      },
      {
        key: 'profit' as const,
        current: sum(current, 'profit'),
        previous: sum(previous, 'profit'),
      },
      {
        key: 'printCount' as const,
        current: current.length,
        previous: previous.length,
      },
    ].map(m => ({
      ...m,
      change: calcChange(m.current, m.previous),
    }))
  }, [filteredEntries])

  // ---------------------------------------------------------------------------
  // PDF Export Handler
  // ---------------------------------------------------------------------------
  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true)
    try {
      // Capture profit trend chart as base64 image
      let chartImage: string | undefined
      if (trendChartRef.current) {
        const canvas = await html2canvas(trendChartRef.current, {
          backgroundColor: null,
          scale: 2,
          logging: false,
        })
        chartImage = canvas.toDataURL('image/png')
      }

      // Build period range from filter or fallback to last 90 days
      const dateFrom = dashboardDateFrom ?? Date.now() - 90 * 24 * 60 * 60 * 1000
      const dateTo = dashboardDateTo ?? Date.now()
      const fromStr = epochToDateStr(dateFrom)
      const toStr = epochToDateStr(dateTo)

      const sorted = [...filteredEntries].sort((a, b) => a.timestamp - b.timestamp)

      const totalRevenue = sorted.reduce((s, e) => s + e.sellPrice, 0)
      const totalCost = sorted.reduce((s, e) => s + e.totalCost, 0)
      const totalProfit = sorted.reduce((s, e) => s + e.profit, 0)
      const marginEntries = sorted.filter(e => e.sellPrice > 0)
      const avgMargin = marginEntries.length > 0
        ? marginEntries.reduce((s, e) => s + (e.profit / e.sellPrice) * 100, 0) / marginEntries.length
        : 0

      // Recompute comparison for the report (use same logic as periodComparison)
      const calcChange = (cur: number, prev: number): number | null => {
        if (prev === 0) return cur > 0 ? 100 : null
        return parseFloat((((cur - prev) / Math.abs(prev)) * 100).toFixed(1))
      }

      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
      const current = sorted.filter(e => e.timestamp >= currentMonthStart)
      const previous = sorted.filter(e => e.timestamp >= prevMonthStart && e.timestamp < currentMonthStart)

      const sum = (arr: typeof sorted, key: 'sellPrice' | 'totalCost' | 'profit') =>
        arr.reduce((s, e) => s + e[key], 0)

      const reportData: ExecutiveReportData = {
        period: { from: fromStr, to: toStr },
        entryCount: sorted.length,
        totalRevenue,
        totalCost,
        totalProfit,
        avgMargin,
        topPrinters: topPrintersData,
        topMaterials: topMaterialsData,
        comparison: {
          revenue: {
            current: sum(current, 'sellPrice'),
            previous: sum(previous, 'sellPrice'),
            change: calcChange(sum(current, 'sellPrice'), sum(previous, 'sellPrice')),
          },
          cost: {
            current: sum(current, 'totalCost'),
            previous: sum(previous, 'totalCost'),
            change: calcChange(sum(current, 'totalCost'), sum(previous, 'totalCost')),
          },
          profit: {
            current: sum(current, 'profit'),
            previous: sum(previous, 'profit'),
            change: calcChange(sum(current, 'profit'), sum(previous, 'profit')),
          },
        },
        chartImage,
      }

      await exportExecutivePdf(reportData)
    } finally {
      setExportingPdf(false)
    }
  }, [filteredEntries, dashboardDateFrom, dashboardDateTo, topPrintersData, topMaterialsData])

  // ---------------------------------------------------------------------------
  // Custom Goal
  // ---------------------------------------------------------------------------
  const GOAL_KEY = 'open3dcalc_dashboard_goal'
  const [goal, setGoal] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem(GOAL_KEY) || ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(GOAL_KEY, goal)
    } catch {
      // Silently fail
    }
  }, [goal])

  const printsNeeded = useMemo(() => {
    const goalValue = parseFloat(goal)
    if (!goalValue || goalValue <= 0 || !results) return null
    if (results.profit <= 0) return { prints: Infinity, negativeMargin: true, goalValue }
    return { prints: Math.ceil(goalValue / results.profit), negativeMargin: false, goalValue }
  }, [goal, results])

  // ---------------------------------------------------------------------------
  // Low-Margin Alerts
  // ---------------------------------------------------------------------------
  const lowMarginEntries = useMemo(() => {
    return filteredEntries
      .filter(e => e.sellPrice > 0)
      .map(e => ({ ...e, margin: (e.profit / e.sellPrice) * 100 }))
      .filter(e => e.margin < 20)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 3)
  }, [filteredEntries])

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
      {/* Header with Export PDF */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('nav.dashboard')}</h2>
        <button
          onClick={handleExportPdf}
          disabled={exportingPdf || filteredEntries.length === 0}
          className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {exportingPdf ? t('common.loading') : t('dashboard.exportPdf')}
        </button>
      </div>

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
        <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">{t('dashboard.dateFrom')} / {t('dashboard.dateTo')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('dashboard.dateFrom')}</label>
            <input type="date" value={epochToDateStr(dashboardDateFrom)}
              onChange={e => setDashboardDateFrom(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('dashboard.dateTo')}</label>
            <input type="date" value={epochToDateStr(dashboardDateTo)}
              onChange={e => setDashboardDateTo(e.target.value ? dateStrToEpoch(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
          </div>
          {(dashboardDateFrom !== null || dashboardDateTo !== null) && (
            <button onClick={() => { setDashboardDateFrom(null); setDashboardDateTo(null) }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] transition-colors">
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
            <div className="w-full h-56" ref={trendChartRef}>
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

      {/* Top Printers Chart */}
      <Suspense fallback={<div className="surface rounded-xl p-5"><p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('dashboard.loadingCharts')}</p></div>}>
        <div className="surface rounded-xl p-5">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.topPrinters')}</h3>
          {topPrintersData.length > 0 ? (
            <div className="w-full h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPrintersData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, { notation: 'compact', maximumFractionDigits: 0 }).format(v)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: unknown) => formatMoney(Number(value))}
                    labelStyle={{ color: 'var(--color-text-secondary)' }}
                  />
                  <Bar dataKey="profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-8">{t('common.noData')}</p>
          )}
        </div>
      </Suspense>

      {/* Top Materials Chart */}
      <Suspense fallback={<div className="surface rounded-xl p-5"><p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('dashboard.loadingCharts')}</p></div>}>
        <div className="surface rounded-xl p-5">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.topMaterials')}</h3>
          {topMaterialsData.length > 0 ? (
            <div className="w-full h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMaterialsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, { notation: 'compact', maximumFractionDigits: 0 }).format(v)}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: unknown) => `${value}`}
                    labelStyle={{ color: 'var(--color-text-secondary)' }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-8">{t('common.noData')}</p>
          )}
        </div>
      </Suspense>

      {/* Period Comparison */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.periodComparison')}</h3>
        {periodComparison.some(m => m.current > 0 || m.previous > 0) ? (
          <div className="grid grid-cols-2 gap-3">
            {/* Header row */}
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" />
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-right">{t('dashboard.currentMonth')}</div>
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-right">{t('dashboard.previousMonth')}</div>
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-right">{t('dashboard.change')}</div>
            {periodComparison.map(m => (
              <Fragment key={m.key}>
                <div className="text-xs text-[var(--color-text-secondary)] font-medium">{t(`dashboard.${m.key}`)}</div>
                <div className="text-xs text-[var(--color-text-primary)] font-semibold text-right">
                  {m.key === 'printCount' ? m.current : formatMoney(m.current)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] text-right">
                  {m.key === 'printCount' ? m.previous : formatMoney(m.previous)}
                </div>
                <div className={`text-xs font-bold text-right ${m.change !== null ? (m.change >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]') : 'text-[var(--color-text-muted)]'}`}>
                  {m.change !== null ? `${m.change >= 0 ? '+' : ''}${m.change}%` : '---'}
                </div>
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">{t('common.noData')}</p>
        )}
      </div>

      {/* Custom Goal */}
      <div className="surface rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">{t('dashboard.customGoal')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">{t('dashboard.goalInput')}</label>
            <input
              type="number"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="0"
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div className="flex flex-col justify-center gap-1">
            {printsNeeded ? (
              printsNeeded.negativeMargin ? (
                <p className="text-xs text-[var(--color-danger)]">{t('dashboard.goalWarning')}</p>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('dashboard.printsNeeded', { count: printsNeeded.prints, value: formatMoney(printsNeeded.goalValue) })}
                </p>
              )
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">{t('calc.noCosts')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Low-Margin Alerts */}
      {lowMarginEntries.length > 0 && (
        <div className="surface rounded-xl p-5 border border-amber-500/30">
          <h3 className="text-sm font-bold text-amber-400 mb-2">{t('dashboard.lowMarginAlerts')}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            {t('dashboard.lowMarginCount', { count: lowMarginEntries.length })}
          </p>
          <div className="space-y-1">
            {lowMarginEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-amber-500/5">
                <span className="text-xs text-[var(--color-text-primary)] truncate mr-2">{e.name}</span>
                <span className="text-xs font-semibold text-amber-400 shrink-0">{e.margin.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
