import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCalculatorStore, initialState } from './calculatorStore.test-utils'

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

describe('CalculatorStore FDM', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    localStorage.clear()
    useCalculatorStore.setState(initialState, true)
    mockAddEntry.mockClear()
  })

  describe('section filtering', () => {
    it('setFdmMachine() → machineCost reflects new machine', () => {
      const store = useCalculatorStore.getState()
      const before = store.results!.machineCost

      store.setFdmMachine({
        ...store.fdmMachine,
        machineCost: 10000,
      })

      const after = useCalculatorStore.getState()
      expect(after.fdmMachine.machineCost).toBe(10000)
      expect(after.results!.machineCost).not.toBe(before)
    })

    it('machine disabled → machineCost === 0', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmMachine.enabled).toBe(true)
      expect(store.results!.machineCost).toBeGreaterThan(0)

      store.setFdmMachine({ ...store.fdmMachine, enabled: false })
      const after = useCalculatorStore.getState()
      expect(after.results!.machineCost).toBe(0)
    })

    it('machine maintenanceEnabled → adds maintenance cost', () => {
      const store = useCalculatorStore.getState()
      store.setFdmMachine({
        ...store.fdmMachine,
        enabled: true,
        maintenanceEnabled: true,
        maintenanceCost: 100,
        hoursPerMonth: 200,
      })

      const after = useCalculatorStore.getState()
      // maintenance per hour = 100/200 = 0.5, multiplied by print time
      expect(after.results!.machineCost).toBeGreaterThan(0)
    })

    it('machine with zero hoursPerMonth → no division by zero', () => {
      const store = useCalculatorStore.getState()
      store.setFdmMachine({
        ...store.fdmMachine,
        enabled: true,
        maintenanceEnabled: true,
        maintenanceCost: 100,
        hoursPerMonth: 0,
      })

      const after = useCalculatorStore.getState()
      // Should not throw, maintenance = 0 when hoursPerMonth is 0
      expect(after.results).not.toBeNull()
    })

    it('hardware disabled → hardwareCost === 0', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmHardware.enabled).toBe(true)
      expect(store.results!.hardwareCost).toBeGreaterThan(0)

      store.setFdmHardware({ ...store.fdmHardware, enabled: false })
      const after = useCalculatorStore.getState()
      expect(after.results!.hardwareCost).toBe(0)
    })

    it('hardware with nozzle disabled → only bed cost', () => {
      const store = useCalculatorStore.getState()
      store.setFdmHardware({
        ...store.fdmHardware,
        enabled: true,
        nozzleEnabled: false,
        bedEnabled: true,
        bedAdhesionCost: 1.50,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.hardwareCost).toBe(1.50)
    })

    it('hardware with nozzle lifespanKg=0 → nozzle depreciation 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmHardware({
        ...store.fdmHardware,
        enabled: true,
        nozzleEnabled: true,
        nozzleLifespanKg: 0,
        bedEnabled: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.hardwareCost).toBe(0)
    })

    it('hardware with both nozzle and bed disabled → hardwareCost 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmHardware({
        ...store.fdmHardware,
        enabled: true,
        nozzleEnabled: false,
        bedEnabled: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.hardwareCost).toBe(0)
    })

    it('finishing enabled → postProcessingCost includes suppliesCost', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmFinishing.enabled).toBe(false)
      expect(store.results!.postProcessingCost).toBe(0)

      store.setFdmFinishing({ enabled: true, suppliesCost: 5 })
      const after = useCalculatorStore.getState()
      expect(after.results!.postProcessingCost).toBe(5)
    })

    it('finishing disabled → postProcessingCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmFinishing({ enabled: true, suppliesCost: 10 })
      const after1 = useCalculatorStore.getState()
      expect(after1.results!.postProcessingCost).toBe(10)

      store.setFdmFinishing({ enabled: false, suppliesCost: 10 })
      const after2 = useCalculatorStore.getState()
      expect(after2.results!.postProcessingCost).toBe(0)
    })

    it('labor enabled → laborCost > 0', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmLabor.enabled).toBe(false)
      expect(store.results!.laborCost).toBe(0)

      store.setFdmLabor({
        enabled: true,
        setupTimeMinutes: 15,
        postProcessingTimeMinutes: 20,
        hourlyRate: 25,
      })

      const after = useCalculatorStore.getState()
      // (15+20)/60 * 25 = 14.583
      expect(after.results!.laborCost).toBeCloseTo((35 / 60) * 25, 1)
    })

    it('extras with cost → extrasCost included', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmExtras.extrasCost).toBe(0)

      store.setFdmExtras({ extrasCost: 15 })
      const after = useCalculatorStore.getState()
      expect(after.results!.extrasCost).toBe(15)
    })

    it('ops enabled → consumablesCost includes PPE cost', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmOps.enabled).toBe(false)
      expect(store.results!.consumablesCost).toBe(0)

      store.setFdmOps({ enabled: true, ppeCostPerPrint: 2.5, carbonIntensity: 100 })
      const after = useCalculatorStore.getState()
      expect(after.results!.consumablesCost).toBe(2.5)
    })

    it('ops disabled → consumablesCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmOps({ enabled: true, ppeCostPerPrint: 5, carbonIntensity: 100 })
      const after1 = useCalculatorStore.getState()
      expect(after1.results!.consumablesCost).toBe(5)

      store.setFdmOps({ enabled: false, ppeCostPerPrint: 5, carbonIntensity: 100 })
      const after2 = useCalculatorStore.getState()
      expect(after2.results!.consumablesCost).toBe(0)
    })

    it('software enabled → softwareCost > 0', () => {
      const store = useCalculatorStore.getState()
      expect(store.fdmSoft.enabled).toBe(false)
      expect(store.results!.softwareCost).toBe(0)

      store.setFdmSoft({
        enabled: true,
        slicerMonthlyCost: 60,
        modelFileCost: 10,
      })

      const after = useCalculatorStore.getState()
      // softwareHourly = 60 / 200 = 0.3
      // softwareTotal = 0.3 * 5 (printTimeHours) + 10 = 11.5
      expect(after.results!.softwareCost).toBeCloseTo(11.5, 1)
    })

    it('software with zero hoursPerMonth → uses 0 hourly rate', () => {
      const store = useCalculatorStore.getState()
      store.setFdmSoft({
        enabled: true,
        slicerMonthlyCost: 60,
        modelFileCost: 10,
      })
      store.setFdmMachine({
        ...store.fdmMachine,
        enabled: true,
        hoursPerMonth: 0,
      })

      const after = useCalculatorStore.getState()
      // softwareHourly = 60 / 0 = 0 (guard), softwareTotal = 0 * 5 + 10 = 10
      expect(after.results!.softwareCost).toBe(10)
    })
  })

  describe('failure modes', () => {
    it('failureMode "fixed" → failureCost is the fixed value', () => {
      const store = useCalculatorStore.getState()
      store.setFdmPrintParams({
        ...store.fdmPrintParams,
        failureMode: 'fixed',
        failureValue: 20,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.failureCost).toBe(20)
    })

    it('failureMode "none" → failureCost is 0', () => {
      const store = useCalculatorStore.getState()
      store.setFdmPrintParams({
        ...store.fdmPrintParams,
        failureMode: 'none',
        failureValue: 0,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.failureCost).toBe(0)
    })

    it('failureMode "percent" with riskMultiplier → scaled failure', () => {
      const store = useCalculatorStore.getState()
      const subtotalBefore = store.results!.subtotal

      store.setFdmPrintParams({
        ...store.fdmPrintParams,
        failureMode: 'percent',
        failureValue: 10,
        riskMultiplier: 2,
      })

      const after = useCalculatorStore.getState()
      // failureCost = subtotal * (10 * 2 / 100) = subtotal * 0.2
      expect(after.results!.failureCost).toBeCloseTo(subtotalBefore * 0.2, 1)
    })
  })

  describe('quantity > 1 with labor', () => {
    it('qty=5 with labor → totalCost amortized (lower than single-unit cost)', () => {
      const store = useCalculatorStore.getState()
      // First get single-unit totalCost for reference
      store.setFdmLabor({
        enabled: true,
        setupTimeMinutes: 30,
        postProcessingTimeMinutes: 30,
        hourlyRate: 25,
      })
      store.setQuantity(1)
      const singleUnitTotal = useCalculatorStore.getState().results!.totalCost

      store.setQuantity(5)
      const after = useCalculatorStore.getState()
      const r = after.results!
      // setupCost = (30+30)/60 * 25 = 25
      // perUnitCost = singleUnitTotal - 25 + 25/5 = singleUnitTotal - 20
      // Both totalCost and costPerUnit are set to perUnitCost in the return
      expect(r.costPerUnit).toBeGreaterThan(0)
      expect(r.costPerUnit).toBeLessThan(singleUnitTotal)
    })

    it('qty=1 with labor → costPerUnit === totalCost', () => {
      const store = useCalculatorStore.getState()
      store.setFdmLabor({
        enabled: true,
        setupTimeMinutes: 15,
        postProcessingTimeMinutes: 15,
        hourlyRate: 30,
      })
      store.setQuantity(1)

      const after = useCalculatorStore.getState()
      const r = after.results!
      // setupCost = 30/60 * 30 = 15
      // perUnitCost = totalCost - 15 + 15/1 = totalCost
      expect(r.costPerUnit).toBe(r.totalCost)
    })
  })

  describe('sell price edge cases', () => {
    it('feePercent >= 1 → sellPrice uses priceBeforeFees * 2 fallback', () => {
      const store = useCalculatorStore.getState()
      // tax + marketplace fee = 60 + 50 = 110 → /100 = 1.1 ≥ 1
      store.setFdmSales({
        ...store.fdmSales,
        taxPercent: 60,
        marketplaceFeePercent: 50,
        profitMarginPercent: 10,
      })

      const after = useCalculatorStore.getState()
      const r = after.results!
      const totalBaseCost = r.totalCost
      const profitAmountRaw = totalBaseCost * 0.10
      const priceBeforeFees = totalBaseCost + profitAmountRaw
      // Since (60+50)/100 = 1.1 >= 1, sellPrice = priceBeforeFees * 2
      expect(r.sellPrice).toBeCloseTo(priceBeforeFees * 2, 1)
    })

    it('zero profitMarginPercent → sellPrice covers only costs', () => {
      const store = useCalculatorStore.getState()
      store.setFdmSales({
        ...store.fdmSales,
        profitMarginPercent: 0,
        taxPercent: 0,
        marketplaceFeePercent: 0,
      })

      const after = useCalculatorStore.getState()
      const r = after.results!
      // totalFeePercent = 0, so sellPrice = priceBeforeFees / 1 = priceBeforeFees = totalBaseCost
      expect(r.sellPrice).toBeCloseTo(r.totalCost, 1)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  FDM — Fixed Costs
  // ══════════════════════════════════════════════════════════════

  describe('fixed costs', () => {
    it('setFixedCostsField enabled → adds fixedCostPerHour to machine', () => {
      const store = useCalculatorStore.getState()
      const machineBefore = store.results!.machineCost

      store.setFixedCostsField('enabled', true)
      store.setFixedCostsField('monthlyCost', 600)
      store.setFixedCostsField('monthlyPrintHours', 160)

      const after = useCalculatorStore.getState()
      // fixedCostPerHour = 600/160 = 3.75
      // machineCost should increase by fixedCostPerHour * printTimeHours
      expect(after.results!.machineCost).toBeGreaterThan(machineBefore)
      expect(after.fixedCosts.enabled).toBe(true)
      expect(after.fixedCosts.monthlyCost).toBe(600)
    })

    it('setFixedCostsField disabled → fixedCostPerHour is 0', () => {
      const store = useCalculatorStore.getState()
      store.setFixedCostsField('enabled', true)
      store.setFixedCostsField('monthlyCost', 600)
      store.setFixedCostsField('monthlyPrintHours', 160)
      const withFixed = useCalculatorStore.getState().results!.machineCost

      store.setFixedCostsField('enabled', false)
      const withoutFixed = useCalculatorStore.getState().results!.machineCost

      expect(withFixed).toBeGreaterThan(withoutFixed)
    })

    it('fixedCosts with zero monthlyPrintHours → no division by zero', () => {
      const store = useCalculatorStore.getState()
      store.setFixedCostsField('enabled', true)
      store.setFixedCostsField('monthlyCost', 600)
      store.setFixedCostsField('monthlyPrintHours', 0)

      const after = useCalculatorStore.getState()
      expect(after.results).not.toBeNull()
    })

  })
})
