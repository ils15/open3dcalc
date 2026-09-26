import { describe, it, expect, afterEach } from "vitest";

import {
  ALWAYS_VISIBLE_TAB,
  setTabHidden,
  defaultNavigationPrefs,
  type NavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import {
  escapeIsOwnedByOverlay,
  resolveFocusModeExit,
} from "@/shared/lib/focusMode";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * Phase 7o s4 — Focus Mode.
 *
 * Two pure decisions live here and both are the ones a component would get
 * wrong if it inlined them:
 *
 * 1. Where to land when the mode ends. The screen you came from is only
 *    restored if it is STILL VISIBLE under the Manage Visibility settings —
 *    navigating the user to a screen they had hidden is the one outcome the
 *    stage-3 visibility model forbids. Otherwise the always-visible home
 *    destination is the only legal answer.
 *
 * 2. Whether Escape belongs to Focus Mode or to an overlay on top of it. The
 *    rule is deliberately "the topmost layer wins", and the layers are told
 *    apart by what they put in the DOM (the same `role="dialog"[aria-modal]`
 *    marker the tutorial engine already uses) plus the tutorial's own state.
 */

afterEach(() => {
  document.body.innerHTML = "";
});

function prefsWithHidden(...hidden: Tab[]): NavigationPrefs {
  return hidden.reduce<NavigationPrefs>(
    (prefs, tab) => setTabHidden(prefs, tab, true),
    defaultNavigationPrefs(),
  );
}

describe("focusMode — where the mode lands on exit", () => {
  it("restores the screen the user came from when it is still visible", () => {
    const prefs = defaultNavigationPrefs();

    expect(resolveFocusModeExit(prefs, "history")).toBe("history");
    expect(resolveFocusModeExit(prefs, "dashboard")).toBe("dashboard");
    expect(resolveFocusModeExit(prefs, "wiki")).toBe("wiki");
  });

  it("falls back to the always-visible home when the screen is hidden", () => {
    // The user entered Focus Mode from History and then hid History in Manage
    // Visibility. Returning them to a screen they removed from navigation
    // would violate the stage-3 rule that hiding is navigation-only.
    const prefs = prefsWithHidden("history");

    expect(resolveFocusModeExit(prefs, "history")).toBe(ALWAYS_VISIBLE_TAB);
  });

  it("falls back to home for every hideable destination, never to a hidden one", () => {
    const hideable: Tab[] = [
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
      "changelog",
      "wiki",
    ];

    for (const tab of hideable) {
      expect(resolveFocusModeExit(defaultNavigationPrefs(), tab), tab).toBe(
        tab,
      );
      expect(resolveFocusModeExit(prefsWithHidden(tab), tab), tab).toBe(
        ALWAYS_VISIBLE_TAB,
      );
    }
  });

  it("returns home when there is no remembered screen", () => {
    expect(resolveFocusModeExit(defaultNavigationPrefs(), null)).toBe(
      ALWAYS_VISIBLE_TAB,
    );
  });

  it("returns home when the remembered screen IS home", () => {
    expect(resolveFocusModeExit(defaultNavigationPrefs(), "calculator")).toBe(
      ALWAYS_VISIBLE_TAB,
    );
  });

  it("can never answer with a destination the user hid", () => {
    // Property: whatever the preferences are, the answer is always a screen
    // the user can still see in navigation.
    const candidates: Tab[] = [
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
      "changelog",
      "wiki",
    ];

    for (const returnTab of candidates) {
      for (const hidden of [null, "history", "dashboard", "infill"] as const) {
        const prefs = hidden
          ? prefsWithHidden(hidden)
          : defaultNavigationPrefs();
        const target = resolveFocusModeExit(prefs, returnTab);
        expect(candidates).toContain(target);
        expect(
          prefs.hiddenTabs.includes(target) && target !== ALWAYS_VISIBLE_TAB,
          `${returnTab} + hidden ${hidden} -> ${target}`,
        ).toBe(false);
      }
    }
  });
});

describe("focusMode — who owns the Escape key", () => {
  function mount(html: string): void {
    document.body.innerHTML = html;
  }

  it("leaves Escape to Focus Mode when nothing is open", () => {
    expect(escapeIsOwnedByOverlay(false)).toBe(false);
  });

  it("yields to an open modal dialog", () => {
    mount('<div role="dialog" aria-modal="true"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);
  });

  it("yields to a non-modal dialog panel", () => {
    // The calculator's field customizer is a role="dialog" popover with no
    // aria-modal, and it closes on Escape like any other layer.
    mount('<div role="dialog" aria-labelledby="x"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);
  });

  it("yields to an open menu", () => {
    mount('<div role="menu"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);
  });

  it("yields to an open listbox", () => {
    mount('<div role="listbox"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);
  });

  it("yields while the tutorial is running, before it has painted anything", () => {
    // Deliberately with an empty document: the tutorial owns the key from the
    // moment it starts, and its card is rendered a render later.
    expect(document.body.innerHTML).toBe("");
    expect(escapeIsOwnedByOverlay(true)).toBe(true);
  });

  it("also recognises the tutorial from its own markup", () => {
    // The tutorial card is a role="dialog" layer (aria-modal="false", because
    // it does not take the whole screen), so the DOM check catches it too. Two
    // independent signals, one outcome.
    mount('<div role="dialog" aria-modal="false" data-tutorial="true"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);
  });

  it("ignores markup that merely looks like an overlay once removed", () => {
    mount('<div role="dialog" aria-modal="true"></div>');
    expect(escapeIsOwnedByOverlay(false)).toBe(true);

    document.body.innerHTML = "";
    expect(escapeIsOwnedByOverlay(false)).toBe(false);
  });
});
