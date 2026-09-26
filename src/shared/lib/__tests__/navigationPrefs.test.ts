import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  ALWAYS_VISIBLE_TAB,
  DEFAULT_NAVIGATION_PREFS,
  MORE_TAB_IDS,
  NAV_PREFS_STORAGE_KEY,
  PRIMARY_TAB_IDS,
  SURFACE_IDS,
  canHideTab,
  defaultNavigationPrefs,
  hiddenTabsIn,
  isTabHidden,
  isTabId,
  loadNavigationPrefs,
  parseNavigationPrefs,
  saveNavigationPrefs,
  serializeNavigationPrefs,
  setTabHidden,
  visibleTabsFrom,
  type NavigationPrefs,
} from "../navigationPrefs";
import { resetManifestForTests, ManifestError } from "../manifestGate";
import { guardedStorage } from "../manifestStorage";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "../dataManifest";

/**
 * Phase 7o s3 — navigation preferences (v2.0, no silent data loss).
 *
 * `open3dcalc_nav_v1` is a NEW, namespaced key. Nothing here may reshape an
 * existing key: the contract under test is "additive and optional", so a
 * profile written by an older build (no such key at all), a truncated write, or
 * a hand-edited payload must all resolve to safe defaults WITHOUT the reader
 * ever touching — let alone clearing — a user's calculation, quote, history or
 * spool records.
 */

const OLD_ENV = process.env.NODE_ENV;

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  process.env.NODE_ENV = OLD_ENV;
  window.localStorage.clear();
});

describe("navigationPrefs — destination contract", () => {
  it("declares exactly the five always-available primary destinations", () => {
    expect([...PRIMARY_TAB_IDS]).toEqual([
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
    ]);
  });

  it("demotes Infill out of the primary set into the More set", () => {
    expect(PRIMARY_TAB_IDS as readonly string[]).not.toContain("infill");
    expect(MORE_TAB_IDS as readonly string[]).toContain("infill");
  });

  it("keeps the More set reachable (the demoted feature is not deleted)", () => {
    expect([...MORE_TAB_IDS]).toEqual([
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
    ]);
  });

  it("primary and More are disjoint and together cover every navigation tab", () => {
    const overlap = PRIMARY_TAB_IDS.filter((id) =>
      (MORE_TAB_IDS as readonly string[]).includes(id),
    );
    expect(overlap).toEqual([]);

    const combined = [...PRIMARY_TAB_IDS, ...MORE_TAB_IDS];
    expect(new Set(combined).size).toBe(combined.length);
    expect(combined).toHaveLength(10);
  });

  it("accepts the secondary footer surfaces as persisted destinations", () => {
    expect(SURFACE_IDS as readonly string[]).toContain("wiki");
    expect(SURFACE_IDS as readonly string[]).toContain("changelog");
    expect(isTabId("wiki")).toBe(true);
    expect(isTabId("nope")).toBe(false);
    expect(isTabId(7)).toBe(false);
  });

  it("never lets Pricing/Calculator be hidden", () => {
    expect(ALWAYS_VISIBLE_TAB).toBe("calculator");
    expect(canHideTab("calculator")).toBe(false);
    expect(canHideTab("history")).toBe(true);
  });
});

describe("navigationPrefs — safe defaults", () => {
  it("defaults to Calculator visible with nothing hidden", () => {
    expect(defaultNavigationPrefs()).toEqual({
      activeTab: "calculator",
      hiddenTabs: [],
    });
    expect(DEFAULT_NAVIGATION_PREFS).toEqual(defaultNavigationPrefs());
  });

  it("hands out a fresh object so one caller cannot poison the default", () => {
    const first = defaultNavigationPrefs();
    first.hiddenTabs.push("history");
    expect(defaultNavigationPrefs().hiddenTabs).toEqual([]);
  });
});

describe("navigationPrefs — parse tolerates absent / corrupt payloads", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["truncated JSON", '{"activeTab":"history"'],
    ["a bare string", '"history"'],
    ["an array", '["history"]'],
    ["a number", "42"],
    ["null literal", "null"],
  ])("falls back to safe defaults for %s", (_label, raw) => {
    expect(parseNavigationPrefs(raw)).toEqual(defaultNavigationPrefs());
  });

  it("keeps a valid activeTab and hiddenTabs", () => {
    const parsed = parseNavigationPrefs(
      '{"activeTab":"history","hiddenTabs":["catalog"]}',
    );
    expect(parsed).toEqual({ activeTab: "history", hiddenTabs: ["catalog"] });
  });

  it("recovers each field independently when only one is usable", () => {
    expect(
      parseNavigationPrefs('{"activeTab":"bogus","hiddenTabs":["inventory"]}'),
    ).toEqual({ activeTab: "calculator", hiddenTabs: ["inventory"] });
    expect(
      parseNavigationPrefs('{"activeTab":"dashboard","hiddenTabs":"nope"}'),
    ).toEqual({ activeTab: "dashboard", hiddenTabs: [] });
  });

  it("drops unknown tab ids instead of forwarding them to the shell", () => {
    const parsed = parseNavigationPrefs(
      '{"activeTab":"history","hiddenTabs":["bogus","inventory",42,null]}',
    );
    expect(parsed).toEqual({ activeTab: "history", hiddenTabs: ["inventory"] });
  });

  it("never restores the always-visible destination as hidden", () => {
    const parsed = parseNavigationPrefs(
      '{"activeTab":"history","hiddenTabs":["calculator","history"]}',
    );
    expect(parsed.hiddenTabs).toEqual(["history"]);
  });

  it("de-duplicates repeated ids", () => {
    expect(
      parseNavigationPrefs(
        '{"activeTab":"history","hiddenTabs":["history","history"]}',
      ).hiddenTabs,
    ).toEqual(["history"]);
  });

  it("accepts a payload carrying unknown extra fields (forward-compatible)", () => {
    const parsed = parseNavigationPrefs(
      '{"activeTab":"history","hiddenTabs":[],"futureFlag":true}',
    );
    expect(parsed).toEqual({ activeTab: "history", hiddenTabs: [] });
  });

  it("round-trips a payload through parse → serialize → parse", () => {
    const prefs: NavigationPrefs = {
      activeTab: "dashboard",
      hiddenTabs: ["products"],
    };
    const once = parseNavigationPrefs(serializeNavigationPrefs(prefs));
    const twice = parseNavigationPrefs(serializeNavigationPrefs(once));
    expect(twice).toEqual(prefs);
  });
});

describe("navigationPrefs — visibility helpers", () => {
  const prefs: NavigationPrefs = {
    activeTab: "calculator",
    hiddenTabs: ["history"],
  };

  it("reports a hidden destination as hidden", () => {
    expect(isTabHidden(prefs, "history")).toBe(true);
    expect(isTabHidden(prefs, "dashboard")).toBe(false);
  });

  it("reports Pricing/Calculator as visible even when the list names it", () => {
    expect(
      isTabHidden({ ...prefs, hiddenTabs: ["calculator"] }, "calculator"),
    ).toBe(false);
  });

  it("filters a candidate list down to the visible destinations", () => {
    expect(visibleTabsFrom(PRIMARY_TAB_IDS, prefs)).toEqual([
      "calculator",
      "dashboard",
      "catalog",
      "inventory",
    ]);
  });

  it("keeps the candidate ordering stable", () => {
    expect(visibleTabsFrom(MORE_TAB_IDS, prefs)).toEqual([
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
    ]);
  });

  it("returns an empty list when every candidate is hidden", () => {
    const all = [...PRIMARY_TAB_IDS, ...MORE_TAB_IDS].filter(
      (id) => id !== "calculator",
    );
    expect(
      visibleTabsFrom(all, {
        activeTab: "calculator",
        hiddenTabs: [...all],
      }),
    ).toEqual([]);
  });

  it("toggles a destination in and out without mutating the input", () => {
    const hidden = setTabHidden(prefs, "history", false);
    expect(hidden.hiddenTabs).toEqual([]);
    expect(prefs.hiddenTabs).toEqual(["history"]);

    const shown = setTabHidden(defaultNavigationPrefs(), "history", true);
    expect(shown.hiddenTabs).toEqual(["history"]);
  });

  it("refuses to hide Pricing/Calculator through the setter", () => {
    expect(setTabHidden(prefs, "calculator", true).hiddenTabs).toEqual([
      "history",
    ]);
  });

  it("lists the hidden ids for the current preferences", () => {
    expect(hiddenTabsIn(prefs)).toEqual(["history"]);
  });
});

describe("navigationPrefs — SPEC-01 gate and persistence", () => {
  it("registers open3dcalc_nav_v1 as a never-synced, never-exported ui_preference", () => {
    const entry = (manifestFixture as ManifestDocument).keys.find(
      (key) => key.key === NAV_PREFS_STORAGE_KEY,
    );

    expect(
      entry,
      `${NAV_PREFS_STORAGE_KEY} must be registered in SPEC-01`,
    ).toBeDefined();
    expect(entry?.class).toBe("ui_preference");
    expect(entry?.sync).toBe("never");
    expect(entry?.export).toBe("never");
    expect(entry?.pii).toBe(false);
  });

  it("is unblocked by the manifest gate (no dev throw on read or write)", () => {
    expect(() =>
      saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] }),
    ).not.toThrow(ManifestError);
    expect(() => loadNavigationPrefs()).not.toThrow(ManifestError);
  });

  it("still throws ManifestError in dev for a key that is NOT registered", () => {
    process.env.NODE_ENV = "development";
    // Proves the gate is live rather than a no-op: an unregistered key is
    // rejected, so the round-trip above is only green because registration works.
    expect(() =>
      guardedStorage.getItem("open3dcalc_nav_probe_not_registered"),
    ).toThrow(ManifestError);
  });

  it("round-trips the active tab through the registered key", () => {
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });
    expect(loadNavigationPrefs()).toEqual({
      activeTab: "history",
      hiddenTabs: [],
    });
  });

  it("round-trips hidden destinations through the registered key", () => {
    saveNavigationPrefs({
      activeTab: "calculator",
      hiddenTabs: ["history", "catalog"],
    });
    expect(loadNavigationPrefs().hiddenTabs).toEqual(["history", "catalog"]);
  });

  it("overwrites the previous payload instead of appending", () => {
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] });
    saveNavigationPrefs({ activeTab: "dashboard", hiddenTabs: [] });

    expect(window.localStorage.getItem(NAV_PREFS_STORAGE_KEY)).toBe(
      '{"activeTab":"dashboard","hiddenTabs":[]}',
    );
  });

  it("resolves to defaults for a profile written before the key existed", () => {
    expect(window.localStorage.getItem(NAV_PREFS_STORAGE_KEY)).toBeNull();
    expect(loadNavigationPrefs()).toEqual(defaultNavigationPrefs());
  });

  it("resolves to defaults for a corrupt payload left in the key", () => {
    window.localStorage.setItem(NAV_PREFS_STORAGE_KEY, "{not valid json");
    expect(loadNavigationPrefs()).toEqual(defaultNavigationPrefs());
  });
});

describe("navigationPrefs — v2.0 no-loss guarantee", () => {
  /** Keys the manifest gate already owns; none of them may be touched here. */
  const USER_DATA_KEYS = [
    "open3dcalc_settings_v2",
    "open3dcalc_history_v2",
    "open3dcalc_spool_v1",
    "open3dcalc_quote_v1",
    "open3dcalc_theme",
  ];

  it("loads an old profile with no navigation key and no visible destinations hidden", () => {
    const legacy = {
      open3dcalc_settings_v2: JSON.stringify({ activeTab: "fdm", quantity: 7 }),
      open3dcalc_history_v2: JSON.stringify([{ id: "h1", summary: "Vaso" }]),
      open3dcalc_spool_v1: JSON.stringify([{ id: "s1", brand: "Polymaker" }]),
    };
    for (const [key, value] of Object.entries(legacy)) {
      window.localStorage.setItem(key, value);
    }

    const prefs = loadNavigationPrefs();

    expect(prefs.activeTab).toBe("calculator");
    expect(prefs.hiddenTabs).toEqual([]);
    expect(visibleTabsFrom(PRIMARY_TAB_IDS, prefs)).toEqual([
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
    ]);
  });

  it("leaves every pre-existing user data key byte-identical", () => {
    const before: Record<string, string> = {};
    for (const key of USER_DATA_KEYS) {
      const value = `payload-for-${key}`;
      window.localStorage.setItem(key, value);
      before[key] = value;
    }

    saveNavigationPrefs({ activeTab: "dashboard", hiddenTabs: ["catalog"] });
    loadNavigationPrefs();

    for (const key of USER_DATA_KEYS) {
      expect(window.localStorage.getItem(key), key).toBe(before[key]);
    }
  });

  it("never removes another key while persisting navigation preferences", () => {
    for (const key of USER_DATA_KEYS)
      window.localStorage.setItem(key, "keep-me");
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem");

    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("only ever writes the single namespaced navigation key", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem");

    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["privacy"] });

    const written = setSpy.mock.calls.map(([key]) => key);
    expect(new Set(written)).toEqual(new Set([NAV_PREFS_STORAGE_KEY]));
  });
});
