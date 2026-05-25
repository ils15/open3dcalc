import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/Header/Header'
import { Calculator } from '@/components/Calculator/Calculator'
import { CatalogTab } from '@/components/Catalog/CatalogTab'
import { HistoryTab } from '@/components/Calculator/HistoryTab/HistoryTab'
import { Dashboard } from '@/components/Dashboard/Dashboard'
import { InfillCalculator } from '@/components/Calculator/InfillCalculator'
import { FilamentInventory } from '@/components/Catalog/FilamentInventory'
import { restoreAutoSnapshot } from '@/stores/storeBridge'
import { useHistoryStore } from '@/stores/historyStore'
import { useCalculatorStore } from '@/stores/calculatorStore'
import type { CalculationResult, CalculationSnapshot } from '@/types'
import {
  Calculator as CalculatorIcon,
  Clock,
  Settings2,
  BarChart3,
  Grid3x3,
  Spool,
} from 'lucide-react'

type Tab = 'calculator' | 'dashboard' | 'catalog' | 'history' | 'infill' | 'inventory'
type LegacyProduct = {
  name?: string
  result?: CalculationResult
  snapshot?: Partial<CalculationSnapshot> | null
}

type LegacyHistoryItem = {
  type?: 'fdm' | 'resin'
  summary?: string
  totalCost?: number
  sellPrice?: number
  profit?: number
  result?: CalculationResult
  snapshot?: CalculationSnapshot | null
}

const TABS: { id: Tab; icon: React.ReactNode; labelKey: string; label: string }[] = [
  { id: 'calculator', icon: <CalculatorIcon className="w-[18px] h-[18px]" />, labelKey: 'nav.calculator', label: 'Calculadora' },
  { id: 'dashboard',  icon: <BarChart3 className="w-[18px] h-[18px]" />,      labelKey: 'nav.dashboard',  label: 'Dashboard' },
  { id: 'infill',     icon: <Grid3x3 className="w-[18px] h-[18px]" />,        labelKey: 'nav.infill',     label: 'Infill' },
  { id: 'inventory',  icon: <Spool className="w-[18px] h-[18px]" />,          labelKey: 'nav.inventory',  label: 'Filamentos' },
  { id: 'catalog',    icon: <Settings2 className="w-[18px] h-[18px]" />,      labelKey: 'nav.catalog',    label: 'Catálogo' },
  { id: 'history',    icon: <Clock className="w-[18px] h-[18px]" />,          labelKey: 'nav.history',    label: 'Histórico' },
]

function App() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('calculator')

  useEffect(() => {
    restoreAutoSnapshot()

    // Migração de dados antigos para historyStore
    const migrateOldData = () => {
      const historyStore = useHistoryStore.getState()
      const existing = historyStore.entries.length

      // Só migra se historyStore estiver vazia (evita duplicação)
      if (existing > 0) return

      // Migrar productStore antigo
      try {
        const oldProducts = localStorage.getItem('open3dcalc_products')
        if (oldProducts) {
          const parsed = JSON.parse(oldProducts) as unknown
          if (Array.isArray(parsed)) {
            parsed.forEach((p) => {
              const product = p as LegacyProduct
              if (!product.result) return
              const type = product.snapshot?.type ?? 'fdm'
              const summary = product.snapshot?.summary || product.name || 'Produto'
              const totalCost = Number(product.result?.totalCost || 0)
              const sellPrice = Number(product.result?.sellPrice || 0)
              historyStore.addEntry({
                type,
                name: product.name || 'Produto',
                summary,
                totalCost,
                sellPrice,
                profit: sellPrice - totalCost,
                result: product.result,
                snapshot: (product.snapshot as CalculationSnapshot) || null,
              })
            })
          }
          localStorage.removeItem('open3dcalc_products')
        }
      } catch (error) {
        console.warn('Failed to migrate open3dcalc_products', error)
      }

      // Migrar calculatorStore.history antigo (v1)
      try {
        const oldHistory = localStorage.getItem('open3dcalc_history_v2')
        if (oldHistory) {
          const parsed = JSON.parse(oldHistory) as unknown
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              const legacyItem = item as LegacyHistoryItem
              historyStore.addEntry({
                type: legacyItem.type || 'fdm',
                name: legacyItem.summary || 'Histórico',
                summary: legacyItem.summary || '',
                totalCost: legacyItem.totalCost || 0,
                sellPrice: legacyItem.sellPrice || 0,
                profit: legacyItem.profit || 0,
                result: legacyItem.result || {
                  materialCost: 0, energyCost: 0, machineCost: 0,
                  hardwareCost: 0, consumablesCost: 0, laborCost: 0,
                  softwareCost: 0, failureCost: 0, extrasCost: 0,
                  postProcessingCost: 0, subtotal: 0, totalCost: 0,
                  sellPrice: 0, profit: 0, marketplaceFee: 0, taxAmount: 0,
                  costPerGram: 0, costPerUnit: 0, unitWeight: 0,
                  estimatedPrintTime: 0, targetMarginPercent: 0,
                  breakEvenPrice: 0, actualMargin: 0,
                },
                snapshot: legacyItem.snapshot || null,
              })
            })
            localStorage.removeItem('open3dcalc_history_v2')
          }
        }
      } catch (error) {
        console.warn('Failed to migrate open3dcalc_history_v2', error)
      }
    }

    migrateOldData()

    const handleBeforeUnload = () => {
      const calc = useCalculatorStore.getState()
      const data = {
        activeTab: calc.activeTab,
        fdmMaterial: calc.fdmMaterial, fdmPrintParams: calc.fdmPrintParams,
        fdmMachine: calc.fdmMachine, fdmHardware: calc.fdmHardware, fdmFinishing: calc.fdmFinishing,
        fdmLabor: calc.fdmLabor, fdmExtras: calc.fdmExtras, fdmSales: calc.fdmSales,
        fdmOps: calc.fdmOps, fdmSoft: calc.fdmSoft,
        resinMaterial: calc.resinMaterial, resinPrintParams: calc.resinPrintParams,
        resinPostProcess: calc.resinPostProcess, resinMachine: calc.resinMachine,
        resinHardware: calc.resinHardware, resinLabor: calc.resinLabor,
        resinExtras: calc.resinExtras, resinSales: calc.resinSales,
        resinOps: calc.resinOps, resinSoft: calc.resinSoft,
        selectedPrinterId: calc.selectedPrinter.id,
        selectedMarketplaceId: calc.selectedMarketplace.id,
        fdmAmsEnabled: calc.fdmAmsEnabled,
        fdmAmsSlots: calc.fdmAmsSlots,
        productName: calc.productName, quantity: calc.quantity,
        infillPercent: calc.infillPercent, targetMarginMode: calc.targetMarginMode,
        enabledSections: calc.enabledSections,
      }
      localStorage.setItem('open3dcalc_settings_v2', JSON.stringify(data))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />

      <div className="flex flex-1 w-full max-w-[1440px] mx-auto">

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col gap-1 w-56 xl:w-64 shrink-0 px-4 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-white/[0.06]">
          <p className="label-xs px-3 mb-2">Navegação</p>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.icon}
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-white/[0.06]">
            <a
              href="https://github.com/ils15/open3dcalc"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4 11.5 11.5 0 0 1 3 .4c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 px-6 sm:px-8 lg:px-10 xl:px-12 py-8 pb-28 lg:pb-10">
          <div className="animate-fade-up">
            {activeTab === 'calculator' && <Calculator />}
            {activeTab === 'dashboard'  && <Dashboard />}
            {activeTab === 'infill'     && <InfillCalculator />}
            {activeTab === 'inventory'  && <FilamentInventory />}
            {activeTab === 'catalog'    && <CatalogTab />}
            {activeTab === 'history'    && <HistoryTab onLoadToCalculator={() => setActiveTab('calculator')} />}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{ background: 'rgba(6,8,24,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegação principal"
      >
        <div className="flex overflow-x-auto h-[68px] px-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-[56px] min-h-[48px] px-1.5 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTab === tab.id
                  ? 'text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              aria-selected={activeTab === tab.id}
            >
              <span className={`transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold leading-none tracking-wide">
                {t(tab.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <footer className="hidden lg:block text-center text-xs text-slate-600 py-3 border-t border-white/[0.04]">
        <a
          href="https://github.com/ils15/open3dcalc"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-400 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none px-1 rounded"
        >
          Open3DCalc — Open Source · MIT License
        </a>
      </footer>
    </div>
  )
}

export default App
