import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const CUSTOMER_KEY = "open3dcalc_beta_test_customers_v1";
const QUOTE_KEY = "open3dcalc_beta_test_quotes_v1";
const HISTORY_KEY = "open3dcalc_beta_test_history_v1";

function persistEnvelope(state: unknown): string {
  return JSON.stringify({ state, version: 1 });
}

describe("Beta store persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => vi.restoreAllMocks());

  it("hydrates customer, quote snapshot, and complete history from exact Beta keys", async () => {
    const customer = {
      id: "synthetic-customer-01",
      name: "Example Customer",
      email: "beta-fixture@example.invalid",
      createdAt: 1,
      updatedAt: 1,
      quoteCount: 1,
    };
    const customerSnapshot = {
      name: customer.name,
      email: customer.email,
      phone: "555-0100",
    };
    const historySnapshot = {
      type: "fdm",
      summary: "Synthetic print",
      printerId: "synthetic-printer-01",
      inputs: { weight: 12 },
    };
    const quote = {
      id: "synthetic-quote-01",
      number: 1,
      title: "Synthetic quote",
      customerId: customer.id,
      customerSnapshot,
      items: [{ name: "Synthetic print", quantity: 1, unitPrice: 12.5 }],
      globalDiscountPercent: 0,
      subtotal: 12.5,
      discountAmount: 0,
      total: 12.5,
      status: "draft",
      createdAt: 1,
      updatedAt: 1,
    };
    const history = {
      id: "synthetic-history-01",
      timestamp: 1,
      type: "fdm",
      name: "Synthetic print",
      summary: "Synthetic print",
      totalCost: 3.25,
      sellPrice: 12.5,
      profit: 9.25,
      result: { totalCost: 3.25 },
      snapshot: historySnapshot,
    };

    window.localStorage.setItem(
      CUSTOMER_KEY,
      persistEnvelope({ customers: [customer], searchQuery: "" }),
    );
    window.localStorage.setItem(
      HISTORY_KEY,
      persistEnvelope({
        entries: [history],
        search: "",
        sortBy: "date",
        sortOrder: "desc",
        filterType: "all",
        dateFrom: null,
        dateTo: null,
      }),
    );
    window.localStorage.setItem(
      QUOTE_KEY,
      persistEnvelope({
        quotes: [quote],
        nextNumber: 2,
        searchQuery: "",
        statusFilter: "all",
      }),
    );

    const gate = await import("@/shared/lib/manifestGate");
    gate.resetManifestForTests(undefined);
    const { useCustomerStore } = await import("../customerStore");
    const { useHistoryStore } = await import("../historyStore");
    const { useQuoteStore } = await import("../quoteStore");

    await useCustomerStore.persist.rehydrate();
    await useHistoryStore.persist.rehydrate();
    await useQuoteStore.persist.rehydrate();

    expect(useCustomerStore.getState().customers).toEqual([customer]);
    expect(useQuoteStore.getState().quotes[0].customerSnapshot).toEqual(
      customerSnapshot,
    );
    expect(useHistoryStore.getState().entries[0]).toEqual(history);

    useQuoteStore.getState().setQuoteStatus(quote.id, "approved");
    expect(
      JSON.parse(window.localStorage.getItem(QUOTE_KEY) ?? "{}").state.quotes[0]
        .customerSnapshot,
    ).toEqual(customerSnapshot);
  });

  it("saves a synthetic customer without consent or a vault password", async () => {
    const gate = await import("@/shared/lib/manifestGate");
    gate.resetManifestForTests(undefined);
    const { useCustomerStore } = await import("../customerStore");

    await useCustomerStore.persist.rehydrate();
    const customerId = useCustomerStore.getState().addCustomer({
      name: "Synthetic Customer",
      company: "Example Workshop",
      email: "customer@example.invalid",
      phone: "555-0100",
      address: "1 Example Way",
      notes: "synthetic test data",
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(CUSTOMER_KEY) ?? "{}",
    ) as { state?: { customers?: Array<{ id: string; email?: string }> } };
    expect(persisted.state?.customers).toContainEqual(
      expect.objectContaining({
        id: customerId,
        email: "customer@example.invalid",
      }),
    );
    expect(window.localStorage.getItem("open3dcalc_consent_v1")).toBeNull();
    expect(window.localStorage.getItem("open3dcalc_vault_hint")).toBeNull();
  });

  it("reports malformed data and refuses to overwrite it with empty defaults", async () => {
    const malformed = "{malformed synthetic Beta data";
    window.localStorage.setItem(CUSTOMER_KEY, malformed);
    const gate = await import("@/shared/lib/manifestGate");
    gate.resetManifestForTests(undefined);
    const { useCustomerStore } = await import("../customerStore");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await useCustomerStore.persist.rehydrate();

    expect(errorLog).toHaveBeenCalledWith(
      `[betaPersistence] malformed data for "${CUSTOMER_KEY}"`,
    );
    expect(() =>
      useCustomerStore.getState().addCustomer({
        name: "Synthetic User",
        company: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      }),
    ).toThrow(/refusing write before readable hydration/);
    expect(window.localStorage.getItem(CUSTOMER_KEY)).toBe(malformed);
  });

  it("reports unavailable localStorage and does not claim a durable write", async () => {
    const gate = await import("@/shared/lib/manifestGate");
    gate.resetManifestForTests(undefined);
    const { useCustomerStore } = await import("../customerStore");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("synthetic storage unavailable", "SecurityError");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await useCustomerStore.persist.rehydrate();

    expect(errorLog).toHaveBeenCalledWith(
      `[betaPersistence] failed to read "${CUSTOMER_KEY}"`,
      expect.any(DOMException),
    );
    expect(() =>
      useCustomerStore.getState().addCustomer({
        name: "Synthetic User",
        company: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      }),
    ).toThrow(/refusing write before readable hydration/);
  });
});
