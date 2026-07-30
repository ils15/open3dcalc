import type { ComputeStoreInput } from './calculatorStore.types'
import type { CalculationResult } from '@/shared/types'
import { calculateFDM, calculateResin, getBulkDiscount } from '@/shared/lib/calculator'

export function computeStoreResults(s: ComputeStoreInput): CalculationResult {
  const qty = s.quantity > 0 ? s.quantity : 1
  const es = s.enabledSections
  const fixedCostPerHour = s.fixedCosts.enabled && s.fixedCosts.monthlyPrintHours > 0
    ? s.fixedCosts.monthlyCost / s.fixedCosts.monthlyPrintHours
    : 0
  if (s.activeTab === 'fdm') {
    const result = calculateFDM(
      s.fdmMaterial, s.fdmPrintParams, s.fdmMachine,
      s.fdmLabor, s.fdmExtras, s.fdmSales, s.fdmOps, s.fdmSoft,
      s.fdmHardware, s.fdmFinishing, fixedCostPerHour,
    )
    let amsMaterialCost = 0
    if (s.fdmAmsEnabled && s.fdmAmsSlots) {
      const enabledSlots = s.fdmAmsSlots.filter(sl => sl.enabled)
      const activeCount = enabledSlots.filter(sl => sl.weightUsedGrams > 0).length
      for (const slot of enabledSlots) {
        const materialCost = (slot.weightUsedGrams / 1000) * slot.costPerKg
        const purgeCost = (slot.purgeWeightGrams / 1000) * slot.costPerKg
        amsMaterialCost += materialCost + purgeCost
      }
      if (activeCount > 1) {
        const transitions = activeCount * (activeCount - 1)
        const avgCost = enabledSlots.reduce((a, s) => a + s.costPerKg, 0) / enabledSlots.length
        amsMaterialCost += (transitions * (enabledSlots[0]?.transitionPurgeGrams ?? 3) / 1000) * avgCost
      }
    }
    const filtered = {
      ...result,
      materialCost: es.material ? (s.fdmAmsEnabled && s.fdmAmsSlots ? amsMaterialCost : result.materialCost) : 0,
      energyCost: es.energy ? result.energyCost : 0,
      machineCost: es.machine ? result.machineCost : 0,
      hardwareCost: es.hardware ? result.hardwareCost : 0,
      consumablesCost: es.consumables ? result.consumablesCost : 0,
      laborCost: es.labor ? result.laborCost : 0,
      softwareCost: es.software ? result.softwareCost : 0,
      failureCost: es.failure ? result.failureCost : 0,
      extrasCost: es.extras ? result.extrasCost : 0,
      postProcessingCost: es.postProcessing ? result.postProcessingCost : 0,
    }
    const totalBaseCost = filtered.subtotal + filtered.failureCost + (es.packaging ? s.fdmSales.packagingCost : 0) + (es.shipping ? s.fdmSales.shippingCost : 0)
    const profitAmountRaw = totalBaseCost * (s.fdmSales.profitMarginPercent / 100)
    const priceBeforeFees = totalBaseCost + profitAmountRaw
    const totalFeePercent = (s.fdmSales.taxPercent + s.fdmSales.marketplaceFeePercent) / 100
    const sellPrice = totalFeePercent < 1 ? priceBeforeFees / (1 - totalFeePercent) : priceBeforeFees * 2
    const taxAmount = sellPrice * (s.fdmSales.taxPercent / 100)
    const marketplaceFee = sellPrice * (s.fdmSales.marketplaceFeePercent / 100)
    const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee
    const r = { ...filtered, totalCost: totalBaseCost, sellPrice, profit: totalProfit, taxAmount, marketplaceFee }
    if (qty > 1) {
      const laborPerUnit = s.fdmLabor.enabled ? ((s.fdmLabor.setupTimeMinutes + s.fdmLabor.postProcessingTimeMinutes) / 60) * s.fdmLabor.hourlyRate : 0
      const setupCost = laborPerUnit
      const bulkDiscount = getBulkDiscount(qty, s.fdmSales.volumeDiscounts)
      const discountMultiplier = 1 - (bulkDiscount / 100)
      const perUnitCost = (r.totalCost - setupCost + (setupCost / qty)) * discountMultiplier
      const perUnitSellPrice = r.sellPrice - setupCost + (setupCost / qty)
      return { ...r, totalCost: perUnitCost, sellPrice: perUnitSellPrice, profit: perUnitSellPrice - perUnitCost - r.marketplaceFee - r.taxAmount, costPerUnit: perUnitCost }
    }
    return r
  } else {
    const result = calculateResin(
      s.resinMaterial, s.resinPrintParams, s.resinMachine,
      s.resinLabor, s.resinExtras, s.resinSales, s.resinOps, s.resinSoft,
      s.resinPostProcess, s.resinHardware, fixedCostPerHour,
    )
    const filtered = {
      ...result,
      materialCost: es.material ? result.materialCost : 0,
      energyCost: es.energy ? result.energyCost : 0,
      machineCost: es.machine ? result.machineCost : 0,
      hardwareCost: es.hardware ? result.hardwareCost : 0,
      consumablesCost: es.consumables ? result.consumablesCost : 0,
      laborCost: es.labor ? result.laborCost : 0,
      softwareCost: es.software ? result.softwareCost : 0,
      failureCost: es.failure ? result.failureCost : 0,
      extrasCost: es.extras ? result.extrasCost : 0,
      postProcessingCost: es.postProcessing ? result.postProcessingCost : 0,
    }
    const totalBaseCost = filtered.subtotal + filtered.failureCost + (es.packaging ? s.resinSales.packagingCost : 0) + (es.shipping ? s.resinSales.shippingCost : 0)
    const profitAmountRaw = totalBaseCost * (s.resinSales.profitMarginPercent / 100)
    const priceBeforeFees = totalBaseCost + profitAmountRaw
    const totalFeePercent = (s.resinSales.taxPercent + s.resinSales.marketplaceFeePercent) / 100
    const sellPrice = totalFeePercent < 1 ? priceBeforeFees / (1 - totalFeePercent) : priceBeforeFees * 2
    const taxAmount = sellPrice * (s.resinSales.taxPercent / 100)
    const marketplaceFee = sellPrice * (s.resinSales.marketplaceFeePercent / 100)
    const totalProfit = sellPrice - totalBaseCost - taxAmount - marketplaceFee
    const r = { ...filtered, totalCost: totalBaseCost, sellPrice, profit: totalProfit, taxAmount, marketplaceFee }
    if (qty > 1) {
      const laborPerUnit = s.resinLabor.enabled ? ((s.resinLabor.setupTimeMinutes + s.resinLabor.postProcessingTimeMinutes) / 60) * s.resinLabor.hourlyRate : 0
      const setupCost = laborPerUnit
      const bulkDiscount = getBulkDiscount(qty, s.resinSales.volumeDiscounts)
      const discountMultiplier = 1 - (bulkDiscount / 100)
      const perUnitCost = (r.totalCost - setupCost + (setupCost / qty)) * discountMultiplier
      const perUnitSellPrice = r.sellPrice - setupCost + (setupCost / qty)
      return { ...r, totalCost: perUnitCost, sellPrice: perUnitSellPrice, profit: perUnitSellPrice - perUnitCost - r.marketplaceFee - r.taxAmount, costPerUnit: perUnitCost }
    }
    return r
  }
}
