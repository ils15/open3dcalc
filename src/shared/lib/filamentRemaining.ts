/**
 * Calculadora de filamento restante por carretel.
 *
 * O peso que a balança mostra é o peso BRUTO (plástico + carretel). Para saber
 * quanto plástico de fato existe — e quantos metros de filamento isso representa
 * — é preciso subtrair a TARA do peso ATUAL, nunca do peso original cheio:
 * um carretel de 1 kg já parcialmente usado não tem mais 1 kg, e a tara continua
 * sendo a mesma. Por isso `remainingNetGrams` opera sobre `weightGrams`.
 *
 * A tara vem de três fontes, em ordem de precedência:
 *   1. override manual do carretel (Wave B: campo `tareGrams` no carretel) —
 *      vence sempre, inclusive quando é 0;
 *   2. tabela estática por marca (`brandTare.lookupBrandTare`);
 *   3. 0 — marca desconhecida ou ausente.
 *
 * A densidade é resolvida por `resolveFilamentDensity` (perfil do material),
 * e o diâmetro padrão é 1.75 mm.
 */

import { lookupBrandTare } from "@/shared/lib/brandTare";
import { resolveFilamentDensity } from "@/shared/lib/filamentProfiles";

/** Diâmetro assumido quando o carretel não informa (prática de mercado). */
export const DEFAULT_SPOOL_DIAMETER_MM = 1.75;

/**
 * Forma mínima de carretel aceita por esta lib — um `FilamentSpool` da store
 * ou qualquer objeto compatível. A tara NÃO vive aqui: é recebida como
 * argumento opcional até a Wave B persisti-la no carretel.
 */
export interface FilamentSpoolLike {
  brand?: string;
  material?: string;
  /** Peso ATUAL (bruto, incluindo o carretel), em gramas. */
  weightGrams: number;
  diameterMm?: number;
}

/**
 * Tara efetiva do carretel, em gramas: override manual vence; senão a tabela de
 * marca; senão 0. Um override precisa ser finito — NaN/Infinity são ignorados e
 * caem na tabela (dados corrompidos não devem inflar o peso líquido).
 */
export function effectiveTareGrams(
  spool: FilamentSpoolLike,
  tareGramsOverride?: number,
): number {
  if (
    typeof tareGramsOverride === "number" &&
    Number.isFinite(tareGramsOverride)
  ) {
    return tareGramsOverride;
  }
  return lookupBrandTare(spool.brand);
}

/**
 * Peso líquido de plástico no carretel, em gramas: peso ATUAL menos a tara
 * efetiva, clampado em 0 (tara maior que o peso atual não gera negativo).
 */
export function remainingNetGrams(
  spool: FilamentSpoolLike,
  tareGramsOverride?: number,
): number {
  const gross = Number.isFinite(spool.weightGrams) ? spool.weightGrams : 0;
  return Math.max(0, gross - effectiveTareGrams(spool, tareGramsOverride));
}

/**
 * Comprimento de filamento, em metros, a partir da massa.
 *
 * meters = (grams / density) / area / 100, onde area = pi * (d/20)^2 em cm²
 * (d em mm -> raio em cm). Entradas inválidas (massa/densidade/diâmetro não
 * positivos ou não finitos) devolvem 0 no lugar de NaN/Infinity.
 */
export function metersFromGrams(
  grams: number,
  densityGperCm3: number,
  diameterMm: number,
): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  if (!Number.isFinite(densityGperCm3) || densityGperCm3 <= 0) return 0;
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return 0;
  const radiusCm = diameterMm / 20;
  const areaCm2 = Math.PI * radiusCm * radiusCm;
  return grams / densityGperCm3 / areaCm2 / 100;
}

/**
 * Metros de filamento restantes no carretel, usando a densidade do material e
 * o diâmetro (padrão 1.75 mm) a partir do peso líquido.
 */
export function remainingMeters(
  spool: FilamentSpoolLike,
  tareGramsOverride?: number,
): number {
  const diameterMm = spool.diameterMm;
  const effectiveDiameterMm =
    typeof diameterMm === "number" &&
    Number.isFinite(diameterMm) &&
    diameterMm > 0
      ? diameterMm
      : DEFAULT_SPOOL_DIAMETER_MM;
  return metersFromGrams(
    remainingNetGrams(spool, tareGramsOverride),
    resolveFilamentDensity(spool.material),
    effectiveDiameterMm,
  );
}

/** Resultado de `coversPrint`. */
export interface PrintCoverage {
  /** A bobina cobre a necessidade? */
  ok: boolean;
  /** Margem em gramas: líquido menos o necessário. Pode ser negativa. */
  marginGrams: number;
  /** O que sobra no carretel após a impressão, clampado em 0. */
  remainingAfter: number;
}

/**
 * A bobina cobre a quantidade de plástico que a peça precisa?
 *
 * `marginGrams` é a margem bruta (negativa = não cobre); `remainingAfter` é o
 * que efetivamente sobra (nunca negativo). Uma necessidade ausente/inválida
 * conta como 0 — não há o que cobrir.
 */
export function coversPrint(
  spool: FilamentSpoolLike,
  requiredGrams: number,
  tareGramsOverride?: number,
): PrintCoverage {
  const remaining = remainingNetGrams(spool, tareGramsOverride);
  const required =
    Number.isFinite(requiredGrams) && requiredGrams > 0 ? requiredGrams : 0;
  const marginGrams = remaining - required;
  return {
    ok: marginGrams >= 0,
    marginGrams,
    remainingAfter: Math.max(0, marginGrams),
  };
}
