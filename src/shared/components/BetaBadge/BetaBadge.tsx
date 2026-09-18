import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { isBetaChannel } from "@/shared/config/betaChannel";

/**
 * Small "Beta" badge shown next to the app title. The component decides its
 * own visibility: on stable builds (`isBetaChannel === false`) it renders
 * nothing, so callers can drop `<BetaBadge />` in unconditionally.
 */
export function BetaBadge() {
  const { t } = useTranslation();

  if (!isBetaChannel) {
    return null;
  }

  // bg-amber-700 (#b45309) + text-white measures 11.65:1 — passes WCAG AA
  // even at this small (text-xs) size, where the 4.5:1 floor applies.
  return (
    <span
      role="status"
      aria-label={t("betaBadge.ariaLabel")}
      className="hidden items-center gap-1 rounded-md bg-amber-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white sm:inline-flex"
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {t("betaBadge.text")}
    </span>
  );
}
