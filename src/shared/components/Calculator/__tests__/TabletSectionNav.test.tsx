import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
// Mock all heavy dependencies used by Calculator
vi.mock('@/shared/components/ui/InputGroup', () => ({
  InputGroup: (props: Record<string, unknown>) => <div data-testid="input-group">{String(props.label)}</div>,
}))
vi.mock('@/shared/components/ui/Select', () => ({
  Select: (props: Record<string, unknown>) => <div data-testid="select">{String(props.label)}</div>,
}))
vi.mock('@/shared/components/ui/Toast', () => ({
  ToastContainer: () => <div data-testid="toast" />,
}))
vi.mock('@/shared/components/ui/ToggleCard', () => ({
  ToggleSwitch: () => <div data-testid="toggle" />,
}))
vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ format: (v: number) => `R$${v}`, symbol: 'R$' }),
}))
vi.mock('@/shared/lib/printTimeEstimator', () => ({
  estimatePrintTimeFromDimensions: () => ({ estimatedHours: 1 }),
}))
vi.mock('@/shared/components/Results/ResultsPanel', () => ({
  ResultsPanel: () => <div data-testid="results-panel" />,
}))
vi.mock('@/shared/components/Calculator/sections/MaterialSection', () => ({
  MaterialSection: () => <div>MaterialSection</div>,
}))
vi.mock('@/shared/components/Calculator/sections/PrintSection', () => ({
  PrintSection: () => <div>PrintSection</div>,
}))
vi.mock('@/shared/components/Calculator/sections/FailureSection', () => ({
  FailureSection: () => <div>FailureSection</div>,
}))
vi.mock('@/shared/components/Calculator/sections/MachineSection', () => ({
  MachineSection: () => <div>MachineSection</div>,
}))
vi.mock('@/shared/components/Calculator/sections/FixedCostsSection', () => ({
  FixedCostsSection: () => <div>FixedCostsSection</div>,
}))
vi.mock('@/shared/components/Calculator/sections/LaborSection', () => ({
  LaborSection: () => <div>LaborSection</div>,
}))
vi.mock('@/shared/components/Calculator/SectionRenderer', () => ({
  SectionRenderer: () => <div data-testid="section-renderer" />,
}))

vi.mock('@/shared/stores/calculatorStore', () => ({
  useCalculatorStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        activeTab: 'fdm',
        calcLevel: 'advanced',
        hiddenFields: [],
        enabledSections: {
          material: true, energy: true, machine: true, hardware: true,
          consumables: true, labor: true, software: true, failure: true,
          extras: true, postProcessing: true, packaging: true, shipping: true,
        },
        fdmMaterial: { type: 'PLA', weightUsed: 50, purgeWeight: 0, costPerKg: 125, density: 1.24, spoolEfficiency: 98 },
        fdmPrintParams: { printTimeHours: 5, printerPowerWatts: 250, energyCostPerKwh: 0.80, failureMode: 'percent', failureValue: 10, riskMultiplier: 1 },
        fdmMachine: { enabled: true, machineCost: 3000, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 },
        fdmHardware: { enabled: true, nozzleEnabled: true, nozzleCost: 25, nozzleLifespanKg: 5, bedEnabled: true, bedAdhesionCost: 0.20 },
        fdmFinishing: { enabled: false, suppliesCost: 5 },
        fdmLabor: { enabled: false, setupTimeMinutes: 15, postProcessingTimeMinutes: 20, hourlyRate: 25 },
        fdmExtras: { extrasCost: 0 },
        fdmSales: { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50 },
        fdmOps: { enabled: false, ppeCostPerPrint: 0 },
        fdmSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
        resinMaterial: { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 5 },
        resinPrintParams: { printTimeHours: 2, printerPowerWatts: 50, energyCostPerKwh: 0.80, failureMode: 'none', failureValue: 0, riskMultiplier: 1 },
        resinPostProcess: { washingEnabled: true, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0.1, curingEnabled: true, curingTimeMinutes: 10, curingPowerWatts: 36 },
        resinMachine: { enabled: true, machineCost: 3500, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 },
        resinHardware: { enabled: true, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 },
        resinLabor: { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 },
        resinExtras: { extrasCost: 0 },
        resinSales: { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50 },
        resinOps: { enabled: true, ppeCostPerPrint: 2.50 },
        resinSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
        selectedPrinter: { id: 'printer-1', name: 'Test', brand: 'Test', power: 200, value: 2000, usefulLife: 5000, maintenancePerHour: 10, maxFilaments: 4 },
        selectedMarketplace: { id: 'mp-1', name: 'Test', feePercent: 10, feeFixed: 0 },
        fdmAmsEnabled: false,
        fdmAmsSlots: [],
        fixedCosts: { enabled: false, monthlyCost: 0, monthlyPrintHours: 160 },
        productName: '',
        quantity: 1,
        infillPercent: 20,
        targetMarginMode: false,
        currency: 'auto',
        results: {
          materialCost: 0, energyCost: 0, machineCost: 0, hardwareCost: 0,
          consumablesCost: 0, laborCost: 0, softwareCost: 0, failureCost: 0,
          extrasCost: 0, postProcessingCost: 0, subtotal: 0, totalCost: 0,
          sellPrice: 0, profit: 0, marketplaceFee: 0, taxAmount: 0,
          costPerGram: 0, costPerUnit: 0, unitWeight: 0,
          estimatedPrintTime: 0, targetMarginPercent: 0, breakEvenPrice: 0, actualMargin: 0,
        },
      }
      return selector ? selector(state) : state
    }),
    {
      getState: vi.fn(),
      setState: vi.fn(),
    }
  ),
}))
vi.mock('@/shared/stores/catalogStore', () => ({
  useCatalogStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        printers: [],
        materials: [],
        marketplaces: [],
      }
      return selector ? selector(state) : state
    }),
    { getState: vi.fn() }
  ),
}))
vi.mock('@/shared/stores/filamentInventory', () => ({
  useFilamentInventory: Object.assign(
    vi.fn((selector) => {
      const state = {
        spools: [],
      }
      return selector ? selector(state) : state
    }),
    { getState: vi.fn() }
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pt-BR' },
  }),
}))

import { Calculator } from '../Calculator'

describe('Phase 2.2 — Calculator tablet section nav', () => {
  it('renders a tablet section nav (icons-only) visible at md breakpoint', () => {
    const { container } = render(<Calculator />)

    // Find all nav elements
    const allNavs = container.querySelectorAll('nav')
    // The tablet nav has hidden md:flex lg:hidden
    const tabletNav = Array.from(allNavs).find((nav) =>
      nav.className.includes('md:flex') &&
      nav.className.includes('lg:hidden')
    )

    expect(tabletNav).toBeDefined()
    expect(tabletNav).not.toBeNull()
  })

  it('tablet section nav has w-14 width class', () => {
    const { container } = render(<Calculator />)

    const allNavs = container.querySelectorAll('nav')
    const tabletNav = Array.from(allNavs).find((nav) =>
      nav.className.includes('md:flex') &&
      nav.className.includes('lg:hidden')
    )

    expect(tabletNav).toBeDefined()
    expect(tabletNav!.className).toContain('w-14')
  })

  it('tablet section nav buttons have title attributes for accessibility', () => {
    const { container } = render(<Calculator />)

    const allNavs = container.querySelectorAll('nav')
    const tabletNav = Array.from(allNavs).find((nav) =>
      nav.className.includes('md:flex') &&
      nav.className.includes('lg:hidden')
    )

    expect(tabletNav).toBeDefined()
    const buttons = tabletNav!.querySelectorAll('button')
    // Should have buttons for each visible section (advanced level = 10 sections)
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('title')
    })
  })

  it('tablet section nav is hidden on mobile (has hidden class)', () => {
    const { container } = render(<Calculator />)

    const allNavs = container.querySelectorAll('nav')
    const tabletNav = Array.from(allNavs).find((nav) =>
      nav.className.includes('md:flex') &&
      nav.className.includes('lg:hidden')
    )

    expect(tabletNav).toBeDefined()
    expect(tabletNav!.className).toMatch(/\bhidden\b/)
  })

  it('tablet section nav is hidden on large screens (has lg:hidden)', () => {
    const { container } = render(<Calculator />)

    const allNavs = container.querySelectorAll('nav')
    const tabletNav = Array.from(allNavs).find((nav) =>
      nav.className.includes('md:flex') &&
      nav.className.includes('lg:hidden')
    )

    expect(tabletNav).toBeDefined()
    expect(tabletNav!.className).toContain('lg:hidden')
  })
})
