/**
 * Dataset ficcional do modo demo — "Estúdio Maria Print" (onboarding Fase 0).
 *
 * PURamente DADO tipado: nenhum import de store, nenhuma ação chamada, nenhuma
 * escrita em localStorage/SQLite. O {@link ./demoModeStore.ts} é quem aplica
 * este dataset chamando SOMENTE ações existentes das stores.
 *
 * Os resultados (`CalculationResult`) são derivados pela função PURA
 * `computeStoreResults` (mesma usada pela calculatorStore), então histórico e
 * calculadora são sempre consistentes — não há números mágicos digitados à mão.
 *
 * As impressoras/marketplace são IDS REAIS do catálogo (`printers.ts` /
 * `marketplace.ts`); o demo não adiciona duplicatas ao catálogo.
 *
 * LGPD: o dataset é ficção e o modo é efêmero — nada a inventariar.
 */

import type {
  CalculationResult,
  CalculationSnapshot,
  CustomerFormData,
  HistoryEntry,
  LaborCosts,
  MachineCosts,
  MaterialStateFDM,
  MaterialStateResin,
  PostProcessingResin,
  PrintParameters,
  ProductFormData,
  QuoteFormData,
  SalesParameters,
} from "@/shared/types";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import {
  DEFAULT_EXTRAS,
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_FINISHING,
  DEFAULT_FDM_HARDWARE,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_FDM_PARAMS,
  DEFAULT_FDM_SLICER_PROFILE,
  DEFAULT_FIXED_COSTS,
  DEFAULT_LABOR,
  DEFAULT_OPS,
  DEFAULT_RESIN_EXTRAS,
  DEFAULT_RESIN_HARDWARE,
  DEFAULT_RESIN_LABOR,
  DEFAULT_RESIN_MATERIAL,
  DEFAULT_RESIN_OPS,
  DEFAULT_RESIN_PARAMS,
  DEFAULT_RESIN_PP,
  DEFAULT_RESIN_SALES,
  DEFAULT_RESIN_SOFT,
  DEFAULT_SALES,
  DEFAULT_SOFT,
  DEFAULT_VOLUME_DISCOUNTS,
} from "@/shared/stores/calculatorStore.defaults";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import { getPrinter } from "@/shared/lib/printers";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Snapshot com resultado já computado. `CalculationSnapshot.results` é
 * `CalculationResult | null` (compatibilidade), mas os builders do demo
 * sempre computam — este tipo fecha o `null` para quem consome o dataset.
 */
export type DemoSnapshot = CalculationSnapshot & { results: CalculationResult };

/** `computeStoreResults` lê `activeTab`; um snapshot carrega `type`. */
function resultsOf(s: CalculationSnapshot): CalculationResult {
  return computeStoreResults({ ...s, activeTab: s.type });
}

/** Studio ficcional do demo. */
export const DEMO_STUDIO_NAME = "Estúdio Maria Print";

/**
 * Impressões reais do catálogo apresentadas no demo (ids de `printers.ts`).
 * A calculadora é carregada na do meio (P1S).
 */
export const DEMO_PRINTER_IDS = [
  "bambu_a1_mini",
  "bambu_p1s",
  "creality_ender_3_v3_se",
] as const;

/** Canal de venda configurado no demo (marketplace real, fee 14% + R$16). */
export const DEMO_MARKETPLACE_ID = "shopee_80mais";

/** Custo de máquina por impressora — espelha a derivação do catálogo que
 * `setSelectedPrinter` faz (value/usefulLife/maintenance → MachineCosts),
 * para o histórico do demo ficar byte-consistente com a calculadora. */
const DEMO_PRINTER_MACHINES: Record<string, MachineCosts> = {
  bambu_a1_mini: {
    enabled: true,
    machineCost: 2000,
    depreciationMonths: 30,
    hoursPerMonth: 100,
    maintenanceEnabled: true,
    maintenanceCost: 20,
  },
  bambu_p1s: {
    enabled: true,
    machineCost: 5500,
    depreciationMonths: 33,
    hoursPerMonth: 120,
    maintenanceEnabled: true,
    maintenanceCost: 48,
  },
  creality_ender_3_v3_se: {
    enabled: true,
    machineCost: 1400,
    depreciationMonths: 31,
    hoursPerMonth: 80,
    maintenanceEnabled: true,
    maintenanceCost: 11,
  },
};

/** Custo de máquina do SLA do demo (Elegoo Saturn 4-like). */
const DEMO_RESIN_MACHINE: MachineCosts = {
  enabled: true,
  machineCost: 4500,
  depreciationMonths: 36,
  hoursPerMonth: 150,
  maintenanceEnabled: true,
  maintenanceCost: 38,
};

const ALL_SECTIONS_ENABLED: Record<string, boolean> = {
  material: true,
  energy: true,
  machine: true,
  hardware: true,
  consumables: true,
  labor: true,
  software: true,
  failure: true,
  extras: true,
  postProcessing: true,
  packaging: true,
  shipping: true,
};

// ── bobinas ──────────────────────────────────────────────────────────

/** Semente de bobina: tudo exceto id/dateAdded (gerados pela store). */
export type DemoSpoolSeed = Omit<FilamentSpool, "id" | "dateAdded">;

/**
 * 6 bobinas: PLA preto, PETG branco, ABS cinza, TPU, PLA Silk + 1 resina
 * lavável em água. Tare por marca vinda da brand tare bank (Bambu Lab 210,
 * Prusament 194, Polymaker 140, Anycubic 127); pesos parciais e status
 * misto — duas carretéis low-stock alimentam o alerta de estoque.
 */
export const DEMO_SPOOLS: DemoSpoolSeed[] = [
  {
    brand: "Bambu Lab",
    material: "PLA",
    color: "Preto",
    colorHex: "#1c1c1c",
    weightGrams: 780,
    originalWeightGrams: 1000,
    costPerKg: 125,
    diameterMm: 1.75,
    tareGrams: 210,
    notes: "Bobina do dia a dia do estúdio.",
    status: "in_stock",
    purchaseStore: "Bambu Lab Official",
  },
  {
    brand: "Prusament",
    material: "PETG",
    color: "Branco",
    colorHex: "#f5f5f5",
    weightGrams: 420,
    originalWeightGrams: 1000,
    costPerKg: 140,
    diameterMm: 1.75,
    tareGrams: 194,
    notes: "",
    status: "in_stock",
    purchaseStore: "Prusa Research",
  },
  {
    brand: "Polymaker",
    material: "ABS",
    color: "Cinza",
    colorHex: "#8a8a8a",
    weightGrams: 950,
    originalWeightGrams: 1000,
    costPerKg: 130,
    diameterMm: 1.75,
    tareGrams: 140,
    notes: "Carretel de papelão — imprimir com câmara fechada.",
    status: "in_stock",
    purchaseStore: "Polymaker Store",
  },
  {
    brand: "Anycubic",
    material: "TPU 95A",
    color: "Laranja",
    colorHex: "#e8722a",
    weightGrams: 90,
    originalWeightGrams: 1000,
    costPerKg: 180,
    diameterMm: 1.75,
    tareGrams: 127,
    notes: "Quase no fim — repor antes do próximo lote de chaveiros.",
    status: "in_stock",
    purchaseStore: "Anycubic Store",
  },
  {
    brand: "Bambu Lab",
    material: "PLA Silk",
    color: "Dourado",
    colorHex: "#d4af37",
    weightGrams: 1000,
    originalWeightGrams: 1000,
    costPerKg: 150,
    diameterMm: 1.75,
    tareGrams: 210,
    notes: "Lote novo, ainda lacrado.",
    status: "on_the_way",
    purchaseStore: "Shopee",
  },
  {
    brand: "Anycubic",
    material: "Water Washable",
    color: "Azul Translúcido",
    colorHex: "#9fb8d4",
    weightGrams: 140,
    originalWeightGrams: 1000,
    costPerKg: 220,
    diameterMm: 1.75,
    tareGrams: 127,
    notes: "Resina lavável em água — cura ao ar livre, sem IPA.",
    status: "in_stock",
    purchaseStore: "Anycubic Store",
  },
];

// ── CRM + produtos ───────────────────────────────────────────────────

export const DEMO_CUSTOMERS: CustomerFormData[] = [
  {
    name: "Ana Paula Souza",
    company: "Loja Artes Analíticas",
    email: "ana@artesanal.exemplo",
    phone: "(11) 98888-7777",
    address: "",
    notes: "Prefere cores pastéis em PLA.",
  },
  {
    name: "Bruno Carvalho",
    company: "BC Brindes",
    email: "bruno@bcbrindes.exemplo",
    phone: "",
    address: "São Paulo, SP",
    notes: "",
  },
  {
    name: "Clínica Vida Plena",
    company: "",
    email: "contato@vidaplena.exemplo",
    phone: "(21) 3232-1212",
    address: "Rio de Janeiro, RJ",
    notes: "Encomendas mensais recorrentes.",
  },
];

export const DEMO_PRODUCTS: ProductFormData[] = [
  {
    name: "Vaso Decorativo Geométrico",
    weightGrams: 185,
    filamentType: "PLA",
    costPrice: 28.5,
    salePrice: 74.9,
  },
  {
    name: "Suporte de Celular Articulado",
    weightGrams: 95,
    filamentType: "PETG",
    costPrice: 18.2,
    salePrice: 52,
  },
  {
    name: "Porta Canetas Helicoidal",
    weightGrams: 210,
    filamentType: "PLA Silk",
    costPrice: 31,
    salePrice: 89.9,
  },
];

/** Semente de orçamento: `addQuote` não aceita cliente, então o store linka
 * depois via `updateQuote` (ação existente). */
export interface DemoQuoteSeed {
  form: QuoteFormData;
  /** Índice em {@link DEMO_CUSTOMERS}; -1 = sem cliente. */
  customerIndex: number;
}

export const DEMO_QUOTES: DemoQuoteSeed[] = [
  {
    form: {
      title: "Encomenda — Loja Artes Analíticas",
      items: [
        { historyEntryId: "demo_hist_01", quantity: 4, discountPercent: 5 },
        { historyEntryId: "demo_hist_03", quantity: 2, discountPercent: 0 },
      ],
      globalDiscountPercent: 5,
      validUntil: "2026-12-31",
      paymentTerms: "50% na aprovação, 50% na entrega",
      deliveryEstimate: "10 dias úteis",
      footerNote: "Frete por conta do estúdio na cidade de São Paulo.",
    },
    customerIndex: 0,
  },
  {
    form: {
      title: "Brindes corporativos — BC Brindes",
      items: [{ historyEntryId: "demo_hist_04", quantity: 10, discountPercent: 10 }],
      globalDiscountPercent: 0,
      validUntil: "2026-11-30",
      paymentTerms: "Pagamento à vista (PIX)",
      deliveryEstimate: "7 dias úteis",
      footerNote: "",
    },
    customerIndex: 1,
  },
];

// ── snapshots de cálculo ─────────────────────────────────────────────

interface FdmCalcInput {
  printerId: string;
  productName: string;
  materialType: string;
  density: number;
  costPerKg: number;
  weightGrams: number;
  hours: number;
  margin: number;
  quantity?: number;
  packaging?: number;
  marketplaceFeePercent?: number;
}

/** Monta um CalculationSnapshot FDM completo a partir de poucos parâmetros. */
function buildFdmSnapshot(o: FdmCalcInput): DemoSnapshot {
  const printer = getPrinter(o.printerId);
  const labor: LaborCosts = {
    ...DEFAULT_LABOR,
    enabled: true,
    setupTimeMinutes: 15,
    postProcessingTimeMinutes: 20,
    hourlyRate: 28,
  };
  const sales: SalesParameters = {
    ...DEFAULT_SALES,
    packagingCost: o.packaging ?? 4,
    profitMarginPercent: o.margin,
    marketplaceFeePercent: o.marketplaceFeePercent ?? 14,
    volumeDiscounts: DEFAULT_VOLUME_DISCOUNTS.map((d) => ({ ...d })),
  };
  const material: MaterialStateFDM = {
    type: o.materialType,
    weightUsed: o.weightGrams,
    purgeWeight: 8,
    costPerKg: o.costPerKg,
    density: o.density,
    spoolEfficiency: 98,
  };
  const printParams: PrintParameters = {
    ...DEFAULT_FDM_PARAMS,
    printTimeHours: o.hours,
    printerPowerWatts: printer.power,
  };
  const snapshot: CalculationSnapshot = {
    id: "demo_calc",
    timestamp: 0,
    type: "fdm",
    summary: o.productName,
    fdmMaterial: material,
    fdmPrintParams: printParams,
    fdmSlicerProfile: { ...DEFAULT_FDM_SLICER_PROFILE },
    fdmFilament: { ...DEFAULT_FDM_FILAMENT },
    fdmMachine: { ...DEMO_PRINTER_MACHINES[o.printerId] },
    fdmHardware: { ...DEFAULT_FDM_HARDWARE },
    fdmFinishing: { ...DEFAULT_FDM_FINISHING },
    fdmLabor: labor,
    fdmExtras: { ...DEFAULT_EXTRAS },
    fdmSales: sales,
    fdmOps: { ...DEFAULT_OPS },
    fdmSoft: { ...DEFAULT_SOFT },
    resinMaterial: { ...DEFAULT_RESIN_MATERIAL },
    resinPrintParams: { ...DEFAULT_RESIN_PARAMS },
    resinPostProcess: { ...DEFAULT_RESIN_PP },
    resinMachine: { ...DEMO_RESIN_MACHINE },
    resinHardware: { ...DEFAULT_RESIN_HARDWARE },
    resinLabor: { ...DEFAULT_RESIN_LABOR },
    resinExtras: { ...DEFAULT_RESIN_EXTRAS },
    resinSales: { ...DEFAULT_RESIN_SALES },
    resinOps: { ...DEFAULT_RESIN_OPS },
    resinSoft: { ...DEFAULT_RESIN_SOFT },
    fixedCosts: { ...DEFAULT_FIXED_COSTS },
    selectedPrinterId: o.printerId,
    selectedMarketplaceId: DEMO_MARKETPLACE_ID,
    productName: o.productName,
    quantity: o.quantity ?? 1,
    infillPercent: 20,
    targetMarginMode: false,
    enabledSections: { ...ALL_SECTIONS_ENABLED },
    results: null,
  };
  const results = resultsOf(snapshot);
  return { ...snapshot, results };
}

interface ResinCalcInput {
  productName: string;
  materialType: string;
  volumeMl: number;
  costPerLiter: number;
  hours: number;
  margin: number;
  washType: "alcohol" | "water";
  wasteMarginPercent?: number;
}

/** Monta um CalculationSnapshot resina completo (lado FDM fica no default). */
function buildResinSnapshot(o: ResinCalcInput): DemoSnapshot {
  const labor: LaborCosts = {
    ...DEFAULT_RESIN_LABOR,
    enabled: true,
    setupTimeMinutes: 10,
    postProcessingTimeMinutes: 15,
    hourlyRate: 28,
  };
  const sales: SalesParameters = {
    ...DEFAULT_RESIN_SALES,
    packagingCost: 3,
    profitMarginPercent: o.margin,
    marketplaceFeePercent: 14,
    volumeDiscounts: DEFAULT_VOLUME_DISCOUNTS.map((d) => ({ ...d })),
  };
  const material: MaterialStateResin = {
    type: o.materialType,
    volumeUsedMl: o.volumeMl,
    costPerLiter: o.costPerLiter,
    density: 1.1,
    wasteMarginPercent: o.wasteMarginPercent ?? 15,
  };
  const postProcess: PostProcessingResin = {
    ...DEFAULT_RESIN_PP,
    washingEnabled: true,
    washType: o.washType,
    curingEnabled: true,
    curingTimeMinutes: 10,
  };
  const snapshot: CalculationSnapshot = {
    id: "demo_calc",
    timestamp: 0,
    type: "resin",
    summary: o.productName,
    fdmMaterial: { ...DEFAULT_FDM_MATERIAL },
    fdmPrintParams: { ...DEFAULT_FDM_PARAMS },
    fdmSlicerProfile: { ...DEFAULT_FDM_SLICER_PROFILE },
    fdmFilament: { ...DEFAULT_FDM_FILAMENT },
    fdmMachine: { ...DEMO_PRINTER_MACHINES.bambu_p1s },
    fdmHardware: { ...DEFAULT_FDM_HARDWARE },
    fdmFinishing: { ...DEFAULT_FDM_FINISHING },
    fdmLabor: { ...DEFAULT_LABOR },
    fdmExtras: { ...DEFAULT_EXTRAS },
    fdmSales: { ...DEFAULT_SALES },
    fdmOps: { ...DEFAULT_OPS },
    fdmSoft: { ...DEFAULT_SOFT },
    resinMaterial: material,
    resinPrintParams: {
      ...DEFAULT_RESIN_PARAMS,
      printTimeHours: o.hours,
      printerPowerWatts: 150,
    },
    resinPostProcess: postProcess,
    resinMachine: { ...DEMO_RESIN_MACHINE },
    resinHardware: { ...DEFAULT_RESIN_HARDWARE },
    resinLabor: labor,
    resinExtras: { ...DEFAULT_RESIN_EXTRAS },
    resinSales: sales,
    resinOps: { ...DEFAULT_RESIN_OPS },
    resinSoft: { ...DEFAULT_RESIN_SOFT },
    fixedCosts: { ...DEFAULT_FIXED_COSTS },
    selectedPrinterId: DEMO_PRINTER_IDS[1],
    selectedMarketplaceId: DEMO_MARKETPLACE_ID,
    productName: o.productName,
    quantity: 1,
    infillPercent: 20,
    targetMarginMode: false,
    enabledSections: { ...ALL_SECTIONS_ENABLED },
    results: null,
  };
  const results = resultsOf(snapshot);
  return { ...snapshot, results };
}

/** Apenas as fatias resina de um snapshot (para compor o calculator demo). */
function resinSlices(s: CalculationSnapshot): Partial<CalculationSnapshot> {
  return {
    resinMaterial: s.resinMaterial,
    resinPrintParams: s.resinPrintParams,
    resinPostProcess: s.resinPostProcess,
    resinMachine: s.resinMachine,
    resinHardware: s.resinHardware,
    resinLabor: s.resinLabor,
    resinExtras: s.resinExtras,
    resinSales: s.resinSales,
    resinOps: s.resinOps,
    resinSoft: s.resinSoft,
  };
}

// ── histórico (10–12 entradas, ~90 dias, margens variadas) ──────────

export interface DemoHistorySeed {
  id: string;
  daysAgo: number;
  name: string;
  snapshot: DemoSnapshot;
}

export const DEMO_HISTORY_SEEDS: DemoHistorySeed[] = [
  {
    id: "demo_hist_09",
    daysAgo: 80,
    name: "Caixa Organizadora com Tampa",
    snapshot: buildFdmSnapshot({
      printerId: "creality_ender_3_v3_se",
      productName: "Caixa Organizadora com Tampa",
      materialType: "PETG",
      density: 1.27,
      costPerKg: 140,
      weightGrams: 420,
      hours: 8,
      margin: 35,
      packaging: 6,
    }),
  },
  {
    id: "demo_hist_11",
    daysAgo: 70,
    name: "Miniatura Resina Standard",
    snapshot: buildResinSnapshot({
      productName: "Miniatura Resina Standard",
      materialType: "Standard",
      volumeMl: 25,
      costPerLiter: 180,
      hours: 3,
      margin: 45,
      washType: "alcohol",
    }),
  },
  {
    id: "demo_hist_08",
    daysAgo: 62,
    name: "Ícone Decorativo Premium",
    snapshot: buildFdmSnapshot({
      printerId: "bambu_p1s",
      productName: "Ícone Decorativo Premium",
      materialType: "PLA Silk",
      density: 1.24,
      costPerKg: 150,
      weightGrams: 260,
      hours: 6,
      margin: 70,
      packaging: 5,
    }),
  },
  {
    id: "demo_hist_07",
    daysAgo: 48,
    name: "Porta Cartão Magnético",
    snapshot: buildFdmSnapshot({
      printerId: "creality_ender_3_v3_se",
      productName: "Porta Cartão Magnético",
      materialType: "ABS",
      density: 1.04,
      costPerKg: 130,
      weightGrams: 140,
      hours: 4,
      margin: 30,
    }),
  },
  {
    id: "demo_hist_06",
    daysAgo: 34,
    name: "Suporte para Fones",
    snapshot: buildFdmSnapshot({
      printerId: "creality_ender_3_v3_se",
      productName: "Suporte para Fones",
      materialType: "PLA",
      density: 1.24,
      costPerKg: 125,
      weightGrams: 75,
      hours: 2.5,
      margin: 50,
    }),
  },
  {
    id: "demo_hist_05",
    daysAgo: 21,
    name: "Organizador de Mesa Modular",
    snapshot: buildFdmSnapshot({
      printerId: "bambu_p1s",
      productName: "Organizador de Mesa Modular",
      materialType: "PETG",
      density: 1.27,
      costPerKg: 140,
      weightGrams: 340,
      hours: 7,
      margin: 40,
      packaging: 6,
    }),
  },
  {
    id: "demo_hist_04",
    daysAgo: 14,
    name: "Chaveiro Personalizado (lote 10)",
    // margem deliberadamente baixa — alimenta o alerta de margem ruim
    snapshot: buildFdmSnapshot({
      printerId: "bambu_a1_mini",
      productName: "Chaveiro Personalizado (lote 10)",
      materialType: "TPU 95A",
      density: 1.21,
      costPerKg: 180,
      weightGrams: 60,
      hours: 2,
      margin: 5,
      quantity: 10,
      packaging: 2,
    }),
  },
  {
    id: "demo_hist_10",
    daysAgo: 12,
    name: "Pingente Lavável em Água",
    // resina water-washable: lavagem com água, sem consumo de IPA
    snapshot: buildResinSnapshot({
      productName: "Pingente Lavável em Água",
      materialType: "Water Washable",
      volumeMl: 15,
      costPerLiter: 220,
      hours: 2,
      margin: 55,
      washType: "water",
      wasteMarginPercent: 10,
    }),
  },
  {
    id: "demo_hist_03",
    daysAgo: 9,
    name: "Porta Canetas Helicoidal",
    snapshot: buildFdmSnapshot({
      printerId: "bambu_p1s",
      productName: "Porta Canetas Helicoidal",
      materialType: "PLA Silk",
      density: 1.24,
      costPerKg: 150,
      weightGrams: 210,
      hours: 5,
      margin: 45,
    }),
  },
  {
    id: "demo_hist_02",
    daysAgo: 5,
    name: "Suporte de Celular Articulado",
    snapshot: buildFdmSnapshot({
      printerId: "bambu_p1s",
      productName: "Suporte de Celular Articulado",
      materialType: "PETG",
      density: 1.27,
      costPerKg: 140,
      weightGrams: 95,
      hours: 3,
      margin: 60,
    }),
  },
  {
    id: "demo_hist_01",
    daysAgo: 2,
    name: "Vaso Decorativo Geométrico",
    snapshot: buildFdmSnapshot({
      printerId: "bambu_a1_mini",
      productName: "Vaso Decorativo Geométrico",
      materialType: "PLA",
      density: 1.24,
      costPerKg: 125,
      weightGrams: 185,
      hours: 4.5,
      margin: 55,
      packaging: 5,
    }),
  },
];

/**
 * Materializa as entradas de histórico: timestamps REAIS espalhados por ~90
 * dias (nunca só "agora"), ids determinísticos, resultados derivados.
 */
export function buildDemoHistoryEntries(): HistoryEntry[] {
  return DEMO_HISTORY_SEEDS.map((seed, idx) => {
    const timestamp =
      Date.now() - seed.daysAgo * DAY_MS - ((idx * 5) % 9) * HOUR_MS;
    const snapshot: DemoSnapshot = {
      ...seed.snapshot,
      id: seed.id,
      timestamp,
    };
    const result = snapshot.results;
    return {
      id: seed.id,
      timestamp,
      type: snapshot.type,
      name: seed.name,
      summary: seed.name,
      totalCost: result.totalCost,
      sellPrice: result.sellPrice,
      profit: result.profit,
      result,
      snapshot,
    };
  });
}

// ── calculadora pré-carregada: 1 FDM + 1 resina water-washable ───────

function composeDemoCalculator(): DemoSnapshot {
  const fdm = buildFdmSnapshot({
    printerId: DEMO_PRINTER_IDS[1],
    productName: "Vaso Decorativo Geométrico",
    materialType: "PLA",
    density: 1.24,
    costPerKg: 125,
    weightGrams: 185,
    hours: 4.5,
    margin: 55,
    packaging: 5,
    marketplaceFeePercent: 14,
  });
  const resin = buildResinSnapshot({
    productName: "Pingente Lavável em Água",
    materialType: "Water Washable",
    volumeMl: 15,
    costPerLiter: 220,
    hours: 2,
    margin: 55,
    washType: "water",
    wasteMarginPercent: 10,
  });
  const composed: DemoSnapshot = {
    ...fdm,
    ...resinSlices(resin),
    type: "fdm",
    selectedPrinterId: DEMO_PRINTER_IDS[1],
    selectedMarketplaceId: DEMO_MARKETPLACE_ID,
    results: fdm.results,
  };
  // As fatias resina não afetam o resultado FDM, mas recomputa por clareza.
  composed.results = resultsOf(composed);
  return composed;
}

export const DEMO_CALCULATOR: DemoSnapshot = composeDemoCalculator();
