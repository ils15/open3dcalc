import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { InputGroup } from '@/components/ui/InputGroup'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6']

export function Dashboard() {
  const { t } = useTranslation()
  const store = useCalculatorStore()
  const results = store.results
  const { format: formatMoney, symbol: currencySymbol } = useCurrency()
  const [printsPerMonth, setPrintsPerMonth] = useState(30)
  const [buyPrice, setBuyPrice] = useState('')
  const [targetSellPrice, setTargetSellPrice] = useState('')

  const handleInput = (value: string, setter: (v: number) => void) => {
    setter(value === '' ? 0 : parseFloat(value) || 0)
  }

  const monthlyProjection = results ? {
    revenue: results.sellPrice * printsPerMonth,
    cost: results.totalCost * printsPerMonth,
    profit: results.profit * printsPerMonth,
    annualProfit: results.profit * printsPerMonth * 12,
  } : null

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
        <div className="glass rounded-2xl p-5">
          <h2 className="text-lg font-bold text-white">{t('nav.dashboard')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('calc.noCosts')}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[t('dashboard.totalCost'), t('dashboard.salePrice'), t('dashboard.profit'), t('dashboard.roi')].map(label => (
            <div key={label} className="glass rounded-2xl p-4 text-center hover:-translate-y-0.5 transition-transform">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-lg font-extrabold text-gray-500">---</p>
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
        <div className="glass rounded-2xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-gray-400 mb-1">{t('dashboard.totalCost')}</p>
          <p className="text-lg font-extrabold text-pink-400">{formatMoney(results.totalCost)}</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-gray-400 mb-1">{t('dashboard.salePrice')}</p>
          <p className="text-lg font-extrabold text-emerald-400">{formatMoney(results.sellPrice)}</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-gray-400 mb-1">{t('dashboard.profit')}</p>
          <p className={`text-lg font-extrabold ${results.profit >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
            {formatMoney(results.profit)}
          </p>
        </div>
        <div className="glass rounded-2xl p-4 text-center hover:-translate-y-0.5 transition-transform">
          <p className="text-xs text-gray-400 mb-1">{t('dashboard.roi')}</p>
          <p className={`text-lg font-extrabold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {roi.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Cost Breakdown Chart */}
      {chartData.length > 1 && (
        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-300 mb-3">{t('breakdown.title')}</p>
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
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    formatter={(value: number) => formatMoney(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {chartData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-400">{d.name}</span>
                  <span className="text-gray-200 font-semibold ml-auto">{formatMoney(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Projection */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">{t('calc.monthlyProjection')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.printsPerMonth')} value={printsPerMonth}
            onChange={v => handleInput(v, val => setPrintsPerMonth(val > 0 ? val : 1))} type="number" unit="un" />
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">{t('calc.monthlyRevenue')}</p>
              <p className="text-sm font-bold text-emerald-400">{monthlyProjection ? formatMoney(monthlyProjection.revenue) : '---'}</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">{t('calc.monthlyCost')}</p>
              <p className="text-sm font-bold text-pink-400">{monthlyProjection ? formatMoney(monthlyProjection.cost) : '---'}</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">{t('calc.monthlyProfit')}</p>
              <p className={`text-sm font-bold ${monthlyProjection && monthlyProjection.profit >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                {monthlyProjection ? formatMoney(monthlyProjection.profit) : '---'}
              </p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">{t('calc.annualProfit')}</p>
              <p className={`text-sm font-bold ${monthlyProjection && monthlyProjection.annualProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {monthlyProjection ? formatMoney(monthlyProjection.annualProfit) : '---'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target Margin Mode */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">{t('calc.targetMarginMode')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('calc.targetMarginDesc')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.sellPriceTarget')} value={targetSellPrice}
            onChange={v => setTargetSellPrice(v)} type="number" prefix={currencySymbol} />
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">{t('calc.actualMargin')}</p>
              <p className={`text-sm font-bold ${reverseMargin && reverseMargin.actualMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {reverseMargin ? `${reverseMargin.actualMargin.toFixed(1)}%` : '---'}
              </p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">Lucro</p>
              <p className={`text-sm font-bold ${reverseMargin && reverseMargin.profit >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                {reverseMargin ? formatMoney(reverseMargin.profit) : '---'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print vs Buy */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">{t('calc.printVsBuy')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('calc.buyPrice')} value={buyPrice}
            onChange={v => setBuyPrice(v)} type="number" prefix={currencySymbol} />
          {printVsBuy && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500">{t('calc.cheaper')}</p>
                <p className="text-sm font-bold text-cyan-400">
                  {printVsBuy.cheaper === 'print' ? t('calc.printCheaper') : t('calc.buyCheaper')}
                </p>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500">{t('calc.savings')}</p>
                <p className="text-sm font-bold text-emerald-400">
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
