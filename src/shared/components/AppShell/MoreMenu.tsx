import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { visibleTabsFrom } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { MORE_ICON, MORE_TABS, holdsDemotedSurface, type Tab } from "./tabs";

/**
 * "More" disclosure — Phase 7o s3.
 *
 * One implementation shared by all four nav surfaces (tablet strip, desktop
 * sidebar, web mobile bar, desktop mobile bar) so the demoted set can never
 * drift between shells. A plain disclosure, NOT an ARIA menu: the items are
 * ordinary buttons reached with Tab, which keeps the keyboard contract honest
 * without hand-rolling arrow-key roving focus.
 *
 * `aria-current="page"` moves onto the trigger when the active destination is a
 * demoted one, so a hidden-from-the-bar surface never looks unselected.
 */
interface MoreMenuProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Trigger classes (layout differs per nav surface). */
  triggerClassName: string;
  /** Item classes. */
  itemClassName: string;
  /** Show the "More" text next to the icon. */
  showLabel?: boolean;
  /** Rendered inside the trigger, before the icon (icons-only strips). */
  children?: React.ReactNode;
  /** Rendered under the items, inside the panel. */
  footer?: React.ReactNode;
}

export function MoreMenu({
  activeTab,
  onTabChange,
  triggerClassName,
  itemClassName,
  showLabel = true,
  children,
  footer,
}: MoreMenuProps): React.ReactElement | null {
  const { t } = useTranslation();
  const hiddenTabs = useNavigationPrefsStore((state) => state.hiddenTabs);
  const { open, toggle, close, triggerRef, contentRef } =
    useDismissablePopover<HTMLButtonElement>();

  // Unique per instance: the tablet strip and the desktop sidebar are BOTH
  // mounted at once (separated only by `display:none`), so a hardcoded id
  // would be duplicated in the DOM and `aria-controls` would resolve to the
  // wrong panel for half the instances. Declared ABOVE the early return below:
  // hiding every demoted destination unmounts the panel, and a hook called
  // after that bail would change hook order between renders.
  const panelId = useId();

  const items = visibleTabsFrom(
    MORE_TABS.map((tab) => tab.id),
    { activeTab, hiddenTabs },
  );

  // Nothing demoted is visible: the trigger would open onto an empty panel.
  if (items.length === 0) return null;

  // Ownership, not visibility: a demoted surface the user hid is filtered out
  // of the panel but is still "behind More", so More keeps the current marker
  // and the nav never shows an active destination as unselected.
  const holdsActive = holdsDemotedSurface(activeTab);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={holdsActive ? "page" : undefined}
        className={triggerClassName}
        title={t("nav.more")}
      >
        {children}
        {MORE_ICON}
        {showLabel && <span>{t("nav.more")}</span>}
      </button>

      {open && (
        <div
          ref={contentRef}
          id={panelId}
          data-testid="more-menu"
          className="absolute left-0 bottom-full z-50 mb-1 min-w-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1 shadow-xl"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t("nav.more")}
          </p>
          <ul>
            {items.map((id) => {
              const entry = MORE_TABS.find((tab) => tab.id === id)!;
              const isActive = activeTab === id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange(entry.id);
                      close();
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`${itemClassName} w-full text-left ${
                      isActive ? "active" : ""
                    }`}
                  >
                    {entry.icon}
                    <span>{t(entry.labelKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {footer}
        </div>
      )}
    </div>
  );
}
