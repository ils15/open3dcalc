import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Check, DollarSign, Globe, Info } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { CURRENCIES, type CurrencyCode } from "@/shared/lib/currency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { APP_VERSION } from "@/shared/version";
import { SecondaryNavigation } from "@/platform/web/SecondaryNavigation";
import { LayoutSwitcher } from "@/shared/components/Header/LayoutSwitcher";

/**
 * Mobile settings bottom sheet (web only — settings only, never tabs).
 *
 * Extracted verbatim from the web App.tsx body. The desktop platform has no
 * equivalent sheet, so it stays platform-local.
 */
interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  /** Navigate to an internal surface from the sheet's secondary links. */
  onInternalNavigate: (tab: "wiki" | "changelog") => void;
}

export function MobileSettingsSheet({
  open,
  onClose,
  onInternalNavigate,
}: MobileSettingsSheetProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { symbol } = useCurrency();
  const currencySetting = useCalculatorStore((s) => s.currency);
  const setCurrency = useCalculatorStore((s) => s.setCurrency);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl"
            role="dialog"
            aria-label={t("nav.settings")}
            style={{
              background: "var(--color-bg-primary)",
              borderTop: "1px solid var(--color-border)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
              maxHeight: "70vh",
              paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "var(--color-border)" }}
              />
            </div>
            <div className="px-3 pb-4 overflow-y-auto space-y-0.5">
              <div className="px-1 py-2">
                <LayoutSwitcher showLabels className="w-full justify-between" />
              </div>

              {/* ── Settings heading ── */}
              <div className="flex items-center gap-3 pt-3 pb-1 px-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {t("nav.settings")}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "var(--color-border)" }}
                />
              </div>

              {/* Tutorial */}
              <button
                onClick={() => {
                  useTutorialStore.getState().startTutorial();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
              >
                <BookOpen className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                <span className="text-sm font-medium">{t("nav.tutorial")}</span>
              </button>

              {/* Currency */}
              <button
                onClick={() => setShowCurrencyPicker((v) => !v)}
                aria-label={t("settings.currency")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
              >
                <DollarSign className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                <span className="text-sm font-medium">
                  {t("settings.currency")}
                </span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-[var(--color-text-muted)] font-mono">
                  {symbol} {currencySetting}
                </span>
              </button>
              {showCurrencyPicker && (
                <div
                  className="mx-4 mb-1 rounded-xl overflow-hidden border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {(
                    Object.entries(CURRENCIES) as [
                      CurrencyCode,
                      (typeof CURRENCIES)[CurrencyCode],
                    ][]
                  ).map(([code, info]) => (
                    <button
                      key={code}
                      onClick={() => {
                        setCurrency(code);
                        setShowCurrencyPicker(false);
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
                        <span className="text-[var(--color-accent)] ml-1">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Language */}
              <button
                onClick={() => {
                  const next = i18n.language === "pt-BR" ? "en-US" : "pt-BR";
                  i18n.changeLanguage(next);
                  onClose();
                }}
                aria-label={t("nav.language")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]"
              >
                <Globe className="w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]" />
                <span className="text-sm font-medium">{t("nav.language")}</span>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  {i18n.language === "pt-BR" ? "PT-BR" : "EN-US"}
                </span>
              </button>

              <SecondaryNavigation
                onInternalNavigate={onInternalNavigate}
                onNavigate={onClose}
              />

              {/* Version */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-muted)]">
                <Info className="w-[18px] h-[18px] shrink-0" />
                <span className="text-xs">Open3DCalc v{APP_VERSION}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
