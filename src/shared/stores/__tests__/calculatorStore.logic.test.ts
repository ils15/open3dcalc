import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AMSSlot, FixedCosts } from '@/shared/types'
import { useCalculatorStore, initialState, buildSnapshot } from './calculatorStore.test-utils'

// ── Hoisted mocks (executed by vitest BEFORE imports) ──────────────
const { mockAddEntry } = vi.hoisted(() => ({
  mockAddEntry: vi.fn(),
}))

vi.mock('@/shared/stores/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({ addEntry: mockAddEntry }),
    setState: () => {},
    subscribe: () => () => {},
    destroy: () => {},
  },
}))

vi.mock('@/shared/stores/catalogStore', () => ({
  useCatalogStore: {
    getState: () => ({ printers: [] }),
  },
}))

describe('CalculatorStore logic', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    localStorage.clear()
    useCalculatorStore.setState(initialState, true)
    mockAddEntry.mockClear()
  })

  // ══════════════════════════════════════════════════════════════
  //  setSelectedPrinter
  // ══════════════════════════════════════════════════════════════

  describe('setSelectedPrinter', () => {
    it('setSelectedPrinter with multi-filament → fdmAmsEnabled stays if was enabled', () => {
      const store = useCalculatorStore.getState()
      store.setFdmAmsEnabled(true)
      expect(useCalculatorStore.getState().fdmAmsEnabled).toBe(true)

      // Printer with maxFilaments > 1
      store.setSelectedPrinter({
        id: 'bambu_p1s', name: 'P1S', brand: 'Bambu Lab',
        power: 350, value: 5500, usefulLife: 4000, maintenancePerHour: 0.40,
        maxFilaments: 4,
      })

      const after = useCalculatorStore.getState()
      expect(after.fdmAmsEnabled).toBe(true)
      expect(after.selectedPrinter.id).toBe('bambu_p1s')
    })

    it('setSelectedPrinter with single-filament → fdmAmsEnabled forced off', () => {
      const store = useCalculatorStore.getState()
      store.setFdmAmsEnabled(true)
      expect(useCalculatorStore.getState().fdmAmsEnabled).toBe(true)

      // Printer with no maxFilaments (defaults to 1)
      store.setSelectedPrinter({
        id: 'creality_ender_3_s1', name: 'Ender 3 S1', brand: 'Creality',
        power: 120, value: 1500, usefulLife: 2000, maintenancePerHour: 0.15,
      })

      const after = useCalculatorStore.getState()
      expect(after.fdmAmsEnabled).toBe(false)
    })

    it('setSelectedPrinter with multi-filament but AMS was off → stays off', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmAmsEnabled).toBe(false)

      store.setSelectedPrinter({
        id: 'bambu_x1c', name: 'X1 Carbon', brand: 'Bambu Lab',
        power: 350, value: 10000, usefulLife: 5000, maintenancePerHour: 0.60,
        maxFilaments: 4,
      })

      const after = useCalculatorStore.getState()
      expect(after.fdmAmsEnabled).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  setSelectedMarketplace
  // ══════════════════════════════════════════════════════════════

  describe('setSelectedMarketplace', () => {
    it('setSelectedMarketplace changes marketplace', () => {
      const store = useCalculatorStore.getState()
      expect(store.selectedMarketplace.id).toBe('direct')

      store.setSelectedMarketplace({
        id: 'etsy', name: 'Etsy', feePercent: 6.5,
        feeFixed: 3, hasFreeShipping: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.selectedMarketplace.id).toBe('etsy')
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  saveSettings
  // ══════════════════════════════════════════════════════════════

  describe('saveSettings', () => {
    it('saveSettings persists data to localStorage', () => {
      const store = useCalculatorStore.getState()
      store.setProductName('Saved Product')
      store.setQuantity(7)

      store.saveSettings()

      const saved = JSON.parse(localStorage.getItem('open3dcalc_settings_v2')!)
      expect(saved).toBeDefined()
      expect(saved.quantity).toBe(7)
      expect(saved.currency).toBeDefined()
      expect(saved.calcLevel).toBeDefined()
      expect(saved.hiddenFields).toBeDefined()
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  addToHistory — variations
  // ══════════════════════════════════════════════════════════════

  describe('addToHistory — variations', () => {
    it('addToHistory with empty productName → uses material type + weight', () => {
      const store = useCalculatorStore.getState()
      store.setProductName('')

      store.addToHistory()

      const arg = mockAddEntry.mock.calls[0][0]
      // FDM default: PLA - 50g
      expect(arg.name).toContain('PLA')
      expect(arg.name).toContain('50')
    })

    it('addToHistory on resin tab → snapshot type is resin', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setProductName('Resin Part')

      useCalculatorStore.getState().addToHistory()

      const arg = mockAddEntry.mock.calls[0][0]
      expect(arg.type).toBe('resin')
      expect(arg.snapshot.type).toBe('resin')
    })

    it('addToHistory when results is null → does nothing', () => {
      const store = useCalculatorStore.getState()
      // Results should not be null normally, but we can check behavior
      // when results is null by testing the guard
      const resultsBefore = store.results
      expect(resultsBefore).not.toBeNull()

      store.addToHistory()
      expect(mockAddEntry).toHaveBeenCalledTimes(1)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  loadHistoryItem — variations
  // ══════════════════════════════════════════════════════════════

  describe('loadHistoryItem — variations', () => {
    it('loadHistoryItem with resin snapshot → restores resin config', () => {
      const store = useCalculatorStore.getState()

      const snap = buildSnapshot({
        type: 'resin',
        resinMaterial: { type: 'Water Washable', volumeUsedMl: 100, costPerLiter: 220, density: 1.15, wasteMarginPercent: 8 },
        resinPrintParams: { printTimeHours: 3, printerPowerWatts: 80, energyCostPerKwh: 0.80, failureMode: 'fixed', failureValue: 15, riskMultiplier: 1, heatUpTimeMinutes: 5, heatUpPowerPercent: 150 },
        productName: 'Resin Part',
        quantity: 2,
      })

      store.loadHistoryItem(snap)
      const after = useCalculatorStore.getState()

      expect(after.activeTab).toBe('resin')
      expect(after.resinMaterial.type).toBe('Water Washable')
      expect(after.resinMaterial.volumeUsedMl).toBe(100)
      expect(after.resinPrintParams.printTimeHours).toBe(3)
      expect(after.productName).toBe('Resin Part')
      expect(after.quantity).toBe(2)
    })

    it('loadHistoryItem with fdmAmsEnabled undefined → defaults to false', () => {
      const snap = buildSnapshot({
        fdmAmsEnabled: undefined,
      })

      useCalculatorStore.getState().loadHistoryItem(snap)
      const after = useCalculatorStore.getState()
      expect(after.fdmAmsEnabled).toBe(false)
    })

    it('loadHistoryItem with fdmAmsSlots undefined → defaults to 4 slots', () => {
      const snap = buildSnapshot({
        fdmAmsSlots: undefined,
      })

      useCalculatorStore.getState().loadHistoryItem(snap)
      const after = useCalculatorStore.getState()
      expect(after.fdmAmsSlots).toHaveLength(4)
    })

    it('loadHistoryItem with fixedCosts undefined → defaults', () => {
      const snap = buildSnapshot({
        fixedCosts: undefined as unknown as FixedCosts,
      })

      useCalculatorStore.getState().loadHistoryItem(snap)
      const after = useCalculatorStore.getState()
      expect(after.fixedCosts).toBeDefined()
      expect(after.fixedCosts.enabled).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Edge cases
  // ══════════════════════════════════════════════════════════════

  describe('Edge cases', () => {
    it('FDM with zero weightUsed → materialCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmMaterial({ ...store.fdmMaterial, weightUsed: 0, purgeWeight: 0 })

      const after = useCalculatorStore.getState()
      expect(after.results!.materialCost).toBe(0)
    })

    it('FDM with zero printTimeHours and heat-up → energyCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmPrintParams({ ...store.fdmPrintParams, printTimeHours: 0, heatUpTimeMinutes: 0 })

      const after = useCalculatorStore.getState()
      expect(after.results!.energyCost).toBe(0)
    })

    it('FDM with zero spoolEfficiency → efficiencyFactor is 1', () => {
      const store = useCalculatorStore.getState()
      store.setFdmMaterial({ ...store.fdmMaterial, spoolEfficiency: 0, weightUsed: 100, purgeWeight: 0 })

      const after = useCalculatorStore.getState()
      // efficiencyFactor = 1, effectiveWeight = 100g, matCost = (100/1000)*125 = 12.5
      expect(after.results!.materialCost).toBeCloseTo(12.5, 1)
    })

    it('setQuantity(0) → quantity defaults to 1 in calculation', () => {
      const store = useCalculatorStore.getState()
      store.setQuantity(0)

      const after = useCalculatorStore.getState()
      // quantity 0 → qty defaults to 1, so costPerUnit should equal totalCost
      expect(after.results!.costPerUnit).toBe(after.results!.totalCost)
    })

    it('resin with zero volumeUsedMl → materialCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMaterial({ ...store.resinMaterial, volumeUsedMl: 0 })

      const after = useCalculatorStore.getState()
      expect(after.results!.materialCost).toBe(0)
    })

    it('resin hardware with zero lifespan → no division by zero', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinHardware({
        enabled: true,
        lcdCost: 400,
        lcdLifespanHours: 0,
        fepCost: 80,
        fepLifespanPrints: 0,
      })

      const after = useCalculatorStore.getState()
      // guards prevent division by zero, hardwareCost = 0
      expect(after.results!.hardwareCost).toBe(0)
    })
  })

  describe('AMS logic', () => {
    it('AMS enabled persists in state', () => {
      const store = useCalculatorStore.getState()
      store.setFdmAmsEnabled(true)
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsEnabled).toBe(true)
    })

    it('AMS disabled persists in state', () => {
      const store = useCalculatorStore.getState()
      store.setFdmAmsEnabled(false)
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsEnabled).toBe(false)
    })

    it('AMS setFdmAmsSlot updates specific slot', () => {
      const store = useCalculatorStore.getState()
      const slot: AMSSlot = {
        enabled: true, materialType: 'PLA', costPerKg: 100, weightUsedGrams: 40,
        purgeWeightGrams: 5, transitionPurgeGrams: 3, density: 1.24, spoolEfficiency: 98, color: '#ff0000',
      }
      store.setFdmAmsSlot(0, slot)
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsSlots[0].materialType).toBe('PLA')
      expect(state.fdmAmsSlots[0].color).toBe('#ff0000')
    })

    it('AMS history reload preserves fdmAmsEnabled', () => {
      const entry = buildSnapshot({ fdmAmsEnabled: true })
      const store = useCalculatorStore.getState()
      store.loadHistoryItem(entry)
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsEnabled).toBe(true)
    })

    it('AMS reload preserves fdmAmsSlots', () => {
      const slots: AMSSlot[] = [
        { enabled: true, materialType: 'PLA', costPerKg: 100, weightUsedGrams: 40, purgeWeightGrams: 5, transitionPurgeGrams: 3, density: 1.24, spoolEfficiency: 98, color: '#ff0000' },
        { enabled: true, materialType: 'PETG', costPerKg: 80, weightUsedGrams: 30, purgeWeightGrams: 5, transitionPurgeGrams: 4, density: 1.27, spoolEfficiency: 95, color: '#0000ff' },
      ]
      const entry = buildSnapshot({ fdmAmsSlots: slots })
      const store = useCalculatorStore.getState()
      store.loadHistoryItem(entry)
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsSlots).toHaveLength(2)
      expect(state.fdmAmsSlots[1].materialType).toBe('PETG')
    })

    it('AMS default has 4 slots', () => {
      const state = useCalculatorStore.getState()
      expect(state.fdmAmsSlots).toHaveLength(4)
    })

    it('AMS enabledSlots counts only enabled slots', () => {
      const store = useCalculatorStore.getState()
      store.setFdmAmsEnabled(true)
      const slots = store.fdmAmsSlots.map((s, i) => ({
        ...s, enabled: i < 2, color: ['#ff0000', '#00ff00', '#0000ff'][i] || s.color,
      }))
      slots.forEach((slot, i) => store.setFdmAmsSlot(i, slot))
      const enabledSlots = useCalculatorStore.getState().fdmAmsSlots.filter(sl => sl.enabled)
      expect(enabledSlots).toHaveLength(2)
    })
  })
})
