/**
 * Modo demo (onboarding Fase 0) — "Estúdio Maria Print".
 *
 * Modo efêmero: aplica um dataset ficcional chamando SOMENTE ações
 * existentes das stores (addSpool, addEntry, addCustomer, addQuote,
 * loadHistoryItem, setSelectedPrinter…), de forma que toda validação,
 * migração e derivação interna continua rodando — zero bypass de lógica.
 *
 * `enter()` tira um snapshot in-memory completo do estado anterior e
 * `exit()` restaura byte-a-byte. Nenhuma chave nova é registrada no
 * manifest SPEC-01 e nenhuma migration roda: as escritas são suprimidas
 * no choke point do `manifestStorage`, então SQLite/localStorage ficam
 * intocados (LGPD: dado efêmero não é dado pessoal tratado).
 */

import { create } from "zustand";

import { getMarketplace } from "@/shared/lib/marketplace";
import { getPrinter } from "@/shared/lib/printers";
import { setDemoPersistenceSuppressed } from "@/shared/lib/manifestStorage";
import {
  DEMO_CALCULATOR,
  DEMO_CUSTOMERS,
  DEMO_MARKETPLACE_ID,
  DEMO_PRINTER_IDS,
  DEMO_PRODUCTS,
  DEMO_QUOTES,
  DEMO_SPOOLS,
  buildDemoHistoryEntries,
} from "@/shared/lib/demoDataset";
import { useCalculatorStore } from "./calculatorStore";
import { useCustomerStore } from "./customerStore";
import { useFilamentInventory } from "./filamentInventory";
import { useHistoryStore } from "./historyStore";
import { useProductInventory } from "./productInventory";
import { useQuoteStore } from "./quoteStore";

/** Snapshot completo (dados + ações — refs estáveis) de cada store afetada. */
interface StoreSnapshot {
  calculator: ReturnType<typeof useCalculatorStore.getState>;
  history: ReturnType<typeof useHistoryStore.getState>;
  filament: ReturnType<typeof useFilamentInventory.getState>;
  customers: ReturnType<typeof useCustomerStore.getState>;
  quotes: ReturnType<typeof useQuoteStore.getState>;
  products: ReturnType<typeof useProductInventory.getState>;
}

interface DemoModeState {
  isActive: boolean;
  snapshot: StoreSnapshot | null;
  /** Aplica o dataset demo sobre o estado real (idempotente). */
  enter: () => void;
  /** Restaura o estado anterior byte-a-byte. */
  exit: () => void;
}

function captureSnapshot(): StoreSnapshot {
  return {
    calculator: useCalculatorStore.getState(),
    history: useHistoryStore.getState(),
    filament: useFilamentInventory.getState(),
    customers: useCustomerStore.getState(),
    quotes: useQuoteStore.getState(),
    products: useProductInventory.getState(),
  };
}

function restoreSnapshot(s: StoreSnapshot): void {
  useCalculatorStore.setState(s.calculator);
  useHistoryStore.setState(s.history);
  useFilamentInventory.setState(s.filament);
  useCustomerStore.setState(s.customers);
  useQuoteStore.setState(s.quotes);
  useProductInventory.setState(s.products);
}

/**
 * Aplica o dataset via ações existentes — nenhuma escrita direta de estado
 * além das actions, nenhum bypass de validação/migração.
 */
function applyDemoDataset(): void {
  // calculadora: 1 cálculo FDM + 1 resina water-washable pré-carregados
  const calc = useCalculatorStore.getState();
  calc.loadHistoryItem(DEMO_CALCULATOR);
  calc.setSelectedPrinter(getPrinter(DEMO_PRINTER_IDS[1]));
  calc.setSelectedMarketplace(getMarketplace(DEMO_MARKETPLACE_ID));

  // inventário: 6 bobinas (addSpool gera id/dateAdded internamente)
  const filament = useFilamentInventory.getState();
  for (const spool of DEMO_SPOOLS) filament.addSpool(spool);

  // histórico: entradas com timestamps reais (addEntry honra id/timestamp)
  const history = useHistoryStore.getState();
  for (const entry of buildDemoHistoryEntries()) history.addEntry(entry);

  // CRM: clientes → orçamentos linkados via updateQuote (ação existente)
  const customers = useCustomerStore.getState();
  const customerIds = DEMO_CUSTOMERS.map((c) => customers.addCustomer(c));

  const products = useProductInventory.getState();
  for (const p of DEMO_PRODUCTS) products.addProduct(p);

  const quotes = useQuoteStore.getState();
  for (const seed of DEMO_QUOTES) {
    const quoteId = quotes.addQuote(seed.form);
    const ci = seed.customerIndex;
    if (ci >= 0 && customerIds[ci]) {
      const c = DEMO_CUSTOMERS[ci];
      quotes.updateQuote(quoteId, {
        customerId: customerIds[ci],
        customerSnapshot: {
          name: c.name,
          company: c.company || undefined,
          email: c.email || undefined,
          phone: c.phone || undefined,
        },
      });
      customers.incrementQuoteCount(customerIds[ci]);
    }
  }
}

export const useDemoModeStore = create<DemoModeState>((set, get) => ({
  isActive: false,
  snapshot: null,

  enter: () => {
    // idempotência: já ativo → não re-aplica (não duplica entradas)
    if (get().isActive) return;

    const snapshot = captureSnapshot();
    // suprime escritas ANTES da primeira action e mantém suprimido por toda
    // a sessão demo — o modo é efêmero de ponta a ponta
    setDemoPersistenceSuppressed(true);
    try {
      applyDemoDataset();
    } catch (err) {
      // rollback completo: restaura o estado e libera o lock
      restoreSnapshot(snapshot);
      setDemoPersistenceSuppressed(false);
      throw err;
    }
    set({ isActive: true, snapshot });
  },

  exit: () => {
    if (!get().isActive) {
      setDemoPersistenceSuppressed(false);
      set({ isActive: false, snapshot: null });
      return;
    }
    const { snapshot } = get();
    // restaura com supressão ativa: o restore em si também não persiste
    if (snapshot) restoreSnapshot(snapshot);
    setDemoPersistenceSuppressed(false);
    set({ isActive: false, snapshot: null });
  },
}));
