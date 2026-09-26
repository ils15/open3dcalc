import { useEffect, useRef, type ReactNode } from "react";
import { TabletSidebar, DesktopSidebar } from "./Sidebar";
import { FocusModeExit } from "./FocusModeExit";
import { MainContent } from "./MainContent";
import { useFocusMode } from "./NavigationContext";
import type { Tab } from "./tabs";

/**
 * Shared application shell (V2.0 Wave 1; reshaped by Phase 7o s3 and s4).
 *
 * Hosts the navigation chrome duplicated by the two platform App.tsx bodies:
 * the tablet (icons-only) sidebar, the desktop sidebar and the tab → surface
 * switch. Platform chrome that genuinely differs (mobile bottom nav, mobile
 * settings sheet, footer, header) stays in the platform folders and is
 * composed around this shell — only identical chrome lives here, so the
 * extraction cannot change behavior.
 *
 * `activeTab` is passed from the shared in-memory NavigationProvider; no
 * router or persisted UI store is involved in this phase.
 *
 * Focus Mode (s4) lives here rather than in the platform Apps because the
 * sidebars ARE the chrome it removes, and the two sides of the shell must not
 * be able to disagree about whether they are showing. What it does NOT hide is
 * the skip link: that is an accessibility affordance, not navigation, and
 * taking it away would make the mode less navigable, not more focused.
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
  /**
   * Main content padding while Focus Mode is on. A separate prop rather than a
   * class swap inside the shell because the padding is platform-specific: the
   * web and desktop bars reserve a different amount of bottom space, and
   * whichever reserve matched the hidden mobile nav would be dead whitespace
   * the moment the nav is gone.
   */
  mainFocusClassName?: string;
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
  mainFocusClassName,
  tabletInactiveHoverClassName,
}: AppShellProps): React.ReactElement {
  const { active: focusMode } = useFocusMode();
  const mainRef = useRef<HTMLElement>(null);
  const wasFocusMode = useRef(focusMode);

  // Leaving the mode unmounts the exit control, so focus would fall to <body>
  // and a keyboard user would lose their place entirely. The main landmark is
  // where they are actually returning to, so it gets the focus. Runs only on
  // the off transition, never on mount.
  useEffect(() => {
    if (wasFocusMode.current && !focusMode) mainRef.current?.focus();
    wasFocusMode.current = focusMode;
  }, [focusMode]);

  return (
    <>
      {!focusMode && (
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
        </>
      )}

      {skipLink}

      <main
        ref={mainRef}
        id={mainId}
        // Programmatic focus target for the Focus Mode exit (see the effect
        // above). -1 keeps it out of the Tab order.
        tabIndex={-1}
        className={
          focusMode ? (mainFocusClassName ?? mainClassName) : mainClassName
        }
      >
        <div className="animate-fade-up">
          <MainContent
            activeTab={activeTab}
            onSelectCalculator={() => onTabChange("calculator")}
          />
        </div>
      </main>

      {focusMode && <FocusModeExit />}
    </>
  );
}
