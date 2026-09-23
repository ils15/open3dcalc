import { useTranslation } from "react-i18next";
import { TABS, type Tab } from "@/shared/components/AppShell/tabs";

/**
 * Mobile bottom navigation (desktop/Electron) — a simple scrollable strip at
 * the lg breakpoint, no settings gear. Extracted verbatim from the desktop
 * App.tsx body; the web bar differs (gear + sheet, md breakpoint).
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
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-[56px] min-h-[48px] px-1.5 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
              activeTab === tab.id
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
            aria-selected={activeTab === tab.id}
          >
            <span
              className={`transition-transform ${activeTab === tab.id ? "scale-110" : ""}`}
            >
              {tab.icon}
            </span>
            <span className="text-[10px] font-semibold leading-none tracking-wide">
              {t(tab.labelKey)}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
