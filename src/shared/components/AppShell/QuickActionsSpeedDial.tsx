import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Keyboard,
  Package,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useNavigateToTab } from "./NavigationContext";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

/**
 * The floating quick-actions dial — the app's copy of the prototype's FAB, and
 * deliberately better on every axis the prototype got wrong.
 *
 * Accessibility, and why each part is here:
 *
 * - The TRIGGER declares `aria-haspopup="menu"`, because what it opens is a
 *   `role="menu"` of `role="menuitem"`s — a menu button, per the WAI-ARIA menu
 *   pattern, not a dialog trigger. It also carries `aria-expanded` and
 *   `aria-controls`, neither of which the prototype's bare `title` had.
 * - The SHORTCUTS ITEM declares `aria-haspopup="dialog"`: that item opens a
 *   modal, so that is what it advertises. Declaring the wrong popup type is the
 *   same class of bug as the prototype's items being `div`s — a lie an
 *   assistive technology then has to reconcile.
 * - Items are real `<button role="menuitem">`. The prototype's `div`s with
 *   `onClick` are not focusable, not activatable by Enter/Space, and invisible
 *   to `getAllByRole("menuitem")`.
 * - Dismissal is `useDismissablePopover`, which is where the prototype is
 *   actively harmful: it closes on Escape and on an outside click but never
 *   returns focus to the trigger, dropping a keyboard user on `<body>`. The app
 *   hook returns focus (see its Escape branch).
 * - Arrow keys walk the items (WAI-ARIA menu pattern). Tab deliberately closes
 *   the menu instead of being trapped: a menu is not a focus cage, and
 *   Focus Mode's own suite asserts the app never cages Tab
 *   (`focusMode.test.tsx:281`). The Tab TRAP lives in the shortcuts dialog,
 *   which IS a modal, matching `manageVisibility.test.tsx:144`.
 *
 * Three of the prototype's seven items are deliberately ABSENT rather than
 * shipped disabled: fleet (deferred by the owner), AI copilot (`v2-no-ai`), and
 * simplified mode (no such concept here). A disabled entry is still a Tab stop,
 * and a stop that can never be acted on is worse than no item at all — the same
 * reasoning `ManageVisibilityButton` uses for "Always visible".
 */
interface DialAction {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
  readonly run: () => void;
}

export function QuickActionsSpeedDial(): React.ReactElement {
  const { t } = useTranslation();
  const navigateToTab = useNavigateToTab();
  const resetCalculator = useCalculatorStore((s) => s.resetCalculator);
  const { open, toggle, close, triggerRef, contentRef } =
    useDismissablePopover<HTMLButtonElement>();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuId = useId();

  // Run, then dismiss. Order matters: the shortcuts action opens a dialog that
  // is itself dismissable, and leaving the dial open underneath it would give
  // the user two Escape layers from one control.
  const runAndClose = useCallback(
    (run: () => void) => () => {
      run();
      close();
    },
    [close],
  );

  const actions: readonly DialAction[] = [
    {
      id: "newProject",
      labelKey: "quickActions.newProject",
      icon: Plus,
      run: runAndClose(() => resetCalculator()),
    },
    {
      id: "quote",
      labelKey: "quickActions.quote",
      icon: FileText,
      // "quotes" is the destination MainContent maps to <QuoteSection/>.
      run: runAndClose(() => navigateToTab("quotes")),
    },
    {
      id: "inventory",
      labelKey: "quickActions.inventory",
      icon: Package,
      // "inventory" is the destination MainContent maps to <SpoolShelf/>.
      run: runAndClose(() => navigateToTab("inventory")),
    },
    {
      id: "shortcuts",
      labelKey: "quickActions.shortcuts",
      icon: Keyboard,
      run: runAndClose(() => setShortcutsOpen(true)),
    },
  ];

  /** Only the one action opens a modal; the rest navigate. */
  const OPENS_DIALOG: ReadonlySet<string> = new Set(["shortcuts"]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(current + 1 + items.length) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(current - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === "Tab") {
      // A menu is not a focus cage: Tab leaves it (see the class comment).
      close();
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 sm:right-6 z-30 flex flex-col items-end select-none">
        {open && (
          <div
            ref={contentRef}
            id={menuId}
            role="menu"
            aria-label={t("quickActions.menu")}
            onKeyDown={onMenuKeyDown}
            className="flex flex-col items-end gap-2 mb-2.5"
          >
            {actions.map(({ id, labelKey, icon: Icon, run }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                aria-haspopup={OPENS_DIALOG.has(id) ? "dialog" : undefined}
                onClick={run}
                className="flex items-center gap-2 min-h-[36px] py-1 pl-2 pr-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-lg transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0 text-[var(--color-accent)]"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={t(open ? "quickActions.close" : "quickActions.open")}
          title={t(open ? "quickActions.close" : "quickActions.open")}
          className="flex items-center gap-2 min-h-[44px] px-3.5 py-2.5 rounded-full font-semibold text-xs tracking-tight shadow-2xl transition-all duration-200 bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Plus
            className={`w-[17px] h-[17px] transition-transform duration-200 ${
              open ? "rotate-45" : ""
            }`}
            aria-hidden="true"
          />
          <span>{t(open ? "quickActions.close" : "quickActions.open")}</span>
        </button>
      </div>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
