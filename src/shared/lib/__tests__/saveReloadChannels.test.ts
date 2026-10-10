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

// Synthetic persisted envelopes using the Stable v1.14 wire names and
// Zustand versions. These cover the three PII stores that must keep loading
// old local data after an application upgrade; no real customer data belongs
// in compatibility fixtures.
const STABLE_V1_14_PII_FIXTURES = {
  [CUSTOMER_KEY]: JSON.stringify({
    state: {
      customers: [
        {
          id: "stable-v114-customer",
          name: "Example Customer",
          company: "Example Workshop",
          email: "customer@example.invalid",
          phone: "555-0101",
          address: "1 Example Street",
          notes: "synthetic v1.14 fixture",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
          quoteCount: 1,
        },
      ],
      searchQuery: "",
    },
    version: 1,
  }),
  open3dcalc_quotes_v1: JSON.stringify({
    state: {
      quotes: [
        {
          id: "stable-v114-quote",
          number: 1,
          title: "Example Quote",
          customerId: "stable-v114-customer",
          customerSnapshot: {
            name: "Example Customer",
            company: "Example Workshop",
            email: "customer@example.invalid",
            phone: "555-0101",
          },
          items: [
            {
              historyEntryId: "stable-v114-history",
              name: "Example Print",
              quantity: 1,
              unitPrice: 12.5,
              totalPrice: 12.5,
              discountPercent: 0,
            },
          ],
          globalDiscountPercent: 0,
          subtotal: 12.5,
          discountAmount: 0,
          total: 12.5,
          status: "draft",
          validUntil: "2026-12-31",
          paymentTerms: "On delivery",
          deliveryEstimate: "3 days",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        },
      ],
      nextNumber: 2,
      searchQuery: "",
      statusFilter: "all",
    },
    version: 1,
  }),
  open3dcalc_history_v2: JSON.stringify({
    state: {
      entries: [
        {
          id: "stable-v114-history",
          timestamp: 1_700_000_000_000,
          type: "fdm",
          name: "Example Print",
          summary: "PLA, 12 g",
          totalCost: 3.25,
          sellPrice: 12.5,
          profit: 9.25,
          result: {
            materialCost: 1,
            energyCost: 0.25,
            machineCost: 1,
            hardwareCost: 0,
            consumablesCost: 0,
            laborCost: 1,
            softwareCost: 0,
            failureCost: 0,
            extrasCost: 0,
            postProcessingCost: 0,
            subtotal: 3.25,
            totalCost: 3.25,
            sellPrice: 12.5,
            profit: 9.25,
            marketplaceFee: 0,
            taxAmount: 0,
            costPerGram: 0.27,
            costPerUnit: 3.25,
            unitWeight: 12,
            estimatedPrintTime: 1,
            targetMarginPercent: 0.5,
            breakEvenPrice: 3.25,
            actualMargin: 0.74,
            carbonFootprintGrams: 0,
          },
          snapshot: null,
        },
      ],
      search: "",
      sortBy: "date",
      sortOrder: "desc",
      filterType: "all",
      dateFrom: null,
      dateTo: null,
    },
    version: 2,
  }),
} as const;

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

  it("preserves v1.14 Stable customer, quote, and history data across write and reload", async () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    for (const [key, value] of Object.entries(STABLE_V1_14_PII_FIXTURES)) {
      window.localStorage.setItem(key, value);
    }

    const { resetManifestForTests } = await import("@/shared/lib/manifestGate");
    resetManifestForTests(undefined);
    const [{ useCustomerStore }, { useHistoryStore }, { useQuoteStore }] =
      await Promise.all([
        import("@/shared/stores/customerStore"),
        import("@/shared/stores/historyStore"),
        import("@/shared/stores/quoteStore"),
      ]);

    await Promise.all([
      useCustomerStore.persist.rehydrate(),
      useHistoryStore.persist.rehydrate(),
      useQuoteStore.persist.rehydrate(),
    ]);

    expect(useCustomerStore.getState().customers[0]?.id).toBe(
      "stable-v114-customer",
    );
    expect(useQuoteStore.getState().quotes[0]?.customerSnapshot?.email).toBe(
      "customer@example.invalid",
    );
    expect(useHistoryStore.getState().entries[0]?.id).toBe(
      "stable-v114-history",
    );

    useCustomerStore.getState().addCustomer({
      name: "Another Example",
      company: "",
      email: "another@example.invalid",
      phone: "",
      address: "",
      notes: "",
    });
    useQuoteStore.getState().setQuoteStatus("stable-v114-quote", "sent");
    useHistoryStore.getState().setSearch("Example Print");

    for (const [key, original] of Object.entries(STABLE_V1_14_PII_FIXTURES)) {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
        version?: number;
        state?: Record<string, unknown>;
      } | null;
      expect(saved?.state).toBeDefined();
      expect(saved?.version).toBe(JSON.parse(original).version);
      expect(JSON.stringify(saved?.state)).toContain("stable-v114-");
    }

    vi.resetModules();
    const { resetManifestForTests: resetAfterReload } =
      await import("@/shared/lib/manifestGate");
    resetAfterReload(undefined);
    const [
      { useCustomerStore: reloadedCustomers },
      { useHistoryStore: reloadedHistory },
      { useQuoteStore: reloadedQuotes },
    ] = await Promise.all([
      import("@/shared/stores/customerStore"),
      import("@/shared/stores/historyStore"),
      import("@/shared/stores/quoteStore"),
    ]);
    await Promise.all([
      reloadedCustomers.persist.rehydrate(),
      reloadedHistory.persist.rehydrate(),
      reloadedQuotes.persist.rehydrate(),
    ]);

    expect(reloadedCustomers.getState().customers).toHaveLength(2);
    expect(reloadedCustomers.getState().customers[0]).toMatchObject({
      id: "stable-v114-customer",
      address: "1 Example Street",
      notes: "synthetic v1.14 fixture",
    });
    expect(reloadedHistory.getState().entries[0]).toMatchObject({
      id: "stable-v114-history",
      summary: "PLA, 12 g",
      result: { materialCost: 1, unitWeight: 12 },
      snapshot: null,
    });
    expect(reloadedQuotes.getState().quotes[0]).toMatchObject({
      id: "stable-v114-quote",
      status: "sent",
      customerSnapshot: {
        name: "Example Customer",
        email: "customer@example.invalid",
      },
      items: [{ historyEntryId: "stable-v114-history", totalPrice: 12.5 }],
    });
  });
});
