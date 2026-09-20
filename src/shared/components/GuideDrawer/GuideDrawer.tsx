import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { HelpCircle, X, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { type TourId } from "@/shared/components/ui/tutorialTours";
import {
  GUIDE_AREAS,
  getAreaTours,
  isAreaTourAvailable,
} from "./guideAreas";

const DRAWER_ID = "guide-drawer";

interface GuideDrawerProps {
  /**
   * "button" (default) is the Header icon button; "inline" is the label row
   * used by the mobile settings sheet, whose container already paints the icon
   * and row padding.
   */
  align?: "button" | "inline";
}

/**
 * Help center for the app's 22 areas (12 tabs + 10 calculator sections): one
 * card per area with its title/description, and a "take the tour" CTA only
 * where a tour with registered steps exists — areas without one (history,
 * changelog, privacy, …) render no dead button.
 *
 * The calculator card owns two tours, so its CTA is a picker ("See available
 * tours") that lists both instead of launching blind.
 *
 * Closing follows the project's drawer idiom (Escape + outside click via
 * `useDismissablePopover`); on Escape focus returns to the trigger.
 */
export function GuideDrawer({ align = "button" }: GuideDrawerProps) {
  const { t } = useTranslation();
  const { startTour } = useTutorialStore((s) => ({ startTour: s.startTour }));
  const {
    open,
    setOpen,
    toggle,
    triggerRef,
    contentRef,
  } = useDismissablePopover<HTMLButtonElement>();
  const titleId = useId();
  // Tracks the area whose tour picker is expanded; null = all collapsed.
  // Reset on close so a reopen starts clean (no stale disclosure state).
  const [expandedArea, setExpandedArea] = useState<string | null>(null);

  const closeDrawer = () => {
    setExpandedArea(null);
    setOpen(false);
  };

  const handleTourStart = (tourId: TourId) => {
    startTour(tourId);
    closeDrawer();
  };

  const handleCta = (area: string) => {
    const tours = getAreaTours(area);
    if (tours.length === 0) return;
    if (tours.length === 1) {
      handleTourStart(tours[0]);
      return;
    }
    // Multiple tours: reveal the picker (calculator → calc-basico + 3D preview).
    setExpandedArea((current) => (current === area ? null : area));
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        className={
          align === "inline"
            ? "w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            : "flex items-center gap-2 p-2.5 lg:px-3.5 lg:py-2.5 min-h-[44px] min-w-[44px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl border border-transparent hover:border-[var(--color-border)]"
        }
        title={t("nav.wiki")}
        aria-label={t("nav.wiki")}
      >
        <HelpCircle
          className={
            align === "inline"
              ? "w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]"
              : "w-5 h-5"
          }
          aria-hidden="true"
        />
        <span
          className={
            align === "inline"
              ? "text-sm font-medium"
              : "hidden lg:inline text-[13px] font-semibold"
          }
        >
          {t("nav.wiki")}
        </span>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            {open && (
              <motion.div
                key="guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[70] bg-black/40"
                onClick={closeDrawer}
                aria-hidden="true"
              />
            )}
            {open && (
              <motion.div
                key="guide-panel"
                ref={contentRef}
                id={DRAWER_ID}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[70] w-full sm:max-w-md flex flex-col surface border-l border-[var(--color-border)] shadow-2xl"
              style={{ background: "var(--color-bg-primary)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]"
                style={{
                  paddingBottom: "calc(16px + env(safe-area-inset-top, 0px))",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <HelpCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
                  <h2
                    id={titleId}
                    className="text-base font-bold text-[var(--color-text-primary)] truncate"
                  >
                    {t("nav.wiki")}
                  </h2>
                </div>
                  <button
                    onClick={closeDrawer}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  aria-label={t("common.close")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
                style={{
                  paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                }}
              >
                {GUIDE_AREAS.map((area) => {
                  const hasTour = isAreaTourAvailable(area);
                  const tours = getAreaTours(area);
                  const isExpanded = expandedArea === area;
                  return (
                    <div
                      key={area}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3.5"
                    >
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t(`guide.${area}.title`)}
                      </h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                        {t(`guide.${area}.description`)}
                      </p>

                      {hasTour && (
                        <div className="mt-2.5">
                          <button
                            onClick={() => handleCta(area)}
                            aria-expanded={
                              tours.length > 1 ? isExpanded : undefined
                            }
                            aria-controls={
                              tours.length > 1
                                ? `guide-tours-${area}`
                                : undefined
                            }
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-md min-h-[32px]"
                          >
                            {t(`guide.${area}.cta`)}
                            {tours.length > 1 && (
                              <ChevronRight
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          {tours.length > 1 && isExpanded && (
                            <ul
                              id={`guide-tours-${area}`}
                              className="mt-1.5 space-y-1 border-l-2 border-[var(--color-accent-muted)] pl-3"
                            >
                              {tours.map((tourId) => (
                                <li key={tourId}>
                                  <button
                                    onClick={() => handleTourStart(tourId)}
                                    className="w-full text-left rounded-md px-2 py-1.5 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[36px]"
                                  >
                                    <span className="font-semibold block">
                                      {t(`tutorial.tours.${tourId}.title`)}
                                    </span>
                                    <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                      {t(
                                        `tutorial.tours.${tourId}.description`,
                                      )}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
            )}
          </>,
          document.body,
        )}
    </>
  );
}
