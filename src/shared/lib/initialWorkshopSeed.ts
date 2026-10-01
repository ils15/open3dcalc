import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useProductInventory } from "@/shared/stores/productInventory";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import {
  DEMO_SPOOLS,
  DEMO_CUSTOMERS,
  DEMO_QUOTES,
  DEMO_PRODUCTS,
  buildDemoHistoryEntries,
} from "./demoDataset";

/**
 * Initializes the workshop with the default studio dataset from the
 * screenshots if the store has no existing records.
 */
export function seedDefaultStudioDataIfEmpty(): void {
  try {
    const historyStore = useHistoryStore.getState();
    const filamentStore = useFilamentInventory.getState();

    if (
      historyStore.entries.length === 0 &&
      filamentStore.spools.length === 0
    ) {
      // 1. Spools
      for (const spool of DEMO_SPOOLS) {
        // The seed is already the store's input shape (id/dateAdded are
        // generated inside addSpool), so it is forwarded as-is.
        filamentStore.addSpool(spool);
      }

      // 2. History entries
      const entries = buildDemoHistoryEntries();
      for (const entry of entries) {
        historyStore.addEntry(entry);
      }

      // 3. Customers
      const customerStore = useCustomerStore.getState();
      const customerIds: string[] = [];
      for (const customer of DEMO_CUSTOMERS) {
        const id = customerStore.addCustomer(customer);
        customerIds.push(id);
      }

      // 4. Products
      const productStore = useProductInventory.getState();
      for (const product of DEMO_PRODUCTS) {
        productStore.addProduct(product);
      }

      // 5. Quotes
      const quoteStore = useQuoteStore.getState();
      // `customerSnapshot` belongs to the stored Quote, not to QuoteFormData, so
      // the link is written through updateQuote — the same two-step the demo
      // dataset loader uses.
      DEMO_QUOTES.forEach((seed, i) => {
        const custId = customerIds[i % customerIds.length];
        const cust = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];
        const quoteId = quoteStore.addQuote(seed.form);
        quoteStore.updateQuote(quoteId, {
          customerId: custId,
          customerSnapshot: {
            name: cust.name,
            company: cust.company || undefined,
            email: cust.email || undefined,
            phone: cust.phone || undefined,
          },
        });
      });

      // 6. Set initial calculator preset: "Suporte Articulado Dobrável" (TPU 95A Laranja, 55g, 54m)
      const calcStore = useCalculatorStore.getState();
      calcStore.setProductName("Suporte Articulado Dobrável");
      calcStore.setActiveTab("fdm");
      calcStore.setFdmMaterial({
        ...calcStore.fdmMaterial,
        type: "tpu_95a",
        costPerKg: 90,
        weightUsed: 55,
      });
      calcStore.setFdmPrintParams({
        ...calcStore.fdmPrintParams,
        printTimeHours: 54 / 60,
        printerPowerWatts: 250,
        energyCostPerKwh: 0.95,
      });
      calcStore.setFdmSales({
        ...calcStore.fdmSales,
        packagingCost: 2.2,
        profitMarginPercent: 100,
      });
      calcStore.setFdmLabor({ ...calcStore.fdmLabor, hourlyRate: 25 });

      // 7. Set default layout mode to Bento (Modern Studio Dashboard)
      const layoutStore = useLayoutStore.getState();
      layoutStore.setLayoutMode("bento");
    }
  } catch (err) {
    console.warn("[seedDefaultStudioDataIfEmpty] Error seeding data:", err);
  }
}
