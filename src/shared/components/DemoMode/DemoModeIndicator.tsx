import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";

import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

/**
 * Persistent banner shown for the whole duration of a demo session.
 *
 * Rendered directly under the `Header` in both the web and desktop shells, so
 * it survives every tab switch: the user can never be inside the demo without
 * knowing it, and the exit action is always one keyboard focus away. It takes
 * over from `DemoModeButton`, which renders nothing while the demo is active.
 *
 * The entry button unmounting drops keyboard focus back to `<body>`; the effect
 * below moves it to the exit button, but only when focus is really orphaned —
 * a user who is mid-interaction elsewhere keeps their focus.
 *
 * Accessibility: violet text on a violet-muted background measures 4.94:1 in
 * light mode and ~6.8:1 in dark mode; the exit button pairs bg-violet with
 * text-inverse (5.70:1 light, 7.19:1 dark). All above the 4.5:1 AA floor that
 * applies at these sizes.
 */
export function DemoModeIndicator(): ReactElement | null {
  const { t } = useTranslation();
  const isActive = useIsDemoMode();
  const exitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive && document.activeElement === document.body) {
      exitButtonRef.current?.focus();
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <section
      aria-label={t("demo.indicator.title")}
      className="w-full border-b bg-[var(--color-violet-muted)] border-[var(--color-violet)]/30"
    >
      <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-12 py-2.5 flex items-center gap-3">
        <Sparkles
          className="w-5 h-5 shrink-0 text-[var(--color-violet)]"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm font-bold text-[var(--color-violet)] whitespace-nowrap">
            {t("demo.indicator.title")}
          </strong>
          <p className="text-xs sm:text-[13px] text-[var(--color-violet)] truncate">
            {t("demo.indicator.description")}
          </p>
        </div>

        <button
          ref={exitButtonRef}
          type="button"
          onClick={() => useDemoModeStore.getState().exit()}
          className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 min-h-[36px] text-xs font-bold rounded-lg bg-[var(--color-violet)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t("demo.indicator.exitAriaLabel")}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          {t("demo.indicator.exit")}
        </button>
      </div>
    </section>
  );
}
