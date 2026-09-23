import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { TABS, type Tab } from "@/shared/components/AppShell/tabs";
import { MobileSettingsSheet } from "./MobileSettingsSheet";

/**
 * Mobile bottom navigation (web) — scrollable tab strip plus a pinned
 * settings gear that opens the settings-only bottom sheet.
 *
 * Extracted verbatim from the web App.tsx body. Desktop has a different bar
 * (no gear, lg breakpoint), so each platform keeps its own.
 */
interface MobileNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function MobileNav({
  activeTab,
  onTabChange,
}: MobileNavProps): React.ReactElement {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background: "var(--color-bg-primary)",
          borderTop: "1px solid var(--color-border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label={t("nav.mainNavigation")}
      >
        <div className="flex items-stretch h-[56px]">
          {/* Scrollable tab strip — parity with the desktop Electron nav */}
          <div className="flex overflow-x-auto flex-1 min-w-0 px-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] py-1 px-1 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                  aria-selected={isActive}
                >
                  {isActive && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-accent)]" />
                  )}
                  <span
                    className={`transition-transform ${isActive ? "scale-110" : ""}`}
                  >
                    {tab.icon}
                  </span>
                  <span className="text-[9px] font-semibold leading-tight tracking-wide truncate max-w-full">
                    {t(tab.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Settings gear — pinned outside the scroll area, always reachable */}
          <button
            onClick={() => setSettingsOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 shrink-0 w-[60px] py-1 px-1 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] border-l border-[var(--color-border)] ${
              settingsOpen
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)]"
            }`}
            aria-label={t("nav.settings")}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
          >
            <Settings className="w-[18px] h-[18px]" />
            <span className="text-[9px] font-semibold leading-tight tracking-wide max-w-full truncate">
              {t("nav.settings")}
            </span>
          </button>
        </div>
      </nav>

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onInternalNavigate={onTabChange}
      />
    </>
  );
}
