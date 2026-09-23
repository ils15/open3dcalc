/**
 * Comparador de lucro entre marketplaces para uma mesma peça (lib pura).
 *
 * Dado o custo total já calculado (result.totalCost — marketplace-independente:
 * produção + failure/risk + packaging + shipping) e os parâmetros de venda
 * atuais (margem e imposto), calcula para cada marketplace do catálogo o preço
 * de venda sugerido e o lucro líquido, ordenando do mais lucrativo para o
 * menos. É a lógica por trás do comparador da UI (Wave 8) — separada da view
 * para ser testável isoladamente, sem tocar na camada de cálculo.
 *
 * MIRROR FROZEN (espelho congelado da camada de cálculo):
 * O core (`calculator.ts`) é INTOCÁVEL por contrato (ROADMAP Phase 7b). Esta lib
 * replica a fórmula de pricing dele — markup-on-cost com INVERSÃO de fees — na
 * MESMA ordem de operações, para que o preço seja idêntico ao centavos:
 *
 *   profitAmountRaw = base * (marginPercent/100)
 *   priceBeforeFees = base + profitAmountRaw
 *   feePctTotal     = (taxPercent + feePercent)/100
 *   sellPrice       = feePctTotal < 1
 *                       ? priceBeforeFees / (1 - feePctTotal)
 *                       : priceBeforeFees * 2          // guard do core
 *
 * `resolveSellPrice` é exportada justamente para que o teste de paridade prove
 * ao centavos que o espelho corresponde ao pipeline real. DRIFT = CI vermelho.
 *
 * DIFERENÇA DELIBERADA vs. core (honestidade): o core só desconta a taxa
 * percentual (`sales.marketplaceFeePercent`); a taxa FIXA (`feeFixed`) existe
 * no catálogo e em `calculateMarketplaceFee`, mas NÃO entra no cálculo
 * principal. Aqui ela ENTRA — `feeTotal = sellPrice*feePercent/100 + feeFixed`
 * — porque o objetivo é comparar o lucro real por marketplace. A UI explica a
 * diferença reusando o AssumptionsPanel.
 *
 * Função pura: recebe parâmetros, não acessa stores nem estado global.
 * Toda a saída é NaN/Infinity-safe (sanitizada — idem `calculator.ts`).
 */

import type { Marketplace } from "@/shared/types";
import { marketplaces } from "@/shared/lib/marketplace";

/**
 * Entrada do comparador. Tudo read-only, espelhando o estado atual:
 * `totalCost` vem do `result` do calculator; `marginPercent`/`taxPercent` dos
 * sales params; `marketplaces` é o catálogo (default: catálogo estático, 6).
 */
export interface MarketplaceComparisonInput {
  /** Custo total base já calculado (result.totalCost): produção + risk + packaging + shipping. */
  totalCost: number;
  /** Margem desejada sobre o custo (sales.profitMarginPercent). */
  marginPercent: number;
  /** Imposto sobre venda em % (sales.taxPercent). */
  taxPercent: number;
  /** Catálogo a comparar. Default: catálogo estático (`marketplaces`). */
  marketplaces?: Marketplace[];
}

/** Linha de resultado do comparador para um marketplace. */
export interface MarketplaceComparisonRow {
  id: string;
  /** Nome do marketplace, ou "—" quando a linha é inválida. */
  name: string;
  /** A linha tem dados suficientes/viáveis para ser comparada? */
  isValid: boolean;
  /** Preço de venda sugerido (markup + inversão de fees). NaN se inválida. */
  sellPrice: number;
  /** Taxa percentual do marketplace (%). */
  feePercent: number;
  /** Taxa fixa do marketplace (R$). */
  feeFixed: number;
  /** Taxa total do marketplace (R$) — percentual + fixa. NaN se inválida. */
  feeTotal: number;
  /** Imposto (R$). NaN se inválida. */
  tax: number;
  /** Lucro líquido (sellPrice − base − tax − feeTotal). NaN se inválida. */
  netProfit: number;
  /** Posição no ranking (1 = mais lucrativo). Inválidas ficam ao final. */
  rank: number;
  /** Diferença de lucro vs. o melhor (R$); 0 no melhor; NaN em inválidas. */
  deltaVsBest: number;
}

/** Marcador de linha inválida exibido na UI (mesmo estilo do compareMaterials). */
export const INVALID_MARKETPLACE_NAME = "—";

/**
 * Resolve o preço de venda — MIRROR FROZEN da camada de cálculo, na mesma
 * ordem de operações do `calculator.ts`. Sanitizada: nunca retorna NaN ou
 * Infinity (entradas não-finitas e estouro viram 0, como o core faz em
 * `roundCurrency`/`computeProfitPerHour`).
 *
 * Exportada para o teste de paridade contra `calculateFDM`/`calculateResin`.
 */
export function resolveSellPrice(
  base: number,
  marginPercent: number,
  taxPercent: number,
  feePercent: number,
): number {
  const profitAmountRaw = base * (marginPercent / 100);
  const priceBeforeFees = base + profitAmountRaw;
  const feePctTotal = (taxPercent + feePercent) / 100;
  const sellPrice =
    feePctTotal < 1 ? priceBeforeFees / (1 - feePctTotal) : priceBeforeFees * 2;
  return Number.isFinite(sellPrice) ? sellPrice : 0;
}

/**
 * Compara o lucro entre marketplaces para a mesma peça. Retorna linhas
 * ordenadas pelo lucro líquido (desc); marketplaces inválidos (catálogo
 * quebrado, tax+fee >= 100% — guard, base negativa) vão ao final marcados como
 * inválidos (nome "—", valores NaN), exatamente como `compareMaterialsForPart`.
 */
export function compareMarketplaceProfits(
  input: MarketplaceComparisonInput,
): MarketplaceComparisonRow[] {
  const list = input.marketplaces ?? marketplaces;
  const base = input.totalCost;
  const marginPercent = input.marginPercent;
  const taxPercent = input.taxPercent;

  const rows = list.map((m): MarketplaceComparisonRow => {
    const feePercent = m.feePercent;
    const feeFixed = m.feeFixed;

    const sellPrice = resolveSellPrice(
      base,
      marginPercent,
      taxPercent,
      feePercent,
    );
    const feeTotal = sellPrice * (feePercent / 100) + feeFixed;
    const tax = sellPrice * (taxPercent / 100);
    const netProfit = sellPrice - base - tax - feeTotal;
    const feePctTotal = (taxPercent + feePercent) / 100;

    // Válido: catálogo íntegro, tax+fee abaixo do guard (inversão sã),
    // base não-negativa e preço de venda factível. A propagação natural de
    // NaN/Infinity em qualquer termo acima invalida a linha.
    const isValid =
      Number.isFinite(feeTotal) &&
      Number.isFinite(netProfit) &&
      feePctTotal < 1 &&
      base >= 0 &&
      sellPrice > 0;

    return {
      id: m.id,
      name: isValid ? m.name : INVALID_MARKETPLACE_NAME,
      isValid,
      sellPrice: isValid ? sellPrice : Number.NaN,
      feePercent: Number.isFinite(feePercent) ? feePercent : Number.NaN,
      feeFixed: Number.isFinite(feeFixed) ? feeFixed : Number.NaN,
      feeTotal: isValid ? feeTotal : Number.NaN,
      tax: isValid ? tax : Number.NaN,
      netProfit: isValid ? netProfit : Number.NaN,
      rank: 0,
      deltaVsBest: Number.NaN,
    };
  });

  const ordered = [
    ...rows.filter((r) => r.isValid).sort((a, b) => b.netProfit - a.netProfit),
    ...rows.filter((r) => !r.isValid),
  ];

  const best = ordered.find((r) => r.isValid);
  const bestNetProfit = best ? best.netProfit : 0;

  ordered.forEach((row, index) => {
    row.rank = index + 1;
    // Both operands are finite (guaranteed by isValid), and every row shares the
    // same base — net profit only differs by feeFixed — so the delta is finite.
    if (row.isValid) {
      row.deltaVsBest = row.netProfit - bestNetProfit;
    }
  });
  return ordered;
}
