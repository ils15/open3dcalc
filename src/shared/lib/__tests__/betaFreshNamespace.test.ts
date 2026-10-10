import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadShippedManifest } from "@/shared/lib/shippedManifest";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { stablePiiPersistStorage } from "@/shared/lib/manifestStorage";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const CUSTOMER_KEY = "open3dcalc_customers_v1";
const LEGACY_CUSTOMER_KEY = "open3dcalc_beta_test_customers_v1";

describe("Beta shared local profile", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("uses the same declared user-content keys as Stable Web", () => {
    const manifest = loadShippedManifest();

    expect(manifest.has(CUSTOMER_KEY)).toBe(true);
    expect(manifest.has("open3dcalc_quotes_v1")).toBe(true);
    expect(manifest.has("open3dcalc_history_v2")).toBe(true);
    expect(manifest.has(LEGACY_CUSTOMER_KEY)).toBe(false);
  });

  it("moves legacy Beta records into the shared V2 profile before hydration", async () => {
    const legacy = JSON.stringify({
      state: {
        customers: [{ id: "beta-customer-01", name: "Cliente Beta" }],
      },
      version: 1,
    });
    window.localStorage.setItem(LEGACY_CUSTOMER_KEY, legacy);

    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(
      CUSTOMER_KEY,
    );
    const record = await storage.getItem(CUSTOMER_KEY);

    expect(record?.state.customers).toEqual([
      { id: "beta-customer-01", name: "Cliente Beta" },
    ]);
    expect(window.localStorage.getItem(CUSTOMER_KEY)).toBe(
      JSON.stringify({
        state: {
          customers: [{ id: "beta-customer-01", name: "Cliente Beta" }],
        },
        version: 1,
      }),
    );
    expect(window.localStorage.getItem(LEGACY_CUSTOMER_KEY)).toBeNull();
  });

  it("merges legacy and current records by ID without overwriting either", async () => {
    window.localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify({
        state: { customers: [{ id: "shared", name: "Current" }] },
        version: 1,
      }),
    );
    window.localStorage.setItem(
      LEGACY_CUSTOMER_KEY,
      JSON.stringify({
        state: {
          customers: [
            { id: "shared", name: "Older copy" },
            { id: "legacy-only", name: "Older customer" },
          ],
        },
        version: 1,
      }),
    );

    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(
      CUSTOMER_KEY,
    );
    const record = await storage.getItem(CUSTOMER_KEY);

    expect(record?.state.customers).toEqual([
      { id: "shared", name: "Current" },
      { id: "legacy-only", name: "Older customer" },
    ]);
    expect(window.localStorage.getItem(LEGACY_CUSTOMER_KEY)).toBeNull();
  });

  it("does not overwrite a corrupt legacy source or claim it migrated", async () => {
    const corrupt = "{malformed legacy data";
    window.localStorage.setItem(LEGACY_CUSTOMER_KEY, corrupt);
    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(
      CUSTOMER_KEY,
    );

    await expect(
      Promise.resolve().then(() => storage.getItem(CUSTOMER_KEY)),
    ).rejects.toThrow(/failed to hydrate/);
    expect(window.localStorage.getItem(LEGACY_CUSTOMER_KEY)).toBe(corrupt);
    expect(window.localStorage.getItem(CUSTOMER_KEY)).toBeNull();
  });
});
