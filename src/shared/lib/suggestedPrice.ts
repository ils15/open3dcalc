/**
 * suggestedPrice.ts — biblioteca pura de valor sugerido (Wave 9-lib / ROADMAP Phase 7b).
 *
 * Gera cenarios de preço de venda a partir de metas: margem alvo, lucro por peca,
 * lucro mensal, break-even ou preço de concorrente. Reusa `getBulkDiscount`
 * para tiers de quantidade, trata a taxa fixa do marketplace como custo por
 * unidade e mantém toda a matemática fora do store.
 *
 * PREMISSAS (alinhadas ao core calculator.ts):
 * - `totalCost` e o custo unitario POS-RISCO: o core ja embute `riskMultiplier` no
 *   `failureCost` que entra em `totalBaseCost`. Esta lib consome esse custo final e
 *   nao aplica nenhum tratamento de risco separado.
 * - O core e markup-on-cost (priceBeforeFees = totalBaseCost*(1+margin%),
 *   sellPrice = priceBeforeFees/(1-(tax%+fee%)/100)). Esta lib trabalha com "margem
 *   sobre o preço" (margin-on-price), por isso rotula explicitamente a diferenca
 *   margem != markup para evitar a armadilha classica de UX.
 * - `breakEvenPrice` do core e PRE-fees (= totalBaseCost); o modo break_even aqui e
 *   INCLUSIVO (S = (base + fee fixa)/(1-(tax%+fee%)/100)) — o piso real que
 *   cobre custos + fees.
 *
 * Absorve itens do ROADMAP: Phase 3 L172 (projeções "se voce imprimir X pecas/mes"
 * via modo lucro-mensal) e Phase 5 L220 (regras de margem minima + reverse-price).
 *
 * Nenhuma funcao aqui lanca; toda saida e finita (never NaN/Infinity). Metas
 * estruturalmente inatingiveis (denominador <= 0, unidades/mes = 0) retornam
 * { feasible: false } com uma nota didatica.
 */
import { getBulkDiscount } from "@/shared/lib/calculator";
import { roundCurrency } from "@/shared/lib/currency";
import type { VolumeDiscount } from "@/shared/types";

export type SuggestedPriceGoal =
  | { kind: "target_margin"; marginPercent: number }
  | { kind: "profit_per_part"; profit: number }
  | { kind: "monthly_profit"; monthlyProfit: number; unitsPerMonth: number }
  | { kind: "break_even" }
  | { kind: "competitor"; competitorPrice: number };

export interface SuggestedPriceInput {
  readonly totalCost: number;
  readonly taxPercent: number;
  readonly marketplaceFeePercent: number;
  /** Fixed fee charged per unit by the selected marketplace profile. */
  readonly marketplaceFeeFixed?: number;
  readonly quantity: number;
  readonly volumeDiscounts?: readonly VolumeDiscount[];
}

export type SuggestedPriceScenarioKey =
  | "target_margin"
  | "profit_per_part"
  | "monthly_profit"
  | "break_even"
  | "competitor_match"
  | "competitor_undercut"
  | "competitor_beat";

export type SuggestedPriceInfeasibility =
  | "margin_target_unreachable"
  | "fees_consume_price"
  | "monthly_units_required"
  | "below_break_even";

export interface SuggestedPriceScenario {
  label: string;
  /** Stable UI key; `label` remains for existing non-UI consumers. */
  key: SuggestedPriceScenarioKey;
  sellPrice: number;
  profit: number;
  /** Margem real sobre o preço de venda, em %. */
  marginReal: number;
  /** Markup sobre o custo, em %. */
  markup: number;
  feasible: boolean;
  note?: string;
  infeasibility?: SuggestedPriceInfeasibility;
  tier?: { minQuantity: number; discountPercent: number };
}

/** Fator do undercut no modo concorrente (5% abaixo). */
const UNDERCUT_FACTOR = 0.95;
/** Fator do "beat" no modo concorrente (5% acima, posicionamento premium). */
const BEAT_FACTOR = 1.05;

interface ModeScenario {
  label: string;
  key: SuggestedPriceScenarioKey;
  /** Preço sugerido bruto a partir do custo + taxa fixa; NaN sinaliza meta inalcançável. */
  priceFor: (base: number) => number;
  note?: string;
  infeasibility?: SuggestedPriceInfeasibility;
}

interface ModeBundle {
  /** false quando a meta e estruturalmente impossivel (sem cenario tier). */
  feasible: boolean;
  scenarios: ModeScenario[];
}

/** Saneia entrada numerica: nao-finito -> 0, negativo -> 0. */
function sanitize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Valor para exibicao em labels: nao-finito vira 0 (a nota explica o problema). */
function displayValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Denominador valido apenas quando e finito e estritamente positivo. */
function validDenominator(d: number): boolean {
  return Number.isFinite(d) && d > 0;
}

/** Nota didatica para quando impostos + taxas consomem 100%+ do preço. */
function excessiveFeesNote(feeFraction: number, tail: string): string {
  const feeSum = Math.round(feeFraction * 100);
  return `Impostos + taxas somam ${feeSum}% (>= 100% do preço): ${tail}`;
}

function targetMarginBundle(
  goal: Extract<SuggestedPriceGoal, { kind: "target_margin" }>,
  feeFraction: number,
): ModeBundle {
  const label = `Margem alvo ${displayValue(goal.marginPercent)}% sobre o preço`;
  // Margem sobre o preço: S*(1 - tax - fee - alvo) = base + fee fixa.
  const denom = 1 - feeFraction - goal.marginPercent / 100;
  if (!validDenominator(denom)) {
    return {
      feasible: false,
      scenarios: [
        {
          label,
          key: "target_margin",
          priceFor: () => NaN,
          infeasibility: "margin_target_unreachable",
          note: `Margem alvo de ${displayValue(goal.marginPercent)}% mais impostos+taxas consome 100% ou mais do preço: meta inatingivel.`,
        },
      ],
    };
  }
  return {
    feasible: true,
    scenarios: [
      {
        label,
        key: "target_margin",
        priceFor: (base) => base / denom,
        note: `Meta: margem de ${displayValue(goal.marginPercent)}% sobre o preço de venda.`,
      },
    ],
  };
}

function profitPerPartBundle(
  goal: Extract<SuggestedPriceGoal, { kind: "profit_per_part" }>,
  feeFraction: number,
): ModeBundle {
  const label = "Lucro desejado por peca";
  // Lucro pos-fees: S*(1 - tax - fee) - (base + fee fixa) = lucro.
  const denom = 1 - feeFraction;
  if (!validDenominator(denom)) {
    return {
      feasible: false,
      scenarios: [
        {
          label,
          key: "profit_per_part",
          priceFor: () => NaN,
          infeasibility: "fees_consume_price",
          note: excessiveFeesNote(
            feeFraction,
            "nao existe preço que cubra o custo. Reduza as taxas.",
          ),
        },
      ],
    };
  }
  return {
    feasible: true,
    scenarios: [
      {
        label,
        key: "profit_per_part",
        priceFor: (base) => (base + goal.profit) / denom,
      },
    ],
  };
}

function monthlyBundle(
  goal: Extract<SuggestedPriceGoal, { kind: "monthly_profit" }>,
  feeFraction: number,
): ModeBundle {
  const label = `Lucro mensal • ${displayValue(goal.unitsPerMonth)} pecas/mes`;
  // Cuidado com divisao por zero: units/mes <= 0 torna a meta inatingivel.
  if (!Number.isFinite(goal.unitsPerMonth) || goal.unitsPerMonth <= 0) {
    return {
      feasible: false,
      scenarios: [
        {
          label,
          key: "monthly_profit",
          priceFor: () => NaN,
          infeasibility: "monthly_units_required",
          note: "Unidades por mes deve ser maior que zero: nao e possivel dividir o lucro mensal (divisao por zero).",
        },
      ],
    };
  }
  const denom = 1 - feeFraction;
  if (!validDenominator(denom)) {
    return {
      feasible: false,
      scenarios: [
        {
          label,
          key: "monthly_profit",
          priceFor: () => NaN,
          infeasibility: "fees_consume_price",
          note: excessiveFeesNote(
            feeFraction,
            "o lucro mensal fica inatingivel. Reduza as taxas.",
          ),
        },
      ],
    };
  }
  const unitProfit = goal.monthlyProfit / goal.unitsPerMonth;
  return {
    feasible: true,
    scenarios: [
      {
        label,
        key: "monthly_profit",
        priceFor: (base) => (base + unitProfit) / denom,
      },
    ],
  };
}

function breakEvenBundle(feeFraction: number): ModeBundle {
  const label = "Break-even inclusivo de fees";
  // Piso real: S = (base + fee fixa)/(1 - tax - fee) zera o lucro pos-fees.
  const denom = 1 - feeFraction;
  if (!validDenominator(denom)) {
    return {
      feasible: false,
      scenarios: [
        {
          label,
          key: "break_even",
          priceFor: () => NaN,
          infeasibility: "fees_consume_price",
          note: excessiveFeesNote(
            feeFraction,
            "o break-even inclusivo nao existe.",
          ),
        },
      ],
    };
  }
  return {
    feasible: true,
    scenarios: [
      {
        label,
        key: "break_even",
        priceFor: (base) => base / denom,
        note: "Piso de break-even inclusivo de fees (lucro zero). Diferente do breakEvenPrice do core, que e pre-fees (= totalCost).",
      },
    ],
  };
}

function competitorBundle(
  goal: Extract<SuggestedPriceGoal, { kind: "competitor" }>,
): ModeBundle {
  const competitorPrice = sanitize(goal.competitorPrice);
  return {
    feasible: true,
    scenarios: [
      {
        label: "Match concorrente",
        key: "competitor_match",
        priceFor: () => competitorPrice,
      },
      {
        label: "Undercut 5%",
        key: "competitor_undercut",
        priceFor: () => competitorPrice * UNDERCUT_FACTOR,
      },
      {
        label: "Beat (+5%)",
        key: "competitor_beat",
        priceFor: () => competitorPrice * BEAT_FACTOR,
      },
    ],
  };
}

function buildBundle(
  goal: SuggestedPriceGoal,
  feeFraction: number,
): ModeBundle {
  switch (goal.kind) {
    case "target_margin":
      return targetMarginBundle(goal, feeFraction);
    case "profit_per_part":
      return profitPerPartBundle(goal, feeFraction);
    case "monthly_profit":
      return monthlyBundle(goal, feeFraction);
    case "break_even":
      return breakEvenBundle(feeFraction);
    case "competitor":
      return competitorBundle(goal);
  }
}

/** Menor minQuantity entre os tiers elegidos (mesma semantica do getBulkDiscount). */
function tierMinQuantity(
  quantity: number,
  discounts: readonly VolumeDiscount[],
  percent: number,
): number {
  let min = quantity;
  for (const d of discounts) {
    // getBulkDiscount so seleciona tiers onde quantity >= minQuantity, mas o
    // filtro e mantido defensivamente (NaN nunca e elegivel la nem aqui).
    if (
      quantity >= d.minQuantity &&
      d.discountPercent === percent &&
      d.minQuantity < min
    ) {
      min = d.minQuantity;
    }
  }
  return min;
}

function buildScenario(
  label: string,
  key: SuggestedPriceScenarioKey,
  price: number,
  base: number,
  taxPercent: number,
  marketplaceFeePercent: number,
  marketplaceFeeFixed: number,
  note?: string,
  infeasibility?: SuggestedPriceInfeasibility,
): SuggestedPriceScenario {
  const sellPrice = roundFiniteCurrency(Math.max(0, price));
  const tax = (sellPrice * taxPercent) / 100;
  const marketplaceFee =
    (sellPrice * marketplaceFeePercent) / 100 + marketplaceFeeFixed;
  const profit = roundFiniteCurrency(sellPrice - base - tax - marketplaceFee);
  const marginReal =
    sellPrice > 0 ? roundFiniteCurrency((profit / sellPrice) * 100) : 0;
  const markup = base > 0 ? roundFiniteCurrency((profit / base) * 100) : 0;
  const feasible = sellPrice > 0 && profit >= 0;
  const reason = infeasibility ?? (!feasible ? "below_break_even" : undefined);
  return {
    label,
    key,
    sellPrice,
    profit,
    marginReal,
    markup,
    feasible,
    ...(reason ? { infeasibility: reason } : {}),
    note:
      note ??
      (reason === "below_break_even"
        ? `Preço abaixo do break-even: prejuizo de ${Math.abs(profit)}.`
        : undefined),
  };
}

/** Currency rounding that keeps the library's finite-output guarantee. */
function roundFiniteCurrency(value: number): number {
  const rounded = roundCurrency(value);
  return Number.isFinite(rounded) ? rounded : 0;
}

/** Rotula a armadilha classica: margem sobre o preço != markup sobre o custo. */
function annotateTrap(
  goal: SuggestedPriceGoal,
  scenario: SuggestedPriceScenario,
): void {
  if (goal.kind !== "target_margin" || !scenario.feasible) return;
  const trap = `Margem sobre o preço != markup sobre o custo (markup aqui: ${scenario.markup}%).`;
  scenario.note = scenario.note ? `${scenario.note} ${trap}` : trap;
}

/** Explica o efeito do tier de volume no preço sugerido. */
function annotateTier(
  scenario: SuggestedPriceScenario,
  minQuantity: number,
  percent: number,
): void {
  if (!scenario.feasible) return;
  scenario.tier = { minQuantity, discountPercent: percent };
  const info = `Tier qtd>=${minQuantity}: -${percent}% no preço sugerido; margem real cai para ${scenario.marginReal}%.`;
  scenario.note = scenario.note ? `${scenario.note} ${info}` : info;
}

/**
 * Gera cenarios de preço sugerido para a meta informada.
 *
 * Cada cenario vem em duas variaveis quando um tier de desconto por volume se
 * aplica a quantidade informada (getBulkDiscount): sem tier e com tier
 * (desconto de d% aplicado ao preço unitario sugerido). Metas estruturalmente
 * inatingiveis retornam um unico cenario com feasible: false e nota didatica.
 */
export function suggestPrices(
  input: SuggestedPriceInput,
  goal: SuggestedPriceGoal,
): SuggestedPriceScenario[] {
  const base = sanitize(input.totalCost);
  const taxPercent = sanitize(input.taxPercent);
  const marketplaceFeePercent = sanitize(input.marketplaceFeePercent);
  const marketplaceFeeFixed = sanitize(input.marketplaceFeeFixed ?? 0);
  const quantity = sanitize(input.quantity);
  // Copia para satisfazer a assinatura (mutavel) do getBulkDiscount sem violar o
  // contrato readonly do input; a leitura e indireta (import de helper puro).
  const discounts: VolumeDiscount[] = input.volumeDiscounts
    ? [...input.volumeDiscounts]
    : [];
  const feeFraction = (taxPercent + marketplaceFeePercent) / 100;

  const tierPercent =
    discounts.length > 0 ? getBulkDiscount(quantity, discounts) : 0;
  const tierActive = tierPercent > 0;
  const minQuantity = tierActive
    ? tierMinQuantity(quantity, discounts, tierPercent)
    : 0;

  const bundle = buildBundle(goal, feeFraction);
  const out: SuggestedPriceScenario[] = [];

  for (const scenario of bundle.scenarios) {
    // Recovering a fixed per-unit marketplace fee is equivalent to adding it
    // to the amount the target price must cover.
    const basePrice = scenario.priceFor(base + marketplaceFeeFixed);
    const primary = buildScenario(
      scenario.label,
      scenario.key,
      basePrice,
      base,
      taxPercent,
      marketplaceFeePercent,
      marketplaceFeeFixed,
      scenario.note,
      scenario.infeasibility,
    );
    out.push(primary);
    annotateTrap(goal, primary);

    if (bundle.feasible && tierActive) {
      const tiered = buildScenario(
        `${scenario.label} + tier qtd>=${minQuantity} (-${tierPercent}%)`,
        scenario.key,
        basePrice * (1 - tierPercent / 100),
        base,
        taxPercent,
        marketplaceFeePercent,
        marketplaceFeeFixed,
      );
      out.push(tiered);
      annotateTrap(goal, tiered);
      annotateTier(tiered, minQuantity, tierPercent);
    }
  }

  return out;
}
