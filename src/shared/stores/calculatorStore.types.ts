import type { CurrencySetting } from '@/shared/lib/currency'
import type {
  MaterialStateFDM, MaterialStateResin, PrintParameters,
  MachineCosts, LaborCosts, AdditionalCosts, SalesParameters,
  OperationalCosts, SoftwareCosts, FDMHardware, FDMFinishing,
  PostProcessingResin, ResinHardware, CalculationResult,
  CalculationSnapshot, AMSSlot, FixedCosts,
} from '@/shared/types'
import { marketplaces } from '@/shared/lib/marketplace'
import { printers } from '@/shared/lib/printers'
type Marketplace = (typeof marketplaces)[number]
type PrinterProfile = (typeof printers)[number]

export type CalcLevel = 'basic' | 'intermediate' | 'advanced'

export interface CalculatorState {
  activeTab: 'fdm' | 'resin'
  setActiveTab: (tab: 'fdm' | 'resin') => void

  fdmMaterial: MaterialStateFDM
  setFdmMaterial: (v: MaterialStateFDM) => void
  fdmPrintParams: PrintParameters
  setFdmPrintParams: (v: PrintParameters) => void
  fdmMachine: MachineCosts
  setFdmMachine: (v: MachineCosts) => void
  fdmHardware: FDMHardware
  setFdmHardware: (v: FDMHardware) => void
  fdmFinishing: FDMFinishing
  setFdmFinishing: (v: FDMFinishing) => void
  fdmLabor: LaborCosts
  setFdmLabor: (v: LaborCosts) => void
  fdmExtras: AdditionalCosts
  setFdmExtras: (v: AdditionalCosts) => void
  fdmSales: SalesParameters
  setFdmSales: (v: SalesParameters) => void
  fdmOps: OperationalCosts
  setFdmOps: (v: OperationalCosts) => void
  fdmSoft: SoftwareCosts
  setFdmSoft: (v: SoftwareCosts) => void

  resinMaterial: MaterialStateResin
  setResinMaterial: (v: MaterialStateResin) => void
  resinPrintParams: PrintParameters
  setResinPrintParams: (v: PrintParameters) => void
  resinPostProcess: PostProcessingResin
  setResinPostProcess: (v: PostProcessingResin) => void
  resinMachine: MachineCosts
  setResinMachine: (v: MachineCosts) => void
  resinHardware: ResinHardware
  setResinHardware: (v: ResinHardware) => void
  resinLabor: LaborCosts
  setResinLabor: (v: LaborCosts) => void
  resinExtras: AdditionalCosts
  setResinExtras: (v: AdditionalCosts) => void
  resinSales: SalesParameters
  setResinSales: (v: SalesParameters) => void
  resinOps: OperationalCosts
  setResinOps: (v: OperationalCosts) => void
  resinSoft: SoftwareCosts
  setResinSoft: (v: SoftwareCosts) => void

  selectedPrinter: PrinterProfile
  setSelectedPrinter: (p: PrinterProfile) => void
  selectedMarketplace: Marketplace
  setSelectedMarketplace: (m: Marketplace) => void

  fdmAmsEnabled: boolean
  fdmAmsSlots: AMSSlot[]
  fixedCosts: FixedCosts
  setFixedCostsField: (field: keyof FixedCosts, value: number | boolean) => void

  setFdmAmsEnabled: (v: boolean) => void
  setFdmAmsSlot: (index: number, slot: AMSSlot) => void

  productName: string
  setProductName: (name: string) => void
  calcLevel: CalcLevel
  setCalcLevel: (v: CalcLevel) => void
  hiddenFields: string[]
  toggleField: (fieldId: string) => void
  quantity: number
  setQuantity: (v: number) => void
  infillPercent: number
  setInfillPercent: (v: number) => void
  targetMarginMode: boolean
  setTargetMarginMode: (v: boolean) => void
  enabledSections: Record<string, boolean>
  toggleSection: (section: string) => void
  selectedSpoolId: string | null
  setSelectedSpoolId: (id: string | null) => void
  lastDeductedInfo: { spoolId: string; weight: number } | null
  setLastDeductedInfo: (info: { spoolId: string; weight: number } | null) => void
  results: CalculationResult | null
  loadHistoryItem: (snapshot: CalculationSnapshot) => void
  addToHistory: () => void
  saveSettings: () => void

  currency: CurrencySetting
  setCurrency: (c: CurrencySetting) => void

  setQuickStart: () => void
  resetCalculator: () => void

  /** JSON snapshots for undo (max UNDO_LIMIT entries). */
  history: string[]
  /** Restores the last snapshot from history. */
  undo: () => void
}

export type ComputeStoreInput = {
  activeTab: 'fdm' | 'resin'
  fdmMaterial: MaterialStateFDM
  fdmPrintParams: PrintParameters
  fdmMachine: MachineCosts
  fdmLabor: LaborCosts
  fdmExtras: AdditionalCosts
  fdmSales: SalesParameters
  fdmOps: OperationalCosts
  fdmSoft: SoftwareCosts
  fdmHardware: FDMHardware
  fdmFinishing: FDMFinishing
  resinMaterial: MaterialStateResin
  resinPrintParams: PrintParameters
  resinMachine: MachineCosts
  resinLabor: LaborCosts
  resinExtras: AdditionalCosts
  resinSales: SalesParameters
  resinOps: OperationalCosts
  resinSoft: SoftwareCosts
  resinPostProcess: PostProcessingResin
  resinHardware: ResinHardware
  quantity: number
  enabledSections: Record<string, boolean>
  fdmAmsEnabled?: boolean
  fdmAmsSlots?: AMSSlot[]
  fixedCosts: FixedCosts
}
