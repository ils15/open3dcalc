import { describe, it, expect } from "vitest";

import type {
  MaterialStateFDM,
  MaterialStateResin,
  PrintParameters,
  MachineCosts,
  LaborCosts,
  AdditionalCosts,
  SalesParameters,
  OperationalCosts,
  SoftwareCosts,
  FDMHardware,
  FDMFinishing,
  ResinHardware,
  PostProcessingResin,
} from "@/shared/types";
import { calculateFDM, calculateResin } from "@/shared/lib/calculator";
import { marketplaces } from "@/shared/lib/marketplace";
import {
  compareMarketplaceProfits,
  resolveSellPrice,
  INVALID_MARKETPLACE_NAME,
} from "@/shared/lib/compareMarketplaces";

/**
 * Fixture mínimo — tudo desativado exceto material (10g a R$100/kg = R$1).
 * Factory (não const) para que overrides pontuais mantenham a tipagem.
 */
function fdmFixture(feePercent: number, marginPercent: number, taxPercent: number) {
  return {
    mat: {
      type: "PLA",
      weightUsed: 10,
      purgeWeight: 0,
      costPerKg: 100,
      density: 1.24,
      spoolEfficiency: 100,
    } satisfies MaterialStateFDM,
    print: {
      printTimeHours: 0,
      printerPowerWatts: 0,
      energyCostPerKwh: 0,
      failureMode: "none" as "none" | "percent" | "fixed",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 100,
    },
    machine: {
      enabled: false as boolean,
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
    } satisfies LaborCosts,
    extras: { extrasCost: 0 } satisfies AdditionalCosts,
    sales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent,
      marketplaceFeePercent: feePercent,
      profitMarginPercent: marginPercent,
      volumeDiscounts: [],
    } satisfies SalesParameters,
    ops: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 } satisfies OperationalCosts,
    soft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 } satisfies SoftwareCosts,
    hw: {
      enabled: false,
      nozzleEnabled: true,
      nozzleCost: 25,
      nozzleLifespanKg: 5,
      bedEnabled: true,
      bedAdhesionCost: 0.2,
    } satisfies FDMHardware,
    fin: { enabled: false, suppliesCost: 0 } satisfies FDMFinishing,
  };
}

function resinFixture(feePercent: number, marginPercent: number, taxPercent: number) {
  return {
    mat: {
      type: "standard",
      volumeUsedMl: 5,
      costPerLiter: 200,
      density: 1.1,
      wasteMarginPercent: 0,
    } satisfies MaterialStateResin,
    print: {
      printTimeHours: 0,
      printerPowerWatts: 0,
      energyCostPerKwh: 0,
      failureMode: "none",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 100,
    } satisfies PrintParameters,
    machine: {
      enabled: false,
      machineCost: 3000,
      depreciationMonths: 36,
      hoursPerMonth: 200,
      maintenanceEnabled: false,
      maintenanceCost: 0,
    } satisfies MachineCosts,
    labor: {
      enabled: false,
      setupTimeMinutes: 0,
      postProcessingTimeMinutes: 0,
      hourlyRate: 25,
    } satisfies LaborCosts,
    extras: { extrasCost: 0 } satisfies AdditionalCosts,
    sales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent,
      marketplaceFeePercent: feePercent,
      profitMarginPercent: marginPercent,
      volumeDiscounts: [],
    } satisfies SalesParameters,
    ops: { enabled: false, ppeCostPerPrint: 0, carbonIntensity: 100 } satisfies OperationalCosts,
    soft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 } satisfies SoftwareCosts,
    hw: {
      enabled: false,
      lcdCost: 500,
      lcdLifespanHours: 500,
      fepCost: 80,
      fepLifespanPrints: 100,
    } satisfies ResinHardware,
    post: {
      washingEnabled: false,
      alcoholCostPerLiter: 30,
      alcoholVolumeLiters: 0,
      washType: "alcohol",
      curingEnabled: false,
      curingTimeMinutes: 0,
      curingPowerWatts: 0,
    } satisfies PostProcessingResin,
  };
}

describe("compareMarketplaceProfits", () => {
  it("ranks the full static catalog by net profit (best first)", () => {
    // base=100 margin=30 tax=0:
    //   direct  = 30.00 net (best)   amazon  = 30.00    etsy     = 27.00
    //   shopee79= 26.00              mlivre = 23.50     shopee80 = 14.00
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });

    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.id)).toEqual([
      "direct",
      "amazon",
      "etsy",
      "shopee_ate79",
      "mercadolivre",
      "shopee_80mais",
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps rows sorted by net profit descending (ties are float-tight)", () => {
    // net = base*margin/100 - feeFixed — tax and percent fees are passed
    // through the price, so the ordering is set by the fixed fee. Exact ties
    // (direct vs amazon, both feeFixed 0) may differ in the last ULP.
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 10 });
    const profits = rows.map((r) => r.netProfit);
    for (let i = 1; i < profits.length; i++) {
      expect(profits[i - 1]).toBeGreaterThanOrEqual(profits[i] - 1e-9);
    }
    // best is feeFixed 0, worst is the highest fixed fee
    expect(rows[0].feeFixed).toBe(0);
    expect(rows[rows.length - 1].id).toBe("shopee_80mais");
  });

  it("computes sellPrice with the fee inversion (markup-on-cost)", () => {
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });
    const amazon = rows.find((r) => r.id === "amazon")!;
    // 130 / (1 - 0.15) = 152.941176...
    expect(amazon.sellPrice).toBeCloseTo(152.94117647, 6);
    // 152.941176 * 0.15 + 0 = 22.941176...
    expect(amazon.feeTotal).toBeCloseTo(22.94117647, 6);
    expect(amazon.tax).toBe(0);
    expect(amazon.netProfit).toBeCloseTo(30, 6);
  });

  it("includes the fixed fee in feeTotal and netProfit", () => {
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });
    const shopee80 = rows.find((r) => r.id === "shopee_80mais")!;
    // 130 / (1 - 0.14) = 151.162790...
    expect(shopee80.sellPrice).toBeCloseTo(151.1627907, 6);
    expect(shopee80.feeFixed).toBe(16);
    // 151.162790 * 0.14 + 16 = 37.162790...
    expect(shopee80.feeTotal).toBeCloseTo(37.1627907, 6);
    // 151.162790 - 100 - 0 - 37.162790 = 14
    expect(shopee80.netProfit).toBeCloseTo(14, 6);
  });

  it("computes tax on the sell price", () => {
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 10 });
    const direct = rows.find((r) => r.id === "direct")!;
    // 130 / 0.9 = 144.444... → tax = 14.444...
    expect(direct.sellPrice).toBeCloseTo(144.4444444, 6);
    expect(direct.tax).toBeCloseTo(14.4444444, 6);
    expect(direct.netProfit).toBeCloseTo(30, 6);
  });

  it("reports deltaVsBest relative to the best row (0 for the best itself)", () => {
    const rows = compareMarketplaceProfits({ totalCost: 250, marginPercent: 45, taxPercent: 12 });
    const best = rows[0];
    const last = rows[rows.length - 1];

    expect(best.rank).toBe(1);
    expect(best.deltaVsBest).toBe(0);
    expect(best.netProfit).toBeCloseTo(112.5, 6);
    // shopee_80mais earns 16 LESS than the best → negative delta
    expect(last.deltaVsBest).toBeCloseTo(-16, 6);
    expect(last.netProfit - last.deltaVsBest).toBeCloseTo(best.netProfit, 6);
  });

  it("runs over a custom catalog slice", () => {
    const slice = marketplaces.filter((m) => m.id === "direct" || m.id === "etsy");
    const rows = compareMarketplaceProfits({
      totalCost: 100,
      marginPercent: 30,
      taxPercent: 0,
      marketplaces: slice,
    });
    expect(rows.map((r) => r.id)).toEqual(["direct", "etsy"]);
  });

  it("marks broken catalog entries as invalid (name '—', NaN values, sorted last)", () => {
    const rows = compareMarketplaceProfits({
      totalCost: 100,
      marginPercent: 30,
      taxPercent: 0,
      marketplaces: [
        { id: "direct", name: "Venda Direta", feePercent: 0, feeFixed: 0, hasFreeShipping: false },
        { id: "ghost", name: "Ghost", feePercent: Number.NaN, feeFixed: Number.NaN, hasFreeShipping: false },
        { id: "zero", name: "Zero", feePercent: 0, feeFixed: 0, hasFreeShipping: false },
      ],
    });

    const valid = rows.filter((r) => r.isValid);
    const invalid = rows.filter((r) => !r.isValid);

    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].name).toBe(INVALID_MARKETPLACE_NAME);
    expect(invalid[0].sellPrice).toBeNaN();
    expect(invalid[0].feeTotal).toBeNaN();
    expect(invalid[0].netProfit).toBeNaN();
    expect(invalid[0].deltaVsBest).toBeNaN();
    // invalid rows are pushed to the end
    expect(invalid[0].rank).toBe(rows.length);
    // invalid rows never take the top rank
    expect(valid.every((r) => r.rank < invalid[0].rank)).toBe(true);
  });

  it("flags the guard when tax + fee >= 100% (no sane inversion)", () => {
    const rows = compareMarketplaceProfits({
      totalCost: 100,
      marginPercent: 30,
      taxPercent: 80,
      marketplaces: [
        { id: "sane", name: "Sane", feePercent: 10, feeFixed: 0, hasFreeShipping: false },
        { id: "crazy", name: "Crazy", feePercent: 25, feeFixed: 0, hasFreeShipping: false },
      ],
    });
    const crazy = rows.find((r) => r.id === "crazy")!;
    // 80 + 25 = 105% → guard branch
    expect(crazy.isValid).toBe(false);
    expect(crazy.name).toBe(INVALID_MARKETPLACE_NAME);
  });

  it("never returns NaN/Infinity in the valid rows, whatever the input", () => {
    const rows = compareMarketplaceProfits({
      totalCost: Number.NaN,
      marginPercent: Number.POSITIVE_INFINITY,
      taxPercent: Number.NaN,
    });
    expect(rows).toHaveLength(6);
    // Inputs invalid → all rows invalid (base NaN/Infinity < 0 false, not finite)
    for (const row of rows) {
      expect(row.isValid).toBe(false);
      expect(row.name).toBe(INVALID_MARKETPLACE_NAME);
    }
  });

  it("treats a negative base cost as invalid (never computes profit on a bad cost)", () => {
    const rows = compareMarketplaceProfits({ totalCost: -50, marginPercent: 30, taxPercent: 0 });
    expect(rows.every((r) => r.isValid)).toBe(false);
  });

  it("keeps the direct channel the most profitable when the catalog has no fees", () => {
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });
    expect(rows[0].id).toBe("direct");
    expect(rows[0].netProfit).toBeCloseTo(30, 6);
  });

  it("scales with the base cost (risk/shipping are already inside totalCost)", () => {
    const base = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });
    const doubled = compareMarketplaceProfits({ totalCost: 200, marginPercent: 30, taxPercent: 0 });
    const b = base.find((r) => r.id === "etsy")!;
    const d = doubled.find((r) => r.id === "etsy")!;
    // sell price scales linearly with the base
    expect(d.sellPrice).toBeCloseTo(b.sellPrice * 2, 6);
    // net profit = base*margin/100 - feeFixed: doubles minus the fixed fee once more
    expect(d.netProfit).toBeCloseTo(b.netProfit * 2 + b.feeFixed, 6);
  });

  it("respects the catalog order of ids", () => {
    const rows = compareMarketplaceProfits({ totalCost: 100, marginPercent: 30, taxPercent: 0 });
    expect(rows.map((r) => r.id).sort()).toEqual(marketplaces.map((m) => m.id).sort());
  });
});

describe("resolveSellPrice", () => {
  it("inverts fees exactly like the frozen core formula", () => {
    // base=100 margin=30 fee=15 tax=0 → 130/0.85
    expect(resolveSellPrice(100, 30, 0, 15)).toBeCloseTo(152.9411764, 6);
  });

  it("falls back to the core guard (x2) when tax + fee >= 100%", () => {
    // 80 + 25 = 105% → 130*2
    expect(resolveSellPrice(100, 30, 80, 25)).toBeCloseTo(260, 6);
  });

  it("sanitizes non-finite results to 0", () => {
    expect(resolveSellPrice(Number.NaN, 30, 0, 15)).toBe(0);
    expect(resolveSellPrice(100, Number.POSITIVE_INFINITY, 0, 15)).toBe(0);
  });

  it("returns 0 for a zero base cost", () => {
    expect(resolveSellPrice(0, 30, 10, 14)).toBe(0);
  });
});

describe("compareMarketplaceProfits — calculator parity (mirror frozen)", () => {
  // A lib espelha o sellPrice do calculator para o marketplace percentual.
  // O core não aplica roundCurrency no sellPrice, então a paridade é exata.
  const parityCases: Array<[string, number, number, number]> = [
    ["shopee_ate79", 20, 30, 0],
    ["shopee_80mais", 14, 30, 10],
    ["mercadolivre", 16, 45, 12],
    ["amazon", 15, 30, 0],
    ["etsy", 6.5, 50, 7.5],
    ["direct", 0, 25, 0],
  ];

  for (const [id, feePercent, marginPercent, taxPercent] of parityCases) {
    it(`FDM parity to the cent: ${id} (fee=${feePercent}%)`, () => {
      const d = fdmFixture(feePercent, marginPercent, taxPercent);
      const real = calculateFDM(
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

      // The mirror matches the real pipeline, to the cent.
      expect(real.sellPrice).toBeCloseTo(
        resolveSellPrice(real.totalCost, marginPercent, taxPercent, feePercent),
        2,
      );

      // And the comparison row for this marketplace agrees on sell price.
      const rows = compareMarketplaceProfits({
        totalCost: real.totalCost,
        marginPercent,
        taxPercent,
        marketplaces: marketplaces.filter((m) => m.id === id),
      });
      expect(rows[0].sellPrice).toBeCloseTo(real.sellPrice, 2);
    });
  }

  it("resin parity to the cent: mercadolivre (fee=16%)", () => {
    const d = resinFixture(16, 40, 10);
    const real = calculateResin(
      d.mat,
      d.print,
      d.machine,
      d.labor,
      d.extras,
      d.sales,
      d.ops,
      d.soft,
      d.post,
      d.hw,
    );
    expect(real.sellPrice).toBeCloseTo(
      resolveSellPrice(real.totalCost, 40, 10, 16),
      2,
    );
  });

  it("parity holds with a failure rate and risk multiplier in the base", () => {
    const d = fdmFixture(15, 35, 8);
    d.print.failureMode = "percent";
    d.print.failureValue = 20;
    d.print.riskMultiplier = 1.5;
    d.sales.packagingCost = 5;
    d.sales.shippingCost = 12;
    d.machine.enabled = true;

    const real = calculateFDM(
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

    // totalCost here includes risk + packaging + shipping — the comparison base.
    // matCost = 1 (10g @ R$100/kg); failure = 1 * (20% * 1.5) = 0.3
    expect(real.failureCost).toBeCloseTo(0.3, 6);
    expect(real.totalCost).toBeCloseTo(1 + 0.3 + 5 + 12, 6);
    expect(real.sellPrice).toBeCloseTo(
      resolveSellPrice(real.totalCost, 35, 8, 15),
      2,
    );
  });
});
