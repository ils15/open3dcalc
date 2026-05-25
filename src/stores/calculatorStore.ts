import { create } from 'zustand'
import type {
  MaterialStateFDM, MaterialStateResin, PrintParameters,
  MachineCosts, LaborCosts, AdditionalCosts, SalesParameters,
  OperationalCosts, SoftwareCosts, FDMHardware, FDMFinishing,
  PostProcessingResin, ResinHardware, CalculationResult,
  CalculationSnapshot, AMSSlot,
} from '@/types'
import { marketplaces } from '@/lib/marketplace'
import { printers } from '@/lib/printers'
import { useCatalogStore } from '@/stores/catalogStore'
import { useHistoryStore } from '@/stores/historyStore'
import { calculateFDM, calculateResin } from '@/lib/calculator'
type Marketplace = (typeof marketplaces)[number]
type PrinterProfile = (typeof printers)[number]

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedAutoSave(getState: () => CalculatorState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    const s = getState()
    const data = {
      activeTab: s.activeTab,
      fdmMaterial: s.fdmMaterial, fdmPrintParams: s.fdmPrintParams,
      fdmMachine: s.fdmMachine, fdmHardware: s.fdmHardware, fdmFinishing: s.fdmFinishing,
      fdmLabor: s.fdmLabor, fdmExtras: s.fdmExtras, fdmSales: s.fdmSales,
      fdmOps: s.fdmOps, fdmSoft: s.fdmSoft,
      resinMaterial: s.resinMaterial, resinPrintParams: s.resinPrintParams,
      resinPostProcess: s.resinPostProcess, resinMachine: s.resinMachine,
      resinHardware: s.resinHardware, resinLabor: s.resinLabor,
      resinExtras: s.resinExtras, resinSales: s.resinSales,
      resinOps: s.resinOps, resinSoft: s.resinSoft,
      selectedPrinterId: s.selectedPrinter.id,
      selectedMarketplaceId: s.selectedMarketplace.id,
      fdmAmsEnabled: s.fdmAmsEnabled,
      fdmAmsSlots: s.fdmAmsSlots,
      fixedCosts: s.fixedCosts,
      productName: s.productName, quantity: s.quantity,
      infillPercent: s.infillPercent, targetMarginMode: s.targetMarginMode,
      enabledSections: s.enabledSections,
    }
    localStorage.setItem('open3dcalc_settings_v2', JSON.stringify(data))
  }, 800)
}

const DEFAULT_FDM_MATERIAL: MaterialStateFDM = { type: 'PLA', weightUsed: 50, purgeWeight: 0, costPerKg: 125, density: 1.24, spoolEfficiency: 98 }
const DEFAULT_FDM_PARAMS: PrintParameters = { printTimeHours: 5, printerPowerWatts: 250, energyCostPerKwh: 0.80, failureMode: 'percent', failureValue: 10, riskMultiplier: 1 }
const DEFAULT_FDM_MACHINE: MachineCosts = { enabled: true, machineCost: 3000, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
const DEFAULT_FDM_HARDWARE: FDMHardware = { enabled: true, nozzleEnabled: true, nozzleCost: 25, nozzleLifespanKg: 5, bedEnabled: true, bedAdhesionCost: 0.20 }
const DEFAULT_FDM_FINISHING: FDMFinishing = { enabled: false, suppliesCost: 5 }
const DEFAULT_LABOR: LaborCosts = { enabled: false, setupTimeMinutes: 15, postProcessingTimeMinutes: 20, hourlyRate: 25 }
const DEFAULT_EXTRAS: AdditionalCosts = { extrasCost: 0 }
const DEFAULT_OPS: OperationalCosts = { enabled: false, ppeCostPerPrint: 0 }
const DEFAULT_SOFT: SoftwareCosts = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
const DEFAULT_SALES: SalesParameters = { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50 }

const DEFAULT_RESIN_MATERIAL: MaterialStateResin = { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 5 }
const DEFAULT_RESIN_PARAMS: PrintParameters = { printTimeHours: 2, printerPowerWatts: 50, energyCostPerKwh: 0.80, failureMode: 'none', failureValue: 0, riskMultiplier: 1 }
const DEFAULT_RESIN_PP: PostProcessingResin = { washingEnabled: true, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0.1, curingEnabled: true, curingTimeMinutes: 10, curingPowerWatts: 36 }
const DEFAULT_RESIN_MACHINE: MachineCosts = { enabled: true, machineCost: 3500, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
const DEFAULT_RESIN_HARDWARE: ResinHardware = { enabled: true, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 }
const DEFAULT_RESIN_LABOR: LaborCosts = { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 }
const DEFAULT_RESIN_OPS: OperationalCosts = { enabled: true, ppeCostPerPrint: 2.50 }
const DEFAULT_RESIN_SOFT: SoftwareCosts = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
const DEFAULT_RESIN_EXTRAS: AdditionalCosts = { extrasCost: 0 }
const DEFAULT_RESIN_SALES: SalesParameters = { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50 }

const DEFAULT_FIXED_COSTS: FixedCosts = { enabled: false, monthlyCost: 200, monthlyPrintHours: 160 }

const DEFAULT_AMS_SLOTS: AMSSlot[] = Array.from({ length: 4 }, (_, i) => ({
  enabled: i === 0,
  materialType: 'PLA',
  costPerKg: 125,
  weightUsedGrams: 50,
  purgeWeightGrams: 0,
  transitionPurgeGrams: 3,
  density: 1.24,
  spoolEfficiency: 98,
  color: ['#cccccc', '#f87171', '#60a5fa', '#34d399'][i],
}))

interface CalculatorState {
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
  quickMode: boolean
  setQuickMode: (v: boolean) => void
  quantity: number
  setQuantity: (v: number) => void
  infillPercent: number
  setInfillPercent: (v: number) => void
  targetMarginMode: boolean
  setTargetMarginMode: (v: boolean) => void
  enabledSections: Record<string, boolean>
  toggleSection: (section: string) => void
  results: CalculationResult | null
  loadHistoryItem: (snapshot: CalculationSnapshot) => void
  addToHistory: () => void
  saveSettings: () => void
}

const loadStr = <T,>(key: string, def: T): T => {
  if (typeof window === 'undefined') return def
  try {
    const saved = localStorage.getItem('open3dcalc_settings_v2')
    if (!saved) return def
    const parsed = JSON.parse(saved)
    return parsed[key] !== undefined ? parsed[key] : def
  } catch { return def }
}

type ComputeStoreInput = {
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

function computeStoreResults(s: ComputeStoreInput): CalculationResult {
  const qty = s.quantity > 0 ? s.quantity : 1
  const es = s.enabledSections
  const fixedCostPerHour = s.fixedCosts.enabled && s.fixedCosts.monthlyPrintHours > 0
    ? s.fixedCosts.monthlyCost / s.fixedCosts.monthlyPrintHours
    : 0
  if (s.activeTab === 'fdm') {
    const result = calculateFDM(
      s.fdmMaterial, s.fdmPrintParams, s.fdmMachine,
      s.fdmLabor, s.fdmExtras, s.fdmSales, s.fdmOps, s.fdmSoft,
      s.fdmHardware, s.fdmFinishing, fixedCostPerHour,
    )
    let amsMaterialCost = 0
    if (s.fdmAmsEnabled && s.fdmAmsSlots) {
      const enabledSlots = s.fdmAmsSlots.filter(sl => sl.enabled)
      const activeCount = enabledSlots.filter(sl => sl.weightUsedGrams > 0).length
      for (const slot of enabledSlots) {
        const materialCost = (slot.weightUsedGrams / 1000) * slot.costPerKg
        const purgeCost = (slot.purgeWeightGrams / 1000) * slot.costPerKg
        amsMaterialCost += materialCost + purgeCost
      }
      if (activeCount > 1) {
        const transitions = activeCount * (activeCount - 1)
        const avgCost = enabledSlots.reduce((a, s) => a + s.costPerKg, 0) / enabledSlots.length
        amsMaterialCost += (transitions * (enabledSlots[0]?.transitionPurgeGrams ?? 3) / 1000) * avgCost
      }
    }
    const filtered = {
      ...result,
      materialCost: es.material ? (s.fdmAmsEnabled && s.fdmAmsSlots ? amsMaterialCost : result.materialCost) : 0,
      energyCost: es.energy ? result.energyCost : 0,
      machineCost: es.machine ? result.machineCost : 0,
      hardwareCost: es.hardware ? result.hardwareCost : 0,
      consumablesCost: es.consumables ? result.consumablesCost : 0,
      laborCost: es.labor ? result.laborCost : 0,
      softwareCost: es.software ? result.softwareCost : 0,
      failureCost: es.failure ? result.failureCost : 0,
      extrasCost: es.extras ? result.extrasCost : 0,
      postProcessingCost: es.postProcessing ? result.postProcessingCost : 0,
    }
    const totalBaseCost = filtered.subtotal + filtered.failureCost + (es.packaging ? s.fdmSales.packagingCost : 0) + (es.shipping ? s.fdmSales.shippingCost : 0)
    const profitAmountRaw = totalBaseCost * (s.fdmSales.profitMarginPercent / 100)
    const priceBeforeFees = totalBaseCost + profitAmountRaw
    const totalFeePercent = (s.fdmSales.taxPercent + s.fdmSales.marketplaceFeePercent) / 100
    const sellPrice = totalFeePercent < 1 ? priceBeforeFees / (1 - totalFeePercent) : priceBeforeFees * 2
    const taxAmount = sellPrice * (s.fdmSales.taxPercent / 100)
    const marketplaceFee = sellPrice * (s.fdmSales.marketplaceFeePercent / 100)
    const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee
    const r = { ...filtered, totalCost: totalBaseCost, sellPrice, profit: totalProfit, taxAmount, marketplaceFee }
    if (qty > 1) {
      const laborPerUnit = s.fdmLabor.enabled ? ((s.fdmLabor.setupTimeMinutes + s.fdmLabor.postProcessingTimeMinutes) / 60) * s.fdmLabor.hourlyRate : 0
      const setupCost = laborPerUnit
      const perUnitCost = r.totalCost - setupCost + (setupCost / qty)
      const perUnitSellPrice = r.sellPrice - setupCost + (setupCost / qty)
      return { ...r, totalCost: perUnitCost, sellPrice: perUnitSellPrice, profit: perUnitSellPrice - perUnitCost - r.marketplaceFee - r.taxAmount, costPerUnit: perUnitCost }
    }
    return r
  } else {
    const result = calculateResin(
      s.resinMaterial, s.resinPrintParams, s.resinMachine,
      s.resinLabor, s.resinExtras, s.resinSales, s.resinOps, s.resinSoft,
      s.resinPostProcess, s.resinHardware, fixedCostPerHour,
    )
    const filtered = {
      ...result,
      materialCost: es.material ? result.materialCost : 0,
      energyCost: es.energy ? result.energyCost : 0,
      machineCost: es.machine ? result.machineCost : 0,
      hardwareCost: es.hardware ? result.hardwareCost : 0,
      consumablesCost: es.consumables ? result.consumablesCost : 0,
      laborCost: es.labor ? result.laborCost : 0,
      softwareCost: es.software ? result.softwareCost : 0,
      failureCost: es.failure ? result.failureCost : 0,
      extrasCost: es.extras ? result.extrasCost : 0,
      postProcessingCost: es.postProcessing ? result.postProcessingCost : 0,
    }
    const totalBaseCost = filtered.subtotal + filtered.failureCost + (es.packaging ? s.resinSales.packagingCost : 0) + (es.shipping ? s.resinSales.shippingCost : 0)
    const profitAmountRaw = totalBaseCost * (s.resinSales.profitMarginPercent / 100)
    const priceBeforeFees = totalBaseCost + profitAmountRaw
    const totalFeePercent = (s.resinSales.taxPercent + s.resinSales.marketplaceFeePercent) / 100
    const sellPrice = totalFeePercent < 1 ? priceBeforeFees / (1 - totalFeePercent) : priceBeforeFees * 2
    const taxAmount = sellPrice * (s.resinSales.taxPercent / 100)
    const marketplaceFee = sellPrice * (s.resinSales.marketplaceFeePercent / 100)
    const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee
    const r = { ...filtered, totalCost: totalBaseCost, sellPrice, profit: totalProfit, taxAmount, marketplaceFee }
    if (qty > 1) {
      const laborPerUnit = s.resinLabor.enabled ? ((s.resinLabor.setupTimeMinutes + s.resinLabor.postProcessingTimeMinutes) / 60) * s.resinLabor.hourlyRate : 0
      const setupCost = laborPerUnit
      const perUnitCost = r.totalCost - setupCost + (setupCost / qty)
      const perUnitSellPrice = r.sellPrice - setupCost + (setupCost / qty)
      return { ...r, totalCost: perUnitCost, sellPrice: perUnitSellPrice, profit: perUnitSellPrice - perUnitCost - r.marketplaceFee - r.taxAmount, costPerUnit: perUnitCost }
    }
    return r
  }
}

export const useCalculatorStore = create<CalculatorState>((set, get) => {
  const setWithCompute = (update: Partial<CalculatorState> | ((state: CalculatorState) => Partial<CalculatorState>)) => {
    set((state) => {
      const nextState = typeof update === 'function' ? update(state) : update
      const merged = { ...state, ...nextState }
      const results = computeStoreResults(merged)
      return { ...nextState, results }
    })
    debouncedAutoSave(get)
  }

  const initialValues = {
    activeTab: 'fdm' as const,
    fdmMaterial: { ...DEFAULT_FDM_MATERIAL, ...loadStr('fdmMaterial', {}) },
    fdmPrintParams: { ...DEFAULT_FDM_PARAMS, ...loadStr('fdmPrintParams', {}) },
    fdmMachine: { ...DEFAULT_FDM_MACHINE, ...loadStr('fdmMachine', {}) },
    fdmHardware: { ...DEFAULT_FDM_HARDWARE, ...loadStr('fdmHardware', {}) },
    fdmFinishing: { ...DEFAULT_FDM_FINISHING, ...loadStr('fdmFinishing', {}) },
    fdmLabor: { ...DEFAULT_LABOR, ...loadStr('fdmLabor', {}) },
    fdmExtras: { ...DEFAULT_EXTRAS, ...loadStr('fdmExtras', {}) },
    fdmSales: { ...DEFAULT_SALES, ...loadStr('fdmSales', {}) },
    fdmOps: { ...DEFAULT_OPS, ...loadStr('fdmOps', {}) },
    fdmSoft: { ...DEFAULT_SOFT, ...loadStr('fdmSoft', {}) },

    resinMaterial: { ...DEFAULT_RESIN_MATERIAL, ...loadStr('resinMaterial', {}) },
    resinPrintParams: { ...DEFAULT_RESIN_PARAMS, ...loadStr('resinPrintParams', {}) },
    resinPostProcess: { ...DEFAULT_RESIN_PP, ...loadStr('resinPostProcess', {}) },
    resinMachine: { ...DEFAULT_RESIN_MACHINE, ...loadStr('resinMachine', {}) },
    resinHardware: { ...DEFAULT_RESIN_HARDWARE, ...loadStr('resinHardware', {}) },
    resinLabor: { ...DEFAULT_RESIN_LABOR, ...loadStr('resinLabor', {}) },
    resinExtras: { ...DEFAULT_RESIN_EXTRAS, ...loadStr('resinExtras', {}) },
    resinSales: { ...DEFAULT_RESIN_SALES, ...loadStr('resinSales', {}) },
    resinOps: { ...DEFAULT_RESIN_OPS, ...loadStr('resinOps', {}) },
    resinSoft: { ...DEFAULT_RESIN_SOFT, ...loadStr('resinSoft', {}) },

    selectedPrinter: printers[0],
    selectedMarketplace: marketplaces[0],
    fixedCosts: { ...DEFAULT_FIXED_COSTS },

    fdmAmsEnabled: false,
    fdmAmsSlots: DEFAULT_AMS_SLOTS.map(s => ({ ...s })),

    productName: '',
    quickMode: false,
    quantity: loadStr('quantity', 1),
    infillPercent: loadStr('infillPercent', 20),
    targetMarginMode: false,
    enabledSections: loadStr('enabledSections', {
      material: true, energy: true, machine: true, hardware: true,
      consumables: true, labor: true, software: true, failure: true,
      extras: true, postProcessing: true, packaging: true, shipping: true,
    }),
  }

  const initialResults = computeStoreResults(initialValues as ComputeStoreInput)

  return {
    ...initialValues,
    results: initialResults,

    setActiveTab: (activeTab) => setWithCompute({ activeTab }),

    setFdmMaterial: (v) => setWithCompute({ fdmMaterial: v }),
    setFdmPrintParams: (v) => setWithCompute({ fdmPrintParams: v }),
    setFdmMachine: (v) => setWithCompute({ fdmMachine: v }),
    setFdmHardware: (v) => setWithCompute({ fdmHardware: v }),
    setFdmFinishing: (v) => setWithCompute({ fdmFinishing: v }),
    setFdmLabor: (v) => setWithCompute({ fdmLabor: v }),
    setFdmExtras: (v) => setWithCompute({ fdmExtras: v }),
    setFdmSales: (v) => setWithCompute({ fdmSales: v }),
    setFdmOps: (v) => setWithCompute({ fdmOps: v }),
    setFdmSoft: (v) => setWithCompute({ fdmSoft: v }),

    setResinMaterial: (v) => setWithCompute({ resinMaterial: v }),
    setResinPrintParams: (v) => setWithCompute({ resinPrintParams: v }),
    setResinPostProcess: (v) => setWithCompute({ resinPostProcess: v }),
    setResinMachine: (v) => setWithCompute({ resinMachine: v }),
    setResinHardware: (v) => setWithCompute({ resinHardware: v }),
    setResinLabor: (v) => setWithCompute({ resinLabor: v }),
    setResinExtras: (v) => setWithCompute({ resinExtras: v }),
    setResinSales: (v) => setWithCompute({ resinSales: v }),
    setResinOps: (v) => setWithCompute({ resinOps: v }),
    setResinSoft: (v) => setWithCompute({ resinSoft: v }),

    setSelectedPrinter: (selectedPrinter) => {
      const hasAms = (selectedPrinter.maxFilaments ?? 1) > 1
      const wasAmsEnabled = get().fdmAmsEnabled
      setWithCompute({ selectedPrinter, fdmAmsEnabled: hasAms && wasAmsEnabled })
    },
    setSelectedMarketplace: (selectedMarketplace) => setWithCompute({ selectedMarketplace }),

    setFixedCostsField: (field, value) => setWithCompute((state) => ({
      fixedCosts: { ...state.fixedCosts, [field]: value as never },
    })),

    setFdmAmsEnabled: (fdmAmsEnabled) => setWithCompute({ fdmAmsEnabled }),
    setFdmAmsSlot: (index, slot) => {
      const slots = [...get().fdmAmsSlots]
      slots[index] = slot
      setWithCompute({ fdmAmsSlots: slots })
    },

    setProductName: (productName) => setWithCompute({ productName }),
    setQuickMode: (quickMode) => setWithCompute({ quickMode }),
    setQuantity: (quantity) => setWithCompute({ quantity }),
    setInfillPercent: (infillPercent) => setWithCompute({ infillPercent }),
    setTargetMarginMode: (targetMarginMode) => setWithCompute({ targetMarginMode }),
    toggleSection: (section) => {
      setWithCompute((state) => {
        const next = { ...state.enabledSections, [section]: !state.enabledSections[section] }
        localStorage.setItem('open3dcalc_sections', JSON.stringify(next))
        return { enabledSections: next }
      })
    },

    addToHistory: () => {
      const s = get()
      const r = s.results
      if (!r) return
      const name = s.productName.trim() || (s.activeTab === 'fdm'
        ? `${s.fdmMaterial.type} - ${s.fdmMaterial.weightUsed}g`
        : `${s.resinMaterial.type} - ${s.resinMaterial.volumeUsedMl}ml`)
      const now = Date.now()
      const id = `hist_${now}_${Math.random().toString(36).slice(2, 7)}`

      const snapshot: CalculationSnapshot = {
        id,
        timestamp: now,
        type: s.activeTab,
        summary: name,
        fdmAmsEnabled: s.fdmAmsEnabled || undefined,
        fdmAmsSlots: s.fdmAmsSlots,
        fixedCosts: s.fixedCosts,
        fdmMaterial: s.fdmMaterial,
        fdmPrintParams: s.fdmPrintParams,
        fdmMachine: s.fdmMachine,
        fdmHardware: s.fdmHardware,
        fdmFinishing: s.fdmFinishing,
        fdmLabor: s.fdmLabor,
        fdmExtras: s.fdmExtras,
        fdmSales: s.fdmSales,
        fdmOps: s.fdmOps,
        fdmSoft: s.fdmSoft,
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
        selectedPrinterId: s.selectedPrinter.id,
        selectedMarketplaceId: s.selectedMarketplace.id,
        productName: s.productName,
        quantity: s.quantity,
        infillPercent: s.infillPercent,
        targetMarginMode: s.targetMarginMode,
        enabledSections: s.enabledSections,
        results: r,
      }

      useHistoryStore.getState().addEntry({
        type: s.activeTab,
        name,
        summary: name,
        totalCost: r.totalCost,
        sellPrice: r.sellPrice,
        profit: r.profit,
        result: r,
        snapshot,
      })
    },

    loadHistoryItem: (snapshot: CalculationSnapshot) => {
      setWithCompute({
        activeTab: snapshot.type,
        fdmAmsEnabled: snapshot.fdmAmsEnabled ?? false,
        fdmAmsSlots: snapshot.fdmAmsSlots ?? DEFAULT_AMS_SLOTS.map(s => ({ ...s })),
        fixedCosts: snapshot.fixedCosts ?? { ...DEFAULT_FIXED_COSTS },
        fdmMaterial: snapshot.fdmMaterial,
        fdmPrintParams: snapshot.fdmPrintParams,
        fdmMachine: snapshot.fdmMachine,
        fdmHardware: snapshot.fdmHardware,
        fdmFinishing: snapshot.fdmFinishing,
        fdmLabor: snapshot.fdmLabor,
        fdmExtras: snapshot.fdmExtras,
        fdmSales: snapshot.fdmSales,
        fdmOps: snapshot.fdmOps,
        fdmSoft: snapshot.fdmSoft,
        resinMaterial: snapshot.resinMaterial,
        resinPrintParams: snapshot.resinPrintParams,
        resinPostProcess: snapshot.resinPostProcess,
        resinMachine: snapshot.resinMachine,
        resinHardware: snapshot.resinHardware,
        resinLabor: snapshot.resinLabor,
        resinExtras: snapshot.resinExtras,
        resinSales: snapshot.resinSales,
        resinOps: snapshot.resinOps,
        resinSoft: snapshot.resinSoft,
        productName: snapshot.productName,
        quantity: snapshot.quantity,
        infillPercent: snapshot.infillPercent,
        targetMarginMode: snapshot.targetMarginMode,
        enabledSections: snapshot.enabledSections,
      })
    },

    saveSettings: () => {
      const s = get()
      const data = {
        fdmMaterial: s.fdmMaterial, fdmPrintParams: s.fdmPrintParams,
        fdmMachine: s.fdmMachine, fdmHardware: s.fdmHardware, fdmFinishing: s.fdmFinishing,
        fdmLabor: s.fdmLabor, fdmExtras: s.fdmExtras, fdmSales: s.fdmSales,
        fdmOps: s.fdmOps, fdmSoft: s.fdmSoft,
        resinMaterial: s.resinMaterial, resinPrintParams: s.resinPrintParams,
        resinPostProcess: s.resinPostProcess, resinMachine: s.resinMachine,
        resinHardware: s.resinHardware, resinLabor: s.resinLabor,
        resinExtras: s.resinExtras, resinSales: s.resinSales,
        resinOps: s.resinOps, resinSoft: s.resinSoft,
        fdmAmsEnabled: s.fdmAmsEnabled,
        fdmAmsSlots: s.fdmAmsSlots,
        fixedCosts: s.fixedCosts,
        quantity: s.quantity, infillPercent: s.infillPercent,
      }
      localStorage.setItem('open3dcalc_settings_v2', JSON.stringify(data))
    },
  }
})

// Sync default selections with catalog overrides when available.
if (typeof window !== 'undefined') {
  const catalog = useCatalogStore.getState()
  const state = useCalculatorStore.getState()
  const printer = catalog.printers.find(p => p.id === state.selectedPrinter.id)
  if (printer) useCalculatorStore.setState({ selectedPrinter: printer as PrinterProfile })
}

