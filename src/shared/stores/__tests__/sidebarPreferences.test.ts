import { beforeEach, describe, expect, it } from "vitest";
import {
  LAYOUT_STORAGE_KEY,
  useLayoutStore,
  type SidebarMode,
} from "../layoutStore";

const modes: readonly SidebarMode[] = ["compact", "tabs", "dock", "expanded"];

describe("layoutStore — independent sidebar preference", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ layoutMode: "classic", sidebarMode: "compact" });
  });

  it("defaults the sidebar to compact without changing the calculator layout", () => {
    expect(useLayoutStore.getState().sidebarMode).toBe("compact");
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
  });

  it.each(modes)(
    "persists %s independently in the registered layout preference",
    (mode) => {
      useLayoutStore.getState().setLayoutMode("bento");
      useLayoutStore.getState().setSidebarMode(mode);

      const saved = JSON.parse(
        localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}",
      ) as {
        layoutMode?: unknown;
        sidebarMode?: unknown;
      };

      expect(saved).toEqual({ layoutMode: "bento", sidebarMode: mode });
    },
  );

  it("keeps the legacy wire format when the persisted payload is corrupt", async () => {
    // A corrupt payload makes hasCompositePayload() throw-free-false, so the
    // store must still fall back to writing the bare layout-mode string
    // instead of silently switching formats.
    localStorage.setItem(LAYOUT_STORAGE_KEY, "{not valid json");

    const { useLayoutStore: freshStore } = await import("../layoutStore");
    freshStore.getState().setLayoutMode("guided");

    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe(
      JSON.stringify("guided"),
    );
    expect(freshStore.getState().sidebarMode).toBe("compact");
  });

  it("does not overwrite the sidebar choice when the global layout changes", () => {
    useLayoutStore.getState().setSidebarMode("dock");
    useLayoutStore.getState().setLayoutMode("guided");

    expect(useLayoutStore.getState().sidebarMode).toBe("dock");
    expect(
      JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}"),
    ).toEqual({
      layoutMode: "guided",
      sidebarMode: "dock",
    });
  });
});
