import type {
  MaterialStateFDM, MaterialStateResin, PrintParameters,
  MachineCosts, LaborCosts, AdditionalCosts, SalesParameters,
  OperationalCosts, SoftwareCosts, FDMHardware, FDMFinishing,
  PostProcessingResin, ResinHardware, AMSSlot, FixedCosts,
  VolumeDiscount,
} from '@/shared/types'

export const DEFAULT_FDM_MATERIAL: MaterialStateFDM = { type: 'PLA', weightUsed: 50, purgeWeight: 0, costPerKg: 125, density: 1.24, spoolEfficiency: 98 }
export const DEFAULT_FDM_PARAMS: PrintParameters = { printTimeHours: 5, printerPowerWatts: 250, energyCostPerKwh: 0.80, failureMode: 'percent', failureValue: 10, riskMultiplier: 1, heatUpTimeMinutes: 5, heatUpPowerPercent: 150 }
export const DEFAULT_FDM_MACHINE: MachineCosts = { enabled: true, machineCost: 3000, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
export const DEFAULT_FDM_HARDWARE: FDMHardware = { enabled: true, nozzleEnabled: true, nozzleCost: 25, nozzleLifespanKg: 5, bedEnabled: true, bedAdhesionCost: 0.20 }
export const DEFAULT_FDM_FINISHING: FDMFinishing = { enabled: false, suppliesCost: 5 }
export const DEFAULT_LABOR: LaborCosts = { enabled: false, setupTimeMinutes: 15, postProcessingTimeMinutes: 20, hourlyRate: 25 }
export const DEFAULT_EXTRAS: AdditionalCosts = { extrasCost: 0 }
export const DEFAULT_OPS: OperationalCosts = { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 }
export const DEFAULT_SOFT: SoftwareCosts = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
export const DEFAULT_VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { minQuantity: 5, discountPercent: 5 },
  { minQuantity: 10, discountPercent: 10 },
  { minQuantity: 25, discountPercent: 15 },
]

export const DEFAULT_SALES: SalesParameters = { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50, volumeDiscounts: DEFAULT_VOLUME_DISCOUNTS }

export const DEFAULT_RESIN_MATERIAL: MaterialStateResin = { type: 'Standard', volumeUsedMl: 50, costPerLiter: 180, density: 1.10, wasteMarginPercent: 5 }
export const DEFAULT_RESIN_PARAMS: PrintParameters = { printTimeHours: 2, printerPowerWatts: 50, energyCostPerKwh: 0.80, failureMode: 'none', failureValue: 0, riskMultiplier: 1, heatUpTimeMinutes: 5, heatUpPowerPercent: 150 }
export const DEFAULT_RESIN_PP: PostProcessingResin = { washingEnabled: true, alcoholCostPerLiter: 25, alcoholVolumeLiters: 0.1, curingEnabled: true, curingTimeMinutes: 10, curingPowerWatts: 36 }
export const DEFAULT_RESIN_MACHINE: MachineCosts = { enabled: true, machineCost: 3500, depreciationMonths: 36, hoursPerMonth: 200, maintenanceEnabled: false, maintenanceCost: 0 }
export const DEFAULT_RESIN_HARDWARE: ResinHardware = { enabled: true, lcdCost: 400, lcdLifespanHours: 2000, fepCost: 80, fepLifespanPrints: 50 }
export const DEFAULT_RESIN_LABOR: LaborCosts = { enabled: false, setupTimeMinutes: 10, postProcessingTimeMinutes: 15, hourlyRate: 25 }
export const DEFAULT_RESIN_OPS: OperationalCosts = { enabled: true, ppeCostPerPrint: 2.50, carbonIntensity: 100 }
export const DEFAULT_RESIN_SOFT: SoftwareCosts = { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 }
export const DEFAULT_RESIN_EXTRAS: AdditionalCosts = { extrasCost: 0 }
export const DEFAULT_RESIN_SALES: SalesParameters = { packagingCost: 2, shippingCost: 0, taxPercent: 0, marketplaceFeePercent: 0, profitMarginPercent: 50, volumeDiscounts: DEFAULT_VOLUME_DISCOUNTS }

export const DEFAULT_FIXED_COSTS: FixedCosts = { enabled: false, monthlyCost: 0, monthlyPrintHours: 160 }

export const DEFAULT_AMS_SLOTS: AMSSlot[] = Array.from({ length: 4 }, (_, i) => ({
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
