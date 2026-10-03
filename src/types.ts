export type MaterialType =
  | "PLA"
  | "PLA Silk"
  | "PETG"
  | "ABS"
  | "ASA"
  | "TPU"
  | "Nylon (PA)"
  | "Resina Standard"
  | "Resina Tough";

export type InfillPattern =
  "gyroid" | "grid" | "honeycomb" | "triangles" | "cubic" | "concentric";

export interface ExtraCostItem {
  id: string;
  name: string;
  cost: number;
  category: "embalagem" | "acabamento" | "ferragem" | "outro";
}

export interface PrinterProfile {
  id: string;
  name: string;
  brand: string;
  technology: PrintTechnology;
  powerWatts: number;
  price: number;
  lifespanHours: number;
  maintenancePerHour: number;
  bedWidth: number;
  bedDepth: number;
  bedHeight: number;
  totalPrintHoursLogged: number;
  status: "disponivel" | "imprimindo" | "manutencao" | "ociosa";
  currentJobName?: string;
  nozzleDiameterMm?: number;
  acquisitionDate?: string;
}

export interface FilamentProfile {
  id: string;
  name: string;
  colorName?: string;
  brand: string;
  type: MaterialType;
  colorHex: string;
  spoolPrice: number;
  spoolWeightGrams: number;
  remainingWeightGrams: number;
  densityGcm3: number;
  status?: "em_estoque" | "a_caminho" | "vazio";
  notes?: string;
  lowStockThreshold?: number;
}

export type PrintTechnology = "fdm" | "resin";

export type ComplexityMode = "rapido" | "detalhado" | "completo";

export interface PrintCalculationData {
  printTechnology: PrintTechnology;
  complexityMode: ComplexityMode;
  projectName: string;
  clientName: string;
  clientPhone: string;
  materialType: MaterialType;
  filamentId: string;
  filamentColor: string;
  spoolPrice: number;
  spoolWeightGrams: number;
  printWeightGrams: number;
  printerId: string;
  printerPowerWatts: number;
  energyKwhPrice: number;
  printerCost: number;
  printerLifespanHours: number;
  printerMaintenancePerHour: number;
  printTimeHours: number;
  printTimeMinutes: number;
  laborPrepMinutes: number;
  laborPostMinutes: number;
  laborHourlyRate: number;
  failureRatePercent: number;
  extraCosts: ExtraCostItem[];
  profitMarginPercent: number;
  marketplaceFeePercent: number;
  taxPercent: number;
  discountPercent: number;
  quantity: number;
  infillPercent: number;
  infillPattern: InfillPattern;
  layerHeightMm: number;
  notes: string;
}

export interface CalculationResult {
  totalHours: number;
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  maintenanceCost: number;
  laborCost: number;
  extraCostsTotal: number;
  baseCost: number;
  failureRiskCost: number;
  totalProductionCost: number;
  // Commercial pricing
  markupAmount: number;
  preTaxPrice: number;
  taxAmount: number;
  marketplaceFeeAmount: number;
  discountAmount: number;
  finalSalePrice: number;
  netProfit: number;
  profitMarginActual: number;
  breakEvenPrice: number;
  // Per unit (when quantity > 1)
  unitProductionCost: number;
  unitSalePrice: number;
  unitProfit: number;
}

export type HistoryItemStatus =
  "orcamento" | "aprovado" | "em_producao" | "concluido" | "cancelado";

export type LayoutMode =
  | "dashboard"
  | "classic"
  | "history"
  | "wizard"
  | "bento"
  | "studio"
  | "comparison"
  | "printers"
  | "spools";

export type CurrencyCode = "BRL" | "USD" | "EUR";

export interface SavedCalculationHistoryItem {
  id: string;
  timestamp: number;
  data: PrintCalculationData;
  result: CalculationResult;
  status?: HistoryItemStatus;
  notes?: string;
  isFavorite?: boolean;
  jobOutcome?: PrintJobOutcome;
  failureCause?: PrintFailureCause;
  progressPercentBeforeFail?: number;
}

// Print Success Analytics types
export type PrintJobOutcome = "sucesso" | "falha" | "em_andamento";

export type PrintFailureCause =
  | "adhesion_warp" // Descolamento da mesa / Warping
  | "nozzle_clog" // Entupimento de bico / Subextrusão
  | "layer_shift" // Deslocamento de camadas mecânico
  | "filament_runout" // Filamento quebrado ou carretel vazio
  | "stringing_blobs" // Excesso de fiapos ou blobs severos
  | "support_failure" // Queda ou descolamento de suportes
  | "dimensional_defect" // Fora da tolerância especificada
  | "resin_delamination" // Resina descolou da mesa ou película FEP
  | "power_outage" // Interrupção elétrica ou desligamento térmico
  | "user_aborted"; // Cancelamento manual pelo operador

export interface PrintJobRecord {
  id: string;
  projectName: string;
  clientName?: string;
  printerId: string;
  printerModelName?: string;
  timestamp: number;
  outcome: PrintJobOutcome;
  failureCause?: PrintFailureCause;
  progressPercentBeforeFail?: number;
  printTimeHours: number;
  weightGrams: number;
  materialType: MaterialType;
  estimatedLossCost?: number;
  notes?: string;
}

export interface PrinterSuccessMetric {
  printerId: string;
  printerName: string;
  brand: string;
  technology: PrintTechnology;
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
  successRatePercent: number;
  previousPeriodSuccessRatePercent: number;
  trendDeltaPercent: number;
  trendDirection: "up" | "down" | "stable";
  totalPrintHoursLogged: number;
  lostHours: number;
  wastedFilamentGrams: number;
  totalFinancialLoss: number;
  primaryFailureCause?: {
    cause: PrintFailureCause;
    label: string;
    count: number;
    percent: number;
  };
  reliabilityScore: number; // 0 - 100
}
