import { describe, it, expect, beforeEach } from "vitest";
import { useQuoteStore } from "../quoteStore";
import type { QuoteFormData } from "@/shared/types";

function validFormData(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
  return {
    title: "Orçamento Teste",
    items: [
      {
        historyEntryId: "hist_1",
        name: "Item A",
        quantity: 2,
        unitPrice: 50,
        discountPercent: 0,
      },
      {
        historyEntryId: "hist_2",
        name: "Item B",
        quantity: 1,
        unitPrice: 100,
        discountPercent: 10,
      },
    ],
    globalDiscountPercent: 5,
    validUntil: "2026-07-28",
    paymentTerms: "30 dias",
    deliveryEstimate: "5 dias úteis",
    footerNote: "Obrigado pela preferência!",
    ...overrides,
  };
}

describe("useQuoteStore (integration)", () => {
  beforeEach(() => {
    localStorage.clear();
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
  });

  // ── addQuote ──────────────────────────────────────────────────
  it("addQuote() → quote appears in the list with correct number and id", () => {
    const id = useQuoteStore.getState().addQuote(validFormData());
    const { quotes } = useQuoteStore.getState();

    expect(quotes).toHaveLength(1);
    expect(quotes[0].id).toBe(id);
    expect(quotes[0].number).toBe(1);
    expect(quotes[0].title).toBe("Orçamento Teste");
    expect(quotes[0].status).toBe("draft");
    expect(quotes[0].createdAt).toBeGreaterThan(0);
    expect(quotes[0].updatedAt).toBe(quotes[0].createdAt);
  });

  it("addQuote() auto-increments the number each quote", () => {
    useQuoteStore.getState().addQuote(validFormData({ title: "First" }));
    useQuoteStore.getState().addQuote(validFormData({ title: "Second" }));
    useQuoteStore.getState().addQuote(validFormData({ title: "Third" }));

    const { quotes } = useQuoteStore.getState();
    expect(quotes).toHaveLength(3);
    expect(quotes.find((q) => q.title === "First")!.number).toBe(1);
    expect(quotes.find((q) => q.title === "Second")!.number).toBe(2);
    expect(quotes.find((q) => q.title === "Third")!.number).toBe(3);
    expect(useQuoteStore.getState().nextNumber).toBe(4);
  });

  it("addQuote() with items calculates subtotal correctly", () => {
    // The caller is the price authority: `QuoteFormData.items` carries the
    // unitPrice the user typed, so the store prices the quote from it. This
    // test used to assert the opposite (`subtotal === 0`, names "Item #N"),
    // which certified the bug where every new quote was born worth R$ 0,00.
    // Items: 2 units of item A (unitPrice 50) + 1 unit of item B (unitPrice 100)
    // subtotal = 2*50 + 1*100 = 200
    // discountAmount = 200 * 0.05 = 10
    // total = 200 - 10 = 190
    const id = useQuoteStore.getState().addQuote(validFormData());
    const quote = useQuoteStore.getState().getQuote(id)!;

    expect(quote.items).toHaveLength(2);
    expect(quote.items[0].historyEntryId).toBe("hist_1");
    expect(quote.items[0].quantity).toBe(2);
    expect(quote.items[0].name).toBe("Item A");
    expect(quote.items[0].unitPrice).toBe(50);
    expect(quote.items[1].historyEntryId).toBe("hist_2");
    expect(quote.items[1].name).toBe("Item B");
    expect(quote.subtotal).toBe(200);
    expect(quote.discountAmount).toBe(10);
    expect(quote.total).toBe(190);
  });

  it('addQuote() never labels an item "Item #N" — the name is what was typed', () => {
    const id = useQuoteStore.getState().addQuote(validFormData());
    const quote = useQuoteStore.getState().getQuote(id)!;

    expect(quote.items.map((i) => i.name)).not.toContain("Item #1");
    expect(quote.items.map((i) => i.name)).not.toContain("Item #2");
  });

  it("addQuote() computes totalPrice from the caller price minus the item discount", () => {
    const data = validFormData({
      items: [
        {
          historyEntryId: "hist_1",
          name: "Item A",
          quantity: 2,
          unitPrice: 100,
          discountPercent: 10,
        },
      ],
    });
    const id = useQuoteStore.getState().addQuote(data);
    const quote = useQuoteStore.getState().getQuote(id)!;

    // 2 * 100 = 200, less 10% => 180
    expect(quote.items[0].totalPrice).toBe(180);
  });

  it("addQuote() carries the customer snapshot the caller supplied", () => {
    const data = validFormData({
      customerId: "cust_1",
      customerSnapshot: { name: "Loja Artes Analíticas", company: "LAA" },
    });
    const quote = useQuoteStore
      .getState()
      .getQuote(useQuoteStore.getState().addQuote(data))!;

    expect(quote.customerSnapshot).toEqual({
      name: "Loja Artes Analíticas",
      company: "LAA",
    });
    expect(quote.customerId).toBe("cust_1");
  });

  it("addQuote() honours a caller-supplied status instead of forcing draft", () => {
    const quote = useQuoteStore
      .getState()
      .getQuote(
        useQuoteStore.getState().addQuote(validFormData({ status: "sent" })),
      )!;

    expect(quote.status).toBe("sent");
  });

  it("addQuote() defaults to draft when the caller supplies no status", () => {
    const quote = useQuoteStore
      .getState()
      .getQuote(useQuoteStore.getState().addQuote(validFormData()))!;

    expect(quote.status).toBe("draft");
  });

  it("addQuote() with globalDiscountPercent calculates discounts correctly", () => {
    const data = validFormData({ globalDiscountPercent: 10 });
    const id = useQuoteStore.getState().addQuote(data);
    const quote = useQuoteStore.getState().getQuote(id)!;

    expect(quote.globalDiscountPercent).toBe(10);
  });

  it("addQuote() with empty items creates quote with zero totals", () => {
    const data = validFormData({ items: [] });
    const id = useQuoteStore.getState().addQuote(data);
    const quote = useQuoteStore.getState().getQuote(id)!;

    expect(quote.items).toHaveLength(0);
    expect(quote.subtotal).toBe(0);
    expect(quote.discountAmount).toBe(0);
    expect(quote.total).toBe(0);
  });

  it("addQuote() generates ID in format quote_{timestamp}_{random5}", () => {
    const id = useQuoteStore.getState().addQuote(validFormData());
    expect(id).toMatch(/^quote_\d+_[a-z0-9]{5}$/);
  });

  // ── updateQuote ──────────────────────────────────────────────
  it("updateQuote() modifies quote fields", () => {
    const id = useQuoteStore.getState().addQuote(validFormData());
    const original = useQuoteStore.getState().getQuote(id)!;
    const originalUpdatedAt = original.updatedAt;

    useQuoteStore.getState().updateQuote(id, {
      title: "Título Atualizado",
      globalDiscountPercent: 15,
      footerNote: "Nota atualizada",
    });

    const updated = useQuoteStore.getState().getQuote(id)!;
    expect(updated.title).toBe("Título Atualizado");
    expect(updated.globalDiscountPercent).toBe(15);
    expect(updated.footerNote).toBe("Nota atualizada");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it("updateQuote() with non-existent id does nothing", () => {
    useQuoteStore.getState().addQuote(validFormData());
    expect(useQuoteStore.getState().quotes).toHaveLength(1);

    useQuoteStore.getState().updateQuote("nonexistent", { title: "Nope" });
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
    expect(useQuoteStore.getState().quotes[0].title).toBe("Orçamento Teste");
  });

  // ── removeQuote ──────────────────────────────────────────────
  it("removeQuote() → quote is removed from the list", () => {
    const id1 = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "One" }));
    useQuoteStore.getState().addQuote(validFormData({ title: "Two" }));
    expect(useQuoteStore.getState().quotes).toHaveLength(2);

    useQuoteStore.getState().removeQuote(id1);
    const { quotes } = useQuoteStore.getState();

    expect(quotes).toHaveLength(1);
    expect(quotes[0].title).toBe("Two");
  });

  it("removeQuote() with non-existent id does nothing", () => {
    useQuoteStore.getState().addQuote(validFormData());
    expect(useQuoteStore.getState().quotes).toHaveLength(1);

    useQuoteStore.getState().removeQuote("nonexistent");
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
  });

  // ── getQuote ──────────────────────────────────────────────────
  it("getQuote() returns quote by ID", () => {
    const id = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Find Me" }));
    const quote = useQuoteStore.getState().getQuote(id);

    expect(quote).toBeDefined();
    expect(quote!.id).toBe(id);
    expect(quote!.title).toBe("Find Me");
  });

  it("getQuote() returns undefined for non-existent ID", () => {
    useQuoteStore.getState().addQuote(validFormData());
    const quote = useQuoteStore.getState().getQuote("nonexistent");
    expect(quote).toBeUndefined();
  });

  // ── getQuotesByCustomer ──────────────────────────────────────
  it("getQuotesByCustomer() returns quotes for a specific customer", () => {
    const custId = "cust_12345";
    useQuoteStore.getState().addQuote(
      validFormData({
        title: "Quote A",
        customerId: custId,
      }),
    );
    useQuoteStore.getState().addQuote(
      validFormData({
        title: "Quote B",
        customerId: custId,
      }),
    );
    useQuoteStore.getState().addQuote(
      validFormData({
        title: "Quote C",
        customerId: "other_cust",
      }),
    );

    const customerQuotes = useQuoteStore.getState().getQuotesByCustomer(custId);
    expect(customerQuotes).toHaveLength(2);
    expect(customerQuotes.map((q) => q.title).sort()).toEqual([
      "Quote A",
      "Quote B",
    ]);
  });

  it("getQuotesByCustomer() returns empty for customer with no quotes", () => {
    const result = useQuoteStore.getState().getQuotesByCustomer("nonexistent");
    expect(result).toHaveLength(0);
  });

  // ── setQuoteStatus ───────────────────────────────────────────
  it("setQuoteStatus() changes status", () => {
    const id = useQuoteStore.getState().addQuote(validFormData());
    expect(useQuoteStore.getState().getQuote(id)!.status).toBe("draft");

    useQuoteStore.getState().setQuoteStatus(id, "sent");
    expect(useQuoteStore.getState().getQuote(id)!.status).toBe("sent");

    useQuoteStore.getState().setQuoteStatus(id, "approved");
    expect(useQuoteStore.getState().getQuote(id)!.status).toBe("approved");

    useQuoteStore.getState().setQuoteStatus(id, "rejected");
    expect(useQuoteStore.getState().getQuote(id)!.status).toBe("rejected");
  });

  it("setQuoteStatus() with non-existent id does nothing", () => {
    useQuoteStore.getState().setQuoteStatus("nonexistent", "sent");
    expect(useQuoteStore.getState().quotes).toHaveLength(0);
  });

  // ── exportQuotes ──────────────────────────────────────────────
  it("exportQuotes() returns valid JSON string with correct structure", () => {
    useQuoteStore.getState().addQuote(validFormData({ title: "Export Test" }));

    const json = useQuoteStore.getState().exportQuotes();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe("1.0");
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.quotes).toHaveLength(1);
    expect(parsed.quotes[0].title).toBe("Export Test");
  });

  // ── importQuotes ──────────────────────────────────────────────
  it("importQuotes() merges without duplicating existing ids", () => {
    const existingId = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Original" }));

    const importPayload = {
      quotes: [
        {
          id: existingId,
          number: 1,
          title: "Original",
          customerId: undefined,
          customerSnapshot: undefined,
          items: [],
          globalDiscountPercent: 0,
          subtotal: 0,
          discountAmount: 0,
          total: 0,
          status: "draft" as const,
          validUntil: "2026-07-28",
          paymentTerms: "30 dias",
          deliveryEstimate: "5 dias úteis",
          footerNote: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "quote_2000000000_abcde",
          number: 2,
          title: "New Import",
          customerId: undefined,
          customerSnapshot: undefined,
          items: [],
          globalDiscountPercent: 0,
          subtotal: 0,
          discountAmount: 0,
          total: 0,
          status: "draft" as const,
          validUntil: "2026-07-28",
          paymentTerms: "30 dias",
          deliveryEstimate: "5 dias úteis",
          footerNote: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const result = useQuoteStore
      .getState()
      .importQuotes(JSON.stringify(importPayload));

    expect(result.skipped).toBe(1); // the duplicate
    expect(result.imported).toBe(1); // the new one
    expect(useQuoteStore.getState().quotes).toHaveLength(2);
    expect(
      useQuoteStore
        .getState()
        .quotes.map((q) => q.title)
        .sort(),
    ).toEqual(["New Import", "Original"]);
  });

  it("importQuotes() with invalid JSON returns 0 imported", () => {
    const result = useQuoteStore.getState().importQuotes("not valid json");
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("importQuotes() with payload without quotes returns 0", () => {
    const result = useQuoteStore.getState().importQuotes(JSON.stringify({}));
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });

  // ── getFilteredQuotes ─────────────────────────────────────────
  it("getFilteredQuotes() filters by searchQuery (title)", () => {
    useQuoteStore.getState().addQuote(validFormData({ title: "Benchy 3D" }));
    useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Vase Decorativo" }));
    useQuoteStore.getState().addQuote(validFormData({ title: "Benchy V2" }));

    useQuoteStore.getState().setSearchQuery("benchy");
    const filtered = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered).toHaveLength(2);

    useQuoteStore.getState().setSearchQuery("vase");
    const filtered2 = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered2).toHaveLength(1);
  });

  it("getFilteredQuotes() filters by statusFilter", () => {
    const id1 = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Draft Quote" }));
    useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Another Draft" }));
    const id3 = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Sent Quote" }));

    useQuoteStore.getState().setQuoteStatus(id1, "sent");
    useQuoteStore.getState().setQuoteStatus(id3, "sent");

    useQuoteStore.getState().setStatusFilter("sent");
    const filtered = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered).toHaveLength(2);

    useQuoteStore.getState().setStatusFilter("draft");
    const filtered2 = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered2).toHaveLength(1);
  });

  it('getFilteredQuotes() with statusFilter "all" returns all', () => {
    useQuoteStore.getState().addQuote(validFormData());
    useQuoteStore.getState().addQuote(validFormData());

    useQuoteStore.getState().setStatusFilter("all");
    const filtered = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered).toHaveLength(2);
  });

  it("getFilteredQuotes() combines search + status filter", () => {
    const id = useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Special Quote" }));
    useQuoteStore
      .getState()
      .addQuote(validFormData({ title: "Special Draft" }));
    useQuoteStore.getState().addQuote(validFormData({ title: "Other Quote" }));

    useQuoteStore.getState().setQuoteStatus(id, "sent");

    useQuoteStore.getState().setSearchQuery("special");
    useQuoteStore.getState().setStatusFilter("sent");
    const filtered = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Special Quote");
  });

  it("getFilteredQuotes() with empty quotes returns empty array", () => {
    useQuoteStore.getState().setSearchQuery("");
    useQuoteStore.getState().setStatusFilter("all");
    const filtered = useQuoteStore.getState().getFilteredQuotes();
    expect(filtered).toEqual([]);
  });

  // ── setSearchQuery / setStatusFilter ──────────────────────────
  it("setSearchQuery() updates searchQuery", () => {
    expect(useQuoteStore.getState().searchQuery).toBe("");
    useQuoteStore.getState().setSearchQuery("benchy");
    expect(useQuoteStore.getState().searchQuery).toBe("benchy");
    useQuoteStore.getState().setSearchQuery("");
    expect(useQuoteStore.getState().searchQuery).toBe("");
  });

  it("setStatusFilter() updates statusFilter", () => {
    expect(useQuoteStore.getState().statusFilter).toBe("all");
    useQuoteStore.getState().setStatusFilter("sent");
    expect(useQuoteStore.getState().statusFilter).toBe("sent");
    useQuoteStore.getState().setStatusFilter("draft");
    expect(useQuoteStore.getState().statusFilter).toBe("draft");
    useQuoteStore.getState().setStatusFilter("approved");
    expect(useQuoteStore.getState().statusFilter).toBe("approved");
    useQuoteStore.getState().setStatusFilter("rejected");
    expect(useQuoteStore.getState().statusFilter).toBe("rejected");
    useQuoteStore.getState().setStatusFilter("all");
    expect(useQuoteStore.getState().statusFilter).toBe("all");
  });

  // ── calculateTotals ───────────────────────────────────────────
  it("calculateTotals() computes subtotal, discountAmount and total correctly", () => {
    const items = [
      {
        historyEntryId: "a",
        name: "Item A",
        quantity: 2,
        unitPrice: 100,
        totalPrice: 0,
        discountPercent: 0,
      },
      {
        historyEntryId: "b",
        name: "Item B",
        quantity: 3,
        unitPrice: 50,
        totalPrice: 0,
        discountPercent: 0,
      },
    ];
    // item totalPrice = 2*100 = 200, 3*50 = 150
    // subtotal = 200 + 150 = 350
    // discountAmount = 350 * 0.10 = 35
    // total = 350 - 35 = 315
    const result = useQuoteStore.getState().calculateTotals(items, 10);
    expect(result.subtotal).toBe(350);
    expect(result.discountAmount).toBe(35);
    expect(result.total).toBe(315);
  });

  it("calculateTotals() with empty items returns zeros", () => {
    const result = useQuoteStore.getState().calculateTotals([], 10);
    expect(result.subtotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("calculateTotals() with discount 0 returns total = subtotal", () => {
    const items = [
      {
        historyEntryId: "a",
        name: "Item A",
        quantity: 5,
        unitPrice: 20,
        totalPrice: 0,
        discountPercent: 0,
      },
    ];
    const result = useQuoteStore.getState().calculateTotals(items, 0);
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(100);
  });

  it("addQuote() with items with individual discountPercent calculates item totalPrice", () => {
    const data = validFormData({
      items: [
        {
          historyEntryId: "hist_1",
          name: "Item A",
          quantity: 2,
          unitPrice: 100,
          discountPercent: 10,
        },
      ],
    });
    const id = useQuoteStore.getState().addQuote(data);
    const quote = useQuoteStore.getState().getQuote(id)!;
    expect(quote.items[0].discountPercent).toBe(10);
    expect(quote.items[0].totalPrice).toBe(180);
  });
});
