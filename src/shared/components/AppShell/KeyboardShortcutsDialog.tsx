import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, X } from "lucide-react";

import {
  SHORTCUTS,
  formatChord,
  type ShortcutDeclaration,
} from "@/shared/lib/keyboardShortcutCatalog";

/**
 * The keyboard-shortcuts reference opened from the quick-actions dial.
 *
 * Copying the app's own dialog pattern rather than the prototype's: the
 * prototype has no reference at all (its "?" entry sets a context flag that
 * nothing in the app can read). What it does have — and what this keeps — is
 * the `role="dialog"` / `aria-modal` contract from `ManageVisibilityButton`:
 * focus moves in on open, Tab is contained, and Escape hands focus back to the
 * control that opened it.
 *
 * The trap listens on `document` and stops propagation on Escape, because
 * `useDismissablePopover` (the dial behind this dialog) listens on `window`,
 * which sits above `document` in the bubble path. Without the stop, one Escape
 * would close the dialog AND the dial behind it.
 */
export interface KeyboardShortcutsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The dial's trigger; focus returns here when the dialog closes. */
  readonly returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function KeyboardShortcutsDialog({
  open,
  onClose,
  returnFocusRef,
}: KeyboardShortcutsDialogProps): React.ReactElement | null {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        // window listeners (the dial) sit above document in the bubble path.
        event.stopPropagation();
        onClose();
        returnFocusRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  return (
    <>
      <div
        data-testid="shortcuts-backdrop"
        onClick={() => {
          onClose();
          returnFocusRef.current?.focus();
        }}
        aria-hidden="true"
        className="fixed inset-0 z-[70] bg-black/50"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2
            id={titleId}
            className="flex items-center gap-2 text-base font-bold"
          >
            <Keyboard
              className="w-4 h-4 text-[var(--color-accent)]"
              aria-hidden="true"
            />
            {t("quickActions.shortcutsTitle")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => {
              onClose();
              returnFocusRef.current?.focus();
            }}
            aria-label={t("quickActions.closeShortcuts")}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ul data-testid="shortcut-list" className="px-3 pb-4 space-y-1">
          {SHORTCUTS.map((shortcut: ShortcutDeclaration) => (
            <li
              key={shortcut.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
            >
              <span className="text-sm text-[var(--color-text-primary)]">
                {t(shortcut.labelKey)}
              </span>
              <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]">
                {formatChord(shortcut)}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
