import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, X } from "lucide-react";

import { useNavigationVisibility } from "./NavigationContext";
import { TABS, type Tab } from "./tabs";

/**
 * Settings → Manage Visibility (Phase 7o s3).
 *
 * Self-contained: the trigger owns the open state and renders the dialog, so
 * every settings surface in both shells wires it in as a single element and the
 * two can never disagree about whether the dialog is open.
 *
 * Accessibility: a real `<button>` trigger with `aria-haspopup="dialog"` and
 * `aria-expanded`; a `role="dialog"` `aria-modal` panel labelled by its own
 * title; focus moves in on open, is trapped by Tab, and returns to the trigger
 * on Escape or backdrop click. Each destination is a toggle `<button>` with
 * `aria-pressed`, so the state is announced rather than implied by the label
 * swapping between "Hide" and "Show".
 *
 * Pricing/Calculator renders a static "Always visible" note instead of a
 * control — a disabled button is still a Tab stop, and a stop the user can
 * never act on is worse than no button at all.
 *
 * `variant="row"` is the settings-list item (mobile sheets, sidebar footer);
 * `variant="icon"` is the compact header action, sized and coloured like the
 * neighbouring header icons so it does not stretch the action bar.
 */
export interface ManageVisibilityButtonProps {
  variant?: "row" | "icon";
}

export function ManageVisibilityButton({
  variant = "row",
}: ManageVisibilityButtonProps = {}): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { hiddenTabs, setTabVisibility, resetVisibility } =
    useNavigationVisibility();

  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // No enter animation, so focus moves in the same commit as the open state
    // rather than on a deferred timer.
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
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
  }, [open]);

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const isHidden = (tab: Tab): boolean => hiddenTabs.includes(tab);
  const canHide = (tab: Tab): boolean => tab !== "calculator";

  const triggerClassName =
    variant === "icon"
      ? "p-2.5 lg:p-3 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      : "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px] nav-item";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("settings.manageVisibility")}
        title={t("settings.manageVisibility")}
        className={triggerClassName}
      >
        <Eye
          className={
            variant === "icon"
              ? "w-5 h-5 shrink-0"
              : "w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]"
          }
        />
        {variant === "row" && (
          <span className="text-sm font-medium">
            {t("settings.manageVisibility")}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            data-testid="visibility-backdrop"
            onClick={close}
            aria-hidden="true"
            className="fixed inset-0 z-[70] bg-black/50"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(28rem,calc(100vw-2rem))] max-h-[80dvh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
              <h2 id={titleId} className="text-base font-bold">
                {t("settings.visibility.title")}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label={t("settings.visibility.close")}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p
              id={descriptionId}
              className="px-5 pb-3 text-xs text-[var(--color-text-muted)]"
            >
              {t("settings.visibility.description")}
            </p>

            <ul className="px-2 pb-2">
              {TABS.map((tab) => {
                const hidden = isHidden(tab.id);
                return (
                  <li
                    key={tab.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 text-sm">
                      {tab.icon}
                      <span className="truncate">{t(tab.labelKey)}</span>
                      {hidden && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                          {t("settings.visibility.hidden")}
                        </span>
                      )}
                    </span>
                    {canHide(tab.id) ? (
                      // Verb button: the label names the ACTION, so the state is
                      // carried by the adjacent "Hidden" badge rather than by
                      // aria-pressed — a pressed button labelled "Hide" would
                      // read as "hiding is on", inverting the meaning.
                      <button
                        type="button"
                        onClick={() => setTabVisibility(tab.id, hidden)}
                        className="shrink-0 min-w-[92px] min-h-[36px] px-3 rounded-lg text-xs font-semibold border border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                      >
                        {hidden
                          ? t("settings.visibility.show")
                          : t("settings.visibility.hide")}
                      </button>
                    ) : (
                      <span className="shrink-0 min-w-[92px] text-center text-xs text-[var(--color-text-muted)]">
                        {t("settings.visibility.alwaysVisible")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end px-5 pb-4 pt-1">
              <button
                type="button"
                onClick={resetVisibility}
                className="min-h-[40px] px-4 rounded-lg text-xs font-semibold border border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                {t("settings.visibility.showAll")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
