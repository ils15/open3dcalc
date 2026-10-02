import { BookOpen, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tab } from "@/shared/components/AppShell/tabs";

interface DesktopResourceLinksProps {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
}

/** Internal pages omitted from the desktop tab catalog, grouped under More. */
export function DesktopResourceLinks({
  activeTab,
  onNavigate,
}: DesktopResourceLinksProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("nav.resources")}
      data-testid="desktop-resource-navigation"
      className="mt-1 border-t border-[var(--color-border)] pt-1"
    >
      <p className="label-xs px-3 py-1.5">{t("footer.navigation")}</p>
      <ul className="space-y-1">
        <li>
          <button
            type="button"
            onClick={() => onNavigate("wiki")}
            aria-current={activeTab === "wiki" ? "page" : undefined}
            className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${activeTab === "wiki" ? "active" : ""}`}
          >
            <BookOpen
              className="w-[18px] h-[18px] shrink-0"
              aria-hidden="true"
            />
            <span>{t("nav.wiki")}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onNavigate("changelog")}
            aria-current={activeTab === "changelog" ? "page" : undefined}
            className={`nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${activeTab === "changelog" ? "active" : ""}`}
          >
            <Info className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>{t("nav.changelog")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
