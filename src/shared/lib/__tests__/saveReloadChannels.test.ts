import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

const CUSTOMER_KEY = "open3dcalc_customers_v1";
const SYNTHETIC_CUSTOMER = JSON.stringify({
  state: {
    customers: [
      {
        id: "synthetic-customer-01",
        name: "Example Customer",
        email: "customer@example.invalid",
      },
    ],
  },
  version: 1,
});

describe("saveReloadChannels", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldUserAgent = navigator.userAgent;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    window.localStorage.clear();
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    process.env.NODE_ENV = oldNodeEnv;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: oldUserAgent,
    });
    vi.restoreAllMocks();
  });

  function setUserAgent(userAgent: string): void {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: userAgent,
    });
  }

  it.each([
    ["Stable Web", "Mozilla/5.0 (compatible; web)"],
    ["Desktop renderer", "Mozilla/5.0 Electron/43.0"],
  ])(
    "saves and reloads a Stable customer on %s",
    async (_channel, userAgent) => {
      setUserAgent(userAgent);
      const { resetManifestForTests } =
        await import("@/shared/lib/manifestGate");
      resetManifestForTests(undefined);
      const { guardedStorage } = await import("@/shared/lib/manifestStorage");

      guardedStorage.setItem(CUSTOMER_KEY, SYNTHETIC_CUSTOMER);
      expect(window.localStorage.getItem(CUSTOMER_KEY)).toBe(
        SYNTHETIC_CUSTOMER,
      );

      vi.resetModules();
      const { resetManifestForTests: resetAfterReload } =
        await import("@/shared/lib/manifestGate");
      resetAfterReload(undefined);
      const { guardedStorage: reloadedStorage } =
        await import("@/shared/lib/manifestStorage");
      expect(reloadedStorage.getItem(CUSTOMER_KEY)).toBe(SYNTHETIC_CUSTOMER);
    },
  );

  it("hydrates a Stable Web customer before a later store action writes", async () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    window.localStorage.setItem(CUSTOMER_KEY, SYNTHETIC_CUSTOMER);
    const { resetManifestForTests } = await import("@/shared/lib/manifestGate");
    resetManifestForTests(undefined);

    const { useCustomerStore } = await import("@/shared/stores/customerStore");
    expect(useCustomerStore.getState().getAllCustomers()).toHaveLength(1);
    useCustomerStore.getState().addCustomer({
      name: "Another Example",
      company: "",
      email: "another@example.invalid",
      phone: "",
      address: "",
      notes: "",
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(CUSTOMER_KEY) ?? "null",
    ) as { state: { customers: unknown[] } };
    expect(persisted.state.customers).toHaveLength(2);

    vi.resetModules();
    const { resetManifestForTests: resetReloaded } =
      await import("@/shared/lib/manifestGate");
    resetReloaded(undefined);
    const { useCustomerStore: reloadedStore } =
      await import("@/shared/stores/customerStore");
    expect(reloadedStore.getState().getAllCustomers()).toHaveLength(2);
  });
});
