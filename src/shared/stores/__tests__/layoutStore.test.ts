import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useLayoutStore,
  LAYOUT_STORAGE_KEY,
  type LayoutMode,
} from "../layoutStore";
import { useCalculatorStore } from "../calculatorStore";

/**
 * Wave 1 (V2.0) — layout mode store.
 *
 * The key `open3dcalc_layout_v1` is registered in the SPEC-01 manifest
 * (class `ui_preference`); the guardedStorage gate denies unregistered keys,
 * so persistence only works because Wave 0 registered it.
 *
 * The store is deliberately SEPARATE from calculatorStore: `layoutMode` is an
 * ergonomic UI preference and must never enter the calculator undo snapshot
 * (undoing a cost edit must not revert the layout the user chose).
 */

beforeEach(() => {
  localStorage.clear();
  useLayoutStore.setState({ layoutMode: "classic" });
});

describe("layoutStore — defaults and transitions", () => {
  it("defaults to classic mode", () => {
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
  });

  it("setLayoutMode() switches the active mode", () => {
    const { setLayoutMode } = useLayoutStore.getState();

    setLayoutMode("guided");
    expect(useLayoutStore.getState().layoutMode).toBe("guided");

    setLayoutMode("bento");
    expect(useLayoutStore.getState().layoutMode).toBe("bento");

    setLayoutMode("classic");
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
  });

  it("setLayoutMode() accepts every LayoutMode value without narrowing", () => {
    const modes: LayoutMode[] = ["classic", "guided", "bento"];
    for (const mode of modes) {
      useLayoutStore.getState().setLayoutMode(mode);
      expect(useLayoutStore.getState().layoutMode).toBe(mode);
    }
  });
});

describe("layoutStore — SPEC-01 gated persistence", () => {
  it("persists the mode to the registered key", () => {
    useLayoutStore.getState().setLayoutMode("bento");

    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe(
      JSON.stringify("bento"),
    );
  });

  it("overwrites the previous mode instead of appending", () => {
    useLayoutStore.getState().setLayoutMode("guided");
    useLayoutStore.getState().setLayoutMode("classic");

    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe(
      JSON.stringify("classic"),
    );
  });

  it("reloads the persisted mode on module re-evaluation (reload)", () => {
    useLayoutStore.getState().setLayoutMode("guided");

    vi.resetModules();
    return import("../layoutStore").then(({ useLayoutStore: fresh }) => {
      expect(fresh.getState().layoutMode).toBe("guided");
    });
  });

  it("treats an unknown persisted value as classic (default-on-missing)", () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify("hologram"));

    vi.resetModules();
    return import("../layoutStore").then(({ useLayoutStore: fresh }) => {
      expect(fresh.getState().layoutMode).toBe("classic");
    });
  });

  it("treats a corrupted payload as classic (fail-safe)", () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, "{not valid json");

    vi.resetModules();
    return import("../layoutStore").then(({ useLayoutStore: fresh }) => {
      expect(fresh.getState().layoutMode).toBe("classic");
    });
  });

  it("is unblocked by the manifest gate (key registered in SPEC-01 v1.4)", () => {
    // A gated write to an unknown key is silently dropped, so a stale
    // layout must survive a round-trip through the real guardedStorage.
    useLayoutStore.getState().setLayoutMode("bento");
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '""')).toBe(
      "bento",
    );
  });
});

describe("layoutStore — undo isolation from calculatorStore", () => {
  beforeEach(() => {
    // Reset the calculator undo stack so snapshots only come from this test.
    useCalculatorStore.setState({ history: [], quantity: 1 });
  });

  it("switching layout does not add an entry to the calculator undo stack", () => {
    const historyBefore = [...useCalculatorStore.getState().history];

    useLayoutStore.getState().setLayoutMode("guided");
    useLayoutStore.getState().setLayoutMode("bento");

    expect(useCalculatorStore.getState().history).toEqual(historyBefore);
  });

  it("layoutMode is absent from the calculator undo snapshot", () => {
    useLayoutStore.getState().setLayoutMode("guided");
    useCalculatorStore.getState().setQuantity(5);

    const { history } = useCalculatorStore.getState();
    expect(history).not.toHaveLength(0);

    const snapshot = JSON.parse(history[history.length - 1]) as Record<
      string,
      unknown
    >;
    expect(snapshot).not.toHaveProperty("layoutMode");
  });

  it("undo() restores calculator state without touching layoutMode", () => {
    useLayoutStore.getState().setLayoutMode("bento");
    useCalculatorStore.getState().setQuantity(7);
    expect(useCalculatorStore.getState().quantity).toBe(7);

    useCalculatorStore.getState().undo();

    expect(useCalculatorStore.getState().quantity).toBe(1);
    expect(useLayoutStore.getState().layoutMode).toBe("bento");
  });

  it("undo() never introduces a layoutMode into the store", () => {
    useLayoutStore.getState().setLayoutMode("guided");
    useCalculatorStore.getState().setQuantity(3);
    useCalculatorStore.getState().undo();

    expect(useLayoutStore.getState().layoutMode).toBe("guided");
  });
});
