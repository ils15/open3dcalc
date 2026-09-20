import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import {
  TOUR_IDS,
  isTourAvailable,
  type TourId,
} from "@/shared/components/ui/tutorialTours";

const MENU_ID = "tutorial-launcher-menu";

/**
 * Header entry point for the Fase 2 tour registry: a dropdown of the tours
 * that have steps, each marked when the user finished it. Follows the same
 * dismissable-popover idiom as the currency selector (Escape / outside click
 * close, focus returns to the trigger).
 *
 * Tours with an empty registry entry are hidden rather than disabled — an
 * unfinished tour in the menu is a dead end.
 */
export function TutorialLauncher() {
  const { t } = useTranslation();
  const { completedTours, startTour } = useTutorialStore(
    useShallow((s) => ({
      completedTours: s.completedTours,
      startTour: s.startTour,
    })),
  );
  const {
    open,
    setOpen,
    toggle,
    triggerRef,
    contentRef,
  } = useDismissablePopover<HTMLButtonElement>();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const tours = TOUR_IDS.filter(isTourAvailable);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    toggle();
  };

  const handleSelect = (tourId: TourId) => {
    startTour(tourId);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        className="flex items-center gap-2 p-2.5 lg:px-3.5 lg:py-2.5 min-h-[44px] min-w-[44px] text-[var(--color-accent-light)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl border border-transparent hover:border-[var(--color-accent-muted)]"
        title={t("tutorial.launcher.title")}
        aria-label={t("tutorial.launcher.title")}
      >
        <BookOpen className="w-5 h-5" />
        <span className="hidden lg:inline text-[13px] font-semibold">
          {t("tutorial.launcher.title")}
        </span>
        <ChevronDown className="w-3 h-3 opacity-40" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={contentRef}
            id={MENU_ID}
            role="menu"
            aria-label={t("tutorial.launcher.title")}
            className="fixed z-[60] w-64 max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl surface border border-[var(--color-border)]"
            style={{ top: pos.top, right: pos.right }}
          >
            {tours.map((tourId) => {
              const completed = completedTours.includes(tourId);
              const title = t(`tutorial.tours.${tourId}.title`);
              return (
                <button
                  key={tourId}
                  role="menuitem"
                  onClick={() => handleSelect(tourId)}
                  aria-label={
                    completed
                      ? `${title} — ${t("tutorial.launcher.completed")}`
                      : title
                  }
                  className="w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 min-h-[44px] hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold">
                      {title}
                    </span>
                    <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {t(`tutorial.tours.${tourId}.description`)}
                    </span>
                  </span>
                  {completed && (
                    <Check
                      className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-accent)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
