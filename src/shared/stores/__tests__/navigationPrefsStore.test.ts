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

/**
 * Phase 7o s4 — Focus Mode.
 *
 * Focus Mode lives in THIS store, next to the active destination it switches
 * to, but it is TRANSIENT. That is the whole point of the stage: entering and
 * leaving must be invisible to a reload, so unlike stage 3 — which added
 * `open3dcalc_nav_v1` to SPEC-01 — this stage adds NO key and NO second
 * persistence path. The serializer is unchanged and still writes exactly two
 * fields, so a fresh mount cannot possibly resurrect the mode.
 */
describe("navigationPrefsStore — focus mode is transient", () => {
  // The two transient fields are deliberately NOT part of `NavigationPrefs`
  // (that type IS the persisted shape), so the shared `defaultNavigationPrefs`
  // reset above cannot clear them. Reset them here or one test's mode leaks
  // into the next.
  beforeEach(() => {
    useNavigationPrefsStore.setState({
      focusMode: false,
      focusModeReturnTab: null,
    });
  });

  it("remembers the screen it was entered from and switches to the calculator", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");

    useNavigationPrefsStore.getState().enterFocusMode();

    const state = useNavigationPrefsStore.getState();
    expect(state.focusMode).toBe(true);
    expect(state.focusModeReturnTab).toBe("history");
    expect(state.activeTab).toBe("calculator");
  });

  it("restores the remembered screen on exit", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    useNavigationPrefsStore.getState().enterFocusMode();

    useNavigationPrefsStore.getState().exitFocusMode();

    const state = useNavigationPrefsStore.getState();
    expect(state.focusMode).toBe(false);
    expect(state.focusModeReturnTab).toBeNull();
    expect(state.activeTab).toBe("dashboard");
  });

  it("stays on the calculator when the remembered screen is hidden", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    useNavigationPrefsStore.getState().enterFocusMode();
    // The user hides History while the mode is on (reachable from the store,
    // and the only honest way to test the intersection of the two features).
    useNavigationPrefsStore.getState().setTabVisibility("history", false);

    useNavigationPrefsStore.getState().exitFocusMode();

    expect(useNavigationPrefsStore.getState().activeTab).toBe("calculator");
  });

  it("cannot overwrite the remembered screen by entering twice", () => {
    // Entering while already on would otherwise capture the calculator and
    // throw the real context away.
    useNavigationPrefsStore.getState().setActiveTab("history");
    useNavigationPrefsStore.getState().enterFocusMode();
    useNavigationPrefsStore.getState().enterFocusMode();

    expect(useNavigationPrefsStore.getState().focusModeReturnTab).toBe(
      "history",
    );

    useNavigationPrefsStore.getState().exitFocusMode();
    expect(useNavigationPrefsStore.getState().activeTab).toBe("history");
  });

  it("is a no-op to exit when the mode was never entered", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");

    useNavigationPrefsStore.getState().exitFocusMode();

    expect(useNavigationPrefsStore.getState().activeTab).toBe("dashboard");
  });

  it("does not change the hidden-destination list", () => {
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);
    useNavigationPrefsStore.getState().enterFocusMode();
    useNavigationPrefsStore.getState().exitFocusMode();

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual(["infill"]);
  });

  it("never hides the always-visible home destination", () => {
    useNavigationPrefsStore.getState().enterFocusMode();
    useNavigationPrefsStore.getState().exitFocusMode();

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
    expect(useNavigationPrefsStore.getState().isTabVisible("calculator")).toBe(
      true,
    );
  });

  it("writes neither the mode nor the remembered screen to storage", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    useNavigationPrefsStore.getState().enterFocusMode();

    const raw = window.localStorage.getItem(NAV_PREFS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(Object.keys(JSON.parse(raw as string)).sort()).toEqual([
      "activeTab",
      "hiddenTabs",
    ]);
  });

  it("introduces no storage key of its own", () => {
    window.localStorage.clear();
    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    useNavigationPrefsStore.getState().enterFocusMode();
    useNavigationPrefsStore.getState().exitFocusMode();

    const keys = Object.keys(window.localStorage);
    expect(keys).toEqual([NAV_PREFS_STORAGE_KEY]);
    // Belt and braces: even if a future build renamed the preference, no key
    // may ever carry the mode, because the mode is meant to die on reload.
    for (const key of keys) {
      expect(key.toLowerCase(), key).not.toContain("focus");
    }
  });

  it("does not touch any user-data key", () => {
    const saved = {
      open3dcalc_settings_v2: JSON.stringify({ activeTab: "fdm", quantity: 4 }),
      open3dcalc_history_v2: JSON.stringify([{ id: "h1", summary: "Vaso" }]),
      open3dcalc_spool_v1: JSON.stringify([{ id: "s1", brand: "Polymaker" }]),
    };
    for (const [key, value] of Object.entries(saved)) {
      window.localStorage.setItem(key, value);
    }

    useNavigationPrefsStore.getState().enterFocusMode();
    useNavigationPrefsStore.getState().exitFocusMode();

    for (const [key, value] of Object.entries(saved)) {
      expect(window.localStorage.getItem(key), key).toBe(value);
    }
  });

  it("keeps the mode out of the calculator undo snapshot", () => {
    useCalculatorStore.setState({ history: [], quantity: 1 });
    useNavigationPrefsStore.getState().enterFocusMode();
    useCalculatorStore.getState().setQuantity(6);

    const { history } = useCalculatorStore.getState();
    const snapshot = JSON.parse(history[history.length - 1]) as Record<
      string,
      unknown
    >;
    expect(snapshot).not.toHaveProperty("focusMode");
    expect(snapshot).not.toHaveProperty("focusModeReturnTab");
  });

  it("is off after a reload, even with the preference on disk", async () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    useNavigationPrefsStore.getState().enterFocusMode();
    expect(window.localStorage.getItem(NAV_PREFS_STORAGE_KEY)).not.toBeNull();

    // A reload re-evaluates the store from the persisted preference.
    vi.resetModules();
    const { useNavigationPrefsStore: fresh } =
      await import("../navigationPrefsStore");

    const state = fresh.getState();
    expect(state.focusMode).toBe(false);
    expect(state.focusModeReturnTab).toBeNull();
    // The destination the mode switched to IS remembered — that is stage 3's
    // existing behaviour, not a new one, and it is why a reload lands on the
    // calculator instead of on a screen the user cannot see any more.
    expect(state.activeTab).toBe("calculator");
  });
});
