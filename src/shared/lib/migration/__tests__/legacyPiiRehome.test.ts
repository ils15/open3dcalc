import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { migrateLegacyPlaintextPiiToVault } from "../legacyPiiRehome";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("legacyPiiRehome Beta boundary", () => {
  it("refuses the retired migration without reading or mutating Stable residue", async () => {
    const key = "open3dcalc_customers_v1";
    const canary = '{"state":{"customers":[{"id":"synthetic-canary"}]}}';
    window.localStorage.setItem(key, canary);

    const localRead = vi.fn(() => canary);
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");

    const result = await migrateLegacyPlaintextPiiToVault({ read: localRead });

    expect(result).toEqual({
      status: "disabled",
      migratedKeys: [],
      skippedKeys: [],
    });
    expect(localRead).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();

    getItem.mockRestore();
    setItem.mockRestore();
    removeItem.mockRestore();
    expect(window.localStorage.getItem(key)).toBe(canary);
  });
});
