import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MaterialStateFDM, PrintParameters } from '@/shared/types'
import { useCalculatorStore, initialState, buildSnapshot } from './calculatorStore.test-utils'

// ── Hoisted mocks (executed by vitest BEFORE imports) ──────────────
const { mockAddEntry, mockDeductWeight } = vi.hoisted(() => ({
  mockAddEntry: vi.fn(),
  mockDeductWeight: vi.fn(),
}))

vi.mock('@/shared/stores/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({ addEntry: mockAddEntry }),
    setState: () => {},
    subscribe: () => () => {},
    destroy: () => {},
  },
}))

vi.mock('@/shared/stores/filamentInventory', () => ({
  useFilamentInventory: {
    getState: () => ({ deductWeight: mockDeductWeight }),
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

describe('CalculatorStore core', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    localStorage.clear()
    useCalculatorStore.setState(initialState, true)
    mockAddEntry.mockClear()
    mockDeductWeight.mockClear()
  })

  // ══════════════════════════════════════════════════════════════
  //  ORIGINAL 8 TESTS
  // ══════════════════════════════════════════════════════════════

  // ── 1. toggleSection ─────────────────────────────────────────
  it('toggleSection("energy") → results.energyCost === 0', () => {
    const store = useCalculatorStore.getState()
    expect(store.enabledSections.energy).toBe(true)
    const energyBefore = store.results!.energyCost
    expect(energyBefore).toBeGreaterThan(0)

    store.toggleSection('energy')
    const after = useCalculatorStore.getState()

    expect(after.enabledSections.energy).toBe(false)
    expect(after.results!.energyCost).toBe(0)
  })

  // ── 2. setFdmMaterial ────────────────────────────────────────
  it('setFdmMaterial() → recalculates with more expensive material', () => {
    const store = useCalculatorStore.getState()
    const originalCost = store.results!.materialCost

    const novoMaterial: MaterialStateFDM = {
      ...store.fdmMaterial,
      costPerKg: 999,
    }
    store.setFdmMaterial(novoMaterial)

    const after = useCalculatorStore.getState()
    expect(after.fdmMaterial.costPerKg).toBe(999)
    expect(after.results!.materialCost).toBeGreaterThan(originalCost)
  })

  // ── 3. setQuantity ───────────────────────────────────────────
  it('setQuantity(3) → results.costPerUnit is populated', () => {
    const store = useCalculatorStore.getState()
    expect(store.quantity).toBe(1)

    store.setQuantity(3)
    const after = useCalculatorStore.getState()

    expect(after.quantity).toBe(3)
    // With labor disabled, setupCost = 0, so perUnitCost == totalCost
    expect(after.results!.costPerUnit).toBeGreaterThan(0)
    expect(after.results!.costPerUnit).toBe(after.results!.totalCost)
  })

  // ── 4. loadHistoryItem ────────────────────────────────────────
  it('loadHistoryItem() restores values from snapshot', () => {
    const store = useCalculatorStore.getState()

    const snap = buildSnapshot({
      type: 'fdm',
      fdmMaterial: { type: 'PETG', weightUsed: 200, purgeWeight: 10, costPerKg: 150, density: 1.27, spoolEfficiency: 95 },
      fdmPrintParams: { printTimeHours: 8, printerPowerWatts: 300, energyCostPerKwh: 1.20, failureMode: 'percent', failureValue: 15, riskMultiplier: 1.5 },
      fdmMachine: { enabled: true, machineCost: 5000, depreciationMonths: 48, hoursPerMonth: 160, maintenanceEnabled: true, maintenanceCost: 80 },
      productName: 'Loaded Part',
      quantity: 2,
      infillPercent: 35,
      targetMarginMode: true,
      enabledSections: { ...store.enabledSections, energy: false },
    })

    store.loadHistoryItem(snap)
    const after = useCalculatorStore.getState()

    expect(after.productName).toBe('Loaded Part')
    expect(after.fdmMaterial.type).toBe('PETG')
    expect(after.fdmMaterial.weightUsed).toBe(200)
    expect(after.fdmPrintParams.printTimeHours).toBe(8)
    expect(after.fdmMachine.enabled).toBe(true)
    expect(after.quantity).toBe(2)
    expect(after.infillPercent).toBe(35)
    expect(after.targetMarginMode).toBe(true)
    expect(after.enabledSections.energy).toBe(false)
  })

  // ── 5. setActiveTab ───────────────────────────────────────────
  it('setActiveTab("resin") → activeTab changes to resin', () => {
    const store = useCalculatorStore.getState()
    expect(store.activeTab).toBe('fdm')

    store.setActiveTab('resin')
    const after = useCalculatorStore.getState()

    expect(after.activeTab).toBe('resin')
    expect(after.results).not.toBeNull()
  })

  // ── 6. toggleSection multiple ────────────────────────────────
  it('disabling multiple sections → individual costs zero out (subtotal preserved)', () => {
    const store = useCalculatorStore.getState()
    expect(store.results!.materialCost).toBeGreaterThan(0)
    expect(store.results!.energyCost).toBeGreaterThan(0)
    // calculator subtotal is not filtered → remains the same
    const subtotalBefore = store.results!.subtotal

    store.toggleSection('material')
    store.toggleSection('energy')
    store.toggleSection('machine')
    store.toggleSection('hardware')

    const after = useCalculatorStore.getState()
    expect(after.results!.materialCost).toBe(0)
    expect(after.results!.energyCost).toBe(0)
    expect(after.results!.machineCost).toBe(0)
    expect(after.results!.hardwareCost).toBe(0)
    // subtotal (from calculator) is not affected by toggle
    expect(after.results!.subtotal).toBe(subtotalBefore)
  })

  // ── 7. setFdmPrintParams ─────────────────────────────────────
  it('setFdmPrintParams() doubles hours → energyCost doubles', () => {
    const store = useCalculatorStore.getState()
    const originalEnergy = store.results!.energyCost

    const novosParams: PrintParameters = {
      ...store.fdmPrintParams,
      printTimeHours: store.fdmPrintParams.printTimeHours * 2,
    }
    store.setFdmPrintParams(novosParams)

    const after = useCalculatorStore.getState()
    expect(after.fdmPrintParams.printTimeHours).toBe(store.fdmPrintParams.printTimeHours * 2)
    // With energy enabled, energyCost scales linearly with hours
    expect(after.results!.energyCost).toBeCloseTo(originalEnergy * 2, 1)
  })

  // ── 8. addToHistory ───────────────────────────────────────────
  it('addToHistory() delegates to historyStore.addEntry with snapshot', () => {
    const store = useCalculatorStore.getState()
    store.setProductName('My Awesome Part')

    store.addToHistory()

    expect(mockAddEntry).toHaveBeenCalledTimes(1)
    const arg = mockAddEntry.mock.calls[0][0]
    expect(arg).toMatchObject({
      type: 'fdm',
      name: 'My Awesome Part',
    })
    expect(arg.id).toBeDefined()
    expect(arg.timestamp).toBeGreaterThan(0)
    expect(arg.totalCost).toBeGreaterThan(0)
    expect(arg.snapshot).toBeDefined()
    expect(arg.snapshot.productName).toBe('My Awesome Part')
  })

  // ══════════════════════════════════════════════════════════════
  //  toggleField
  // ══════════════════════════════════════════════════════════════

  describe('toggleField', () => {
    it('toggleField adds field to hiddenFields', () => {
      const store = useCalculatorStore.getState()
      expect(store.hiddenFields).not.toContain('materialCost')

      store.toggleField('materialCost')
      const after = useCalculatorStore.getState()
      expect(after.hiddenFields).toContain('materialCost')
    })

    it('toggleField removes field from hiddenFields if already present', () => {
      const store = useCalculatorStore.getState()
      store.toggleField('energyCost')
      expect(useCalculatorStore.getState().hiddenFields).toContain('energyCost')

      store.toggleField('energyCost')
      expect(useCalculatorStore.getState().hiddenFields).not.toContain('energyCost')
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Simple setters
  // ══════════════════════════════════════════════════════════════

  describe('Simple setters', () => {
    it('setProductName updates productName', () => {
      const store = useCalculatorStore.getState()
      store.setProductName('Test Product')
      expect(useCalculatorStore.getState().productName).toBe('Test Product')
    })

    it('setCalcLevel changes level', () => {
      const store = useCalculatorStore.getState()
      store.setCalcLevel('advanced')
      expect(useCalculatorStore.getState().calcLevel).toBe('advanced')

      store.setCalcLevel('intermediate')
      expect(useCalculatorStore.getState().calcLevel).toBe('intermediate')
    })

    it('setInfillPercent updates infillPercent', () => {
      const store = useCalculatorStore.getState()
      store.setInfillPercent(50)
      expect(useCalculatorStore.getState().infillPercent).toBe(50)
    })

    it('setTargetMarginMode toggles targetMarginMode', () => {
      const store = useCalculatorStore.getState()
      expect(store.targetMarginMode).toBe(false)

      store.setTargetMarginMode(true)
      expect(useCalculatorStore.getState().targetMarginMode).toBe(true)
    })

    it('setCurrency updates currency', () => {
      const store = useCalculatorStore.getState()
      store.setCurrency('BRL')
      expect(useCalculatorStore.getState().currency).toBe('BRL')
    })
  })

  // ══════════════════════════════════════════════════════════════
  //  Spool auto-deduction (Phase 1)
  // ══════════════════════════════════════════════════════════════

  describe('Spool auto-deduction', () => {
    it('setSelectedSpoolId stores and retrieves the ID', () => {
      const store = useCalculatorStore.getState()
      store.setSelectedSpoolId('spool_abc123')
      expect(useCalculatorStore.getState().selectedSpoolId).toBe('spool_abc123')
    })

    it('setSelectedSpoolId with null clears it', () => {
      const store = useCalculatorStore.getState()
      store.setSelectedSpoolId('spool_abc123')
      expect(useCalculatorStore.getState().selectedSpoolId).toBe('spool_abc123')

      store.setSelectedSpoolId(null)
      expect(useCalculatorStore.getState().selectedSpoolId).toBeNull()
    })

    it('addToHistory with FDM + selectedSpoolId + unitWeight > 0 calls deductWeight', () => {
      const store = useCalculatorStore.getState()
      store.setSelectedSpoolId('spool_456')
      store.setProductName('Deductible Part')

      store.addToHistory()

      expect(mockDeductWeight).toHaveBeenCalledTimes(1)
      expect(mockDeductWeight).toHaveBeenCalledWith('spool_456', expect.any(Number))
    })

    it('addToHistory with resin type does NOT deduct', () => {
      const store = useCalculatorStore.getState()
      store.setSelectedSpoolId('spool_789')
      store.setActiveTab('resin')
      store.setProductName('Resin Part')

      store.addToHistory()

      expect(mockDeductWeight).not.toHaveBeenCalled()
    })

    it('addToHistory with FDM but no selectedSpoolId does NOT deduct', () => {
      const store = useCalculatorStore.getState()
      // selectedSpoolId is null by default
      store.setProductName('No Spool Part')

      store.addToHistory()

      expect(mockDeductWeight).not.toHaveBeenCalled()
    })

    it('addToHistory with unitWeight === 0 does NOT deduct', () => {
      // Override material weight to zero so unitWeight becomes 0
      const store = useCalculatorStore.getState()
      store.setFdmMaterial({
        ...store.fdmMaterial,
        weightUsed: 0,
        purgeWeight: 0,
      })
      store.setSelectedSpoolId('spool_zero')
      store.setProductName('Zero Weight Part')

      store.addToHistory()

      expect(mockDeductWeight).not.toHaveBeenCalled()
    })

    it('lastDeductedInfo is set after auto-deduction', () => {
      const store = useCalculatorStore.getState()
      store.setSelectedSpoolId('spool_info_1')
      store.setProductName('Info Test')

      store.addToHistory()

      const state = useCalculatorStore.getState()
      expect(state.lastDeductedInfo).not.toBeNull()
      expect(state.lastDeductedInfo!.spoolId).toBe('spool_info_1')
      expect(state.lastDeductedInfo!.weight).toBeGreaterThan(0)
    })

    it('lastDeductedInfo is null when no deduction happens', () => {
      // Default: no selectedSpoolId
      const store = useCalculatorStore.getState()
      store.setProductName('No Deduct')

      store.addToHistory()

      expect(useCalculatorStore.getState().lastDeductedInfo).toBeNull()
    })
  })
})
