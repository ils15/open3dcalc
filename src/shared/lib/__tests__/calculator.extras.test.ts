import { describe, it, expect } from "vitest";
import {
  calculateFDM,
  calculateResin,
  calculateReverseMargin,
  calculateMonthlyProjection,
  calculatePrintVsBuy,
  calculateInfillImpact,
  computeTotalHoursForProfit,
  computeProfitPerHour,
} from "@/shared/lib/calculator";

describe("calculateReverseMargin", () => {
  it("calcula margem real sobre o preço de venda", () => {
    const r = calculateReverseMargin(100, 150, 10, 14);
    // tax = 15, fee = 21, profit = 150 - 100 - 15 - 21 = 14 → 9,33%
    expect(r.taxAmount).toBeCloseTo(15, 6);
    expect(r.marketplaceFee).toBeCloseTo(21, 6);
    expect(r.profit).toBeCloseTo(14, 6);
    expect(r.actualMargin).toBeCloseTo((14 / 150) * 100, 6);
  });

  it("devolve margem 0 quando o preço de venda é 0 (nunca NaN)", () => {
    const r = calculateReverseMargin(100, 0, 10, 14);
    expect(r.actualMargin).toBe(0);
    expect(r.profit).toBe(-100);
  });
});

describe("calculateMonthlyProjection", () => {
  it("projeta receita, custo e lucro mensal/anual", () => {
    const p = calculateMonthlyProjection(
      { totalCost: 10, sellPrice: 20, profit: 10 },
      100,
    );
    expect(p.revenue).toBe(2000);
    expect(p.cost).toBe(1000);
    expect(p.profit).toBe(1000);
    expect(p.annualProfit).toBe(12000);
  });
});

describe("calculatePrintVsBuy", () => {
  it("indica imprimir quando é mais barato", () => {
    const r = calculatePrintVsBuy(10, 15);
    expect(r.cheaper).toBe("print");
    expect(r.savings).toBeCloseTo(5, 6);
    expect(r.savingsPercent).toBeCloseTo((5 / 15) * 100, 6);
  });

  it("indica comprar quando a compra é mais barata", () => {
    const r = calculatePrintVsBuy(20, 15);
    expect(r.cheaper).toBe("buy");
    expect(r.savings).toBeCloseTo(5, 6);
  });

  it("economia percentual 0 quando o preço de compra é 0", () => {
    const r = calculatePrintVsBuy(10, 0);
    expect(r.savingsPercent).toBe(0);
    expect(r.cheaper).toBe("buy");
  });
});

describe("calculateInfillImpact", () => {
  it("calcula peso e custo do núcleo de infill", () => {
    // boundingBox 100 cm³ - sólido 10 cm³ = 90 cm³ a 20% = 18 cm³ de infill.
    const r = calculateInfillImpact(10, 100, 20, 1.24, 125);
    expect(r.weight).toBeCloseTo((10 + 18) * 1.24, 6);
    expect(r.cost).toBeCloseTo((((10 + 18) * 1.24) / 1000) * 125, 6);
    expect(r.timeChange).toBeCloseTo(1, 6);
  });
});

describe("computeTotalHoursForProfit — guards anti-NaN", () => {
  it("entrada não-finita vira 0 em cada componente", () => {
    expect(computeTotalHoursForProfit(NaN, 30, 5)).toBeCloseTo(35 / 60, 8);
    expect(computeTotalHoursForProfit(30, NaN, 5)).toBeCloseTo(35 / 60, 8);
    expect(computeTotalHoursForProfit(30, 30, NaN)).toBeCloseTo(60 / 60, 8);
    expect(computeTotalHoursForProfit(Infinity, -Infinity, NaN)).toBe(0);
  });

  it("valores negativos são clampados em 0", () => {
    expect(computeTotalHoursForProfit(-60, -30, -30)).toBe(0);
  });
});

describe("computeProfitPerHour — guards anti-NaN", () => {
  it("lucro não-finito vira 0", () => {
    expect(computeProfitPerHour(NaN, 60, 30)).toBe(0);
    expect(computeProfitPerHour(Infinity, 60, 30)).toBe(0);
  });

  it("horas zeradas → taxa 0, nunca Infinity", () => {
    expect(computeProfitPerHour(100, 0, 0, 0)).toBe(0);
    expect(computeProfitPerHour(100, 0, 0)).toBe(0);
  });

  it("rateamento correto para valores válidos", () => {
    // 2h totais, lucro 50 → 25/h
    expect(computeProfitPerHour(50, 90, 30)).toBe(25);
  });
});

describe("calculateFDM — riskMultiplier ausente", () => {
  function defaultFDM() {
    return {
      mat: {
        type: "PLA",
        weightUsed: 100,
        purgeWeight: 0,
        costPerKg: 100,
        density: 1.24,
        spoolEfficiency: 100,
      },
      print: {
        printTimeHours: 0,
        printerPowerWatts: 0,
        energyCostPerKwh: 0,
        failureMode: "percent" as "none" | "percent" | "fixed",
        failureValue: 50,
        riskMultiplier: undefined as unknown as number,
        heatUpTimeMinutes: 0,
        heatUpPowerPercent: 100,
      },
      machine: {
        enabled: false,
        machineCost: 3000,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
      labor: {
        enabled: false,
        setupTimeMinutes: 0,
        postProcessingTimeMinutes: 0,
        hourlyRate: 25,
      },
      extras: { extrasCost: 0 },
      sales: {
        packagingCost: 0,
        shippingCost: 0,
        taxPercent: 0,
        marketplaceFeePercent: 0,
        profitMarginPercent: 0,
        volumeDiscounts: [],
      },
      ops: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 },
      soft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
      hw: {
        enabled: false,
        nozzleEnabled: true,
        nozzleCost: 25,
        nozzleLifespanKg: 5,
        bedEnabled: true,
        bedAdhesionCost: 0.2,
      },
      fin: { enabled: false, suppliesCost: 0 },
    };
  }

  it("riskMultiplier undefined cai no default 1 (50% de 10 = 5)", () => {
    const d = defaultFDM();
    const r = calculateFDM(
      d.mat,
      d.print,
      d.machine,
      d.labor,
      d.extras,
      d.sales,
      d.ops,
      d.soft,
      d.hw,
      d.fin,
    );
    expect(r.materialCost).toBe(10);
    expect(r.failureCost).toBe(5);
    expect(r.totalCost).toBe(15);
  });
});

describe("calculateResin — guards", () => {
  function resinFixture() {
    return {
      mat: {
        type: "Standard",
        volumeUsedMl: 0,
        costPerLiter: 0,
        density: 1.1,
        wasteMarginPercent: 0,
      },
      print: {
        printTimeHours: 0,
        printerPowerWatts: 0,
        energyCostPerKwh: 0,
        failureMode: "percent" as "none" | "percent" | "fixed",
        failureValue: 10,
        riskMultiplier: 1,
        heatUpTimeMinutes: 0,
        heatUpPowerPercent: 100,
      },
      machine: {
        enabled: false,
        machineCost: 3500,
        depreciationMonths: 36,
        hoursPerMonth: 200,
        maintenanceEnabled: false,
        maintenanceCost: 0,
      },
      labor: {
        enabled: false,
        setupTimeMinutes: 0,
        postProcessingTimeMinutes: 0,
        hourlyRate: 25,
      },
      extras: { extrasCost: 0 },
      sales: {
        packagingCost: 0,
        shippingCost: 0,
        taxPercent: 0,
        marketplaceFeePercent: 0,
        profitMarginPercent: 0,
        volumeDiscounts: [],
      },
      ops: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 },
      soft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
      pp: {
        washingEnabled: false,
        alcoholCostPerLiter: 25,
        alcoholVolumeLiters: 0,
        curingEnabled: false,
        curingTimeMinutes: 10,
        curingPowerWatts: 36,
      },
      hw: {
        enabled: false,
        lcdCost: 400,
        lcdLifespanHours: 2000,
        fepCost: 80,
        fepLifespanPrints: 50,
      },
    };
  }

  it("custo zero → sellPrice 0 → actualMargin 0 (nunca NaN/Infinity)", () => {
    const d = resinFixture();
    const r = calculateResin(
      d.mat,
      d.print,
      d.machine,
      d.labor,
      d.extras,
      d.sales,
      d.ops,
      d.soft,
      d.pp,
      d.hw,
    );
    expect(r.totalCost).toBe(0);
    expect(r.sellPrice).toBe(0);
    expect(r.actualMargin).toBe(0);
  });
});
