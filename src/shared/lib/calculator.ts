import type {
  MaterialStateFDM, MaterialStateResin, PrintParameters,
  MachineCosts, LaborCosts, AdditionalCosts, SalesParameters,
  OperationalCosts, SoftwareCosts, FDMHardware, FDMFinishing,
  PostProcessingResin, ResinHardware, CalculationResult,
  VolumeDiscount,
} from '@/shared/types'

export function getBulkDiscount(quantity: number, discounts: VolumeDiscount[]): number {
  let maxDiscount = 0
  for (const d of discounts) {
    if (quantity >= d.minQuantity && d.discountPercent > maxDiscount) {
      maxDiscount = d.discountPercent
    }
  }
  return maxDiscount
}

export function calculateFDM(
  mat: MaterialStateFDM,
  print: PrintParameters,
  machine: MachineCosts,
  labor: LaborCosts,
  extras: AdditionalCosts,
  sales: SalesParameters,
  ops: OperationalCosts,
  soft: SoftwareCosts,
  fdmHW: FDMHardware,
  fdmFin: FDMFinishing,
  fixedCostPerHour = 0,
): CalculationResult {
  const efficiencyFactor = mat.spoolEfficiency > 0 ? (100 / mat.spoolEfficiency) : 1
  const totalWeightFDM = mat.weightUsed + mat.purgeWeight
  const effectiveWeight = totalWeightFDM * efficiencyFactor
  const matCost = (effectiveWeight / 1000) * mat.costPerKg

  const totalKwh = (print.printerPowerWatts / 1000) * print.printTimeHours
  const heatUpKwh = (print.printerPowerWatts / 1000) * (print.heatUpTimeMinutes / 60) * ((print.heatUpPowerPercent - 100) / 100)
  const totalEnergyKwh = totalKwh + heatUpKwh
  const printerEnergyCost = totalEnergyKwh * print.energyCostPerKwh
  const carbonFootprintGrams = totalEnergyKwh * ops.carbonIntensity

  let postProcessingTotal = 0
  if (fdmFin.enabled) {
    postProcessingTotal += fdmFin.suppliesCost
  }

  let machineTotal = 0
  if (machine.enabled) {
    const totalLifeHours = machine.depreciationMonths * machine.hoursPerMonth
    const hourlyDepreciation = totalLifeHours > 0 ? machine.machineCost / totalLifeHours : 0
    let hourlyMaintenance = 0
    if (machine.maintenanceEnabled) {
      hourlyMaintenance = machine.hoursPerMonth > 0 ? machine.maintenanceCost / machine.hoursPerMonth : 0
    }
    machineTotal = (hourlyDepreciation + hourlyMaintenance + fixedCostPerHour) * print.printTimeHours
  }

  let hardwareTotal = 0
  if (fdmHW.enabled) {
    let nozzleDepreciation = 0
    if (fdmHW.nozzleEnabled) {
      nozzleDepreciation = fdmHW.nozzleLifespanKg > 0
        ? (totalWeightFDM / 1000) / fdmHW.nozzleLifespanKg * fdmHW.nozzleCost
        : 0
    }
    let bedCost = 0
    if (fdmHW.bedEnabled) {
      bedCost = fdmHW.bedAdhesionCost
    }
    hardwareTotal = nozzleDepreciation + bedCost
  }

  const ppeCost = ops.enabled ? ops.ppeCostPerPrint : 0

  let laborTotal = 0
  if (labor.enabled) {
    const totalMinutes = labor.setupTimeMinutes + labor.postProcessingTimeMinutes
    laborTotal = (totalMinutes / 60) * labor.hourlyRate
  }

  let softwareTotal = 0
  if (soft.enabled) {
    const softwareHourly = machine.hoursPerMonth > 0 ? soft.slicerMonthlyCost / machine.hoursPerMonth : 0
    softwareTotal = (softwareHourly * print.printTimeHours) + soft.modelFileCost
  }

  const productionCost = matCost + printerEnergyCost + machineTotal + hardwareTotal + ppeCost + laborTotal + softwareTotal + postProcessingTotal + extras.extrasCost

  let failureCost = 0
  if (print.failureMode === 'percent') {
    const adjustedPercent = print.failureValue * (print.riskMultiplier ?? 1)
    failureCost = productionCost * (adjustedPercent / 100)
  } else if (print.failureMode === 'fixed') {
    failureCost = print.failureValue
  }

  const totalBaseCost = productionCost + failureCost + sales.packagingCost + sales.shippingCost

  const profitAmountRaw = totalBaseCost * (sales.profitMarginPercent / 100)
  const priceBeforeFees = totalBaseCost + profitAmountRaw

  const totalFeePercent = (sales.taxPercent + sales.marketplaceFeePercent) / 100

  const sellPrice = totalFeePercent < 1
    ? priceBeforeFees / (1 - totalFeePercent)
    : priceBeforeFees * 2

  const taxAmount = sellPrice * (sales.taxPercent / 100)
  const marketplaceFee = sellPrice * (sales.marketplaceFeePercent / 100)
  const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee

  const costPerGram = effectiveWeight > 0 ? matCost / effectiveWeight : 0
  const unitWeight = effectiveWeight
  const breakEvenPrice = totalBaseCost
  const actualMargin = sellPrice > 0 ? ((sellPrice - totalBaseCost - taxAmount - marketplaceFee) / sellPrice) * 100 : 0

  return {
    materialCost: matCost,
    energyCost: printerEnergyCost,
    postProcessingCost: postProcessingTotal,
    machineCost: machineTotal,
    hardwareCost: hardwareTotal,
    consumablesCost: ppeCost,
    softwareCost: softwareTotal,
    laborCost: laborTotal,
    failureCost,
    extrasCost: extras.extrasCost,
    subtotal: productionCost,
    totalCost: totalBaseCost,
    sellPrice,
    profit: totalProfit,
    marketplaceFee,
    taxAmount,
    costPerGram,
    costPerUnit: totalBaseCost,
    unitWeight,
    estimatedPrintTime: print.printTimeHours,
    targetMarginPercent: sales.profitMarginPercent,
    breakEvenPrice,
    actualMargin,
    carbonFootprintGrams,
  }
}

export function calculateResin(
  mat: MaterialStateResin,
  print: PrintParameters,
  machine: MachineCosts,
  labor: LaborCosts,
  extras: AdditionalCosts,
  sales: SalesParameters,
  ops: OperationalCosts,
  soft: SoftwareCosts,
  resinPP: PostProcessingResin,
  resinHW: ResinHardware,
  fixedCostPerHour = 0,
): CalculationResult {
  const volumeWithWaste = mat.volumeUsedMl * (1 + (mat.wasteMarginPercent / 100))
  const matCost = (volumeWithWaste / 1000) * mat.costPerLiter

  const totalKwh = (print.printerPowerWatts / 1000) * print.printTimeHours
  const heatUpKwh = (print.printerPowerWatts / 1000) * (print.heatUpTimeMinutes / 60) * ((print.heatUpPowerPercent - 100) / 100)
  const totalEnergyKwh = totalKwh + heatUpKwh
  const printerEnergyCost = totalEnergyKwh * print.energyCostPerKwh
  const carbonFootprintGrams = totalEnergyKwh * ops.carbonIntensity

  let postProcessingTotal = 0
  if (resinPP.washingEnabled) {
    postProcessingTotal += resinPP.alcoholVolumeLiters * resinPP.alcoholCostPerLiter
  }
  if (resinPP.curingEnabled) {
    const curingKwh = (resinPP.curingPowerWatts / 1000) * (resinPP.curingTimeMinutes / 60)
    postProcessingTotal += curingKwh * print.energyCostPerKwh
  }

  let machineTotal = 0
  if (machine.enabled) {
    const totalLifeHours = machine.depreciationMonths * machine.hoursPerMonth
    const hourlyDepreciation = totalLifeHours > 0 ? machine.machineCost / totalLifeHours : 0
    let hourlyMaintenance = 0
    if (machine.maintenanceEnabled) {
      hourlyMaintenance = machine.hoursPerMonth > 0 ? machine.maintenanceCost / machine.hoursPerMonth : 0
    }
    machineTotal = (hourlyDepreciation + hourlyMaintenance + fixedCostPerHour) * print.printTimeHours
  }

  let hardwareTotal = 0
  if (resinHW.enabled) {
    const lcdHourly = resinHW.lcdLifespanHours > 0 ? resinHW.lcdCost / resinHW.lcdLifespanHours : 0
    const lcdCost = lcdHourly * print.printTimeHours
    const fepPerPrint = resinHW.fepLifespanPrints > 0 ? resinHW.fepCost / resinHW.fepLifespanPrints : 0
    hardwareTotal = lcdCost + fepPerPrint
  }

  const ppeCost = ops.enabled ? ops.ppeCostPerPrint : 0

  let laborTotal = 0
  if (labor.enabled) {
    const totalMinutes = labor.setupTimeMinutes + labor.postProcessingTimeMinutes
    laborTotal = (totalMinutes / 60) * labor.hourlyRate
  }

  let softwareTotal = 0
  if (soft.enabled) {
    const softwareHourly = machine.hoursPerMonth > 0 ? soft.slicerMonthlyCost / machine.hoursPerMonth : 0
    softwareTotal = (softwareHourly * print.printTimeHours) + soft.modelFileCost
  }

  const productionCost = matCost + printerEnergyCost + machineTotal + hardwareTotal + ppeCost + laborTotal + softwareTotal + postProcessingTotal + extras.extrasCost

  let failureCost = 0
  if (print.failureMode === 'percent') {
    const adjustedPercent = print.failureValue * (print.riskMultiplier ?? 1)
    failureCost = productionCost * (adjustedPercent / 100)
  } else if (print.failureMode === 'fixed') {
    failureCost = print.failureValue
  }

  const totalBaseCost = productionCost + failureCost + sales.packagingCost + sales.shippingCost

  const profitAmountRaw = totalBaseCost * (sales.profitMarginPercent / 100)
  const priceBeforeFees = totalBaseCost + profitAmountRaw

  const totalFeePercent = (sales.taxPercent + sales.marketplaceFeePercent) / 100

  const sellPrice = totalFeePercent < 1
    ? priceBeforeFees / (1 - totalFeePercent)
    : priceBeforeFees * 2

  const taxAmount = sellPrice * (sales.taxPercent / 100)
  const marketplaceFee = sellPrice * (sales.marketplaceFeePercent / 100)
  const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee

  const resinWeight = volumeWithWaste * mat.density
  const costPerGram = matCost > 0 && resinWeight > 0 ? matCost / resinWeight : 0
  const breakEvenPrice = totalBaseCost
  const actualMargin = sellPrice > 0 ? ((sellPrice - totalBaseCost - taxAmount - marketplaceFee) / sellPrice) * 100 : 0

  return {
    materialCost: matCost,
    energyCost: printerEnergyCost,
    postProcessingCost: postProcessingTotal,
    machineCost: machineTotal,
    hardwareCost: hardwareTotal,
    consumablesCost: ppeCost,
    softwareCost: softwareTotal,
    laborCost: laborTotal,
    failureCost,
    extrasCost: extras.extrasCost,
    subtotal: productionCost,
    totalCost: totalBaseCost,
    sellPrice,
    profit: totalProfit,
    marketplaceFee,
    taxAmount,
    costPerGram,
    costPerUnit: totalBaseCost,
    unitWeight: resinWeight,
    estimatedPrintTime: print.printTimeHours,
    targetMarginPercent: sales.profitMarginPercent,
    breakEvenPrice,
    actualMargin,
    carbonFootprintGrams,
  }
}

export function calculateReverseMargin(
  totalBaseCost: number,
  targetSellPrice: number,
  taxPercent: number,
  marketplaceFeePercent: number,
): { actualMargin: number; profit: number; taxAmount: number; marketplaceFee: number } {
  const taxAmount = targetSellPrice * (taxPercent / 100)
  const marketplaceFee = targetSellPrice * (marketplaceFeePercent / 100)
  const profit = targetSellPrice - totalBaseCost - taxAmount - marketplaceFee
  const actualMargin = targetSellPrice > 0 ? (profit / targetSellPrice) * 100 : 0
  return { actualMargin, profit, taxAmount, marketplaceFee }
}

export function calculateMonthlyProjection(
  result: { totalCost: number; sellPrice: number; profit: number },
  printsPerMonth: number,
): { revenue: number; cost: number; profit: number; annualProfit: number } {
  const revenue = result.sellPrice * printsPerMonth
  const cost = result.totalCost * printsPerMonth
  const profit = result.profit * printsPerMonth
  return { revenue, cost, profit, annualProfit: profit * 12 }
}

export function calculatePrintVsBuy(
  printCost: number,
  buyPrice: number,
): { cheaper: 'print' | 'buy'; savings: number; savingsPercent: number } {
  const savings = Math.abs(buyPrice - printCost)
  const savingsPercent = buyPrice > 0 ? (savings / buyPrice) * 100 : 0
  return {
    cheaper: printCost <= buyPrice ? 'print' : 'buy',
    savings,
    savingsPercent,
  }
}

export function calculateInfillImpact(
  volumeSolidCm3: number,
  boundingBoxCm3: number,
  infillPercent: number,
  density: number,
  costPerKg: number,
): { weight: number; cost: number; timeChange: number } {
  const infillVolume = (boundingBoxCm3 - volumeSolidCm3) * (infillPercent / 100)
  const totalVolume = volumeSolidCm3 + infillVolume
  const weight = totalVolume * density
  const cost = (weight / 1000) * costPerKg
  const timeChange = infillPercent / 20
  return { weight, cost, timeChange }
}
