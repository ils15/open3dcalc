import { create } from "zustand";
import { persist } from "zustand/middleware";
import { manifestStorage } from "@/shared/lib/manifestStorage";
import type { Quote, QuoteItem, QuoteFormData } from "@/shared/types";

function generateId(): string {
  return `quote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface QuoteStore {
  quotes: Quote[];
  nextNumber: number;
  searchQuery: string;
  statusFilter: "all" | "draft" | "sent" | "approved" | "rejected";

  addQuote: (data: QuoteFormData) => string;
  updateQuote: (id: string, data: Partial<Quote>) => void;
  removeQuote: (id: string) => void;
  getQuote: (id: string) => Quote | undefined;
  getQuotesByCustomer: (customerId: string) => Quote[];
  setQuoteStatus: (id: string, status: Quote["status"]) => void;

  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: QuoteStore["statusFilter"]) => void;
  getFilteredQuotes: () => Quote[];

  exportQuotes: () => string;
  importQuotes: (json: string) => { imported: number; skipped: number };

  calculateTotals: (
    items: Pick<QuoteItem, "quantity" | "unitPrice" | "discountPercent">[],
    globalDiscountPercent: number,
  ) => { subtotal: number; discountAmount: number; total: number };
}

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set, get) => ({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",

      calculateTotals: (items, globalDiscountPercent) => {
        const subtotal = items.reduce((acc, item) => {
          return acc + item.quantity * item.unitPrice;
        }, 0);
        const discountAmount = subtotal * (globalDiscountPercent / 100);
        const total = subtotal - discountAmount;
        return { subtotal, discountAmount, total };
      },

      addQuote: (data) => {
        const { nextNumber } = get();
        const now = Date.now();
        const id = generateId();

        const items: QuoteItem[] = data.items.map((item, idx) => {
          const unitPrice = 0; // will be populated from history sync
          const qty = item.quantity;
          const discPct = item.discountPercent ?? 0;
          const lineTotal = qty * unitPrice;
          const discountedLineTotal = lineTotal * (1 - discPct / 100);
          return {
            historyEntryId: item.historyEntryId,
            name: `Item #${idx + 1}`,
            quantity: qty,
            unitPrice,
            totalPrice: discountedLineTotal,
            discountPercent: discPct,
          };
        });

        const { subtotal, discountAmount, total } = get().calculateTotals(
          items,
          data.globalDiscountPercent,
        );

        const customerSnapshot = undefined;

        const quote: Quote = {
          id,
          number: nextNumber,
          title: data.title,
          customerId: data.customerId,
          customerSnapshot,
          items,
          globalDiscountPercent: data.globalDiscountPercent,
          subtotal,
          discountAmount,
          total,
          status: "draft",
          validUntil: data.validUntil,
          paymentTerms: data.paymentTerms,
          deliveryEstimate: data.deliveryEstimate,
          footerNote: data.footerNote,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          quotes: [...state.quotes, quote],
          nextNumber: state.nextNumber + 1,
        }));

        return id;
      },

      updateQuote: (id, data) => {
        set((state) => ({
          quotes: state.quotes.map((q) =>
            q.id === id ? { ...q, ...data, updatedAt: Date.now() } : q,
          ),
        }));
      },

      removeQuote: (id) =>
        set((state) => ({
          quotes: state.quotes.filter((q) => q.id !== id),
        })),

      getQuote: (id) => get().quotes.find((q) => q.id === id),

      getQuotesByCustomer: (customerId) =>
        get().quotes.filter((q) => q.customerId === customerId),

      setQuoteStatus: (id, status) => {
        set((state) => ({
          quotes: state.quotes.map((q) =>
            q.id === id ? { ...q, status, updatedAt: Date.now() } : q,
          ),
        }));
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setStatusFilter: (filter) => set({ statusFilter: filter }),

      getFilteredQuotes: () => {
        const { quotes, searchQuery, statusFilter } = get();
        let filtered = [...quotes];

        if (statusFilter !== "all") {
          filtered = filtered.filter((q) => q.status === statusFilter);
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (entry) =>
              entry.title.toLowerCase().includes(q) ||
              (entry.customerSnapshot?.name &&
                entry.customerSnapshot.name.toLowerCase().includes(q)),
          );
        }

        return filtered;
      },

      exportQuotes: () => {
        return JSON.stringify(
          {
            quotes: get().quotes,
            version: "1.0",
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      },

      importQuotes: (json) => {
        try {
          const data = JSON.parse(json);
          const incoming = Array.isArray(data.quotes) ? data.quotes : [];
          let imported = 0;
          let skipped = 0;

          set((state) => {
            const existingIds = new Set(state.quotes.map((q) => q.id));
            const newQuotes = incoming
              .flatMap((entry: unknown) => {
                const e = entry as Partial<Quote>;
                if (
                  !e ||
                  typeof e !== "object" ||
                  !e.id ||
                  typeof e.id !== "string"
                ) {
                  skipped++;
                  return [];
                }
                return [e as Quote];
              })
              .filter((q: Quote) => {
                if (existingIds.has(q.id)) {
                  skipped++;
                  return false;
                }
                existingIds.add(q.id);
                imported++;
                return true;
              });
            return { quotes: [...state.quotes, ...newQuotes] };
          });

          return { imported, skipped };
        } catch {
          return { imported: 0, skipped: 0 };
        }
      },
    }),
    {
      name: "open3dcalc_quotes_v1",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
