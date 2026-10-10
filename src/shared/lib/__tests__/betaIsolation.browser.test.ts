import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  guardedStorage,
  stablePiiPersistStorage,
} from "@/shared/lib/manifestStorage";
import { isKeyAllowed, resetManifestForTests } from "@/shared/lib/manifestGate";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const BETA_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;
const STABLE_CUSTOMERS_KEY = "open3dcalc_customers_v1";
const STABLE_CANARY =
  '{"state":{"customers":[{"id":"stable-1","name":"Stable Canary","email":"stable@example.invalid"}]},"version":1}';
const BETA_CANARY =
  '{"state":{"customers":[{"id":"beta-1","name":"Beta Customer","email":"beta@example.invalid"}]},"version":1}';

describe("betaIsolation.browser", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
    window.localStorage.setItem(STABLE_CUSTOMERS_KEY, STABLE_CANARY);
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    vi.restoreAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("uses the same readable Stable customer key in Beta", () => {
    expect(isKeyAllowed(STABLE_CUSTOMERS_KEY)).toBe(true);
    expect(guardedStorage.getItem(STABLE_CUSTOMERS_KEY)).toBe(STABLE_CANARY);

    guardedStorage.setItem(STABLE_CUSTOMERS_KEY, STABLE_CANARY);
    expect(window.localStorage.getItem(STABLE_CUSTOMERS_KEY)).toBe(
      STABLE_CANARY,
    );
    expect(window.localStorage.length).toBe(1);
  });

  it("merges a valid record from the retired Beta key before hydration", async () => {
    window.localStorage.setItem(BETA_KEYS[0], BETA_CANARY);
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    const persisted = await stablePiiPersistStorage<{
      customers: Array<{ id: string; name: string; email: string }>;
    }>(STABLE_CUSTOMERS_KEY).getItem(STABLE_CUSTOMERS_KEY);

    expect(persisted?.state.customers.map((customer) => customer.id)).toEqual([
      "stable-1",
      "beta-1",
    ]);
    expect(getItem).toHaveBeenCalledWith(STABLE_CUSTOMERS_KEY);
    expect(getItem).toHaveBeenCalledWith(BETA_KEYS[0]);
    expect(window.localStorage.getItem(BETA_KEYS[0])).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(STABLE_CUSTOMERS_KEY) ?? "{}"),
    ).toMatchObject({
      state: { customers: [{ id: "stable-1" }, { id: "beta-1" }] },
      version: 1,
    });
  });

  it("denies unknown and retired Beta keys without a prefix fallback", () => {
    expect(isKeyAllowed("open3dcalc_beta_test_unknown_v1")).toBe(false);
    expect(isKeyAllowed(STABLE_CUSTOMERS_KEY)).toBe(true);
    expect(isKeyAllowed(BETA_KEYS[0])).toBe(false);
    expect(isKeyAllowed("open3dcalc_beta_test_customers_v2")).toBe(false);
    expect(isKeyAllowed("sw_cache_entries")).toBe(true);
  });
});
