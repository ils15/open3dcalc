/**
 * Navigation preferences — Phase 7o stage 3 (primary nav, v2.0 no-loss rule).
 *
 * Two things live here, both pure so they can be tested without React:
 *
 * 1. The destination contract. The app already had ten `Tab` surfaces; this
 *    module only *classifies* them. Five are always-available primary
 *    destinations (Pricing, Dashboard, History, Printers, Spools) and the rest
 *    are demoted to "More". Nothing is deleted — `MainContent` still switches on
 *    every id, so demoting Infill moves it out of the primary bar and nothing
 *    else.
 *
 * 2. The persisted preference: which destination is active and which ones the
 *    user chose to hide. ONE new namespaced key (`open3dcalc_nav_v1`), additive
 *    and optional. No existing key is renamed, reshaped or rewritten; a profile
 *    written by an older build simply has no such key and reads as defaults.
 *
 * Every read is total: a missing, truncated, hand-edited or field-partial
 * payload resolves to safe defaults (Calculator visible, nothing hidden) instead
 * of throwing, so a bad preference can never block the app or reach the shell
 * as an unknown tab id.
 */

import type { Tab } from "@/shared/components/AppShell/tabs";
import { guardedStorage } from "./manifestStorage";

/**
 * SPEC-01 registered key. Class `ui_preference`, `sync: never`,
 * `export: never` — the same treatment as the layout preference, because
 * neither is synchronized nor part of a user export.
 */
export const NAV_PREFS_STORAGE_KEY = "open3dcalc_nav_v1";

/**
 * The five always-available primary destinations, in nav order. These are the
 * existing surface ids — the change is presentation and label, not a new screen
 * set: calculator→Pricing, dashboard→Dashboard, history→History,
 * catalog→Printers, inventory→Spools.
 */
export const PRIMARY_TAB_IDS = [
  "calculator",
  "dashboard",
  "history",
  "catalog",
  "inventory",
] as const satisfies readonly Tab[];

/**
 * Demoted surfaces, still fully functional and still reachable from "More".
 * Infill is here on purpose: its standalone screen and its in-calculator field
 * both keep working, it is just no longer a primary destination.
 */
export const MORE_TAB_IDS = [
  "infill",
  "quotes",
  "customers",
  "products",
  "privacy",
] as const satisfies readonly Tab[];

/**
 * Every id that may be persisted as the active destination. Includes the two
 * footer-only surfaces (wiki, changelog) so a user who left the app on the Wiki
 * page comes back to the Wiki page.
 */
export const SURFACE_IDS = [
  ...PRIMARY_TAB_IDS,
  ...MORE_TAB_IDS,
  "changelog",
  "wiki",
] as const satisfies readonly Tab[];

/** Pricing/Calculator is the app's home: it can never be hidden. */
export const ALWAYS_VISIBLE_TAB: Tab = "calculator";

export interface NavigationPrefs {
  /** Where the user left off. */
  activeTab: Tab;
  /** Destinations the user removed from navigation. Never contains the home tab. */
  hiddenTabs: Tab[];
}

export function defaultNavigationPrefs(): NavigationPrefs {
  return { activeTab: ALWAYS_VISIBLE_TAB, hiddenTabs: [] };
}

/** Frozen for callers that only read the default (tests, defaults). */
export const DEFAULT_NAVIGATION_PREFS: Readonly<NavigationPrefs> =
  Object.freeze(defaultNavigationPrefs());

export function isTabId(value: unknown): value is Tab {
  return (
    typeof value === "string" &&
    (SURFACE_IDS as readonly string[]).includes(value)
  );
}

export function canHideTab(tab: Tab): boolean {
  return tab !== ALWAYS_VISIBLE_TAB;
}

/** True only for a destination the user may actually hide. */
export function isTabHidden(prefs: NavigationPrefs, tab: Tab): boolean {
  if (!canHideTab(tab)) return false;
  return prefs.hiddenTabs.includes(tab);
}

export function hiddenTabsIn(prefs: NavigationPrefs): readonly Tab[] {
  return prefs.hiddenTabs;
}

/** `candidates` minus the hidden ones, preserving the candidate order. */
export function visibleTabsFrom(
  candidates: readonly Tab[],
  prefs: NavigationPrefs,
): Tab[] {
  return candidates.filter((tab) => !isTabHidden(prefs, tab));
}

export function setTabHidden(
  prefs: NavigationPrefs,
  tab: Tab,
  hidden: boolean,
): NavigationPrefs {
  // Hiding the home destination is not a supported transition, so the list is
  // normalized rather than trusted here too.
  const current = prefs.hiddenTabs.filter((id) => canHideTab(id));
  if (!canHideTab(tab)) return { ...prefs, hiddenTabs: current };
  if (hidden) {
    if (current.includes(tab)) return { ...prefs, hiddenTabs: current };
    return { ...prefs, hiddenTabs: [...current, tab] };
  }
  return { ...prefs, hiddenTabs: current.filter((id) => id !== tab) };
}

function parseHiddenTabs(value: unknown): Tab[] {
  if (!Array.isArray(value)) return [];
  const seen: Tab[] = [];
  for (const entry of value) {
    if (!isTabId(entry)) continue;
    if (!canHideTab(entry)) continue;
    if (seen.includes(entry)) continue;
    seen.push(entry);
  }
  return seen;
}

/**
 * Total reader: any unusable payload yields safe defaults. Unknown/extra fields
 * are ignored (a future writer may add fields without breaking an older build),
 * and a known field with an unusable value falls back on its own without
 * discarding the field next to it.
 */
export function parseNavigationPrefs(
  raw: string | null | undefined,
): NavigationPrefs {
  const fallback = defaultNavigationPrefs();
  if (typeof raw !== "string" || raw === "") return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return fallback;
  }

  const record = parsed as Record<string, unknown>;
  return {
    activeTab: isTabId(record.activeTab)
      ? record.activeTab
      : fallback.activeTab,
    hiddenTabs: parseHiddenTabs(record.hiddenTabs),
  };
}

/** Only ever writes the two known fields — never echoes a foreign payload back. */
export function serializeNavigationPrefs(prefs: NavigationPrefs): string {
  return JSON.stringify({
    activeTab: prefs.activeTab,
    hiddenTabs: [...prefs.hiddenTabs].filter(canHideTab),
  });
}

export function loadNavigationPrefs(): NavigationPrefs {
  try {
    return parseNavigationPrefs(guardedStorage.getItem(NAV_PREFS_STORAGE_KEY));
  } catch {
    // A denied key (gate off / manifest unreadable) must not block startup.
    return defaultNavigationPrefs();
  }
}

export function saveNavigationPrefs(prefs: NavigationPrefs): void {
  guardedStorage.setItem(
    NAV_PREFS_STORAGE_KEY,
    serializeNavigationPrefs(prefs),
  );
}
