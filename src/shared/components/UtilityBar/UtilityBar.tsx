import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * Persistent utility band: the strip that sits between the sticky header and
 * the content, carrying what the header no longer has room for.
 *
 * WHY IT EXISTS. The header's action cluster is `shrink-0` and was measured at
 * 1120.6px on web at 1280, 1440 AND 1920 — identical at every width, because
 * `shrink-0` means "the breadcrumb gives way, the tools never do"
 * (`ContextBreadcrumb.tsx:20-23`). Two measured consequences, both real defects:
 *
 *   - the breadcrumb collapsed to 0px at 1280 and 1440 and only appeared at
 *     1920, where it had 331.6px;
 *   - at 1280 the brand button was crushed to 31.4px while its own content
 *     measured 169px — 137.6px of the logo clipped away.
 *
 * Moving the band is the fix for the second outright and for the first as far
 * as the sub-2xl width goes: see the numbers recorded on the migration commits.
 *
 * WHY IT IS NOT A `nav`. Nothing in it travels. Currency chooses a unit, theme
 * chooses a palette, language chooses a locale — they act on the page, they do
 * not move it. A `section` (role=region) says "here is a distinct part of the
 * page" without claiming to be a second quick-jump list, which the sidebar
 * (`Sidebar.tsx:87`, `w-60 xl:w-68`) is already entitled to. A `nav` here would
 * put a second unnamed destination list in the landmark list for no gain.
 *
 * WHY THE TABS ARE NOT HERE. The prototype's band repeats its five sections
 * because ITS sidebar is narrower. Ours is not — `Sidebar.tsx:87` already IS
 * the navigation. Repeating the destinations would produce two
 * `aria-current="page"` for one route and a second landmark sharing the
 * navigation name: the exact WCAG 2.4.6 collision this repo already recorded at
 * `SecondaryNavigation.tsx:23-26` and that `tabsParity.test.tsx` catches through
 * a GLOBAL `getByRole`. That is redundancy, not fidelity.
 *
 * IN THE FLOW, NOT STICKY. It is ordinary flow content between the header and
 * the shell, so nothing in the shell has to move an offset for it: the sidebar
 * keeps `sticky top-[68px]` (`Sidebar.tsx:87`) because the header above it is
 * still the only 68px sticky band, and `main` keeps its `pb-32` reserve for the
 * fixed `MobileNav`, which this does not touch.
 *
 * `hidden lg:block`: below `lg` the band is not rendered at all. The
 * `MobileNav` and the header's own settings sheet already carry every one of
 * these controls, and a squeezed strip would be the third place to look. Only
 * `display` changes, so the region stays MOUNTED and remains in the a11y tree
 * and in tests.
 *
 * Token family is `--surface-*` / `--text-*` / `--border-*`, declared in
 * `styles/tokens.css` and imported by BOTH `platform/web/index.css` and
 * `platform/desktop/index.css`. That shared declaration is what lets one
 * component serve both shells; the `--color-*` names the desktop chrome uses
 * are aliases of exactly these (`--color-text-secondary: var(--text-secondary)`
 * and so on), so reading the `--*` family here is visually neutral.
 */
interface UtilityBarProps {
  /** The controls. Order here is the tab order — keep it stable across shells. */
  children?: ReactNode;
}

export function UtilityBar({ children }: UtilityBarProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <section
      // MUST differ from "nav.navigation" (the modules region, SidebarGroup),
      // "nav.resources" (SecondaryNavigation), "footer.navigation",
      // "nav.mainNavigation" (MobileNav — still mounted on mobile, and jsdom's
      // getByRole cannot see a media query, so both are in the tree at once),
      // and "breadcrumb.label". Two landmarks sharing an accessible name are
      // indistinguishable in the landmark list (WCAG 2.4.6).
      aria-label={t("utilityBar.label")}
      className="hidden lg:block border-b"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* The inner row scrolls rather than squashing its items: every control
          in it is shrink-0, which is the whole point of the split — that is the
          property that crushed the logo at 1280. `h-10` keeps the band to the
          prototype's height. The max-width pair matches the header and the shell
          (`layoutShell.test.ts` pins both), so the band's gutters line up with
          theirs instead of starting a third column rhythm. */}
      <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto min-w-0 px-4 sm:px-6 lg:px-12 h-10 flex items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {children}
        </div>
      </div>
    </section>
  );
}
