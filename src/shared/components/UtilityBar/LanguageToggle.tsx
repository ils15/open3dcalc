import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

/**
 * The language control: a button that flips the locale between pt-BR and
 * en-US, showing the code of the language it switches TO.
 *
 * SHARED, and again by proof rather than by taste. The two Headers carried
 * copies that differed only in token name (`--color-text-secondary` on desktop
 * is `--text-secondary` on web — `tokens.css:480`), so one component using the
 * `--*` family renders identically in both shells.
 *
 * `hidden sm:inline` on the label is the web shell's rule, kept as written.
 * Inside a band that is `hidden lg:block` the `sm:` step is always satisfied,
 * so the label is always visible — which is what the desktop header shows
 * today. Below `lg` neither this nor the band renders, and the mobile settings
 * sheet carries its own full-width language row instead.
 *
 * There is no persistence key here on purpose: `i18n.changeLanguage` already
 * persists through i18next's own storage, and inventing a second one would give
 * two sources of truth for one setting.
 */
export function LanguageToggle(): React.ReactElement {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "pt-BR" ? "en-US" : "pt-BR";
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex min-w-[64px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-semibold px-3.5 py-2.5 min-h-[44px] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
      title={t("nav.language")}
      aria-label={t("nav.language")}
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">
        {i18n.language === "pt-BR" ? "EN" : "PT"}
      </span>
    </button>
  );
}
