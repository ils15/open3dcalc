import { useTranslation } from "react-i18next";
import { BookOpen, Info } from "lucide-react";
import { BrandIcon } from "./BrandIcon";

type SecondaryNavigationProps = {
  onInternalNavigate: (tab: "wiki" | "changelog") => void;
  onNavigate?: () => void;
  desktop?: boolean;
};

export function SecondaryNavigation({
  onInternalNavigate,
  onNavigate,
  desktop = false,
}: SecondaryNavigationProps): React.ReactElement {
  const { t } = useTranslation();
  const itemClass = desktop
    ? "nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
    : "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none min-h-[48px]";

  return (
    <nav
      aria-label={t("nav.navigation")}
      data-testid="secondary-navigation"
      className={desktop ? "mt-auto pt-4 border-t border-[var(--color-border)]" : "pt-3 mt-2 border-t border-[var(--color-border)]"}
    >
      <p className={desktop ? "label-xs px-3 mb-2" : "px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"}>
        {t("footer.navigation")}
      </p>
      <ul className="space-y-1">
        <li>
          <button type="button" onClick={() => { onInternalNavigate("wiki"); onNavigate?.(); }} className={itemClass} aria-label={t("nav.wiki")}>
            <BookOpen className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>{t("nav.wiki")}</span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => { onInternalNavigate("changelog"); onNavigate?.(); }} className={itemClass} aria-label={t("nav.changelog")}>
            <Info className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>{t("nav.changelog")}</span>
          </button>
        </li>
        <li>
          <a href="https://github.com/ils15/open3dcalc" target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={itemClass} aria-label={t("footer.github")}>
            <BrandIcon brand="github" className="w-[18px] h-[18px] shrink-0" />
            <span>{t("footer.github")}</span>
          </a>
        </li>
        <li>
          <a href="https://t.me/Impressao3DBR" target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={itemClass} aria-label={t("footer.telegram")}>
            <BrandIcon brand="telegram" className="w-[18px] h-[18px] shrink-0" />
            <span>{t("footer.telegram")}</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
