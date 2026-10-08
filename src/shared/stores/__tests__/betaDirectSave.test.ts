import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const BETA_CUSTOMERS_KEY = "open3dcalc_beta_test_customers_v1";

describe("betaDirectSave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves synthetic customer data on a fresh profile without password or consent", async () => {
    const { resetManifestForTests } = await import("@/shared/lib/manifestGate");
    resetManifestForTests(undefined);
    const { useCustomerStore } = await import("../customerStore");

    await useCustomerStore.persist.rehydrate();
    const customerId = useCustomerStore.getState().addCustomer({
      name: "Synthetic Customer",
      company: "Example Workshop",
      email: "customer@example.invalid",
      phone: "555-0100",
      address: "1 Example Way",
      notes: "synthetic test record",
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(BETA_CUSTOMERS_KEY) ?? "{}",
    ) as { state?: { customers?: Array<{ id: string; email?: string }> } };
    expect(persisted.state?.customers).toContainEqual(
      expect.objectContaining({
        id: customerId,
        email: "customer@example.invalid",
      }),
    );
    expect(window.localStorage.getItem("open3dcalc_consent_v1")).toBeNull();
    expect(window.localStorage.getItem("open3dcalc_pii_vault")).toBeNull();
  });
});

describe("saveReloadChannels", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reloads a Beta synthetic customer from its exact test key", async () => {
    const gateBeforeSave = await import("@/shared/lib/manifestGate");
    gateBeforeSave.resetManifestForTests(undefined);
    const { useCustomerStore: firstStore } = await import("../customerStore");
    await firstStore.persist.rehydrate();
    firstStore.getState().addCustomer({
      name: "Reloaded Synthetic",
      company: "Example Workshop",
      email: "reload@example.invalid",
      phone: "555-0101",
      address: "2 Example Way",
      notes: "synthetic reload fixture",
    });

    vi.resetModules();
    const gateAfterReload = await import("@/shared/lib/manifestGate");
    gateAfterReload.resetManifestForTests(undefined);
    const { useCustomerStore: reloadedStore } =
      await import("../customerStore");
    await reloadedStore.persist.rehydrate();

    expect(reloadedStore.getState().customers).toEqual([
      expect.objectContaining({
        name: "Reloaded Synthetic",
        email: "reload@example.invalid",
      }),
    ]);
  });
});
