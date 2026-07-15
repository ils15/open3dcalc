import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/shared/components/Header/Header'
import { Calculator } from '@/shared/components/Calculator/Calculator'
import { CatalogTab } from '@/shared/components/Catalog/CatalogTab'
import { HistoryTab } from '@/shared/components/Calculator/HistoryTab/HistoryTab'
import { Dashboard } from '@/shared/components/Dashboard/Dashboard'
import { ChangelogPage } from '@/shared/components/Changelog/ChangelogPage'
import { InfillCalculator } from '@/shared/components/Calculator/InfillCalculator'
import { FilamentInventory } from '@/shared/components/Catalog/FilamentInventory'
import { CustomerTab } from '@/shared/components/Catalog/CustomerTab'
import { QuoteSection } from '@/shared/components/Calculator/QuoteSection'
import { restoreAutoSnapshot } from '@/shared/stores/storeBridge'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useCurrency } from '@/shared/hooks/useCurrency'
import { CURRENCIES, type CurrencyCode } from '@/shared/lib/currency'
import { motion, AnimatePresence } from "framer-motion"
import { Tutorial } from '@/shared/components/ui/Tutorial'
import { PrivacyBanner } from '@/shared/components/ui/PrivacyBanner'
import { useTutorialStore } from '@/shared/stores/tutorialStore'
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
  MoreHorizontal,
  BookOpen,
  DollarSign,
  Globe,
  Info,
  ExternalLink,
} from 'lucide-react'

type Tab = 'calculator' | 'dashboard' | 'catalog' | 'history' | 'infill' | 'inventory' | 'changelog' | 'quotes' | 'customers'
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

// On mobile, show first 4 tabs + Menu button
const MORE_TABS: Tab[] = ['catalog', 'inventory', 'quotes', 'customers', 'changelog']

const TABS: { id: Tab; icon: React.ReactNode; labelKey: string; label: string }[] = [
  { id: 'calculator', icon: <CalculatorIcon className="w-[18px] h-[18px]" />, labelKey: 'nav.calculator', label: 'Calculadora' },
  { id: 'dashboard',  icon: <BarChart3 className="w-[18px] h-[18px]" />,      labelKey: 'nav.dashboard',  label: 'Dashboard' },
  { id: 'infill',     icon: <Grid3x3 className="w-[18px] h-[18px]" />,        labelKey: 'nav.infill',     label: 'Calc. Infill' },
  { id: 'inventory',  icon: <Spool className="w-[18px] h-[18px]" />,          labelKey: 'nav.inventory',  label: 'Filamentos' },
  { id: 'catalog',    icon: <Settings2 className="w-[18px] h-[18px]" />,      labelKey: 'nav.catalog',    label: 'Cadastros' },
  { id: 'history',    icon: <Clock className="w-[18px] h-[18px]" />,          labelKey: 'nav.history',    label: 'Histórico' },
  { id: 'quotes',     icon: <FileText className="w-[18px] h-[18px]" />,    labelKey: 'nav.quotes',     label: 'Orçamentos' },
  { id: 'customers',  icon: <Users className="w-[18px] h-[18px]" />,      labelKey: 'nav.customers',  label: 'Clientes' },
]

function App() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('calculator')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const { symbol } = useCurrency()
  const currencySetting = useCalculatorStore((s) => s.currency)
  const setCurrency = useCalculatorStore((s) => s.setCurrency)

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
    <div className="min-h-dvh flex flex-col overflow-x-hidden">
      <Header />
      <PrivacyBanner />

      <div className="flex flex-1 w-full max-w-[1600px] mx-auto overflow-hidden">

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
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-transparent'
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
            <button
              onClick={() => setActiveTab('changelog')}
              className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${activeTab === 'changelog' ? 'active' : ''}`}
            >
              <Sparkles className="w-[18px] h-[18px]" />
              <span>{t('nav.changelog')}</span>
            </button>
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

        {/* ── Skip Link ── */}
        <a href="#main" className="skip-link" aria-label="Pular para o conteúdo principal">
          Pular para o conteúdo
        </a>

        {/* ── Main Content ── */}
        <main id="main" className="flex-1 min-w-0 px-6 sm:px-8 lg:px-10 xl:px-14 py-8 sm:py-10 pb-32 lg:pb-10">
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
          </div>
        </main>
      </div>
      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{ background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label={t('nav.mainNavigation')}
      >
        <div className="flex items-center h-[56px] px-1">
          {['calculator', 'dashboard', 'infill', 'history'].map(tabId => {
            const tab = TABS.find(t => t.id === tabId)!
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 px-0.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] ${
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`}
                aria-selected={isActive}
              >
                {isActive && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-accent)]" />
                )}
                <span className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
                <span className="text-[9px] font-semibold leading-tight tracking-wide truncate max-w-full">
                  {t(tab.labelKey)}
                </span>
              </button>
            )
          })}
          {/* More button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 px-0.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] ${
              mobileMenuOpen ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
            }`}
            aria-label={t('nav.more')}
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
            <span className="text-[9px] font-semibold leading-tight tracking-wide max-w-full truncate">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile More Menu Bottom Sheet ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-2xl"
              style={{
                background: 'var(--color-bg-primary)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
                maxHeight: '70vh',
                paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
              </div>
              <div className="px-3 pb-4 overflow-y-auto space-y-0.5">
                {MORE_TABS.map(tabId => {
                  const tab = TABS.find(t => t.id === tabId) || (tabId === 'changelog' ? { id: 'changelog' as Tab, icon: <Sparkles className="w-[18px] h-[18px]" />, labelKey: 'nav.changelog', label: 'Novidades' } : undefined)!
                  if (!tab) return null
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px] ${
                        activeTab === tab.id
                          ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] font-semibold'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                      }`}
                    >
                      <span className="shrink-0">{tab.icon}</span>
                      <span className="text-sm">{t(tab.labelKey)}</span>
                    </button>
                  )
                })}

                {/* ── Settings separator ── */}
                <div className="flex items-center gap-3 pt-3 pb-1 px-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t('nav.settings')}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                </div>

                {/* Tutorial */}
                <button
                  onClick={() => { useTutorialStore.getState().startTutorial(); setMobileMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <BookOpen className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('nav.tutorial')}</span>
                </button>

                {/* Currency */}
                <button
                  onClick={() => setShowCurrencyPicker(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <DollarSign className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('settings.currency')}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">{symbol} {currencySetting}</span>
                </button>
                {showCurrencyPicker && (
                  <div className="mx-4 mb-1 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, info]) => (
                      <button
                        key={code}
                        onClick={() => { setCurrency(code); setShowCurrencyPicker(false) }}
                        className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors ${currencySetting === code ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
                      >
                        <span className="font-mono font-bold w-6">{info.symbol}</span>
                        <span>{code}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{info.name}</span>
                        {currencySetting === code && <span className="text-[var(--color-accent)] ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Language */}
                <button
                  onClick={() => { const next = i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR'; i18n.changeLanguage(next); setMobileMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <Globe className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('nav.language')}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{i18n.language === 'pt-BR' ? 'PT-BR' : 'EN-US'}</span>
                </button>

                {/* GitHub */}
                <a
                  href="https://github.com/ils15/open3dcalc"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <ExternalLink className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">GitHub</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">github.com/ils15/open3dcalc</span>
                </a>

                {/* Version */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-muted)]">
                  <Info className="w-[18px] h-[18px] shrink-0" />
                  <span className="text-xs">Open3DCalc v1.9.2</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <footer className="hidden lg:block text-center text-xs text-[var(--color-text-muted)] py-3 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-center gap-3">
          <span>Open3DCalc v1.9.1 — Open Source · MIT License</span>
        </div>
      </footer>

      <Tutorial />
    </div>
  )
}

export default App
