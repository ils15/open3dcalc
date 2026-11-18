import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useLayoutStore,
  LAYOUT_STORAGE_KEY,
  DEFAULT_SIDEBAR_MODE,
  DEFAULT_WORKSPACE_WIDTH,
  type LayoutMode,
  type WorkspaceWidth,
} from "../layoutStore";
import { useCalculatorStore } from "../calculatorStore";

beforeEach(() => {
  localStorage.clear();
  // sidebarMode and workspaceWidth live in the same store: reset both so tests stay isolated.
  useLayoutStore.setState({
    layoutMode: "classic",
    sidebarMode: DEFAULT_SIDEBAR_MODE,
    workspaceWidth: DEFAULT_WORKSPACE_WIDTH,
  });
});

describe("layoutStore — defaults and transitions", () => {
  it("defaults to classic mode and standard workspaceWidth", () => {
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
    expect(useLayoutStore.getState().workspaceWidth).toBe("standard");
  });

  it("setWorkspaceWidth and cycleWorkspaceWidth transition through focused -> standard -> wide", () => {
    const store = useLayoutStore.getState();
    const widths: WorkspaceWidth[] = ["focused", "standard", "wide"];
    for (const width of widths) {
      store.setWorkspaceWidth(width);
      expect(useLayoutStore.getState().workspaceWidth).toBe(width);
    }
    store.setWorkspaceWidth("focused");
    store.cycleWorkspaceWidth();
    expect(useLayoutStore.getState().workspaceWidth).toBe("standard");
    store.cycleWorkspaceWidth();
    expect(useLayoutStore.getState().workspaceWidth).toBe("wide");
    store.cycleWorkspaceWidth();
    expect(useLayoutStore.getState().workspaceWidth).toBe("focused");
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
