import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Code2, Globe, ChevronDown } from 'lucide-react'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { CURRENCIES, type CurrencyCode } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'

export function Header() {
  const { t, i18n } = useTranslation()
  const currencySetting = useCalculatorStore(s => s.currency)
  const setCurrency = useCalculatorStore(s => s.setCurrency)
  const { symbol } = useCurrency()
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleLanguage = () => {
    const next = i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR'
    i18n.changeLanguage(next)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCurrencyMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'rgba(6,8,24,0.92)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 h-[68px] flex items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
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
              <h1 className="text-[17px] sm:text-[19px] font-black tracking-tight gradient-text">
                {t('app.title')}
              </h1>
              <span className="badge badge-indigo hidden sm:inline-flex">Beta</span>
            </div>
            <p className="text-[11px] sm:text-[12px] text-slate-500 uppercase tracking-widest mt-0.5 hidden sm:block">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/ils15/open3dcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 lg:p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="GitHub"
          >
            <Code2 className="w-5 h-5 lg:w-5 lg:h-5" />
          </a>

          {/* Currency selector */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowCurrencyMenu(v => !v)}
              className="flex items-center gap-1 text-[13px] font-semibold px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title={t('settings.currency')}
            >
              <span className="font-mono">{symbol}</span>
              {currencySetting === 'auto' && (
                <span className="text-[10px] text-slate-500 font-normal">auto</span>
              )}
              <ChevronDown className="w-3 h-3 opacity-40" />
            </button>

            {showCurrencyMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl shadow-2xl z-50 overflow-hidden border border-white/10"
                style={{ background: 'rgba(6,8,24,0.98)', backdropFilter: 'blur(20px)' }}>
                <button
                  onClick={() => { setCurrency('auto'); setShowCurrencyMenu(false) }}
                  className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-white/5 transition-colors ${currencySetting === 'auto' ? 'text-indigo-400' : 'text-slate-300'}`}
                >
                  <span className="font-mono font-bold w-6">{symbol}</span>
                  <span>{t('settings.currencyAuto')}</span>
                  {currencySetting === 'auto' && <span className="ml-auto text-indigo-400">✓</span>}
                </button>
                <div className="border-t border-white/[0.06]" />
                {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, info]) => (
                  <button
                    key={code}
                    onClick={() => { setCurrency(code); setShowCurrencyMenu(false) }}
                    className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-white/5 transition-colors ${currencySetting === code ? 'text-indigo-400' : 'text-slate-300'}`}
                  >
                    <span className="font-mono font-bold w-6">{info.symbol}</span>
                    <span>{code}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{info.name}</span>
                    {currencySetting === code && <span className="text-indigo-400 ml-1">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none min-w-[44px]"
            title="Mudar idioma"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{i18n.language === 'pt-BR' ? 'EN' : 'PT'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
