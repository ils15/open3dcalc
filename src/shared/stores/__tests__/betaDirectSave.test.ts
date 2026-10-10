import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

async function resetProfile(): Promise<void> {
  vi.resetModules();
  const { resetManifestForTests } = await import("@/shared/lib/manifestGate");
  resetManifestForTests(undefined);
}

describe("Beta real local user data", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await resetProfile();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves and reloads customers through the shared local key", async () => {
    const { useCustomerStore } = await import("@/shared/stores/customerStore");
    const email = "maria@example.invalid";
    const name = "Maria Cliente";

    useCustomerStore.getState().addCustomer({
      name,
      company: "Oficina 3D",
      email,
      phone: "555-0100",
      address: "Rua Um, 10",
      notes: "Cliente real do perfil local",
    });

    const raw = window.localStorage.getItem("open3dcalc_customers_v1");
    expect(raw).toContain(name);
    expect(raw).toContain(email);
    expect(
      window.localStorage.getItem("open3dcalc_beta_test_customers_v1"),
    ).toBeNull();

    await resetProfile();
    const reopened = await import("@/shared/stores/customerStore");
    expect(reopened.useCustomerStore.getState().customers).toEqual([
      expect.objectContaining({ name, email }),
    ]);
  });

  it("migrates Beta V1 history into the shared V2 key before store hydration", async () => {
    const legacy = JSON.stringify({
      state: {
        entries: [
          {
            id: "history-v1-01",
            timestamp: 1,
            type: "fdm",
            name: "Suporte de teste",
            summary: "PLA, 20g",
            totalCost: 2,
            sellPrice: 5,
            profit: 3,
            result: { totalCost: 2 },
          },
        ],
      },
      version: 1,
    });
    window.localStorage.setItem("open3dcalc_beta_test_history_v1", legacy);

    const { useHistoryStore } = await import("@/shared/stores/historyStore");

    expect(useHistoryStore.getState().entries).toEqual([
      expect.objectContaining({
        id: "history-v1-01",
        name: "Suporte de teste",
      }),
    ]);
    const current = JSON.parse(
      window.localStorage.getItem("open3dcalc_history_v2") ?? "null",
    ) as { version: number };
    expect(current.version).toBe(2);
    expect(
      window.localStorage.getItem("open3dcalc_beta_test_history_v1"),
    ).toBeNull();
  });
});
