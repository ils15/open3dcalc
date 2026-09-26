import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Minimize2 } from "lucide-react";

import { escapeIsOwnedByOverlay } from "@/shared/lib/focusMode";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useFocusMode } from "./NavigationContext";

/**
 * Focus Mode exit affordance — Phase 7o s4.
 *
 * This is the single way out of Focus Mode, so it is deliberately the least
 * clever part of the stage: a real `<button>` with a verb label, visible at
 * every width, in no dialog and in no focus trap. `AppShell` renders it
 * whenever the mode is on, so "the exit is always there" is structural rather
 * than a promise the copy makes.
 *
 * It also owns the Escape key, which is the part worth explaining. The
 * listener is on `window`, not `document`, for one reason: the stage-3
 * visibility dialog handles Escape on `document` and calls `stopPropagation`,
 * and `window` sits ABOVE `document` in the bubble path. Listening on `window`
 * therefore means a dialog that consumes the key never even reaches us — one
 * Escape closes one layer, which is the behaviour stage 3 fought a real bug to
 * achieve. Everything that listens on `window` itself (the shared
 * `useDismissablePopover` panels, the tutorial) is instead handled by asking
 * `escapeIsOwnedByOverlay` who is on top, because among sibling `window`
 * listeners registration order — not layer order — decides who runs first, and
 * leaning on it would silently break the day an overlay mounts earlier.
 *
 * Accessibility notes:
 * - A verb label, not a state, so no `aria-pressed`: a pressed button reading
 *   "Exit focus mode" would be announced as "exiting is on".
 * - The hint lives in a `role="status"` region so entering the mode is
 *   announced, not just drawn.
 * - No animation at all, which satisfies the reduced-motion requirement by
 *   construction rather than by honouring a media query.
 */
export function FocusModeExit(): React.ReactElement {
  const { t } = useTranslation();
  const { exit } = useFocusMode();

  // The tutorial's own handler bails out once it is dismissed for the session,
  // so this must bail on the same flag: a key owned by nobody is a key Focus
  // Mode may take.
  const isTutorialRunning = useTutorialStore(
    (state) => state.isActive && !state.sessionDismissed,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      // Something below `window` already consumed the key (three of the app's
      // dialogs close this way without stopping propagation).
      if (event.defaultPrevented) return;
      if (escapeIsOwnedByOverlay(isTutorialRunning)) return;
      exit();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exit, isTutorialRunning]);

  return (
    <div
      data-testid="focus-mode-exit"
      className="fixed z-[60] top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl px-3 py-2"
    >
      <span role="status" className="text-xs leading-tight max-w-[46vw]">
        <span className="block font-semibold text-[var(--color-text-primary)]">
          {t("focusMode.active")}
        </span>
        <span className="block text-[var(--color-text-muted)]">
          {t("focusMode.hint")}
        </span>
      </span>
      <button
        type="button"
        onClick={exit}
        className="shrink-0 flex items-center gap-2 min-h-[40px] px-3 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        <Minimize2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{t("focusMode.exit")}</span>
      </button>
    </div>
  );
}
