import { describe, it, expect } from 'vitest'
import { calculateFDM, calculateResin } from '@/lib/calculator'

function defaultFDM() {
  return {
    mat: { type: 'PLA', weightUsed: 50, purgeWeight: 0, costPerKg: 125, density: 1.24, spoolEfficiency: 98 },
    print: { printTimeHours: 5, printerPowerWatts: 250, energyCostPerKwh: 0.80, failureMode: 'percent' as 'none' | 'percent' | 'fixed', failureValue: 10, riskMultiplier: 1 },
    machine: { enabled: false, machineCost: 3000, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 },
    labor: { enabled: false, setupTimeMinutes: 15, postProcessingTimeMinutes: 20, hourlyRate: 25 },
    extras: { extrasCost: 0 },
    sales: { packagingCost: 0, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 0 },
    ops: { enabled: false, ppeCostPerPrint: 0 },
    soft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
    hw: { enabled: false, nozzleEnabled: true, nozzleCost: 25, nozzleLifespanKg: 5, bedEnabled: true, bedAdhesionCost: 0.20 },
    fin: { enabled: false, suppliesCost: 5 },
  }
}

describe('calculateFDM', () => {
  it('returns zero for minimal inputs', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 0
    d.mat.costPerKg = 0
    d.mat.purgeWeight = 0
    d.print.printerPowerWatts = 0
    d.print.energyCostPerKwh = 0
    d.print.printTimeHours = 0
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.totalCost).toBe(0)
    expect(r.sellPrice).toBe(0)
  })

  it('calculates material cost correctly with spool efficiency', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 100
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.mat.purgeWeight = 0
    d.print.printTimeHours = 0
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.materialCost).toBe(10)
  })

  it('accounts for purge weight', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 50
    d.mat.purgeWeight = 50
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.print.printTimeHours = 0
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.materialCost).toBe(10)
  })

  it('calculates energy cost correctly', () => {
    const d = defaultFDM()
    d.print.printTimeHours = 2
    d.print.printerPowerWatts = 200
    d.print.energyCostPerKwh = 0.50
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.energyCost).toBeCloseTo(0.20, 2)
  })

  it('applies failure rate correctly', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 100
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.print.printTimeHours = 0
    d.print.failureMode = 'percent'
    d.print.failureValue = 50
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.materialCost).toBe(10)
    expect(r.failureCost).toBe(5)
    expect(r.totalCost).toBe(15)
  })

  it('uses fixed failure cost verbatim', () => {
    const d = defaultFDM()
    d.print.failureMode = 'fixed'
    d.print.failureValue = 12.5
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.failureCost).toBe(12.5)
  })

  it('allows risk multiplier zero without forcing 1', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 100
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.print.printTimeHours = 0
    d.print.failureMode = 'percent'
    d.print.failureValue = 50
    d.print.riskMultiplier = 0
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.failureCost).toBe(0)
  })

  it('calculates sell price with margin', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 100
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.print.printTimeHours = 0
    d.print.failureMode = 'none'
    d.sales.profitMarginPercent = 100
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.totalCost).toBe(10)
    expect(r.sellPrice).toBe(20)
    expect(r.profit).toBe(10)
  })

  it('calculates with marketplace fee and taxes', () => {
    const d = defaultFDM()
    d.mat.weightUsed = 100
    d.mat.costPerKg = 100
    d.mat.spoolEfficiency = 100
    d.print.printTimeHours = 0
    d.print.failureMode = 'none'
    d.sales.profitMarginPercent = 100
    d.sales.marketplaceFeePercent = 14
    d.sales.taxPercent = 8
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.totalCost).toBe(10)
    expect(r.sellPrice).toBeGreaterThan(20)
    expect(r.marketplaceFee).toBeGreaterThan(0)
    expect(r.taxAmount).toBeGreaterThan(0)
  })

  it('calculates machine depreciation', () => {
    const d = defaultFDM()
    d.print.printTimeHours = 2
    d.machine.enabled = true
    d.machine.machineCost = 5000
    d.machine.depreciationMonths = 36
    d.machine.hoursPerMonth = 200
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin)
    expect(r.machineCost).toBeCloseTo(5000 / (36 * 200) * 2, 5)
  })

  it('includes fixed hourly costs in machine total', () => {
    const d = defaultFDM()
    d.print.printTimeHours = 3
    d.machine.enabled = true
    d.machine.machineCost = 3600
    d.machine.depreciationMonths = 36
    d.machine.hoursPerMonth = 100
    const fixedCostPerHour = 2
    const r = calculateFDM(d.mat, d.print, d.machine, d.labor, d.extras, d.sales, d.ops, d.soft, d.hw, d.fin, fixedCostPerHour)
    const depreciationPerHour = 3600 / (36 * 100)
    expect(r.machineCost).toBeCloseTo((depreciationPerHour + fixedCostPerHour) * 3, 5)
  })
})

describe('calculateResin', () => {
  it('calculates resin material cost with waste margin', () => {
    const mat = { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 10 }
    const print = { printTimeHours: 0, printerPowerWatts: 0, energyCostPerKwh: 0, failureMode: 'none' as const, failureValue: 0, riskMultiplier: 1 }
    const machine = { enabled: false, machineCost: 3500, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
    const labor = { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 }
    const extras = { extrasCost: 0 }
    const sales = { packagingCost: 0, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 0 }
    const ops = { enabled: false, ppeCostPerPrint: 0 }
    const soft = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
    const pp = { washingEnabled: false, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0, curingEnabled: false, curingTimeMinutes: 10, curingPowerWatts: 36 }
    const hw = { enabled: false, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 }

    const r = calculateResin(mat, print, machine, labor, extras, sales, ops, soft, pp, hw)
    const expectedVolume = 50 * 1.10
    expect(r.materialCost).toBeCloseTo((expectedVolume / 1000) * 180, 2)
  })

  it('includes resin washing and curing costs', () => {
    const mat = { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 0 }
    const print = { printTimeHours: 1, printerPowerWatts: 50, energyCostPerKwh: 1, failureMode: 'none' as const, failureValue: 0, riskMultiplier: 1 }
    const machine = { enabled: false, machineCost: 3500, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
    const labor = { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 }
    const extras = { extrasCost: 0 }
    const sales = { packagingCost: 0, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 0 }
    const ops = { enabled: false, ppeCostPerPrint: 0 }
    const soft = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
    const pp = { washingEnabled: true, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0.2, curingEnabled: true, curingTimeMinutes: 10, curingPowerWatts: 60 }
    const hw = { enabled: false, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 }

    const r = calculateResin(mat, print, machine, labor, extras, sales, ops, soft, pp, hw)
    expect(r.postProcessingCost).toBeCloseTo(0.2 * 25 + (60 / 1000) * (10 / 60) * 1, 4)
  })

  it('includes fixed hourly costs in resin machine total', () => {
    const mat = { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 0 }
    const print = { printTimeHours: 4, printerPowerWatts: 50, energyCostPerKwh: 1, failureMode: 'none' as const, failureValue: 0, riskMultiplier: 1 }
    const machine = { enabled: true, machineCost: 3600, depreciationMonths: 36, hoursPerMonth: 100, maintenanceEnabled: false, maintenanceCost: 0 }
    const labor = { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 }
    const extras = { extrasCost: 0 }
    const sales = { packagingCost: 0, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 0 }
    const ops = { enabled: false, ppeCostPerPrint: 0 }
    const soft = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
    const pp = { washingEnabled: false, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0, curingEnabled: false, curingTimeMinutes: 10, curingPowerWatts: 60 }
    const hw = { enabled: false, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 }
    const fixedCostPerHour = 1.5

    const r = calculateResin(mat, print, machine, labor, extras, sales, ops, soft, pp, hw, fixedCostPerHour)
    const depreciationPerHour = 3600 / (36 * 100)
    expect(r.machineCost).toBeCloseTo((depreciationPerHour + fixedCostPerHour) * 4, 5)
  })
})
