import { TABS, type Tab } from "./tabs";

/**
 * Chrome copy for each destination — the title and one-line description the
 * header breadcrumb shows for the active surface.
 *
 * WHY A SEPARATE MAP, and not two more fields on `TabEntry` (option (a)):
 * `tabsParity.test.tsx:102-111` locks web ≡ desktop through `tabShape()`, a
 * four-field WHITELIST projection (`id`, `labelKey`, `label`, `iconType`,
 * `iconClassName`). New fields on `TabEntry` would not fail that test — both
 * sides get projected through the same whitelist — they would simply fall
 * OUTSIDE the one lock that exists to keep the two shells honest, so web and
 * desktop breadcrumb copy could drift with the suite still green. That is
 * false assurance from a test whose name promises parity. Keeping the map here
 * also leaves the ten-tab contract in `tabs.tsx` byte-identical, which is the
 * surface `tabsParity` and `tutorialTours` both speak.
 *
 * `titleKey` is therefore DERIVED from `TabEntry.labelKey` rather than
 * restated, so the breadcrumb title cannot drift from the label the nav already
 * renders. Only the descriptions are new keys.
 */
export interface TabSurfaceInfo {
  /** The surface's name — the very key the navigation itself renders. */
  titleKey: string;
  /** Short one-line description, for the header only. */
  descKey: string;
}

/**
 * Wiki and Novidades are reachable destinations but are deliberately absent
 * from `TABS` (they are footer-only), so they are declared here to keep the
 * lookup TOTAL: every id `Tab` can hold resolves, and no destination can ever
 * render a raw i18n key in the chrome.
 */
const FOOTER_ONLY_SURFACES: Record<"wiki" | "changelog", TabSurfaceInfo> = {
  wiki: { titleKey: "nav.wiki", descKey: "breadcrumb.wiki.description" },
  changelog: {
    titleKey: "nav.changelog",
    descKey: "breadcrumb.changelog.description",
  },
};

export const TAB_SURFACE_INFO: Record<Tab, TabSurfaceInfo> = Object.fromEntries(
  [
    ...TABS.map(
      (tab) =>
        [
          tab.id,
          {
            titleKey: tab.labelKey,
            descKey: `breadcrumb.${tab.id}.description`,
          },
        ] as const,
    ),
    ...(Object.entries(FOOTER_ONLY_SURFACES) as [Tab, TabSurfaceInfo][]),
  ],
) as Record<Tab, TabSurfaceInfo>;
