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
  it("leaves Stable customer data untouched and does not inspect retired storage keys", async () => {
    const key = "open3dcalc_history_v2";
    const canary = '[{"id":"synthetic-stable-canary"}]';
    window.localStorage.setItem(key, canary);

    const getItem = vi.spyOn(guardedStorage, "getItem");
    const setItem = vi.spyOn(guardedStorage, "setItem");
    const removeItem = vi.spyOn(guardedStorage, "removeItem");

    renderHook(() => useAppInit(vi.fn()));
    await Promise.resolve();
    await Promise.resolve();

    const retiredPiiKeys = [
      "open3dcalc_customers_v1",
      "open3dcalc_quotes_v1",
      "open3dcalc_history_v2",
    ];
    expect(
      getItem.mock.calls.every(
        ([calledKey]) => !retiredPiiKeys.includes(calledKey),
      ),
    ).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    expect(window.localStorage.getItem(key)).toBe(canary);
  });
});
