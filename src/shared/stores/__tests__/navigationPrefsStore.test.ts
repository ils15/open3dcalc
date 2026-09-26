import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  NAV_PREFS_STORAGE_KEY,
  defaultNavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { useNavigationPrefsStore } from "../navigationPrefsStore";
import { useCalculatorStore } from "../calculatorStore";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

/**
 * Phase 7o s3 — navigation preference store.
 *
 * The store owns exactly two pieces of state: the active destination (so the
 * user returns where they left off) and the hidden-destination list. It is
 * deliberately SEPARATE from calculatorStore, for the same reason layoutStore
 * is: a navigation/ergonomic preference must never enter the calculator undo
 * snapshot, so undoing a cost edit cannot revert the tab the user chose.
 *
 * The critical invariant is that visibility is NAVIGATION-ONLY. Hiding a
 * destination must not delete, filter or hide a single user record, and
 * navigateToTab must still reach a hidden surface.
 */

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState(defaultNavigationPrefs());
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("navigationPrefsStore — defaults", () => {
  it("starts on Calculator with nothing hidden", () => {
    const state = useNavigationPrefsStore.getState();

    expect(state.activeTab).toBe("calculator");
    expect(state.hiddenTabs).toEqual([]);
  });

  it("reports every hideable destination as visible", () => {
    const { isTabVisible } = useNavigationPrefsStore.getState();

    for (const tab of [
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
    ] as const) {
      expect(isTabVisible(tab), tab).toBe(true);
    }
  });
});

describe("navigationPrefsStore — active tab persistence", () => {
  it("switches the active destination", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    expect(useNavigationPrefsStore.getState().activeTab).toBe("history");
  });

  it("persists the active destination to the registered key", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");

    expect(
      JSON.parse(window.localStorage.getItem(NAV_PREFS_STORAGE_KEY) ?? "{}"),
    ).toEqual({ activeTab: "dashboard", hiddenTabs: [] });
  });

  it("reloads the persisted destination on module re-evaluation (reload)", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");

    vi.resetModules();
    return import("../navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        expect(fresh.getState().activeTab).toBe("history");
      },
    );
  });

  it("resumes a secondary footer surface (wiki) too", () => {
    useNavigationPrefsStore.getState().setActiveTab("wiki");
    expect(useNavigationPrefsStore.getState().activeTab).toBe("wiki");
  });

  it("falls back to Calculator for a corrupt payload", () => {
    window.localStorage.setItem(NAV_PREFS_STORAGE_KEY, "{not valid json");

    vi.resetModules();
    return import("../navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        expect(fresh.getState().activeTab).toBe("calculator");
        expect(fresh.getState().hiddenTabs).toEqual([]);
      },
    );
  });

  it("falls back to Calculator for a payload naming an unknown destination", () => {
    window.localStorage.setItem(
      NAV_PREFS_STORAGE_KEY,
      '{"activeTab":"hologram","hiddenTabs":["bogus"]}',
    );

    vi.resetModules();
    return import("../navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        expect(fresh.getState().activeTab).toBe("calculator");
        expect(fresh.getState().hiddenTabs).toEqual([]);
      },
    );
  });

  it("keeps a partial payload's usable half", () => {
    window.localStorage.setItem(
      NAV_PREFS_STORAGE_KEY,
      '{"hiddenTabs":["catalog"]}',
    );

    vi.resetModules();
    return import("../navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        expect(fresh.getState().activeTab).toBe("calculator");
        expect(fresh.getState().hiddenTabs).toEqual(["catalog"]);
      },
    );
  });
});

describe("navigationPrefsStore — destination visibility", () => {
  it("hides a destination from navigation", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual(["history"]);
    expect(useNavigationPrefsStore.getState().isTabVisible("history")).toBe(
      false,
    );
  });

  it("shows a hidden destination again", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().setTabVisibility("history", true);

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
    expect(useNavigationPrefsStore.getState().isTabVisible("history")).toBe(
      true,
    );
  });

  it("toggles a destination", () => {
    const { toggleTabVisibility } = useNavigationPrefsStore.getState();

    toggleTabVisibility("catalog");
    expect(useNavigationPrefsStore.getState().isTabVisible("catalog")).toBe(
      false,
    );
    toggleTabVisibility("catalog");
    expect(useNavigationPrefsStore.getState().isTabVisible("catalog")).toBe(
      true,
    );
  });

  it("never hides Pricing/Calculator, even when asked directly", () => {
    useNavigationPrefsStore.getState().setTabVisibility("calculator", false);

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
    expect(useNavigationPrefsStore.getState().isTabVisible("calculator")).toBe(
      true,
    );
  });

  it("refuses to toggle Pricing/Calculator off", () => {
    useNavigationPrefsStore.getState().toggleTabVisibility("calculator");
    expect(useNavigationPrefsStore.getState().isTabVisible("calculator")).toBe(
      true,
    );
  });

  it("round-trips hidden destinations through a reload", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);

    vi.resetModules();
    return import("../navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        expect(fresh.getState().hiddenTabs).toEqual(["history", "infill"]);
      },
    );
  });

  it("restores every destination through resetVisibility()", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().resetVisibility();

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
  });
});

describe("navigationPrefsStore — navigation-only, never data", () => {
  it("still navigates to a destination the user hid", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().setActiveTab("history");

    // Hiding removes the item from navigation; it must not make the surface
    // unreachable, or History → Calculator style internal flows would break.
    expect(useNavigationPrefsStore.getState().activeTab).toBe("history");
  });

  it("leaves the active destination alone when it is hidden", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    useNavigationPrefsStore.getState().setTabVisibility("history", false);

    expect(useNavigationPrefsStore.getState().activeTab).toBe("history");
  });

  it("does not touch saved calculator, quote, history or spool data", () => {
    const saved = {
      open3dcalc_settings_v2: JSON.stringify({ activeTab: "fdm", quantity: 4 }),
      open3dcalc_history_v2: JSON.stringify([{ id: "h1", summary: "Vaso" }]),
      open3dcalc_spool_v1: JSON.stringify([{ id: "s1", brand: "Polymaker" }]),
      open3dcalc_quote_v1: JSON.stringify([{ id: "q1", total: 42 }]),
    };
    for (const [key, value] of Object.entries(saved)) {
      window.localStorage.setItem(key, value);
    }

    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().setTabVisibility("catalog", false);
    useNavigationPrefsStore.getState().resetVisibility();

    for (const [key, value] of Object.entries(saved)) {
      expect(window.localStorage.getItem(key), key).toBe(value);
    }
  });

  it("keeps the preference out of the calculator undo snapshot", () => {
    useCalculatorStore.setState({ history: [], quantity: 1 });

    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    useCalculatorStore.getState().setQuantity(6);

    const { history } = useCalculatorStore.getState();
    expect(history.length).toBeGreaterThan(0);
    const snapshot = JSON.parse(history[history.length - 1]) as Record<
      string,
      unknown
    >;

    // calculatorStore has its OWN activeTab (fdm/resin). The navigation
    // destination must not overwrite or be confused with it, and the hidden
    // list must never appear in a calculation snapshot.
    expect(snapshot.activeTab).toBe("fdm");
    expect(snapshot).not.toHaveProperty("hiddenTabs");
  });

  it("undo() in the calculator does not revert the navigation preference", () => {
    useCalculatorStore.setState({ history: [], quantity: 1 });

    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useCalculatorStore.getState().setQuantity(9);
    useCalculatorStore.getState().undo();

    expect(useNavigationPrefsStore.getState().activeTab).toBe("dashboard");
    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual(["history"]);
  });
});
