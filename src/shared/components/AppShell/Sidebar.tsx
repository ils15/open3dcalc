import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TABS, type Tab } from "./tabs";

/**
 * Navigation sidebars shared by both platforms (V2.0 Wave 1).
 *
 * Extracted verbatim from the duplicated App.tsx bodies. The only real
 * difference between platforms is the inactive-item hover token on the
 * tablet strip (web uses text-primary, desktop text-secondary) and the
 * desktop sidebar footer content, so both are passed as props.
 */
interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Desktop sidebar bottom content (web: SecondaryNavigation; desktop: brand links). */
  footer?: ReactNode;
  /** Inactive-item hover token on the tablet strip — differs per platform. */
  tabletInactiveHoverClassName?: string;
}

export function TabletSidebar({
  activeTab,
  onTabChange,
  tabletInactiveHoverClassName,
}: Omit<SidebarProps, "footer">): React.ReactElement {
  const { t } = useTranslation();

  return (
    <aside className="hidden md:flex lg:hidden flex-col gap-1 w-16 shrink-0 px-2 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--color-border)]">
      <p className="text-[9px] font-semibold text-[var(--color-text-muted)] px-2 mb-2 uppercase tracking-wider">
        Nav
      </p>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
            activeTab === tab.id
              ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent-muted)]"
              : `text-[var(--color-text-muted)] ${tabletInactiveHoverClassName ?? "hover:text-[var(--color-text-primary)]"} hover:bg-[var(--color-bg-hover)] border border-transparent`
          }`}
          title={t(tab.labelKey)}
        >
          {tab.icon}
        </button>
      ))}
    </aside>
  );
}

export function DesktopSidebar({
  activeTab,
  onTabChange,
  footer,
}: SidebarProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:flex flex-col gap-1 w-60 xl:w-68 shrink-0 px-4 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--color-border)]">
      <p className="label-xs px-3 mb-2">{t("nav.navigation")}</p>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${activeTab === tab.id ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.icon}
          <span>{t(tab.labelKey)}</span>
        </button>
      ))}

      {footer}
    </aside>
  );
}
