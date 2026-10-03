import {
  PrintCalculationData,
  CalculationResult,
  CurrencyCode,
} from "../types";

export function calculatePrintCost(
  data: PrintCalculationData,
): CalculationResult {
  const qty = Math.max(1, data.quantity || 1);
  const singleItemWeight = Math.max(0, data.printWeightGrams || 0);
  const totalWeight = singleItemWeight * qty;

  // Material cost
  const spoolWeight = Math.max(1, data.spoolWeightGrams || 1000);
  const costPerGram = (data.spoolPrice || 0) / spoolWeight;
  const materialCost = totalWeight * costPerGram;

  // Print time in hours
  const itemHours =
    (data.printTimeHours || 0) + (data.printTimeMinutes || 0) / 60;
  const totalHours = Math.max(0.01, itemHours * qty);

  // Energy cost
  const kw = (data.printerPowerWatts || 0) / 1000;
  const energyKwhPrice = data.energyKwhPrice || 0;
  const energyCost = kw * totalHours * energyKwhPrice;

  // Depreciation and maintenance
  const lifespan = Math.max(100, data.printerLifespanHours || 2500);
  const depreciationPerHour = (data.printerCost || 0) / lifespan;
  const depreciationCost = depreciationPerHour * totalHours;
  const maintenanceCost = (data.printerMaintenancePerHour || 0) * totalHours;

  // Labor
  const totalLaborMinutes =
    ((data.laborPrepMinutes || 0) + (data.laborPostMinutes || 0)) * qty;
  const laborCost = (totalLaborMinutes / 60) * (data.laborHourlyRate || 0);

  // Extra costs
  const extraCostsSingle = (data.extraCosts || []).reduce(
    (acc, item) => acc + (item.cost || 0),
    0,
  );
  const extraCostsTotal = extraCostsSingle * qty;

  // Subtotal & failure risk
  const baseCost =
    materialCost +
    energyCost +
    depreciationCost +
    maintenanceCost +
    laborCost +
    extraCostsTotal;
  const failureRiskCost = baseCost * ((data.failureRatePercent || 0) / 100);
  const totalProductionCost = baseCost + failureRiskCost;

  // Margins and Fees
  const marginPercent = Math.max(0, data.profitMarginPercent || 0);
  const feePercent = Math.max(0, data.marketplaceFeePercent || 0);
  const taxPercent = Math.max(0, data.taxPercent || 0);
  const discountPercent = Math.max(0, data.discountPercent || 0);

  // Target markup
  const costWithProfit = totalProductionCost * (1 + marginPercent / 100);

  // Gross sale price before discount, factoring in marketplace and taxes
  const combinedFeeRate = (feePercent + taxPercent) / 100;
  const safeDivisor = Math.max(0.1, 1 - combinedFeeRate);
  const rawSalePrice = costWithProfit / safeDivisor;

  // Apply discount if any
  const discountAmount = rawSalePrice * (discountPercent / 100);
  const finalSalePrice = Math.max(0, rawSalePrice - discountAmount);

  // Actual deductions
  const marketplaceFeeAmount = finalSalePrice * (feePercent / 100);
  const taxAmount = finalSalePrice * (taxPercent / 100);
  const netProfit =
    finalSalePrice - totalProductionCost - marketplaceFeeAmount - taxAmount;
  const profitMarginActual =
    finalSalePrice > 0 ? (netProfit / finalSalePrice) * 100 : 0;

  // Break even (0% profit)
  const breakEvenPrice = totalProductionCost / safeDivisor;

  return {
    totalHours,
    materialCost,
    energyCost,
    depreciationCost,
    maintenanceCost,
    laborCost,
    extraCostsTotal,
    baseCost,
    failureRiskCost,
    totalProductionCost,
    markupAmount: costWithProfit - totalProductionCost,
    preTaxPrice: rawSalePrice,
    taxAmount,
    marketplaceFeeAmount,
    discountAmount,
    finalSalePrice,
    netProfit,
    profitMarginActual,
    breakEvenPrice,
    unitProductionCost: totalProductionCost / qty,
    unitSalePrice: finalSalePrice / qty,
    unitProfit: netProfit / qty,
  };
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "BRL",
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  switch (currency) {
    case "USD":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(safe);
    case "EUR":
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(safe);
    case "BRL":
    default:
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(safe);
  }
}

export function formatTime(hoursDecimal: number): string {
  const safe = Math.max(0, hoursDecimal || 0);
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
