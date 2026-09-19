import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";

import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

/**
 * Entry point of the ephemeral demo mode ("Estúdio Maria Print" dataset).
 *
 * Rendered in the Header actions row on every screen size — icon-only below
 * `sm`, icon + label from `sm` up (same breakpoint `BetaBadge` uses). While
 * the demo is active the button is absent: the persistent `DemoModeIndicator`
 * owns the "you are inside a demo" state together with its exit action, so
 * there is never more than one demo affordance on screen at a time.
 *
 * It lives in the actions row rather than beside `BetaBadge` because the logo
 * is itself a `<button>` on mobile, and interactive elements cannot nest.
 *
 * Accessibility: `text-[var(--color-accent)]` on `--color-bg-primary` measures
 * 6.29:1 in light mode (#4f46e5 on #ffffff) and 4.70:1 in dark mode (#6366f1
 * on #0a0a0a) — above the 4.5:1 WCAG AA floor that applies at this 13px
 * semibold size.
 */
export function DemoModeButton(): ReactElement | null {
  const { t } = useTranslation();
  const isActive = useIsDemoMode();

  if (isActive) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => useDemoModeStore.getState().enter()}
      className="flex items-center gap-2 p-2.5 sm:px-3.5 sm:py-2 min-h-[44px] min-w-[44px] text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded-xl border border-transparent hover:border-[var(--color-accent-muted)]"
      title={t("demo.button.ariaLabel")}
      aria-label={t("demo.button.ariaLabel")}
    >
      <PlayCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap">
        {t("demo.button.label")}
      </span>
    </button>
  );
}
