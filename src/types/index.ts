export type Language = 'pt-BR' | 'en-US'

export type MaterialType =
  | 'pla' | 'pla_silk' | 'pla_plus' | 'petg' | 'abs' | 'asa'
  | 'tpu_85a' | 'tpu_95a' | 'nylon_pa6' | 'nylon_pa12' | 'pc'
  | 'pc_abs' | 'pla_cf' | 'petg_cf' | 'nylon_cf' | 'pla_wood'
  | 'pla_metal' | 'hips' | 'pva' | 'pp' | 'peek' | 'peek_cf' | 'ultem'

export interface Material {
  id: string
  name: string
  density: number
  avgPrice: number
  type: 'fdm' | 'resin'
}

export interface PrinterProfile {
  id: string
  name: string
  brand: string
  power: number
  value: number
  usefulLife: number
  maintenancePerHour: number
  image?: string
  maxFilaments?: number
}

export interface AMSSlot {
  enabled: boolean
  materialType: string
  costPerKg: number
  weightUsedGrams: number
  purgeWeightGrams: number
  transitionPurgeGrams: number
  density: number
  spoolEfficiency: number
  color: string
  spoolId?: string
}

export interface Marketplace {
  id: string
  name: string
  feePercent: number
  feeFixed: number
  hasFreeShipping: boolean
  shippingFeePercent?: number
}

export interface MaterialStateFDM {
  type: string
  weightUsed: number
  purgeWeight: number
  costPerKg: number
  density: number
  spoolEfficiency: number
}

export interface MaterialStateResin {
  type: string
  volumeUsedMl: number
  costPerLiter: number
  density: number
  wasteMarginPercent: number
}

export interface PrintParameters {
  printTimeHours: number
  printerPowerWatts: number
  energyCostPerKwh: number
  failureMode: 'none' | 'percent' | 'fixed'
  failureValue: number
  riskMultiplier: number
}

export interface MachineCosts {
  enabled: boolean
  machineCost: number
  depreciationMonths: number
  hoursPerMonth: number
  maintenanceEnabled: boolean
  maintenanceCost: number
}

export interface FDMHardware {
  enabled: boolean
  nozzleEnabled: boolean
  nozzleCost: number
  nozzleLifespanKg: number
  bedEnabled: boolean
  bedAdhesionCost: number
}

export interface FDMFinishing {
  enabled: boolean
  suppliesCost: number
}

export interface ResinHardware {
  enabled: boolean
  lcdCost: number
  lcdLifespanHours: number
  fepCost: number
  fepLifespanPrints: number
}

export interface PostProcessingResin {
  washingEnabled: boolean
  alcoholCostPerLiter: number
  alcoholVolumeLiters: number
  curingEnabled: boolean
  curingTimeMinutes: number
  curingPowerWatts: number
}

export interface LaborCosts {
  enabled: boolean
  setupTimeMinutes: number
  postProcessingTimeMinutes: number
  hourlyRate: number
}

export interface FixedCosts {
  enabled: boolean
  monthlyCost: number
  monthlyPrintHours: number
}

export interface OperationalCosts {
  enabled: boolean
  ppeCostPerPrint: number
}

export interface SoftwareCosts {
  enabled: boolean
  slicerMonthlyCost: number
  modelFileCost: number
}

export interface AdditionalCosts {
  extrasCost: number
}

export interface SalesParameters {
  packagingCost: number
  shippingCost: number
  taxPercent: number
  marketplaceFeePercent: number
  profitMarginPercent: number
}

export interface CalculationResult {
  materialCost: number
  energyCost: number
  machineCost: number
  hardwareCost: number
  consumablesCost: number
  laborCost: number
  softwareCost: number
  failureCost: number
  extrasCost: number
  postProcessingCost: number
  subtotal: number
  totalCost: number
  sellPrice: number
  profit: number
  marketplaceFee: number
  taxAmount: number
  costPerGram: number
  costPerUnit: number
  unitWeight: number
  estimatedPrintTime: number
  targetMarginPercent: number
  breakEvenPrice: number
  actualMargin: number
}

export interface HistoryItem {
  id: string
  timestamp: number
  type: 'fdm' | 'resin'
  summary: string
  totalCost: number
  sellPrice: number
  profit: number
}

export interface SavedProduct {
  id: number
  name: string
  date: string
  result: CalculationResult
  snapshot?: CalculationSnapshot
}

export interface HistoryEntry {
  id: string
  timestamp: number
  type: 'fdm' | 'resin'
  name: string
  summary: string
  totalCost: number
  sellPrice: number
  profit: number
  result: CalculationResult
  snapshot: CalculationSnapshot | null
}

export interface CalculationInputs {
  productName: string
  material: Material
  weight: number
  volume: number
  useVolume: boolean
  timeMinutes: number
  printer: PrinterProfile
  energyRate: number
  laborRate: number
  packagingCost: number
  finishingCost: number
  failureRate: number
  markup: number
  marketplace: Marketplace
  quantity: number
  infillPercent: number
  purgePercent: number
  shippingCost: number
  taxRate: number
  cardFeePercent: number
}

export interface CalculationSnapshot {
  id: string
  timestamp: number
  type: 'fdm' | 'resin'
  summary: string
  fdmAmsEnabled?: boolean
  fdmAmsSlots?: AMSSlot[]
  fdmMaterial: MaterialStateFDM
  fdmPrintParams: PrintParameters
  fdmMachine: MachineCosts
  fdmHardware: FDMHardware
  fdmFinishing: FDMFinishing
  fdmLabor: LaborCosts
  fdmExtras: AdditionalCosts
  fdmSales: SalesParameters
  fdmOps: OperationalCosts
  fdmSoft: SoftwareCosts
  fixedCosts: FixedCosts
  resinMaterial: MaterialStateResin
  resinPrintParams: PrintParameters
  resinPostProcess: PostProcessingResin
  resinMachine: MachineCosts
  resinHardware: ResinHardware
  resinLabor: LaborCosts
  resinExtras: AdditionalCosts
  resinSales: SalesParameters
  resinOps: OperationalCosts
  resinSoft: SoftwareCosts
  selectedPrinterId: string
  selectedMarketplaceId: string
  productName: string
  quantity: number
  infillPercent: number
  targetMarginMode: boolean
  enabledSections: Record<string, boolean>
  results: CalculationResult | null
}
