import { create } from 'zustand'
import { marketplaces } from '@/shared/lib/marketplace'
import { printers } from '@/shared/lib/printers'
import { useCatalogStore } from '@/shared/stores/catalogStore'
import { useFilamentInventory } from '@/shared/stores/filamentInventory'
import { useHistoryStore } from '@/shared/stores/historyStore'
import type { CalculatorState, ComputeStoreInput } from './calculatorStore.types'
import type { CalcLevel } from './calculatorStore.types'
import type { CurrencySetting } from '@/shared/lib/currency'
import type { CalculationSnapshot } from '@/shared/types'
import {
  DEFAULT_FDM_MATERIAL, DEFAULT_FDM_PARAMS, DEFAULT_FDM_MACHINE,
  DEFAULT_FDM_HARDWARE, DEFAULT_FDM_FINISHING, DEFAULT_LABOR,
  DEFAULT_EXTRAS, DEFAULT_OPS, DEFAULT_SOFT, DEFAULT_SALES,
  DEFAULT_RESIN_MATERIAL, DEFAULT_RESIN_PARAMS, DEFAULT_RESIN_PP,
  DEFAULT_RESIN_MACHINE, DEFAULT_RESIN_HARDWARE, DEFAULT_RESIN_LABOR,
  DEFAULT_RESIN_OPS, DEFAULT_RESIN_SOFT, DEFAULT_RESIN_EXTRAS,
  DEFAULT_RESIN_SALES, DEFAULT_FIXED_COSTS, DEFAULT_AMS_SLOTS,
} from './calculatorStore.defaults'
import { debouncedAutoSave, loadStr, migrateQuickMode } from './calculatorStore.helpers'
import { computeStoreResults } from './calculatorStore.compute'

type PrinterProfile = (typeof printers)[number]

// Re-exports — used by section components, Calculator.tsx, tests, etc.
export type { CalculatorState, CalcLevel, ComputeStoreInput } from './calculatorStore.types'

const UNDO_LIMIT = 20

/** Extracts data-only fields from CalculatorState into a JSON-safe snapshot. */
function captureSnapshot(s: CalculatorState): string {
  return JSON.stringify({
    activeTab: s.activeTab,
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
    selectedPrinter: s.selectedPrinter,
    selectedMarketplace: s.selectedMarketplace,
    fdmAmsEnabled: s.fdmAmsEnabled,
    fdmAmsSlots: s.fdmAmsSlots,
    fixedCosts: s.fixedCosts,
    productName: s.productName,
    calcLevel: s.calcLevel,
    hiddenFields: s.hiddenFields,
    quantity: s.quantity,
    infillPercent: s.infillPercent,
    targetMarginMode: s.targetMarginMode,
    enabledSections: s.enabledSections,
    currency: s.currency,
  })
}

export const useCalculatorStore = create<CalculatorState>((set, get) => {
  const setWithCompute = (
    update: Partial<CalculatorState> | ((state: CalculatorState) => Partial<CalculatorState>),
    options?: { undoable?: boolean },
  ) => {
    const undoable = options?.undoable ?? true
    set((state) => {
      const history = undoable
        ? [...(state.history || []), captureSnapshot(state)].slice(-UNDO_LIMIT)
        : state.history || []
      const nextState = typeof update === 'function' ? update(state) : update
      const merged = { ...state, ...nextState }
      const results = computeStoreResults(merged)
      return { ...nextState, results, history }
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
    fixedCosts: { ...DEFAULT_FIXED_COSTS, ...loadStr('fixedCosts', {}) },

    fdmAmsEnabled: false,
    fdmAmsSlots: DEFAULT_AMS_SLOTS.map(s => ({ ...s })),

    productName: '',
    calcLevel: loadStr<CalcLevel>('calcLevel', migrateQuickMode(loadStr<boolean | undefined>('quickMode', undefined))),
    hiddenFields: loadStr<string[]>('hiddenFields', []),
    quantity: loadStr('quantity', 1),
    infillPercent: loadStr('infillPercent', 20),
    targetMarginMode: false,
    currency: loadStr<CurrencySetting>('currency', 'auto'),
    enabledSections: loadStr('enabledSections', {
      material: true, energy: true, machine: true, hardware: true,
      consumables: true, labor: true, software: true, failure: true,
      extras: true, postProcessing: true, packaging: true, shipping: true,
    }),
    selectedSpoolId: null,
    lastDeductedInfo: null,
    history: [],
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

    setCurrency: (currency) => set({ currency }),
    setSelectedSpoolId: (id) => setWithCompute({ selectedSpoolId: id }),
    setLastDeductedInfo: (info) => set({ lastDeductedInfo: info }),

    undo: () => {
      const s = get()
      const hist = s.history || []
      if (hist.length === 0) return
      const snapshot = hist[hist.length - 1]
      try {
        const data = JSON.parse(snapshot) as Record<string, unknown>
        set((state) => {
          const merged = { ...state, ...data }
          const results = computeStoreResults(merged)
          return { ...merged, results, history: state.history.slice(0, -1) }
        })
      } catch {
        // Corrupted snapshot — just remove it
        set((state) => ({ history: state.history.slice(0, -1) }))
      }
    },

    setProductName: (productName) => setWithCompute({ productName }),
    setCalcLevel: (calcLevel) => setWithCompute({ calcLevel }),
    toggleField: (fieldId) => setWithCompute((state) => {
      const hidden = state.hiddenFields.includes(fieldId)
        ? state.hiddenFields.filter((id) => id !== fieldId)
        : [...state.hiddenFields, fieldId]
      return { hiddenFields: hidden }
    }),
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

    setQuickStart: () => {
      const rand = (min: number, max: number) => Math.round(Math.random() * (max - min) + min)
      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

      const names = ['Vaso Decorativo', 'Suporte de Celular', 'Porta Canetas', 'Chaveiro Personalizado', 'Mascote Impressão 3D', 'Suporte para Fones', 'Organizador de Mesa', 'Mini Vaso', 'Porta Cartão', 'Ícone Decorativo', 'Suporte de Caneca', 'Caixa Organizadora']
      const types = ['PLA', 'PETG', 'ABS', 'PLA+']
      const type = pick(types)
      const costPerKg = type === 'PLA' ? rand(65, 110) : type === 'PETG' ? rand(85, 140) : type === 'ABS' ? rand(80, 130) : rand(70, 120)
      const weightUsed = rand(80, 350)
      const purgeWeight = Math.random() > 0.5 ? rand(10, 30) : 0
      const printTime = rand(2, 8)
      const power = pick([150, 180, 200, 250, 300, 350])
      const energyCost = parseFloat((rand(50, 110) / 100).toFixed(2))
      const margin = pick([30, 40, 50, 60, 80])
      const machineCost = pick([800, 1200, 1800, 2000, 2500, 3500, 5000])
      const hourlyRate = pick([20, 25, 30, 35, 50])
      const packaging = rand(2, 10)
      const shipping = Math.random() > 0.4 ? rand(10, 30) : 0
      const setupTime = rand(10, 30)
      const postTime = rand(10, 25)
      const failureValue = pick([5, 8, 10, 12, 15, 20])
      const nozzleCost = pick([15, 20, 25, 35, 50])
      const nozzleLife = pick([3, 5, 8, 10])
      const bedCost = parseFloat((rand(10, 50) / 100).toFixed(2))
      const hoursMonth = pick([50, 80, 100, 120, 150])
      const depMonths = pick([24, 36, 48])
      const infill = pick([10, 15, 20, 25, 30, 50])
      const density = type === 'PLA' ? 1.24 : type === 'PETG' ? 1.27 : type === 'ABS' ? 1.04 : 1.24
      const spoolEff = pick([95, 96, 97, 98, 99])

      setWithCompute({
        activeTab: 'fdm',
        fdmMaterial: { type, weightUsed, purgeWeight, costPerKg, density, spoolEfficiency: spoolEff },
        fdmPrintParams: { printTimeHours: printTime, printerPowerWatts: power, energyCostPerKwh: energyCost, failureMode: 'percent', failureValue, riskMultiplier: 1 },
        fdmMachine: { enabled: true, machineCost, depreciationMonths: depMonths, hoursPerMonth: hoursMonth, maintenanceEnabled: false, maintenanceCost: 0 },
        fdmHardware: { enabled: true, nozzleEnabled: true, nozzleCost, nozzleLifespanKg: nozzleLife, bedEnabled: true, bedAdhesionCost: bedCost },
        fdmFinishing: { enabled: false, suppliesCost: 5 },
        fdmLabor: { enabled: true, setupTimeMinutes: setupTime, postProcessingTimeMinutes: postTime, hourlyRate },
        fdmExtras: { extrasCost: 0 },
        fdmSales: { packagingCost: packaging, shippingCost: shipping, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: margin },
        fdmOps: { enabled: false, ppeCostPerPrint: 0 },
        fdmSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
        quantity: 1,
        productName: pick(names),
        infillPercent: infill,
        targetMarginMode: false,
      })
    },

    resetCalculator: () => {
      setWithCompute({
        fdmMaterial: { ...DEFAULT_FDM_MATERIAL },
        fdmPrintParams: { ...DEFAULT_FDM_PARAMS },
        fdmMachine: { ...DEFAULT_FDM_MACHINE },
        fdmHardware: { ...DEFAULT_FDM_HARDWARE },
        fdmFinishing: { ...DEFAULT_FDM_FINISHING },
        fdmLabor: { ...DEFAULT_LABOR },
        fdmExtras: { ...DEFAULT_EXTRAS },
        fdmSales: { ...DEFAULT_SALES },
        fdmOps: { ...DEFAULT_OPS },
        fdmSoft: { ...DEFAULT_SOFT },
        resinMaterial: { ...DEFAULT_RESIN_MATERIAL },
        resinPrintParams: { ...DEFAULT_RESIN_PARAMS },
        resinPostProcess: { ...DEFAULT_RESIN_PP },
        resinMachine: { ...DEFAULT_RESIN_MACHINE },
        resinHardware: { ...DEFAULT_RESIN_HARDWARE },
        resinLabor: { ...DEFAULT_RESIN_LABOR },
        resinExtras: { ...DEFAULT_RESIN_EXTRAS },
        resinSales: { ...DEFAULT_RESIN_SALES },
        resinOps: { ...DEFAULT_RESIN_OPS },
        resinSoft: { ...DEFAULT_RESIN_SOFT },
        fixedCosts: { ...DEFAULT_FIXED_COSTS },
        productName: '',
        quantity: 1,
        infillPercent: 20,
        targetMarginMode: false,
        fdmAmsEnabled: false,
        fdmAmsSlots: DEFAULT_AMS_SLOTS.map(s => ({ ...s })),
        selectedPrinter: printers[0],
        selectedMarketplace: marketplaces[0],
        selectedSpoolId: null,
        lastDeductedInfo: null,
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
        id,
        timestamp: now,
        type: s.activeTab,
        name,
        summary: name,
        totalCost: r.totalCost,
        sellPrice: r.sellPrice,
        profit: r.profit,
        result: r,
        snapshot,
      })

      // Auto-deduct filament from inventory
      if (s.activeTab === 'fdm' && s.selectedSpoolId !== null && r.unitWeight > 0) {
        useFilamentInventory.getState().deductWeight(s.selectedSpoolId, r.unitWeight)
        set({ lastDeductedInfo: { spoolId: s.selectedSpoolId, weight: r.unitWeight } })
      }
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
        currency: s.currency,
        calcLevel: s.calcLevel, hiddenFields: s.hiddenFields,
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
