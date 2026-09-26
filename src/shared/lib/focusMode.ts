/**
 * Focus Mode — Phase 7o stage 4.
 *
 * A temporary, distraction-free state: while it is on, the chrome is gone and
 * the calculator is the only surface. It is deliberately a THIRD thing, not a
 * variant of either mechanism that already exists:
 *
 * - Not Manage Visibility (stage 3): that is a PERSISTED preference that edits
 *   which destinations the nav offers. Focus Mode persists nothing and edits
 *   nothing — a reload ends it.
 * - Not the persisted active destination (stage 3): that survives a reload on
 *   purpose. Focus Mode's whole contract is that it does not.
 *
 * Two decisions live here, both pure so they can be tested without a DOM:
 *
 * 1. Where the mode lands on exit. The screen the user came from is restored
 *    ONLY if it is still visible under the Manage Visibility settings —
 *    navigating someone to a screen they removed from the navigation is the
 *    one outcome the stage-3 model forbids. The always-visible home
 *    destination is the only other legal answer, which is what makes "Focus
 *    Mode can never trap the user away from Pricing" a property of the code
 *    rather than a promise in the copy.
 *
 * 2. Whether Escape belongs to Focus Mode or to a layer on top of it. The rule
 *    is "the topmost layer wins", and the layers are recognised by what they
 *    put in the DOM — the `role="dialog"` / `menu` / `listbox` markers the app
 *    already sets on every overlay — plus the tutorial's own state, which is
 *    checked independently of its markup so the answer does not depend on the
 *    tutorial having painted its card yet.
 */

import {
  ALWAYS_VISIBLE_TAB,
  isTabHidden,
  type NavigationPrefs,
} from "./navigationPrefs";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * The DOM markers an open overlay in this app leaves behind. Every dialog,
 * menu and listbox the app opens declares one of them, which is what lets a
 * single predicate cover all of them without this module importing any of them
 * (and without every overlay having to register itself).
 *
 * Modality is deliberately NOT part of the selector. `aria-modal="true"` is
 * the usual shortcut, but at least one real panel here — the calculator's
 * field customizer — is a `role="dialog"` popover with no `aria-modal` at all,
 * and it owns Escape exactly as much as a modal does. Every `role="dialog"` in
 * the app is rendered only while its layer is open (the modals `return null`
 * when closed), so a blanket query cannot produce a false positive.
 *
 * The one `useDismissablePopover` panel with no role is the "More" nav
 * disclosure, and it needs no marker: that is navigation chrome, so it does not
 * exist while Focus Mode is on.
 */
export const ESCAPE_OWNER_SELECTOR = [
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
].join(", ");

/**
 * Where Focus Mode lands when it ends.
 *
 * `returnTab` is the screen the mode was entered from, or `null` when there is
 * nothing to go back to. A hidden return screen resolves to home, never to
 * itself.
 */
export function resolveFocusModeExit(
  prefs: NavigationPrefs,
  returnTab: Tab | null,
): Tab {
  if (returnTab === null) return ALWAYS_VISIBLE_TAB;
  if (isTabHidden(prefs, returnTab)) return ALWAYS_VISIBLE_TAB;
  return returnTab;
}

/**
 * True when something above Focus Mode owns the Escape key right now.
 *
 * `isTutorialRunning` is passed in rather than read from the store so this
 * stays a pure function of (DOM, tutorial state) and the caller owns the
 * subscription. The `sessionDismissed` half of that flag is the caller's
 * business too: the tutorial itself stops listening once it is dismissed for
 * the session, and a key owned by nobody is a key Focus Mode may take.
 */
export function escapeIsOwnedByOverlay(isTutorialRunning: boolean): boolean {
  // No document means no way to know what is on top. Refuse to act blind:
  // swallowing a key we cannot account for is how a dialog gets stuck.
  if (typeof document === "undefined") return true;
  if (isTutorialRunning) return true;
  return document.querySelector(ESCAPE_OWNER_SELECTOR) !== null;
}
