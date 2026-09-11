import { create } from "zustand";
import { persist } from "zustand/middleware";
import { manifestStorage } from "@/shared/lib/manifestStorage";
import type { Customer, CustomerFormData } from "@/shared/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateId(): string {
  return `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface CustomerStore {
  customers: Customer[];
  searchQuery: string;

  addCustomer: (data: CustomerFormData) => string;
  updateCustomer: (id: string, data: Partial<CustomerFormData>) => void;
  removeCustomer: (id: string) => void;

  getCustomer: (id: string) => Customer | undefined;
  searchCustomers: (query: string) => Customer[];
  getAllCustomers: () => Customer[];

  incrementQuoteCount: (id: string) => void;
  exportCustomers: () => string;
  importCustomers: (json: string) => { imported: number; skipped: number };

  setSearchQuery: (query: string) => void;
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      customers: [],
      searchQuery: "",

      addCustomer: (data) => {
        const name = data.name.trim();
        if (name.length < 2) {
          throw new Error("Name must be at least 2 characters");
        }
        if (data.email && !EMAIL_REGEX.test(data.email)) {
          throw new Error("Invalid email format");
        }

        const now = Date.now();
        const id = generateId();
        const customer: Customer = {
          id,
          name,
          company: data.company || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
          createdAt: now,
          updatedAt: now,
          quoteCount: 0,
        };
        set((state) => ({ customers: [...state.customers, customer] }));
        return id;
      },

      updateCustomer: (id, data) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(data.name !== undefined ? { name: data.name } : {}),
                  ...(data.company !== undefined
                    ? { company: data.company || undefined }
                    : {}),
                  ...(data.email !== undefined
                    ? { email: data.email || undefined }
                    : {}),
                  ...(data.phone !== undefined
                    ? { phone: data.phone || undefined }
                    : {}),
                  ...(data.address !== undefined
                    ? { address: data.address || undefined }
                    : {}),
                  ...(data.notes !== undefined
                    ? { notes: data.notes || undefined }
                    : {}),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        }));
      },

      removeCustomer: (id) =>
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        })),

      getCustomer: (id) => get().customers.find((c) => c.id === id),

      searchCustomers: (query) => {
        const { customers } = get();
        if (!query) return [...customers];
        const q = query.toLowerCase();
        return customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.company && c.company.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)),
        );
      },

      getAllCustomers: () => [...get().customers],

      incrementQuoteCount: (id) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, quoteCount: c.quoteCount + 1 } : c,
          ),
        }));
      },

      exportCustomers: () => {
        return JSON.stringify(
          {
            customers: get().customers,
            version: "1.0",
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      },

      importCustomers: (json) => {
        try {
          const data = JSON.parse(json);
          const incoming = Array.isArray(data.customers) ? data.customers : [];
          let imported = 0;
          let skipped = 0;

          set((state) => {
            const existingIds = new Set(state.customers.map((c) => c.id));
            const newCustomers = incoming
              .flatMap((entry: unknown) => {
                const e = entry as Partial<Customer>;
                if (
                  !e ||
                  typeof e !== "object" ||
                  !e.name ||
                  typeof e.name !== "string" ||
                  e.name.trim().length < 2
                ) {
                  skipped++;
                  return [];
                }
                const now = Date.now();
                const normalized: Customer = {
                  id:
                    typeof e.id === "string" && e.id.trim()
                      ? e.id
                      : generateId(),
                  name: e.name.trim(),
                  company: e.company || undefined,
                  email: e.email || undefined,
                  phone: e.phone || undefined,
                  address: e.address || undefined,
                  notes: e.notes || undefined,
                  createdAt:
                    typeof e.createdAt === "number" ? e.createdAt : now,
                  updatedAt:
                    typeof e.updatedAt === "number" ? e.updatedAt : now,
                  quoteCount:
                    typeof e.quoteCount === "number" ? e.quoteCount : 0,
                };
                return [normalized];
              })
              .filter((c: Customer) => {
                if (existingIds.has(c.id)) {
                  skipped++;
                  return false;
                }
                existingIds.add(c.id);
                imported++;
                return true;
              });
            return { customers: [...state.customers, ...newCustomers] };
          });

          return { imported, skipped };
        } catch {
          return { imported: 0, skipped: 0 };
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: "open3dcalc_customers_v1",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
