import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Box, Globe, ChevronDown, BookOpen, DollarSign, Info, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { motion, AnimatePresence } from 'framer-motion'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useTutorialStore } from '@/shared/stores/tutorialStore'
import { CURRENCIES, type CurrencyCode } from '@/shared/lib/currency'
import { useCurrency } from '@/shared/hooks/useCurrency'
import { useDismissablePopover } from '@/shared/hooks/useDismissablePopover'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const { t, i18n } = useTranslation()
  const { currency: currencySetting, setCurrency } = useCalculatorStore(
    useShallow((s) => ({ currency: s.currency, setCurrency: s.setCurrency })),
  )
  const { symbol } = useCurrency()
  const [showSettings, setShowSettings] = useState(false)
  const {
    open: currencyMenuOpen,
    toggle: toggleCurrencyMenu,
    triggerRef: currencyTriggerRef,
    contentRef: currencyMenuContentRef,
  } = useDismissablePopover<HTMLButtonElement>()
  const [currencyMenuPos, setCurrencyMenuPos] = useState<{ top: number; right: number } | null>(null)

  const toggleLanguage = () => {
    const next = i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR'
    i18n.changeLanguage(next)
  }

  const handleCurrencyToggle = () => {
    if (!currencyMenuOpen && currencyTriggerRef.current) {
      const rect = currencyTriggerRef.current.getBoundingClientRect()
      setCurrencyMenuPos({
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      })
    }
    toggleCurrencyMenu()
  }

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 h-[68px] flex items-center justify-between gap-2 sm:gap-4">

        {/* Logo — clickable on mobile to open settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-3 cursor-pointer sm:cursor-default text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl"
          aria-label={t('nav.settings')}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 2px 12px rgba(79,70,229,0.4)',
            }}
          >
            <Box className="w-[22px] h-[22px] text-white" strokeWidth={2} />
          </div>

          <div className="leading-none">
            <div className="flex items-center gap-2">
              <span className="text-[17px] sm:text-[19px] font-black tracking-tight gradient-text">
                {t('app.title')}
              </span>
              <span className="badge badge-indigo hidden sm:inline-flex">Beta</span>
            </div>
            <p className="text-[11px] sm:text-[12px] text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5 hidden sm:block">
              {t('app.subtitle')}
            </p>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">

          {/* Desktop-only actions */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Tutorial trigger */}
            <button
              onClick={() => useTutorialStore.getState().startTutorial()}
              className="flex items-center gap-2 p-2.5 lg:px-3.5 lg:py-2.5 min-h-[44px] min-w-[44px] text-[var(--color-accent-light)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl border border-transparent hover:border-[var(--color-accent-muted)]"
              title={t('nav.tutorial')}
              aria-label={t('nav.tutorial')}
            >
              <BookOpen className="w-5 h-5" />
              <span className="hidden lg:inline text-[13px] font-semibold">{t('nav.tutorial')}</span>
            </button>

            {/* Currency selector */}
            <div className="flex items-center">
              <button
                ref={currencyTriggerRef}
                onClick={handleCurrencyToggle}
                aria-haspopup="menu"
                aria-expanded={currencyMenuOpen}
                aria-controls="header-currency-menu"
                className="flex items-center gap-1 text-[13px] font-semibold px-3 py-2.5 rounded-lg min-h-[44px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                title={t('settings.currency')}
              >
                <span className="font-mono">{symbol}</span>
                {currencySetting === 'auto' && (
                  <span className="hidden sm:inline text-[10px] text-[var(--color-text-muted)] font-normal">auto</span>
                )}
                <ChevronDown className="w-3 h-3 opacity-40" />
              </button>

              {currencyMenuOpen &&
                currencyMenuPos &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={currencyMenuContentRef}
                    id="header-currency-menu"
                    role="menu"
                    aria-label={t('settings.currency')}
                    className="fixed z-[60] w-44 rounded-xl shadow-2xl overflow-hidden surface border border-[var(--color-border)]"
                    style={{ position: 'fixed', top: currencyMenuPos.top, right: currencyMenuPos.right }}
                  >
                    <button
                      role="menuitem"
                      onClick={() => { setCurrency('auto'); toggleCurrencyMenu() }}
                      className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors ${currencySetting === 'auto' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
                    >
                      <span className="font-mono font-bold w-6">{symbol}</span>
                      <span>{t('settings.currencyAuto')}</span>
                      {currencySetting === 'auto' && <span className="ml-auto text-[var(--color-accent)]">✓</span>}
                    </button>
                    <div className="border-t border-[var(--color-border)]" />
                    {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, info]) => (
                      <button
                        key={code}
                        role="menuitem"
                        onClick={() => { setCurrency(code); toggleCurrencyMenu() }}
                        className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors ${currencySetting === code ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
                      >
                        <span className="font-mono font-bold w-6">{info.symbol}</span>
                        <span>{code}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{info.name}</span>
                        {currencySetting === code && <span className="text-[var(--color-accent)] ml-1">✓</span>}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2.5 min-h-[44px] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-w-[44px]"
              title={t('nav.language')}
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{i18n.language === 'pt-BR' ? 'EN' : 'PT'}</span>
            </button>
          </div>

          {/* Theme toggle — visible on all sizes */}
          <ThemeToggle />
        </div>
      </div>

      {/* ── Mobile Settings Bottom Sheet ── */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 sm:hidden"
              onClick={() => setShowSettings(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 sm:hidden rounded-t-2xl"
              style={{
                background: 'var(--color-bg-primary)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
                paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
              </div>

              {/* Title */}
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-sm font-bold">{t('nav.settings')}</span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 pb-4 space-y-0.5">
                {/* Tutorial */}
                <button
                  onClick={() => { useTutorialStore.getState().startTutorial(); setShowSettings(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <BookOpen className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('nav.tutorial')}</span>
                </button>

                {/* Currency — desktop selector handles changes; close the sheet here */}
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <DollarSign className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('settings.currency')}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">{symbol} {currencySetting}</span>
                </button>

                {/* Language */}
                <button
                  onClick={() => { toggleLanguage(); setShowSettings(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
                >
                  <Globe className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                  <span className="text-sm font-medium">{t('nav.language')}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{i18n.language === 'pt-BR' ? 'PT-BR' : 'EN-US'}</span>
                </button>

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
    </header>
  )
}
