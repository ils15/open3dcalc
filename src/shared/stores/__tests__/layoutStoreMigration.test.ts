import { beforeEach, describe, expect, it, vi } from "vitest";
import { LAYOUT_STORAGE_KEY } from "../layoutStore";

describe("layoutStore preference migration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("reads a legacy layout-only payload and supplies the compact sidebar default", async () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify("guided"));

    const { useLayoutStore: freshStore } = await import("../layoutStore");

    expect(freshStore.getState().layoutMode).toBe("guided");
    expect(freshStore.getState().sidebarMode).toBe("compact");
  });

  it("reloads both independent preferences from the composite payload", async () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ layoutMode: "bento", sidebarMode: "dock" }),
    );

    const { useLayoutStore: freshStore } = await import("../layoutStore");

    expect(freshStore.getState().layoutMode).toBe("bento");
    expect(freshStore.getState().sidebarMode).toBe("dock");
  });
});
