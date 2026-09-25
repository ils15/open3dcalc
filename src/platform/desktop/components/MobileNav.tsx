import { useTranslation } from "react-i18next";
import { MoreMenu } from "@/shared/components/AppShell/MoreMenu";
import { PRIMARY_TABS, type Tab } from "@/shared/components/AppShell/tabs";
import { useVisiblePrimaryTabs } from "@/shared/components/AppShell/useVisibleNavigation";

/**
 * Mobile bottom navigation (desktop/Electron) — the five always-available
 * primary destinations plus a More disclosure for the demoted surfaces, at the
 * lg breakpoint and with no settings gear. The visible items come from the
 * shared hook, so this bar and the web bar can never show different sets; only
 * the gear (web-only) and the breakpoint differ.
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
  const visiblePrimary = useVisiblePrimaryTabs();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: "var(--color-bg-primary)",
        borderTop: "1px solid var(--color-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label={t("nav.mainNavigation")}
    >
      <div className="flex overflow-x-auto h-[68px] px-1.5">
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
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-[56px] min-h-[48px] px-1.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <span
                className={`transition-transform ${isActive ? "scale-110" : ""}`}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold leading-none tracking-wide">
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}

        <MoreMenu
          activeTab={activeTab}
          onTabChange={onTabChange}
          triggerClassName="flex flex-col items-center justify-center gap-1 flex-1 min-w-[56px] min-h-[48px] px-1.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          itemClassName="nav-item"
        >
          <span className="text-[10px] font-semibold leading-none tracking-wide">
            {t("nav.more")}
          </span>
        </MoreMenu>
      </div>
    </nav>
  );
}
