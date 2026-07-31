import type { CalculationResult } from '@/shared/types'

export interface QuotePayload {
  version: string
  timestamp: string
  product: {
    name: string
    quantity: number
  }
  costs: {
    material: number
    energy: number
    machine: number
    hardware: number
    consumables: number
    labor: number
    software: number
    failure: number
    extras: number
    postProcessing: number
    packaging: number
    shipping: number
  }
  pricing: {
    subtotal: number
    totalCost: number
    sellPrice: number
    profit: number
    margin: number
    marketplaceFee: number
    taxAmount: number
    costPerGram: number
    breakEvenPrice: number
  }
  print: {
    estimatedTimeHours: number
    unitWeightGrams: number
  }
  metadata: {
    currency: string
    locale: string
    generator: string
  }
}

export function generateQuotePayload(
  result: CalculationResult,
  productName: string,
  quantity: number,
  packagingCost: number,
  shippingCost: number,
  locale: string = 'pt-BR',
  currency: string = 'BRL',
): QuotePayload {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    product: {
      name: productName || 'Untitled',
      quantity,
    },
    costs: {
      material: result.materialCost,
      energy: result.energyCost,
      machine: result.machineCost,
      hardware: result.hardwareCost,
      consumables: result.consumablesCost,
      labor: result.laborCost,
      software: result.softwareCost,
      failure: result.failureCost,
      extras: result.extrasCost,
      postProcessing: result.postProcessingCost,
      packaging: packagingCost,
      shipping: shippingCost,
    },
    pricing: {
      subtotal: result.subtotal,
      totalCost: result.totalCost,
      sellPrice: result.sellPrice,
      profit: result.profit,
      margin: result.actualMargin,
      marketplaceFee: result.marketplaceFee,
      taxAmount: result.taxAmount,
      costPerGram: result.costPerGram,
      breakEvenPrice: result.breakEvenPrice,
    },
    print: {
      estimatedTimeHours: result.estimatedPrintTime,
      unitWeightGrams: result.unitWeight,
    },
    metadata: {
      currency,
      locale,
      generator: 'Open3DCalc',
    },
  }
}

export function exportQuoteJson(
  result: CalculationResult,
  productName: string,
  quantity: number,
  packagingCost: number,
  shippingCost: number,
  locale: string = 'pt-BR',
  currency: string = 'BRL',
): string {
  const payload = generateQuotePayload(result, productName, quantity, packagingCost, shippingCost, locale, currency)
  return JSON.stringify(payload, null, 2)
}

export function downloadQuoteJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
