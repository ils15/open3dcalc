import { describe, it, expect } from "vitest";
import {
  computeProfitPerHour,
  computeTotalHoursForProfit,
} from "@/shared/lib/calculator";
import { roundCurrency } from "@/shared/lib/currency";
import { estimatedHoursPrecise } from "@/shared/lib/printTimeEstimator";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import type { ComputeStoreInput } from "@/shared/stores/calculatorStore.types";
import { ReportDoc } from "@/shared/lib/ReportDoc";

function baseInput(
  overrides: Partial<ComputeStoreInput> = {},
): ComputeStoreInput {
  return {
    activeTab: "fdm",
    fdmMaterial: {
      type: "PLA",
      weightUsed: 50,
      purgeWeight: 0,
      costPerKg: 120,
      density: 1.24,
      spoolEfficiency: 100,
    },
    fdmPrintParams: {
      printTimeHours: 2,
      printerPowerWatts: 0,
      energyCostPerKwh: 0,
      failureMode: "none",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 100,
    },
    fdmMachine: {
      enabled: false,
      machineCost: 0,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    },
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 0,
      postProcessingTimeMinutes: 30,
      hourlyRate: 0,
    },
    fdmExtras: { extrasCost: 0 },
    fdmSales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent: 0,
      marketplaceFeePercent: 0,
      profitMarginPercent: 50,
      volumeDiscounts: [],
    },
    fdmOps: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 0 },
    fdmSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
    fdmHardware: {
      enabled: false,
      nozzleEnabled: false,
      nozzleCost: 0,
      nozzleLifespanKg: 0,
      bedEnabled: false,
      bedAdhesionCost: 0,
    },
    fdmFinishing: { enabled: false, suppliesCost: 0 },
    resinMaterial: {
      type: "Standard",
      volumeUsedMl: 50,
      costPerLiter: 300,
      density: 1.1,
      wasteMarginPercent: 0,
    },
    resinPrintParams: {
      printTimeHours: 2,
      printerPowerWatts: 0,
      energyCostPerKwh: 0,
      failureMode: "none",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 100,
    },
    resinMachine: {
      enabled: false,
      machineCost: 0,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    },
    resinLabor: {
      enabled: true,
      setupTimeMinutes: 0,
      postProcessingTimeMinutes: 30,
      hourlyRate: 0,
    },
    resinExtras: { extrasCost: 0 },
    resinSales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent: 0,
      marketplaceFeePercent: 0,
      profitMarginPercent: 50,
      volumeDiscounts: [],
    },
    resinOps: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 0 },
    resinSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
    resinPostProcess: {
      washingEnabled: false,
      alcoholCostPerLiter: 0,
      alcoholVolumeLiters: 0,
      curingEnabled: false,
      curingTimeMinutes: 0,
      curingPowerWatts: 0,
    },
    resinHardware: {
      enabled: false,
      lcdCost: 0,
      lcdLifespanHours: 0,
      fepCost: 0,
      fepLifespanPrints: 0,
    },
    quantity: 1,
    enabledSections: {
      material: true,
      energy: true,
      machine: true,
      hardware: true,
      consumables: true,
      labor: true,
      software: true,
      failure: true,
      extras: true,
      postProcessing: true,
      packaging: true,
      shipping: true,
    },
    fixedCosts: { enabled: false, monthlyCost: 0, monthlyPrintHours: 0 },
    ...overrides,
  };
}

describe("profitPerHour (Fase 2 #70)", () => {
  it("1. FDM 2h impressao + 0.5h pos => lucro 25 / 2.5h = 10 R$/h", () => {
    expect(computeProfitPerHour(25, 120, 30, 0)).toBe(10);
    expect(computeTotalHoursForProfit(120, 30, 0)).toBe(2.5);
    // rounding helper (currency.ts, 2 casas) + precise estimator hours
    expect(roundCurrency(10 / 3)).toBe(3.33);
    expect(roundCurrency(Number.NaN)).toBe(0);
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0);
    expect(estimatedHoursPrecise(150)).toBe(2.5);
    expect(estimatedHoursPrecise(0)).toBe(0);
  });

  it("2. pos desabilitado => ignora postProcessingTimeMinutes", () => {
    const r = computeStoreResults(
      baseInput({
        enabledSections: {
          material: true,
          energy: false,
          machine: false,
          hardware: false,
          consumables: false,
          labor: false,
          software: false,
          failure: false,
          extras: false,
          postProcessing: false,
          packaging: false,
          shipping: false,
        },
      }),
    );
    expect(r.totalHoursForProfit).toBe(2);
    expect(r.profitPerHour).toBeCloseTo(r.profit / 2, 2);
  });

  it("3. totalHours=0 => 0 sem NaN/Infinity", () => {
    expect(computeProfitPerHour(50, 0, 0, 0)).toBe(0);
    expect(computeTotalHoursForProfit(0, 0, 0)).toBe(0);
    const r = computeStoreResults(
      baseInput({
        fdmPrintParams: {
          printTimeHours: 0,
          printerPowerWatts: 0,
          energyCostPerKwh: 0,
          failureMode: "none",
          failureValue: 0,
          riskMultiplier: 1,
          heatUpTimeMinutes: 0,
          heatUpPowerPercent: 100,
        },
        fdmLabor: {
          enabled: false,
          setupTimeMinutes: 0,
          postProcessingTimeMinutes: 0,
          hourlyRate: 0,
        },
      }),
    );
    expect(r.profitPerHour).toBe(0);
    expect(Number.isFinite(r.profitPerHour)).toBe(true);
  });

  it("4. qty>1 bulk => setup amortizado por unidade nas horas", () => {
    const single = computeStoreResults(
      baseInput({
        fdmLabor: {
          enabled: true,
          setupTimeMinutes: 60,
          postProcessingTimeMinutes: 0,
          hourlyRate: 0,
        },
      }),
    );
    const bulk = computeStoreResults(
      baseInput({
        quantity: 5,
        fdmLabor: {
          enabled: true,
          setupTimeMinutes: 60,
          postProcessingTimeMinutes: 0,
          hourlyRate: 0,
        },
      }),
    );
    expect(single.totalHoursForProfit).toBe(3);
    expect(bulk.totalHoursForProfit).toBeCloseTo(2 + 1 / 5, 5);
    expect(Number.isFinite(bulk.profitPerHour)).toBe(true);
  });

  it("5. Resin idem FDM => lucro/hora consistente", () => {
    const r = computeStoreResults(
      baseInput({
        activeTab: "resin",
        resinPrintParams: {
          printTimeHours: 2,
          printerPowerWatts: 0,
          energyCostPerKwh: 0,
          failureMode: "none",
          failureValue: 0,
          riskMultiplier: 1,
          heatUpTimeMinutes: 0,
          heatUpPowerPercent: 100,
        },
        resinLabor: {
          enabled: true,
          setupTimeMinutes: 0,
          postProcessingTimeMinutes: 30,
          hourlyRate: 0,
        },
      }),
    );
    expect(r.totalHoursForProfit).toBe(2.5);
    expect(r.profitPerHour).toBeCloseTo(r.profit / 2.5, 2);
  });

  it("6. snapshot PDF => ReportDoc embute lucro/hora formatado", () => {
    const r = computeStoreResults(baseInput());
    const tree = ReportDoc({ result: r, locale: "pt-BR", currency: "BRL" });
    const dump = JSON.stringify(tree);
    const expected = (r.profitPerHour ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    expect(dump).toContain(expected);
  });
});
