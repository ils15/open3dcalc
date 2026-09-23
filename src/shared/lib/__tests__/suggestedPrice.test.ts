import { describe, it, expect } from "vitest";
import {
  suggestPrices,
  type SuggestedPriceGoal,
  type SuggestedPriceScenario,
} from "@/shared/lib/suggestedPrice";
import { reverseFromSellPrice } from "@/shared/lib/sellPriceOverride";

/**
 * Golden inputs used across the algebra assertions.
 * base = 100, tax = 10%, fee = 10% => feeFraction = 0.2, (1 - feeFraction) = 0.8
 */
const BASE_INPUT = {
  totalCost: 100,
  taxPercent: 10,
  marketplaceFeePercent: 10,
  quantity: 1,
} as const;

function finiteFields(scenarios: SuggestedPriceScenario[]): void {
  for (const s of scenarios) {
    for (const v of [s.sellPrice, s.profit, s.marginReal, s.markup]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(typeof s.feasible).toBe("boolean");
  }
}

describe("suggestPrices — shape & invariants", () => {
  it("returns at least one scenario for every goal kind", () => {
    const goals: SuggestedPriceGoal[] = [
      { kind: "target_margin", marginPercent: 30 },
      { kind: "profit_per_part", profit: 50 },
      { kind: "monthly_profit", monthlyProfit: 1000, unitsPerMonth: 20 },
      { kind: "break_even" },
      { kind: "competitor", competitorPrice: 200 },
    ];
    for (const goal of goals) {
      const out = suggestPrices(BASE_INPUT, goal);
      expect(out.length).toBeGreaterThanOrEqual(1);
      finiteFields(out);
    }
  });

  it("never emits NaN or Infinity for pathological inputs", () => {
    const goals: SuggestedPriceGoal[] = [
      { kind: "target_margin", marginPercent: NaN },
      { kind: "target_margin", marginPercent: -50 },
      { kind: "profit_per_part", profit: NaN },
      { kind: "profit_per_part", profit: -10 },
      { kind: "monthly_profit", monthlyProfit: NaN, unitsPerMonth: NaN },
      { kind: "monthly_profit", monthlyProfit: 500, unitsPerMonth: 0 },
      { kind: "competitor", competitorPrice: NaN },
      { kind: "competitor", competitorPrice: -200 },
      { kind: "break_even" },
    ];
    const inputs = [
      { ...BASE_INPUT, totalCost: NaN },
      { ...BASE_INPUT, totalCost: -100 },
      { ...BASE_INPUT, taxPercent: NaN },
      { ...BASE_INPUT, marketplaceFeePercent: NaN },
      { ...BASE_INPUT, taxPercent: -10, marketplaceFeePercent: -20 },
    ];
    for (const input of inputs) {
      for (const goal of goals) {
        const out = suggestPrices(input, goal);
        expect(out.length).toBeGreaterThanOrEqual(1);
        finiteFields(out);
      }
    }
  });
});

describe("suggestPrices — target_margin (margin-on-price)", () => {
  it("solves S = base / (1 - margin - tax - fee) exactly", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "target_margin",
      marginPercent: 30,
    });
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.sellPrice).toBe(200);
    expect(s.profit).toBe(60);
    expect(s.marginReal).toBe(30);
    expect(s.markup).toBe(60);
    expect(s.feasible).toBe(true);
  });

  it("labels the margin != markup trap", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "target_margin",
      marginPercent: 30,
    });
    expect(out[0].note).toContain("markup");
    expect(out[0].note).toContain("60");
  });

  it("is infeasible when target + fees >= 100% of price", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "target_margin",
      marginPercent: 90,
    });
    expect(out).toHaveLength(1);
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toBeTruthy();
  });

  it("treats NaN margin as infeasible with a didactic note", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "target_margin",
      marginPercent: NaN,
    });
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toBeTruthy();
  });
});

describe("suggestPrices — profit_per_part", () => {
  it("solves S = (base + profit) / (1 - (tax+fee)) with post-fee profit", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "profit_per_part",
      profit: 50,
    });
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.sellPrice).toBe(187.5);
    expect(s.profit).toBe(50);
    expect(s.marginReal).toBeCloseTo(26.67, 2);
    expect(s.markup).toBe(50);
    expect(s.feasible).toBe(true);
  });

  it("is infeasible when tax + fee >= 100%", () => {
    const out = suggestPrices(
      { ...BASE_INPUT, taxPercent: 60, marketplaceFeePercent: 50 },
      { kind: "profit_per_part", profit: 10 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toContain("100");
  });
});

describe("suggestPrices — monthly_profit", () => {
  it("divides monthly profit by units/month then applies per-part math", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "monthly_profit",
      monthlyProfit: 1000,
      unitsPerMonth: 20,
    });
    expect(out).toHaveLength(1);
    const s = out[0];
    // unit profit = 1000 / 20 = 50 -> same as profit_per_part 50
    expect(s.sellPrice).toBe(187.5);
    expect(s.profit).toBe(50);
    expect(s.feasible).toBe(true);
  });

  it("is infeasible when unitsPerMonth is zero (division by zero)", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "monthly_profit",
      monthlyProfit: 1000,
      unitsPerMonth: 0,
    });
    expect(out).toHaveLength(1);
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toBeTruthy();
  });

  it("is infeasible when unitsPerMonth is NaN", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "monthly_profit",
      monthlyProfit: 1000,
      unitsPerMonth: NaN,
    });
    expect(out[0].feasible).toBe(false);
  });

  it("is infeasible when tax + fee >= 100%", () => {
    const out = suggestPrices(
      { ...BASE_INPUT, taxPercent: 60, marketplaceFeePercent: 50 },
      { kind: "monthly_profit", monthlyProfit: 500, unitsPerMonth: 10 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toContain("100");
  });
});

describe("suggestPrices — break_even", () => {
  it("solves the fee-inclusive floor S = base / (1 - (tax+fee))", () => {
    const out = suggestPrices(BASE_INPUT, { kind: "break_even" });
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.sellPrice).toBe(125);
    expect(s.profit).toBe(0);
    expect(s.marginReal).toBe(0);
    expect(s.markup).toBe(0);
    expect(s.feasible).toBe(true);
    // didactic: core breakEvenPrice is pre-fees, this is inclusive
    expect(s.note).toBeTruthy();
  });

  it("is infeasible when tax + fee >= 100%", () => {
    const out = suggestPrices(
      { ...BASE_INPUT, taxPercent: 50, marketplaceFeePercent: 60 },
      { kind: "break_even" },
    );
    expect(out[0].feasible).toBe(false);
    expect(out[0].note).toContain("100");
  });
});

describe("suggestPrices — competitor (reuses reverseFromSellPrice)", () => {
  it("emits match / undercut 5% / beat scenarios", () => {
    const out = suggestPrices(BASE_INPUT, {
      kind: "competitor",
      competitorPrice: 200,
    });
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.label)).toEqual([
      "Match concorrente",
      "Undercut 5%",
      "Beat (+5%)",
    ]);
    finiteFields(out);
  });

  it("is numerically identical to reverseFromSellPrice on the match point", () => {
    const ref = reverseFromSellPrice(200, 100, 10, 10);
    const [match] = suggestPrices(BASE_INPUT, {
      kind: "competitor",
      competitorPrice: 200,
    });
    expect(match.sellPrice).toBe(ref.sellPrice);
    expect(match.profit).toBe(ref.profit);
    expect(match.marginReal).toBe(ref.marginReal);
    expect(match.markup).toBe(ref.markupEffective);
    expect(match.feasible).toBe(true);
  });

  it("undercuts by exactly 5% and beats by exactly 5%", () => {
    const [, undercut, beat] = suggestPrices(BASE_INPUT, {
      kind: "competitor",
      competitorPrice: 200,
    });
    expect(undercut.sellPrice).toBe(190);
    expect(beat.sellPrice).toBe(210);
    expect(undercut.profit).toBe(52);
    expect(beat.profit).toBe(68);
  });

  it("flags scenarios below break-even as infeasible", () => {
    // base 155: match (200) lucra 5; undercut (190) perde 3.
    const out = suggestPrices(
      { ...BASE_INPUT, totalCost: 155 },
      { kind: "competitor", competitorPrice: 200 },
    );
    const [match, undercut] = out;
    expect(match.feasible).toBe(true);
    expect(undercut.feasible).toBe(false);
    expect(undercut.note).toBeTruthy();
  });

  it("absorbs extreme fee loads without NaN", () => {
    const out = suggestPrices(
      { ...BASE_INPUT, taxPercent: 60, marketplaceFeePercent: 50 },
      { kind: "competitor", competitorPrice: 200 },
    );
    expect(out).toHaveLength(3);
    finiteFields(out);
    expect(out.every((s) => s.feasible)).toBe(false);
  });
});

describe("suggestPrices — volume discount tiers", () => {
  const TIER_INPUT = {
    ...BASE_INPUT,
    quantity: 10,
    volumeDiscounts: [{ minQuantity: 10, discountPercent: 10 }],
  } as const;

  it("emits with/without-tier variants when the tier applies", () => {
    const out = suggestPrices(TIER_INPUT, { kind: "break_even" });
    expect(out).toHaveLength(2);
    expect(out[0].sellPrice).toBe(125);
    // tier: 125 * 0.9 = 112.5 -> profit = 112.5 - 100 - 22.5 = -10 (below floor)
    expect(out[1].sellPrice).toBe(112.5);
    expect(out[1].label).toContain("tier");
    expect(out[1].feasible).toBe(false);
  });

  it("applies the tier to the target_margin price and keeps both feasible", () => {
    const out = suggestPrices(TIER_INPUT, {
      kind: "target_margin",
      marginPercent: 30,
    });
    expect(out).toHaveLength(2);
    expect(out[0].sellPrice).toBe(200);
    expect(out[1].sellPrice).toBe(180);
    expect(out[1].profit).toBe(44);
    expect(out[1].feasible).toBe(true);
    // both scenarios carry the margin!=markup didactic note
    expect(out[0].note).toContain("markup");
    expect(out[1].note).toContain("markup");
  });

  it("ignores tiers when quantity is below minQuantity", () => {
    const out = suggestPrices(
      { ...TIER_INPUT, quantity: 9 },
      { kind: "target_margin", marginPercent: 30 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].sellPrice).toBe(200);
  });

  it("picks the highest qualifying tier", () => {
    const out = suggestPrices(
      {
        ...TIER_INPUT,
        quantity: 60,
        volumeDiscounts: [
          { minQuantity: 10, discountPercent: 10 },
          { minQuantity: 50, discountPercent: 25 },
        ],
      },
      { kind: "break_even" },
    );
    expect(out).toHaveLength(2);
    expect(out[1].sellPrice).toBe(93.75); // 125 * 0.75
    expect(out[1].label).toContain("qtd>=50");
  });

  it("applies tiers to competitor scenarios too", () => {
    const out = suggestPrices(TIER_INPUT, {
      kind: "competitor",
      competitorPrice: 200,
    });
    expect(out).toHaveLength(6);
    expect(out[0].sellPrice).toBe(200);
    expect(out[1].sellPrice).toBe(180);
  });

  it("ignores an empty volumeDiscounts array", () => {
    const out = suggestPrices(
      { ...TIER_INPUT, volumeDiscounts: [] },
      { kind: "break_even" },
    );
    expect(out).toHaveLength(1);
  });
});
