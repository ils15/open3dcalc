import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encodeCalculationState,
  decodeCalculationState,
  hasSharedCalculation,
  getSharedCalculation,
  generateShareUrl,
  type SharedCalculationState,
} from '@/shared/lib/calculationLink'

// ---------------------------------------------------------------------------
// Sample state for tests
// ---------------------------------------------------------------------------

function createSampleState(
  overrides?: Partial<SharedCalculationState>,
): SharedCalculationState {
  return {
    activeTab: 'fdm',
    fdmMaterial: {
      type: 'PLA',
      weightUsed: 50,
      purgeWeight: 0,
      costPerKg: 125,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      printTimeHours: 5,
      printerPowerWatts: 250,
      energyCostPerKwh: 0.8,
      failureMode: 'percent',
      failureValue: 10,
      riskMultiplier: 1,
      heatUpTimeMinutes: 5,
      heatUpPowerPercent: 150,
    },
    fdmMachine: {
      enabled: true,
      machineCost: 3000,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    },
    fdmHardware: {
      enabled: true,
      nozzleEnabled: true,
      nozzleCost: 25,
      nozzleLifespanKg: 5,
      bedEnabled: true,
      bedAdhesionCost: 0.2,
    },
    fdmFinishing: {
      enabled: false,
      suppliesCost: 5,
    },
    fdmLabor: {
      enabled: false,
      setupTimeMinutes: 15,
      postProcessingTimeMinutes: 20,
      hourlyRate: 25,
    },
    fdmExtras: { extrasCost: 0 },
    fdmSales: {
      packagingCost: 2,
      shippingCost: 10,
      taxPercent: 0,
      marketplaceFeePercent: 0,
      profitMarginPercent: 50,
      volumeDiscounts: [],
    },
    fdmOps: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 },
    fdmSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
    selectedPrinterId: 'bambu_a1_mini',
    selectedMarketplaceId: 'shopee',
    infillPercent: 20,
    quantity: 1,
    targetMarginMode: false,
    productName: 'Test Print',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// encodeCalculationState / decodeCalculationState
// ---------------------------------------------------------------------------

describe('encodeCalculationState / decodeCalculationState', () => {
  it('should round-trip a complete FDM state', () => {
    const original = createSampleState()
    const encoded = encodeCalculationState(original)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.activeTab).toBe('fdm')
    expect(decoded!.fdmMaterial).toEqual(original.fdmMaterial)
    expect(decoded!.fdmPrintParams).toEqual(original.fdmPrintParams)
    expect(decoded!.fdmMachine).toEqual(original.fdmMachine)
    expect(decoded!.fdmHardware).toEqual(original.fdmHardware)
    expect(decoded!.fdmFinishing).toEqual(original.fdmFinishing)
    expect(decoded!.fdmLabor).toEqual(original.fdmLabor)
    expect(decoded!.fdmExtras).toEqual(original.fdmExtras)
    expect(decoded!.fdmSales).toEqual(original.fdmSales)
    expect(decoded!.fdmOps).toEqual(original.fdmOps)
    expect(decoded!.fdmSoft).toEqual(original.fdmSoft)
    expect(decoded!.selectedPrinterId).toBe('bambu_a1_mini')
    expect(decoded!.selectedMarketplaceId).toBe('shopee')
    expect(decoded!.infillPercent).toBe(20)
    expect(decoded!.quantity).toBe(1)
    expect(decoded!.productName).toBe('Test Print')
    expect(decoded!.targetMarginMode).toBe(false)
  })

  it('should round-trip a full Resin state', () => {
    const original: SharedCalculationState = {
      activeTab: 'resin',
      resinMaterial: {
        type: 'Standard',
        volumeUsedMl: 50,
        costPerLiter: 180,
        density: 1.1,
        wasteMarginPercent: 5,
      },
      resinPrintParams: {
        printTimeHours: 2,
        printerPowerWatts: 50,
        energyCostPerKwh: 0.8,
        failureMode: 'none',
        failureValue: 0,
        riskMultiplier: 1,
        heatUpTimeMinutes: 5,
        heatUpPowerPercent: 150,
      },
      resinMachine: {
        enabled: true,
        machineCost: 3500,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
      resinHardware: {
        enabled: true,
        lcdCost: 400,
        lcdLifespanHours: 2000,
        fepCost: 80,
        fepLifespanPrints: 50,
      },
      resinPostProcess: {
        washingEnabled: true,
        alcoholCostPerLiter: 25,
        alcoholVolumeLiters: 0.1,
        curingEnabled: true,
        curingTimeMinutes: 10,
        curingPowerWatts: 36,
      },
      resinLabor: {
        enabled: false,
        setupTimeMinutes: 10,
        postProcessingTimeMinutes: 15,
        hourlyRate: 25,
      },
      resinExtras: { extrasCost: 0 },
      resinSales: {
        packagingCost: 2,
        shippingCost: 0,
        taxPercent: 0,
        marketplaceFeePercent: 0,
        profitMarginPercent: 50,
        volumeDiscounts: [],
      },
      resinOps: { enabled: true, ppeCostPerPrint: 2.5, carbonIntensity: 100 },
      resinSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
      selectedPrinterId: 'elegoo_saturn_3',
      selectedMarketplaceId: 'mercadolivre',
      quantity: 2,
      infillPercent: 0,
    }

    const encoded = encodeCalculationState(original)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.activeTab).toBe('resin')
    expect(decoded!.resinMaterial).toEqual(original.resinMaterial)
    expect(decoded!.resinPrintParams).toEqual(original.resinPrintParams)
    expect(decoded!.resinMachine).toEqual(original.resinMachine)
    expect(decoded!.resinHardware).toEqual(original.resinHardware)
    expect(decoded!.resinPostProcess).toEqual(original.resinPostProcess)
    expect(decoded!.resinLabor).toEqual(original.resinLabor)
    expect(decoded!.resinExtras).toEqual(original.resinExtras)
    expect(decoded!.resinSales).toEqual(original.resinSales)
    expect(decoded!.resinOps).toEqual(original.resinOps)
    expect(decoded!.resinSoft).toEqual(original.resinSoft)
    expect(decoded!.selectedPrinterId).toBe('elegoo_saturn_3')
    expect(decoded!.selectedMarketplaceId).toBe('mercadolivre')
    expect(decoded!.quantity).toBe(2)
  })

  it('should include AMS state when provided', () => {
    const original = createSampleState({
      fdmAmsEnabled: true,
      fdmAmsSlots: [
        {
          enabled: true,
          materialType: 'PLA',
          costPerKg: 125,
          weightUsedGrams: 50,
          purgeWeightGrams: 0,
          transitionPurgeGrams: 3,
          density: 1.24,
          spoolEfficiency: 98,
          color: '#cccccc',
        },
      ],
    })

    const encoded = encodeCalculationState(original)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.fdmAmsEnabled).toBe(true)
    expect(decoded!.fdmAmsSlots).toHaveLength(1)
    expect(decoded!.fdmAmsSlots![0].materialType).toBe('PLA')
  })

  it('should include fixedCosts when provided', () => {
    const original = createSampleState({
      fixedCosts: { enabled: true, monthlyCost: 500, monthlyPrintHours: 160 },
    })

    const encoded = encodeCalculationState(original)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.fixedCosts).toEqual({
      enabled: true,
      monthlyCost: 500,
      monthlyPrintHours: 160,
    })
  })

  it('should include enabledSections when provided', () => {
    const original = createSampleState({
      enabledSections: {
        material: true,
        energy: false,
        machine: true,
        hardware: true,
        labor: false,
      },
    })

    const encoded = encodeCalculationState(original)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.enabledSections).toEqual({
      material: true,
      energy: false,
      machine: true,
      hardware: true,
      labor: false,
    })
  })

  it('should return null for an invalid hash', () => {
    expect(decodeCalculationState('')).toBeNull()
    expect(decodeCalculationState('invalid!@#$')).toBeNull()
  })

  it('should return null for a wrong version', () => {
    const payload = JSON.stringify({ v: 2, t: 'fdm' })
    const encoded = btoa(encodeURIComponent(payload))
    expect(decodeCalculationState(encoded)).toBeNull()
  })

  it('should handle minimal state (only required fields)', () => {
    const minimal: SharedCalculationState = { activeTab: 'fdm' }
    const encoded = encodeCalculationState(minimal)
    const decoded = decodeCalculationState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.activeTab).toBe('fdm')
    // Optional fields should be undefined
    expect(decoded!.fdmMaterial).toBeUndefined()
    expect(decoded!.quantity).toBeUndefined()
  })

  it('should produce a URL-safe encoded string', () => {
    const original = createSampleState()
    const encoded = encodeCalculationState(original)

    // Base64 should only contain alphanumeric, +, /, =
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})

// ---------------------------------------------------------------------------
// URL helpers (with mocked window.location)
// ---------------------------------------------------------------------------

describe('URL helpers', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Mock window.location
    const mockUrl = new URL('https://example.com/')
    Object.defineProperty(window, 'location', {
      value: {
        ...mockUrl,
        hash: '',
        href: mockUrl.href,
        origin: mockUrl.origin,
        pathname: mockUrl.pathname,
        search: mockUrl.search,
      },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  describe('hasSharedCalculation', () => {
    it('should return false when no hash is present', () => {
      expect(hasSharedCalculation()).toBe(false)
    })

    it('should return false for other hash prefixes', () => {
      window.location.hash = '#other=value'
      expect(hasSharedCalculation()).toBe(false)
    })

    it('should return true when #calc= is present', () => {
      window.location.hash = '#calc=SGVsbG8='
      expect(hasSharedCalculation()).toBe(true)
    })
  })

  describe('getSharedCalculation', () => {
    it('should return null when no shared calculation exists', () => {
      expect(getSharedCalculation()).toBeNull()
    })

    it('should decode a valid shared calculation hash', () => {
      const original = createSampleState({
        fdmMaterial: { type: 'PETG', weightUsed: 100, purgeWeight: 0, costPerKg: 90, density: 1.27, spoolEfficiency: 97 },
      })
      const encoded = encodeCalculationState(original)
      window.location.hash = `#calc=${encoded}`

      const result = getSharedCalculation()
      expect(result).not.toBeNull()
      expect(result!.fdmMaterial?.type).toBe('PETG')
      expect(result!.fdmMaterial?.weightUsed).toBe(100)
    })

    it('should return null for an invalid hash', () => {
      window.location.hash = '#calc=invalid!@#'
      expect(getSharedCalculation()).toBeNull()
    })
  })

  describe('generateShareUrl', () => {
    it('should return a URL with the encoded state in the hash', () => {
      const state = createSampleState()
      const url = generateShareUrl(state)

      expect(url).toContain('#calc=')
      // Should start with the current origin/path
      expect(url).toMatch(/^https:\/\/example\.com\//)

      // Should be decodable
      const hashPart = url.split('#calc=')[1]
      const decoded = decodeCalculationState(hashPart)
      expect(decoded).not.toBeNull()
      expect(decoded!.activeTab).toBe('fdm')
    })
  })
})
