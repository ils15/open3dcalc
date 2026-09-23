import { useTranslation } from "react-i18next";

/**
 * Desktop sidebar footer — brand links pinned at the bottom of the desktop
 * sidebar (the web platform renders its SecondaryNavigation there instead).
 * Extracted verbatim from the desktop App.tsx body.
 */
export function SidebarFooter(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
      <a
        href="https://github.com/ils15/open3dcalc"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        <svg
          className="w-[18px] h-[18px] shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4 11.5 11.5 0 0 1 3 .4c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span>GitHub</span>
      </a>
      <a
        href="https://t.me/Impressao3DBR"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        title={t("nav.telegram")}
        aria-label={t("nav.telegram")}
      >
        <svg
          className="w-[18px] h-[18px] shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.441-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141a.506.506 0 0 1 .171.325c.016.093.036.306.02.472z" />
        </svg>
        <span>{t("nav.telegram")}</span>
      </a>
    </div>
  );
}
