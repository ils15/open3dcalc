import type { ReactNode } from "react";
import { TabletSidebar, DesktopSidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import type { Tab } from "./tabs";

/**
 * Shared application shell (V2.0 Wave 1).
 *
 * Hosts the navigation chrome duplicated by the two platform App.tsx bodies:
 * the tablet (icons-only) sidebar, the desktop sidebar and the tab → surface
 * switch. Platform chrome that genuinely differs (mobile bottom nav, mobile
 * settings sheet, footer, header) stays in the platform folders and is
 * composed around this shell — only identical chrome lives here, so the
 * extraction cannot change behavior.
 *
 * `activeTab` remains local state in each App (passed by props); no router,
 * no persisted UI store in this wave.
 */
export interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Desktop sidebar bottom content (web: SecondaryNavigation; desktop: brand links). */
  sidebarFooter?: ReactNode;
  /** Skip link rendered before the main content (web only). */
  skipLink?: ReactNode;
  /** `id` on the main landmark (web: "main"; desktop: none). */
  mainId?: string;
  /** Main content padding — differs per platform. */
  mainClassName: string;
  /** Inactive-item hover token on the tablet strip — differs per platform. */
  tabletInactiveHoverClassName?: string;
}

export function AppShell({
  activeTab,
  onTabChange,
  sidebarFooter,
  skipLink,
  mainId,
  mainClassName,
  tabletInactiveHoverClassName,
}: AppShellProps): React.ReactElement {
  return (
    <>
      <TabletSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabletInactiveHoverClassName={tabletInactiveHoverClassName}
      />

      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        footer={sidebarFooter}
      />

      {skipLink}

      <main id={mainId} className={mainClassName}>
        <div className="animate-fade-up">
          <MainContent
            activeTab={activeTab}
            onSelectCalculator={() => onTabChange("calculator")}
          />
        </div>
      </main>
    </>
  );
}
