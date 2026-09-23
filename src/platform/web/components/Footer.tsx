import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@/shared/version";

/**
 * Web footer — the secondary-surface hub (Wiki and Novidades) plus version
 * lines. Extracted verbatim from the web App.tsx body; the desktop footer is
 * a different surface, so each platform keeps its own.
 */
interface FooterProps {
  onInternalNavigate: (tab: "wiki" | "changelog") => void;
}

export function Footer({
  onInternalNavigate,
}: FooterProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <footer className="text-center text-xs text-[var(--color-text-muted)] py-2.5 lg:py-3 border-t border-[var(--color-border)]">
      <nav aria-label={t("footer.navigation")}>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
          <button
            type="button"
            onClick={() => onInternalNavigate("wiki")}
            className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            {t("nav.wiki")}
          </button>
          <span aria-hidden="true" className="text-[var(--color-border)]">
            ·
          </span>
          <button
            type="button"
            onClick={() => onInternalNavigate("changelog")}
            className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            {t("nav.changelog")}
          </button>
          <span aria-hidden="true" className="text-[var(--color-border)]">
            ·
          </span>
          <a
            href="https://github.com/ils15/open3dcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            {t("footer.github")}
          </a>
          <span aria-hidden="true" className="text-[var(--color-border)]">
            ·
          </span>
          <a
            href="https://t.me/Impressao3DBR"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
          >
            {t("footer.telegram")}
          </a>
        </div>
      </nav>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
        <span>{t("footer.version", { version: APP_VERSION })}</span>
        <span aria-hidden="true" className="text-[var(--color-border)]">
          ·
        </span>
        <span>{t("footer.openSource")}</span>
      </div>
    </footer>
  );
}
