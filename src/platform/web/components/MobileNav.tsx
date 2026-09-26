import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { type Tab } from "@/shared/components/AppShell/tabs";
import { MoreMenu } from "@/shared/components/AppShell/MoreMenu";
import { PRIMARY_TABS } from "@/shared/components/AppShell/tabs";
import { useVisiblePrimaryTabs } from "@/shared/components/AppShell/useVisibleNavigation";
import { MobileSettingsSheet } from "./MobileSettingsSheet";

/**
 * Mobile bottom navigation (web) — the five always-available primary
 * destinations, a More disclosure for the demoted surfaces, and a pinned
 * settings gear that opens the settings-only bottom sheet.
 *
 * The primary/More split and the visibility filter are the shared ones, so the
 * web and desktop bars cannot drift. Desktop has a different bar (no gear, lg
 * breakpoint), so each platform keeps its own.
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
  const visiblePrimary = useVisiblePrimaryTabs();

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden"
        style={{
          background: "var(--color-bg-primary)",
          borderTop: "1px solid var(--color-border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          // --z-app-chrome: persistent chrome, not a modal. It has to beat
          // scrolling content and lose to every transient, so the two platforms
          // share one named step instead of drifting apart (this was z-50 and
          // z-40 for the same component).
          zIndex: "var(--z-app-chrome)",
        }}
        aria-label={t("nav.mainNavigation")}
      >
        <div className="flex items-stretch h-[56px]">
          {/* Primary destinations + More — parity with the desktop Electron nav */}
          <div className="flex overflow-x-auto flex-1 min-w-0 px-1">
            {visiblePrimary.map((id) => {
              const tab = PRIMARY_TABS.find((entry) => entry.id === id)!;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  aria-selected={isActive}
                  className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] py-1 px-1 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
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

            <MoreMenu
              activeTab={activeTab}
              onTabChange={onTabChange}
              triggerClassName="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] py-1 px-1 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[44px] text-[var(--color-text-muted)]"
              itemClassName="nav-item"
            >
              <span className="text-[9px] font-semibold leading-tight tracking-wide">
                {t("nav.more")}
              </span>
            </MoreMenu>
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
