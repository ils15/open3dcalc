import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PRIMARY_TABS, holdsDemotedSurface, type Tab } from "./tabs";
import { MoreMenu } from "./MoreMenu";
import { useVisiblePrimaryTabs } from "./useVisibleNavigation";

/**
 * Navigation sidebars shared by both platforms (V2.0 Wave 1, reshaped by
 * Phase 7o s3).
 *
 * The visible items are the five always-available primary destinations the user
 * has not hidden; everything else demoted sits behind the shared "More"
 * disclosure. The only real difference between platforms is the inactive-item
 * hover token on the tablet strip (web uses text-primary, desktop
 * text-secondary), so that and the desktop footer content are passed as props.
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
  const visiblePrimary = useVisiblePrimaryTabs();

  return (
    <aside className="hidden md:flex lg:hidden flex-col gap-1 w-16 shrink-0 px-2 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--border-subtle)]">
      <p className="text-[9px] font-semibold text-[var(--text-muted)] px-2 mb-2 uppercase tracking-wider">
        Nav
      </p>
      {visiblePrimary.map((id) => {
        const tab = PRIMARY_TABS.find((entry) => entry.id === id)!;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
              activeTab === tab.id
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-subtle)]"
                : `text-[var(--text-muted)] ${tabletInactiveHoverClassName ?? "hover:text-[var(--text-primary)]"} hover:bg-[var(--surface-sunken)] border border-transparent`
            }`}
            title={t(tab.labelKey)}
            aria-label={t(tab.labelKey)}
          >
            {tab.icon}
          </button>
        );
      })}
      <MoreMenu
        activeTab={activeTab}
        onTabChange={onTabChange}
        showLabel={false}
        triggerClassName={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
          holdsDemotedSurface(activeTab)
            ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-subtle)]"
            : `text-[var(--text-muted)] ${tabletInactiveHoverClassName ?? "hover:text-[var(--text-primary)]"} hover:bg-[var(--surface-sunken)] border border-transparent`
        }`}
        itemClassName="nav-item"
      />
    </aside>
  );
}

export function DesktopSidebar({
  activeTab,
  onTabChange,
  footer,
}: SidebarProps): React.ReactElement {
  const { t } = useTranslation();
  const visiblePrimary = useVisiblePrimaryTabs();

  return (
    <aside className="hidden lg:flex flex-col gap-1 w-60 xl:w-68 shrink-0 px-4 py-6 sticky top-[68px] h-[calc(100dvh-68px)] overflow-y-auto border-r border-[var(--border-subtle)]">
      <p className="label-xs px-3 mb-2">{t("nav.navigation")}</p>
      {visiblePrimary.map((id) => {
        const tab = PRIMARY_TABS.find((entry) => entry.id === id)!;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}

      <MoreMenu
        activeTab={activeTab}
        onTabChange={onTabChange}
        triggerClassName="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        itemClassName="nav-item"
      />

      {footer}
    </aside>
  );
}
