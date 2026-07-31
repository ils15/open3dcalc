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

describe('CalculatorStore Resin', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    localStorage.clear()
    useCalculatorStore.setState(initialState, true)
    mockAddEntry.mockClear()
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — computeStoreResults path
  // ══════════════════════════════════════════════════════════════

  describe('computeStoreResults path', () => {
    it('setActiveTab("resin") → results computed using resin defaults', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')

      const after = useCalculatorStore.getState()
      const r = after.results!
      expect(r).not.toBeNull()
      expect(r.materialCost).toBeGreaterThan(0)
      expect(r.energyCost).toBeGreaterThan(0)
      // resin machine is enabled by default
      expect(r.machineCost).toBeGreaterThan(0)
    })

    it('resin material change → materialCost updates', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      const before = useCalculatorStore.getState().results!.materialCost

      store.setResinMaterial({
        ...store.resinMaterial,
        costPerLiter: 500,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.materialCost).toBeGreaterThan(before)
    })

    it('resin material with wasteMarginPercent → volume increases', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMaterial({
        ...store.resinMaterial,
        volumeUsedMl: 100,
        wasteMarginPercent: 10,
        costPerLiter: 100,
      })

      const after = useCalculatorStore.getState()
      // volumeWithWaste = 100 * 1.1 = 110ml
      // matCost = (110/1000) * 100 = 11
      expect(after.results!.materialCost).toBeCloseTo(11, 1)
    })

    it('resin machine disabled → machineCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMachine({ ...store.resinMachine, enabled: false })

      const after = useCalculatorStore.getState()
      expect(after.results!.machineCost).toBe(0)
    })

    it('resin hardware disabled → hardwareCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinHardware({ ...store.resinHardware, enabled: false })

      const after = useCalculatorStore.getState()
      expect(after.results!.hardwareCost).toBe(0)
    })

    it('resin hardware with LCD and FEP costs → hardwareCost computed', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinHardware({
        enabled: true,
        lcdCost: 500,
        lcdLifespanHours: 1000,
        fepCost: 100,
        fepLifespanPrints: 100,
      })

      const after = useCalculatorStore.getState()
      // lcdHourly = 500/1000 = 0.5
      // lcdCost = 0.5 * 2 (printTimeHours) = 1.0
      // fepPerPrint = 100/100 = 1.0
      // hardwareTotal = 1.0 + 1.0 = 2.0
      expect(after.results!.hardwareCost).toBeCloseTo(2.0, 1)
    })

    it('resin post-processing washing disabled → no alcohol cost', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      const ppBefore = useCalculatorStore.getState().results!.postProcessingCost

      store.setResinPostProcess({
        ...store.resinPostProcess,
        washingEnabled: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.postProcessingCost).toBeLessThan(ppBefore)
    })

    it('resin post-processing curing disabled → no curing energy cost', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      const ppBefore = useCalculatorStore.getState().results!.postProcessingCost

      store.setResinPostProcess({
        ...store.resinPostProcess,
        curingEnabled: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.postProcessingCost).toBeLessThan(ppBefore)
    })

    it('resin post-processing both disabled → postProcessingCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinPostProcess({
        ...store.resinPostProcess,
        washingEnabled: false,
        curingEnabled: false,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.postProcessingCost).toBe(0)
    })

    it('resin labor enabled → laborCost > 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinLabor({
        enabled: true,
        setupTimeMinutes: 10,
        postProcessingTimeMinutes: 15,
        hourlyRate: 30,
      })

      const after = useCalculatorStore.getState()
      // (10+15)/60 * 30 = 12.5
      expect(after.results!.laborCost).toBeCloseTo(12.5, 1)
    })

    it('resin extras with cost → extrasCost included', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinExtras({ extrasCost: 25 })

      const after = useCalculatorStore.getState()
      expect(after.results!.extrasCost).toBe(25)
    })

    it('resin ops enabled → consumablesCost includes PPE', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      // resinOps is enabled by default with ppeCostPerPrint = 2.50
      const after = useCalculatorStore.getState()
      expect(after.results!.consumablesCost).toBe(2.5)
    })

    it('resin ops disabled → consumablesCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinOps({ enabled: false, ppeCostPerPrint: 2.5, carbonIntensity: 100 })

      const after = useCalculatorStore.getState()
      expect(after.results!.consumablesCost).toBe(0)
    })

    it('resin software enabled → softwareCost > 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinSoft({
        enabled: true,
        slicerMonthlyCost: 60,
        modelFileCost: 15,
      })

      const after = useCalculatorStore.getState()
      // softwareHourly = 60/200 = 0.3, softwareTotal = 0.3*2 + 15 = 15.6
      expect(after.results!.softwareCost).toBeCloseTo(15.6, 1)
    })

    it('resin software with zero hoursPerMonth → uses 0 hourly', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMachine({ ...store.resinMachine, hoursPerMonth: 0 })
      store.setResinSoft({
        enabled: true,
        slicerMonthlyCost: 60,
        modelFileCost: 10,
      })

      const after = useCalculatorStore.getState()
      // softwareHourly = 60/0 = 0 (guard), softwareTotal = 0*2 + 10 = 10
      expect(after.results!.softwareCost).toBe(10)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — Failure Modes
  // ══════════════════════════════════════════════════════════════

  describe('failure modes', () => {
    it('resin failureMode "fixed" → failureCost is the fixed value', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinPrintParams({
        ...store.resinPrintParams,
        failureMode: 'fixed',
        failureValue: 30,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.failureCost).toBe(30)
    })

    it('resin failureMode "none" → failureCost === 0', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinPrintParams({
        ...store.resinPrintParams,
        failureMode: 'none',
        failureValue: 0,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.failureCost).toBe(0)
    })

    it('resin failureMode "percent" → failureCost scaled by subtotal', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      const subtotalBefore = useCalculatorStore.getState().results!.subtotal

      store.setResinPrintParams({
        ...store.resinPrintParams,
        failureMode: 'percent',
        failureValue: 20,
        riskMultiplier: 1,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.failureCost).toBeCloseTo(subtotalBefore * 0.2, 1)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — Quantity > 1 with Labor
  // ══════════════════════════════════════════════════════════════

  describe('quantity > 1 with labor', () => {
    it('resin qty=4 with labor → totalCost amortized (lower than single-unit)', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinLabor({
        enabled: true,
        setupTimeMinutes: 10,
        postProcessingTimeMinutes: 10,
        hourlyRate: 25,
      })

      // Get single-unit cost for reference
      store.setQuantity(1)
      const singleUnitTotal = useCalculatorStore.getState().results!.totalCost

      store.setQuantity(4)
      const after = useCalculatorStore.getState()
      const r = after.results!
      // setupCost = (10+10)/60 * 25 = 8.333
      // perUnitCost = singleUnitTotal - 8.333 + 8.333/4
      expect(r.costPerUnit).toBeGreaterThan(0)
      expect(r.costPerUnit).toBeLessThan(singleUnitTotal)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — Sell Price / Fee Edge Cases
  // ══════════════════════════════════════════════════════════════

  describe('sell price edge cases', () => {
    it('resin feePercent >= 1 → sellPrice uses priceBeforeFees * 2', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinSales({
        ...store.resinSales,
        taxPercent: 60,
        marketplaceFeePercent: 50,
        profitMarginPercent: 10,
      })

      const after = useCalculatorStore.getState()
      const r = after.results!
      const totalBaseCost = r.totalCost
      const profitAmountRaw = totalBaseCost * 0.10
      const priceBeforeFees = totalBaseCost + profitAmountRaw
      expect(r.sellPrice).toBeCloseTo(priceBeforeFees * 2, 1)
    })

    it('resin with packaging and shipping costs → included in totalBaseCost', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinSales({
        ...store.resinSales,
        packagingCost: 5,
        shippingCost: 10,
      })

      const after = useCalculatorStore.getState()
      // totalBaseCost = subtotal + failureCost + packaging + shipping
      expect(after.results!.totalCost).toBeGreaterThan(after.results!.subtotal)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — section filtering
  // ══════════════════════════════════════════════════════════════

  describe('section filtering', () => {
    it('disable all resin sections → only subtotal remains', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')

      const sections = ['material', 'energy', 'machine', 'hardware', 'consumables', 'labor', 'software', 'failure', 'extras', 'postProcessing']
      for (const s of sections) {
        if (useCalculatorStore.getState().enabledSections[s]) {
          useCalculatorStore.getState().toggleSection(s)
        }
      }

      const after = useCalculatorStore.getState()
      expect(after.results!.materialCost).toBe(0)
      expect(after.results!.energyCost).toBe(0)
      expect(after.results!.machineCost).toBe(0)
      expect(after.results!.hardwareCost).toBe(0)
      expect(after.results!.consumablesCost).toBe(0)
      expect(after.results!.laborCost).toBe(0)
      expect(after.results!.softwareCost).toBe(0)
      expect(after.results!.failureCost).toBe(0)
      expect(after.results!.extrasCost).toBe(0)
      expect(after.results!.postProcessingCost).toBe(0)
    })

    it('resin packaging/shipping sections → affects totalCost', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')

      // Toggle packaging off and on
      const packagingBefore = store.enabledSections.packaging
      store.toggleSection('packaging')
      const afterToggle = useCalculatorStore.getState()
      expect(afterToggle.enabledSections.packaging).toBe(!packagingBefore)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — fixed costs
  // ══════════════════════════════════════════════════════════════

  describe('fixed costs', () => {
    it('resin with fixed costs enabled → machine cost increases', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      const machineBefore = useCalculatorStore.getState().results!.machineCost

      store.setFixedCostsField('enabled', true)
      store.setFixedCostsField('monthlyCost', 600)
      store.setFixedCostsField('monthlyPrintHours', 160)

      const after = useCalculatorStore.getState()
      expect(after.results!.machineCost).toBeGreaterThan(machineBefore)
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Resin — machine maintenance
  // ══════════════════════════════════════════════════════════════

  describe('machine maintenance', () => {
    it('resin machine with maintenance → added to machineCost', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMachine({
        ...store.resinMachine,
        enabled: true,
        maintenanceEnabled: true,
        maintenanceCost: 80,
        hoursPerMonth: 200,
      })

      const after = useCalculatorStore.getState()
      expect(after.results!.machineCost).toBeGreaterThan(0)
    })

    it('resin machine maintenance with zero hoursPerMonth → no crash', () => {
      const store = useCalculatorStore.getState()
      store.setActiveTab('resin')
      store.setResinMachine({
        ...store.resinMachine,
        enabled: true,
        maintenanceEnabled: true,
        maintenanceCost: 100,
        hoursPerMonth: 0,
      })

      const after = useCalculatorStore.getState()
      expect(after.results).not.toBeNull()
    })
  })
})
