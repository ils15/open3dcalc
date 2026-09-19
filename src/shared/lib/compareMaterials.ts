/**
 * Comparador de custo de material para uma mesma peça (lib pura).
 *
 * Dado o volume OU o peso de uma peça, calcula para cada material do catálogo
 * quanto ela pesa naquele material e quanto custa, ordenando do mais barato
 * para o mais caro. É a lógica por trás do comparador da UI (Wave C) —
 * separada da view para ser testável isoladamente.
 *
 * Decisão do MVP (frente Phase 6 P1): NÃO há failure rate por material. O
 * `failureRatePercent` é um único valor global, aplicado de forma idêntica a
 * todos os materiais — o multiplicador (1 + rate/100) escala o custo de todos
 * igualmente e, portanto, não muda a ordem do ranking. Comparar taxa de falha
 * por material ficaria para depois de termos dados reais de falha por material.
 *
 * Função pura: recebe parâmetros, não acessa stores nem estado global.
 */

import type { Material } from "@/shared/types";

/** Entrada do comparador. Informe `weightGrams` (peso fixo) ou `volumeCm3`. */
export interface MaterialComparisonInput {
  /** Volume da peça em cm³. Peso = volume × densidade de cada material. */
  volumeCm3?: number | null;
  /**
   * Peso da peça já resolvido, em gramas. Quando presente (finito e positivo),
   * vence sobre `volumeCm3` — todos os materiais pesam o mesmo.
   */
  weightGrams?: number | null;
  /** Quantidade de peças. Default 1; valor inválido/não-positivo vira 1. */
  quantity?: number;
  /** Taxa de falha global em %. Default 0; valor inválido/negativo vira 0. */
  failureRatePercent?: number | null;
}

/** Linha de resultado do comparador para um material. */
export interface MaterialComparisonRow {
  id: string;
  /** Nome do material, ou "—" quando a linha é inválida. */
  name: string;
  density: number;
  /** Peso de UMA peça neste material, em gramas. */
  weightGrams: number;
  /** Custo do material para a quantidade × taxa de falha informadas. */
  materialCost: number;
  /** Preço por grama (avgPrice é por kg). */
  costPerGram: number;
  /** Posição no ranking (1 = mais barato). Inválidas ficam ao final. */
  rank: number;
  /** A linha tem dados suficientes para ser comparada? */
  isValid: boolean;
}

/** Marcador de linha inválida exibido na UI. */
export const INVALID_MATERIAL_NAME = "—";

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Compara materiais para uma peça. Retorna linhas ordenadas pelo custo da peça
 * (asc); materiais sem volume/peso válidos, ou com dados quebrados, vão ao
 * final marcados como inválidos (nome "—", valores NaN).
 */
export function compareMaterialsForPart(
  input: MaterialComparisonInput,
  materials: Material[],
): MaterialComparisonRow[] {
  const hasFixedWeight = isPositiveFinite(input.weightGrams ?? undefined);
  const hasVolume = isPositiveFinite(input.volumeCm3 ?? undefined);
  const quantity = isPositiveFinite(input.quantity) ? input.quantity : 1;
  const failureRatePercent =
    typeof input.failureRatePercent === "number" &&
    Number.isFinite(input.failureRatePercent) &&
    input.failureRatePercent >= 0
      ? input.failureRatePercent
      : 0;
  const failureMultiplier = 1 + failureRatePercent / 100;

  const rows = materials.map((material): MaterialComparisonRow => {
    const costPerGram = material.avgPrice / 1000;
    let weightGrams: number;
    if (hasFixedWeight) {
      weightGrams = input.weightGrams as number;
    } else if (hasVolume) {
      weightGrams = (input.volumeCm3 as number) * material.density;
    } else {
      weightGrams = Number.NaN;
    }

    const isValid =
      Number.isFinite(weightGrams) &&
      weightGrams > 0 &&
      Number.isFinite(material.density) &&
      material.density > 0 &&
      Number.isFinite(costPerGram);

    return {
      id: material.id,
      name: isValid ? material.name : INVALID_MATERIAL_NAME,
      density: material.density,
      weightGrams: isValid ? weightGrams : Number.NaN,
      materialCost: isValid
        ? weightGrams * costPerGram * quantity * failureMultiplier
        : Number.NaN,
      costPerGram: isValid ? costPerGram : Number.NaN,
      rank: 0,
      isValid,
    };
  });

  const ordered = [
    ...rows
      .filter((r) => r.isValid)
      .sort((a, b) => a.materialCost - b.materialCost),
    ...rows.filter((r) => !r.isValid),
  ];
  ordered.forEach((row, index) => {
    row.rank = index + 1;
  });
  return ordered;
}
