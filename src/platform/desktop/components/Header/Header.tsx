import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Code2,
  Globe,
  ChevronDown,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { CURRENCIES, type CurrencyCode } from "@/shared/lib/currency";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { ThemeToggle } from "@/shared/components/Header/ThemeToggle";
import { useUpdaterStore } from "../UpdateNotification/UpdaterStore";

export function Header() {
  const { t, i18n } = useTranslation();
  const { currency: currencySetting, setCurrency } = useCalculatorStore(
    useShallow((s) => ({ currency: s.currency, setCurrency: s.setCurrency })),
  );
  const { symbol } = useCurrency();
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Updater state — only renders button when electronAPI is available
  const hasUpdater = !!window.electronAPI?.updater;
  const isChecking = useUpdaterStore(
    useShallow((s) => s.status === "checking"),
  );

  const toggleLanguage = () => {
    const next = i18n.language === "pt-BR" ? "en-US" : "pt-BR";
    i18n.changeLanguage(next);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCurrencyMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: "var(--color-bg-primary)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="max-w-[1440px] mx-auto min-w-0 px-6 sm:px-8 lg:px-12 h-[68px] flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              boxShadow: "0 2px 12px rgba(79,70,229,0.4)",
            }}
          >
            <Box className="w-[22px] h-[22px] text-white" strokeWidth={2} />
          </div>

          <div className="leading-none">
            <div className="flex items-center gap-2">
              <span className="text-[17px] sm:text-[19px] font-black tracking-tight gradient-text">
                {t("app.title")}
              </span>
              <span className="badge badge-indigo hidden sm:inline-flex">
                Beta
              </span>
            </div>
            <p className="text-[11px] sm:text-[12px] text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5 hidden sm:block">
              {t("app.subtitle")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://t.me/Impressao3DBR"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 lg:p-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl"
            title={t("nav.telegram")}
            aria-label={t("nav.telegram")}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.441-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141a.506.506 0 0 1 .171.325c.016.093.036.306.02.472z" />
            </svg>
          </a>
          <a
            href="https://github.com/ils15/open3dcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 lg:p-3 text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)] rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            title="GitHub"
          >
            <Code2 className="w-5 h-5 lg:w-5 lg:h-5" />
          </a>

          {/* Tutorial trigger */}
          <button
            onClick={() => useTutorialStore.getState().startTutorial()}
            className="flex items-center gap-2 p-2.5 lg:px-3.5 lg:py-2.5 text-[var(--color-accent-light)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl border border-transparent hover:border-[var(--color-accent-muted)]"
            title={t("nav.tutorial")}
            aria-label={t("nav.tutorial")}
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden lg:inline text-[13px] font-semibold">
              {t("nav.tutorial")}
            </span>
          </button>

          {/* Currency selector */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setShowCurrencyMenu((v) => !v)}
              className="flex min-w-[80px] shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[13px] font-semibold px-3 py-2.5 rounded-lg min-h-[44px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              title={t("settings.currency")}
              aria-label={t("settings.currency")}
              aria-haspopup="menu"
              aria-expanded={showCurrencyMenu}
              aria-controls="currency-menu"
            >
              <span className="font-mono">{symbol}</span>
              {currencySetting === "auto" && (
                <span className="text-[10px] text-[var(--color-text-muted)] font-normal">
                  auto
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-40" />
            </button>

            {showCurrencyMenu && (
              <div
                id="currency-menu"
                role="menu"
                aria-label={t("settings.currency")}
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl shadow-2xl z-50 overflow-hidden surface border border-[var(--color-border)]"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setCurrency("auto");
                    setShowCurrencyMenu(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors ${currencySetting === "auto" ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}
                >
                  <span className="font-mono font-bold w-6">{symbol}</span>
                  <span>{t("settings.currencyAuto")}</span>
                  {currencySetting === "auto" && (
                    <span className="ml-auto text-[var(--color-accent)]">
                      ✓
                    </span>
                  )}
                </button>
                <div className="border-t border-[var(--color-border)]" />
                {(
                  Object.entries(CURRENCIES) as [
                    CurrencyCode,
                    (typeof CURRENCIES)[CurrencyCode],
                  ][]
                ).map(([code, info]) => (
                  <button
                    key={code}
                    role="menuitem"
                    onClick={() => {
                      setCurrency(code);
                      setShowCurrencyMenu(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors ${currencySetting === code ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}
                  >
                    <span className="font-mono font-bold w-6">
                      {info.symbol}
                    </span>
                    <span>{code}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                      {info.name}
                    </span>
                    {currencySetting === code && (
                      <span className="text-[var(--color-accent)] ml-1">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Check for Updates (desktop only) */}
          {hasUpdater && (
            <button
              onClick={() => useUpdaterStore.getState().checkForUpdates()}
              disabled={isChecking}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 lg:p-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                isChecking
                  ? "text-[var(--color-text-muted)] cursor-not-allowed"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]"
              }`}
              title={
                isChecking
                  ? t("update.checkingShort")
                  : t("update.checkForUpdates")
              }
              aria-label={
                isChecking ? t("update.checking") : t("update.checkForUpdates")
              }
            >
              <RefreshCw
                className={`w-5 h-5 ${isChecking ? "animate-spin" : ""}`}
              />
            </button>
          )}

          <button
            onClick={toggleLanguage}
            className="flex min-w-[64px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-semibold px-3.5 py-2.5 min-h-[44px] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            title={t("nav.language")}
            aria-label={t("nav.language")}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">
              {i18n.language === "pt-BR" ? "EN" : "PT"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
