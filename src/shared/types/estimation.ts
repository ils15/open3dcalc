/**
 * Modos de estimativa — contrato ANTI-COMPLEXIDADE.
 *
 * - `simple` (default): path legado, byte-idêntico ao atual.
 *   `calibrationK` e âncoras G-code são ignoradas.
 * - `advanced`: aplica `calibrationK` (default 1.0) sobre peso/tempo final
 *   e deixa âncoras G-code (`gcodeGrams`/`gcodeMinutes`) vencerem a estimativa.
 *
 * YAGNI: sem classes, sem ML, sem histograma (futuro).
 */

/** Modo de estimativa de peso/tempo. */
export type EstimationMode = "simple" | "advanced";

/**
 * Opcionais de estimativa. Estendidos por `WeightOptions` (stlParser) e
 * `PrintTimeParams` (printTimeEstimator) — nunca um tipo paralelo.
 */
export interface EstimateOptions {
  /** Modo de estimativa. Default `simple` (legado, ignora o resto). */
  mode?: EstimationMode;
  /**
   * Fator de calibração (default 1.0). Só vale em `advanced`:
   * multiplica peso/tempo final. Não-finito ou <= 0 cai para 1.0.
   */
  calibrationK?: number;
  /**
   * Âncora de peso em gramas (ex: E total do G-code convertido).
   * Só vale em `advanced`: quando finita e > 0, VENCE a estimativa.
   */
  gcodeGrams?: number;
  /**
   * Âncora de tempo em minutos (ex: `;TIME` do G-code).
   * Só vale em `advanced`: quando finita e > 0, VENCE a estimativa.
   */
  gcodeMinutes?: number;
}

/** `calibrationK` efetivo: só em advanced, senão 1.0 (sem efeito). */
export function resolveCalibrationK(
  options: EstimateOptions | undefined,
): number {
  if (options?.mode !== "advanced") return 1;
  const k = options.calibrationK;
  return Number.isFinite(k) && (k as number) > 0 ? (k as number) : 1;
}

/** Âncora de peso válida: só em advanced, finita e > 0. */
export function resolveWeightAnchor(
  options: EstimateOptions | undefined,
): number | undefined {
  if (options?.mode !== "advanced") return undefined;
  const g = options.gcodeGrams;
  return Number.isFinite(g) && (g as number) > 0 ? (g as number) : undefined;
}

/** Âncora de tempo válida: só em advanced, finita e > 0. */
export function resolveTimeAnchor(
  options: EstimateOptions | undefined,
): number | undefined {
  if (options?.mode !== "advanced") return undefined;
  const m = options.gcodeMinutes;
  return Number.isFinite(m) && (m as number) > 0 ? (m as number) : undefined;
}
