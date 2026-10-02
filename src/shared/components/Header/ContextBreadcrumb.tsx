import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

import { TAB_SURFACE_INFO } from "@/shared/components/AppShell/tabSurfaceInfo";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * Contextual breadcrumb for the chrome: "Oficina 3D › <surface>", with a
 * one-line description of that surface set off by a rule.
 *
 * It is SHARED by both shells (web and desktop) and reads the active
 * destination from `navigationPrefsStore` — the same single source of truth
 * `NavigationProvider` feeds `ActiveTabContext` from
 * (`NavigationProvider.tsx:36`). Reading the store rather than the context is
 * what lets the Header mount it: `useActiveTab()` throws outside its provider
 * (`NavigationContext.ts:51-53`), and the Header suite renders the component
 * bare. The value is the same one either way; the store is simply the read that
 * does not require a provider.
 *
 * Layout: the band is `justify-between` with the actions pinned `shrink-0`, so
 * this is `flex-1 min-w-0` and absorbs ALL the slack itself. `truncate` on the
 * long spans is the established chrome pattern (`ManageVisibilityButton.tsx:203`,
 * `MobileNav.tsx:75,107`): the breadcrumb gives way, the tools never do.
 */
interface ContextBreadcrumbProps {
  tab: Tab;
}

export function ContextBreadcrumb({
  tab,
}: ContextBreadcrumbProps): React.ReactElement {
  const { t } = useTranslation();
  const { titleKey, descKey } = TAB_SURFACE_INFO[tab];

  return (
    <nav
      // MUST differ from "nav.navigation" (the modules region), "nav.resources"
      // (SecondaryNavigation), "footer.navigation" and "nav.mainNavigation".
      // Two landmarks sharing an accessible name are indistinguishable in the
      // landmark list (WCAG 2.4.6) — the same rule already recorded at
      // SecondaryNavigation.tsx:23-26.
      aria-label={t("breadcrumb.label")}
      className="flex min-w-0 flex-1 items-center"
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-xs">
        <li className="hidden shrink-0 text-[var(--text-muted)] sm:inline">
          {t("breadcrumb.root")}
        </li>
        {/* Decorative: the separator carries no information a screen reader
            needs, and hiding it keeps the trail reading "Oficina 3D, Precificação". */}
        <li aria-hidden="true" className="hidden shrink-0 sm:inline">
          <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />
        </li>
        <li
          aria-current="page"
          className="flex min-w-0 items-center gap-2.5 font-semibold text-[var(--text-primary)]"
        >
          <span className="truncate">{t(titleKey)}</span>
          {/* Measured: below 1536px the band has under ~530px of slack beside the
              desktop shell's eleven non-shrinking action buttons, which is less
              than a full trail — so the description is withheld until the
              `2xl` step (the same one that widens the shell to 1920px) rather
              than appearing already truncated. */}
          <span className="hidden shrink-0 border-l border-[var(--border-subtle)] pl-2.5 text-[11px] font-normal text-[var(--text-muted)] lg:inline">
            {t(descKey)}
          </span>
        </li>
      </ol>
    </nav>
  );
}
