import { useTranslation } from "react-i18next";
import { Focus } from "lucide-react";

import { useFocusMode } from "./NavigationContext";

/**
 * Focus Mode entry control — Phase 7o s4.
 *
 * Self-contained, like the stage-3 `ManageVisibilityButton`, and wired into the
 * same four places so the two settings controls cannot drift apart: the web
 * mobile settings sheet, the web header sheet, the desktop header action
 * cluster and the desktop sidebar footer. Every one of them is chrome that
 * Focus Mode hides, which is why entering is always a deliberate act from a
 * settings surface rather than a gesture.
 *
 * Renders nothing while the mode is on. The bar the mode shows already carries
 * the exit, so a second control offering the same transition would be a dead
 * end; the store's `enterFocusMode` is idempotent as well, so a stray call can
 * never overwrite the screen the user will be returned to.
 *
 * Deliberately NOT a dialog trigger: it opens no layer, so `aria-haspopup` and
 * `aria-expanded` would both be lies. (The desktop App suite asserts that every
 * dialog trigger in the chrome is Manage Visibility — this keeps that true.)
 *
 * `variant="row"` is the settings-list item; `variant="icon"` is the compact
 * header action, sized like its neighbours.
 */
export interface FocusModeButtonProps {
  variant?: "row" | "icon";
}

export function FocusModeButton({
  variant = "row",
}: FocusModeButtonProps = {}): React.ReactElement | null {
  const { t } = useTranslation();
  const { active, enter } = useFocusMode();

  if (active) return null;

  const className =
    variant === "icon"
      ? "p-2.5 lg:p-3 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      : "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px] nav-item";

  return (
    <button
      type="button"
      onClick={enter}
      aria-label={t("focusMode.enter")}
      title={t("focusMode.enter")}
      className={className}
    >
      <Focus
        className={
          variant === "icon"
            ? "w-5 h-5 shrink-0"
            : "w-[18px] h-[18px] shrink-0 text-[var(--color-accent-light)]"
        }
        aria-hidden="true"
      />
      {variant === "row" && (
        <span className="text-sm font-medium">{t("focusMode.enter")}</span>
      )}
    </button>
  );
}
