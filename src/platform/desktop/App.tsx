import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/platform/desktop/components/Header/Header'
import { Calculator } from '@/shared/components/Calculator/Calculator'
import { CatalogTab } from '@/shared/components/Catalog/CatalogTab'
import { HistoryTab } from '@/shared/components/Calculator/HistoryTab/HistoryTab'
import { Dashboard } from '@/shared/components/Dashboard/Dashboard'
import { ChangelogPage } from '@/shared/components/Changelog/ChangelogPage'
import { InfillCalculator } from '@/shared/components/Calculator/InfillCalculator'
import { FilamentInventory } from '@/shared/components/Catalog/FilamentInventory'
import { CustomerTab } from '@/shared/components/Catalog/CustomerTab'
import { ProductInventory } from '@/shared/components/Catalog/ProductInventory'
import { QuoteSection } from '@/shared/components/Calculator/QuoteSection'
import { restoreAutoSnapshot } from '@/shared/stores/storeBridge'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { computeStoreResults } from '@/shared/stores/calculatorStore.compute'
import type { ComputeStoreInput } from '@/shared/stores/calculatorStore.types'
import { getSharedCalculation } from '@/shared/lib/calculationLink'
import { printers } from '@/shared/lib/printers'
import { marketplaces } from '@/shared/lib/marketplace'
import { Tutorial } from '@/shared/components/ui/Tutorial'
import { PrivacyBanner } from '@/shared/components/ui/PrivacyBanner'
import { useTutorialStore } from '@/shared/stores/tutorialStore'
import { UpdateNotification } from '@/platform/desktop/components/UpdateNotification/UpdateNotification'
import { useUpdaterAutoCheck } from '@/platform/desktop/hooks/useUpdaterAutoCheck'
import type { CalculationResult, CalculationSnapshot } from '@/shared/types'
import {
  Calculator as CalculatorIcon,
  Clock,
  Settings2,
  BarChart3,
  Grid3x3,
  Spool,
  Sparkles,
  FileText,
  Users,
  Package,
} from 'lucide-react'

type Tab = 'calculator' | 'dashboard' | 'catalog' | 'history' | 'infill' | 'inventory' | 'changelog' | 'quotes' | 'customers' | 'products'
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
  { id: 'infill',     icon: <Grid3x3 className="w-[18px] h-[18px]" />,        labelKey: 'nav.infill',     label: 'Calc. Infill' },
  { id: 'inventory',  icon: <Spool className="w-[18px] h-[18px]" />,          labelKey: 'nav.inventory',  label: 'Filamentos' },
  { id: 'catalog',    icon: <Settings2 className="w-[18px] h-[18px]" />,      labelKey: 'nav.catalog',    label: 'Cadastros' },
  { id: 'history',    icon: <Clock className="w-[18px] h-[18px]" />,          labelKey: 'nav.history',    label: 'Histórico' },
  { id: 'changelog',  icon: <Sparkles className="w-[18px] h-[18px]" />,     labelKey: 'nav.changelog',  label: 'Novidades' },
  { id: 'quotes',     icon: <FileText className="w-[18px] h-[18px]" />,    labelKey: 'nav.quotes',     label: 'Orçamentos' },
  { id: 'customers',  icon: <Users className="w-[18px] h-[18px]" />,      labelKey: 'nav.customers',  label: 'Clientes' },
  { id: 'products',   icon: <Package className="w-[18px] h-[18px]" />,    labelKey: 'nav.products',   label: 'Produtos' },
]

function App() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('calculator')

  // Auto-check for updates on desktop
  useUpdaterAutoCheck()

  useEffect(() => {
    restoreAutoSnapshot()

    // Migrate legacy data to historyStore
    const migrateOldData = () => {
      const historyStore = useHistoryStore.getState()
      const existing = historyStore.entries.length

      // Skip if already migrated
      if (localStorage.getItem('open3dcalc_migration_done_v2')) return

      // Only migrate if historyStore is empty (prevent duplicates)
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
                  estimatedPrintTime: 0,                   targetMarginPercent: 0,
                  breakEvenPrice: 0, actualMargin: 0, carbonFootprintGrams: 0,
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

  // Load shared calculation from URL hash
  useEffect(() => {
    const shared = getSharedCalculation()
    if (shared) {
      const state = useCalculatorStore.getState()
      const merged: Record<string, unknown> = {
        ...state,
        activeTab: shared.activeTab,
        ...(shared.fdmMaterial && { fdmMaterial: shared.fdmMaterial }),
        ...(shared.fdmPrintParams && { fdmPrintParams: shared.fdmPrintParams }),
        ...(shared.fdmMachine && { fdmMachine: shared.fdmMachine }),
        ...(shared.fdmHardware && { fdmHardware: shared.fdmHardware }),
        ...(shared.fdmFinishing && { fdmFinishing: shared.fdmFinishing }),
        ...(shared.fdmLabor && { fdmLabor: shared.fdmLabor }),
        ...(shared.fdmExtras && { fdmExtras: shared.fdmExtras }),
        ...(shared.fdmSales && { fdmSales: shared.fdmSales }),
        ...(shared.fdmOps && { fdmOps: shared.fdmOps }),
        ...(shared.fdmSoft && { fdmSoft: shared.fdmSoft }),
        ...(shared.resinMaterial && { resinMaterial: shared.resinMaterial }),
        ...(shared.resinPrintParams && { resinPrintParams: shared.resinPrintParams }),
        ...(shared.resinMachine && { resinMachine: shared.resinMachine }),
        ...(shared.resinHardware && { resinHardware: shared.resinHardware }),
        ...(shared.resinPostProcess && { resinPostProcess: shared.resinPostProcess }),
        ...(shared.resinLabor && { resinLabor: shared.resinLabor }),
        ...(shared.resinExtras && { resinExtras: shared.resinExtras }),
        ...(shared.resinSales && { resinSales: shared.resinSales }),
        ...(shared.resinOps && { resinOps: shared.resinOps }),
        ...(shared.resinSoft && { resinSoft: shared.resinSoft }),
        ...(shared.fdmAmsEnabled !== undefined && { fdmAmsEnabled: shared.fdmAmsEnabled }),
        ...(shared.fdmAmsSlots && { fdmAmsSlots: shared.fdmAmsSlots }),
        ...(shared.fixedCosts && { fixedCosts: shared.fixedCosts }),
        ...(shared.productName !== undefined && { productName: shared.productName }),
        ...(shared.quantity !== undefined && { quantity: shared.quantity }),
        ...(shared.infillPercent !== undefined && { infillPercent: shared.infillPercent }),
        ...(shared.targetMarginMode !== undefined && { targetMarginMode: shared.targetMarginMode }),
        ...(shared.enabledSections && { enabledSections: shared.enabledSections }),
      }
      // Resolve printer/marketplace by ID
      if (shared.selectedPrinterId) {
        const printer = printers.find(p => p.id === shared.selectedPrinterId)
        if (printer) merged.selectedPrinter = printer as (typeof printers)[number]
      }
      if (shared.selectedMarketplaceId) {
        const marketplace = marketplaces.find(m => m.id === shared.selectedMarketplaceId)
        if (marketplace) merged.selectedMarketplace = marketplace as (typeof marketplaces)[number]
      }
      // Recompute results
      const results = computeStoreResults(merged as ComputeStoreInput)
      useCalculatorStore.setState({ ...merged, results })
      // Clear the hash so it doesn't re-trigger
      window.location.hash = ''
    }
  }, [])

  // Auto-start tutorial on first visit (after short delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't start tutorial if onboarding is still pending
      const onboardingDone = localStorage.getItem('open3dcalc_onboarded')
      if (!onboardingDone) return

      const store = useTutorialStore.getState()
      if (!store.isCompleted && !store.isActive) {
        store.startTutorial()
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col overflow-x-clip">
      <Header />
      <UpdateNotification className="max-w-[1440px] mx-auto w-full px-6 sm:px-8 lg:px-12 pt-4" />
      <PrivacyBanner />

      <div className="flex flex-1 w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto overflow-x-clip">

        {/* ── Tablet Sidebar — icons only ── */}
        <aside className="hidden md:flex lg:hidden flex-col gap-1 w-16 shrink-0 px-2 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--color-border)]">
          <p className="text-[9px] font-semibold text-[var(--color-text-muted)] px-2 mb-2 uppercase tracking-wider">Nav</p>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                activeTab === tab.id
                  ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent-muted)]'
                   : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] border border-transparent'
              }`}
              title={t(tab.labelKey)}
            >
              {tab.icon}
            </button>
          ))}
        </aside>

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col gap-1 w-60 xl:w-68 shrink-0 px-4 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--color-border)]">
          <p className="label-xs px-3 mb-2">{t('nav.navigation')}</p>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.icon}
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
            <a
              href="https://github.com/ils15/open3dcalc"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4 11.5 11.5 0 0 1 3 .4c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
            <a
              href="https://t.me/Impressao3DBR"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              title={t('nav.telegram')}
              aria-label={t('nav.telegram')}
            >
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.441-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141a.506.506 0 0 1 .171.325c.016.093.036.306.02.472z"/>
              </svg>
              <span>{t('nav.telegram')}</span>
            </a>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 px-8 sm:px-10 lg:px-12 xl:px-16 py-10 pb-32 lg:pb-12">
          <div className="animate-fade-up">
            {activeTab === 'calculator' && <Calculator />}
            {activeTab === 'dashboard'  && <Dashboard />}
            {activeTab === 'infill'     && <InfillCalculator />}
            {activeTab === 'inventory'  && <FilamentInventory />}
            {activeTab === 'catalog'    && <CatalogTab />}
            {activeTab === 'history'    && <HistoryTab onLoadToCalculator={() => setActiveTab('calculator')} />}
            {activeTab === 'changelog' && <ChangelogPage />}
            {activeTab === 'quotes' && <QuoteSection />}
            {activeTab === 'customers' && <CustomerTab />}
            {activeTab === 'products' && <ProductInventory />}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{ background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label={t('nav.mainNavigation')}
      >
        <div className="flex overflow-x-auto h-[68px] px-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-[56px] min-h-[48px] px-1.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                activeTab === tab.id
                  ? 'text-[var(--color-accent)]'
                   : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
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

      <footer className="hidden lg:block text-center text-xs text-[var(--color-text-muted)] py-3 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://github.com/ils15/open3dcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            Open3DCalc — Open Source · MIT License
          </a>
          <span className="text-[var(--color-text-muted)]">·</span>
          <a
            href="https://ofertachina.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            ofertachina.com.br
          </a>
        </div>
      </footer>

      <Tutorial />
    </div>
  )
}

export default App
