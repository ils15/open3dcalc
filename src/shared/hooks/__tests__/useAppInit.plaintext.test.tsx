import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { useAppInit } from "../useAppInit";
import { guardedStorage } from "@/shared/lib/manifestStorage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useAppInit Beta boundary", () => {
  it("leaves Stable migration inputs untouched and performs no legacy storage access", async () => {
    const key = "open3dcalc_history_v2";
    const canary = '[{"id":"synthetic-stable-canary"}]';
    window.localStorage.setItem(key, canary);

    const getItem = vi.spyOn(guardedStorage, "getItem");
    const setItem = vi.spyOn(guardedStorage, "setItem");
    const removeItem = vi.spyOn(guardedStorage, "removeItem");

    renderHook(() => useAppInit(vi.fn()));
    await Promise.resolve();
    await Promise.resolve();

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    expect(window.localStorage.getItem(key)).toBe(canary);
  });
});
