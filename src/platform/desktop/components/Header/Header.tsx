import { useTranslation } from "react-i18next";
import { Box, Code2, RefreshCw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { TutorialLauncher } from "@/shared/components/ui/TutorialLauncher";
import {
  useCurrencyPreference,
  useSetCurrency,
} from "@/shared/contexts/CurrencyContext";
import { ThemeToggle } from "@/shared/components/Header/ThemeToggle";
import { useUpdaterStore } from "../UpdateNotification/UpdaterStore";
import { DataSyncButton } from "@/shared/components/ui/DataSyncButton";
import { BetaBadge } from "@/shared/components/BetaBadge/BetaBadge";
import { LayoutSwitcher } from "@/shared/components/Header/LayoutSwitcher";
import { ManageVisibilityButton } from "@/shared/components/AppShell/ManageVisibilityButton";
import { FocusModeButton } from "@/shared/components/AppShell/FocusModeButton";
import { ContextBreadcrumb } from "@/shared/components/Header/ContextBreadcrumb";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { UtilityBar } from "@/shared/components/UtilityBar/UtilityBar";
import { CurrencySelect } from "@/shared/components/UtilityBar/CurrencySelect";
import { LanguageToggle } from "@/shared/components/UtilityBar/LanguageToggle";

export function Header() {
  const { t } = useTranslation();
  const { currencySetting } = useCurrencyPreference();
  const setCurrency = useSetCurrency();
  // Single source of truth for the destination: NavigationProvider reads this
  // same field into ActiveTabContext, so the breadcrumb and the nav can never
  // disagree about where the user is.
  const activeTab = useNavigationPrefsStore((state) => state.activeTab);
  // Updater state — only renders button when electronAPI is available
  const hasUpdater = !!window.electronAPI?.updater;
  const isChecking = useUpdaterStore(
    useShallow((s) => s.status === "checking"),
  );

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "var(--color-bg-primary)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto min-w-0 px-6 sm:px-8 lg:px-12 h-[68px] flex items-center justify-between gap-4">
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
                <BetaBadge />
              </div>
              <p className="text-[11px] sm:text-[12px] text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5 hidden sm:block">
                {t("app.subtitle")}
              </p>
            </div>
          </div>

          {/* Contextual breadcrumb — same intermediate sibling as the web shell,
              so the two bands stay symmetric. Its zone is `flex-1 min-w-0`: the
              eleven action buttons to the right are all `shrink-0`, so the
              breadcrumb is the only thing that can absorb slack. */}
          <ContextBreadcrumb tab={activeTab} />

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <LayoutSwitcher />

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

            {/* Tours launcher */}
            <TutorialLauncher />

            {/* Destination visibility (Phase 7o s3) — reachable at every width,
                including the <lg range where the desktop sidebar is hidden. */}
            <ManageVisibilityButton variant="icon" />

            {/* Focus Mode (Phase 7o s4) — same reachability, transient */}
            <FocusModeButton variant="icon" />

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
                  isChecking
                    ? t("update.checking")
                    : t("update.checkForUpdates")
                }
              >
                <RefreshCw
                  className={`w-5 h-5 ${isChecking ? "animate-spin" : ""}`}
                />
              </button>
            )}

            {/* Data Sync */}
            <DataSyncButton variant="icon" />
          </div>
        </div>
      </header>

      {/* In the flow, below the header — see UtilityBar.tsx. Currency first:
          it is the widest of the three and the one whose `auto` marker is
          widest, so it anchors the band's left edge on both shells. */}
      <UtilityBar>
        <CurrencySelect setting={currencySetting} onChange={setCurrency} />
        <LanguageToggle />
        <ThemeToggle />
      </UtilityBar>
    </>
  );
}
