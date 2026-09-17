/**
 * Perfis de filamento FDM: densidade + vazão volumétrica máxima (MVS).
 *
 * Centraliza os dois números que os estimadores precisam por material para
 * não duplicar tabelas entre `stlParser` (peso) e `printTimeEstimator`
 * (clamp de velocidade). Densidades alinhadas ao catálogo da calculadora
 * (`shared/lib/materials.ts`); MVS são valores conservadores de literatura
 * para hotend stock com bico de 0,4 mm. Ver `docs/estimators-model.md`.
 */

/** Famílias-base de filamento cobertas pelos estimadores. */
export type FilamentFamily = "pla" | "petg" | "abs" | "asa" | "tpu" | "nylon";

export interface FilamentProfile {
  /** Densidade em g/cm³. */
  densityGcm3: number;
  /**
   * Vazão volumétrica máxima sustentável em mm³/s (MVS).
   * Velocidades que exigiriam Q maior são clamped — sem isso, speeds altos
   * geram tempos impossíveis (Q >> o que o hotend entrega).
   */
  maxVolumetricSpeedMm3PerS: number;
}

export const FILAMENT_PROFILES: Record<FilamentFamily, FilamentProfile> = {
  pla: { densityGcm3: 1.24, maxVolumetricSpeedMm3PerS: 15 },
  petg: { densityGcm3: 1.27, maxVolumetricSpeedMm3PerS: 12 },
  abs: { densityGcm3: 1.04, maxVolumetricSpeedMm3PerS: 12 },
  asa: { densityGcm3: 1.05, maxVolumetricSpeedMm3PerS: 12 }, // = catálogo materials.ts (era 1,07 até PR #73 — sem fonte; alinhado ao catálogo, autoridade)
  tpu: { densityGcm3: 1.21, maxVolumetricSpeedMm3PerS: 5 },
  nylon: { densityGcm3: 1.14, maxVolumetricSpeedMm3PerS: 10 },
};

/** Família assumida quando o chamador não informa o material. */
export const DEFAULT_FILAMENT_FAMILY: FilamentFamily = "pla";

/**
 * Lookup case-insensitive da tabela (D-EA4 — Frente B).
 *
 * `FILAMENT_PROFILES` é indexada por chaves minúsculas, mas o nome do material
 * chega de fonte externa — nome de loja/fabricante, perfil de catálogo ou
 * `filamentInventory` (`"PLA"`, `"PlA"`, `"PETG"`). Antes do D-EA4 o lookup era
 * `FILAMENT_PROFILES[family]`, case-sensitive: esses nomes não existiam na
 * tabela e caíam no fallback seguro, ignorando o perfil REAL do material
 * (ex.: `"PETG"` recebia o teto MVS 10 em vez de 12).
 *
 * A normalização acontece SOMENTE na chave de lookup — ela é derivada da
 * tabela, nunca do input. Nem a tabela indexada nem o valor que o chamador
 * persistiu são mutados: o snapshot do perfil original permanece
 * byte-identical (a store continua guardando `type: "PLA"`, não `"pla"`).
 */
const FILAMENT_PROFILES_BY_LOWER_KEY: Readonly<
  Record<string, FilamentProfile>
> = Object.fromEntries(
  Object.entries(FILAMENT_PROFILES).map(([key, profile]) => [
    key.toLowerCase(),
    profile,
  ]),
);

function lookupFilamentProfile(family: string): FilamentProfile | undefined {
  return FILAMENT_PROFILES_BY_LOWER_KEY[family.toLowerCase()];
}

/**
 * Teto seguro para material desconhecido/fora da tabela.
 * Deliberadamente baixo: prefere superestimar o tempo (margem de preço)
 * a prometer um tempo que o hotend não entrega.
 */
export const DEFAULT_MAX_VOLUMETRIC_SPEED_MM3_PER_S = 10;

/**
 * MVS do material, com fallback seguro para família desconhecida.
 *
 * (D-EA4 — Frente A) `maxVolumetricSpeedOverrideMm3PerS` é o override manual
 * vindo do slice `fdmFilament` (hotend high-flow volcano/CHT dobra o MVS real):
 * vence a tabela quando é finito e estritamente positivo — MVS é um teto de
 * vazão, então 0 ou negativo geraria divisão por zero no clamp (tempo
 * infinito). Ausente/inválido = tabela, byte-identical ao pré-D-EA4.
 *
 * Espelha `resolveFilamentDensity(family, densityOverrideGcm3)`.
 */
export function maxVolumetricSpeedFor(
  family?: FilamentFamily | string,
  maxVolumetricSpeedOverrideMm3PerS?: number,
): number {
  if (
    maxVolumetricSpeedOverrideMm3PerS != null &&
    Number.isFinite(maxVolumetricSpeedOverrideMm3PerS) &&
    maxVolumetricSpeedOverrideMm3PerS > 0
  ) {
    return maxVolumetricSpeedOverrideMm3PerS;
  }
  if (family == null)
    return FILAMENT_PROFILES[DEFAULT_FILAMENT_FAMILY].maxVolumetricSpeedMm3PerS;
  return (
    lookupFilamentProfile(String(family))?.maxVolumetricSpeedMm3PerS ??
    DEFAULT_MAX_VOLUMETRIC_SPEED_MM3_PER_S
  );
}

/**
 * Densidade do material em g/cm³.
 * `densityOverrideGcm3` explícito (ex: vindo da store da calculadora) sempre
 * vence a tabela — a tabela é fallback, não autoridade.
 */
export function resolveFilamentDensity(
  family?: FilamentFamily | string,
  densityOverrideGcm3?: number,
): number {
  if (densityOverrideGcm3 != null && Number.isFinite(densityOverrideGcm3)) {
    return densityOverrideGcm3;
  }
  if (family == null)
    return FILAMENT_PROFILES[DEFAULT_FILAMENT_FAMILY].densityGcm3;
  return (
    lookupFilamentProfile(String(family))?.densityGcm3 ??
    FILAMENT_PROFILES[DEFAULT_FILAMENT_FAMILY].densityGcm3
  );
}
