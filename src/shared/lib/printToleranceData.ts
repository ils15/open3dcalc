/**
 * Tabela de referência de tolerâncias de impressão 3D — folha estática.
 *
 * Centraliza os números de calibragem (compensação de furo por material e por
 * diâmetro, inserts rosqueáveis, furos de passagem ISO 273, rolamentos e
 * classes de encaixe) compartilhados entre `holeTolerance` (P2.1) e `pressFit`
 * (P2.2). É o equivalente, na frente de tolerâncias, do que `brandTare` é para
 * a frente de filamento: dado estático de leitura, não CRUD nem tabela do
 * banco.
 *
 * Proveniência: benchmark Creative3DP Tools (set/2026). Os valores são
 * pontos de partida consagrados da comunidade, calibrados para impressora
 * FDM bem tensionada com bico de 0,4 mm — NÃO são leis: cada par
 * impressora/filamento tem sua própria correção, por isso o
 * `PRINT_TOLERANCE_SOURCE_NOTE` vai junto da tabela na UI e o usuário é
 * instruído a fazer um teste de impressão antes de produzir um lote.
 *
 * Estrutura espelha `brandTare.ts`: entries `readonly` + `SOURCE_NOTE`.
 */

/** Materiais com banda de compensação medida no benchmark. */
export type ToleranceMaterial = "pla" | "petg" | "abs";

/** Entrada da compensação por material (mm, intervalo baixo/alto). */
export interface MaterialCompensationEntry {
  material: ToleranceMaterial;
  /** Extremidade baixa da banda, mm. */
  low: number;
  /** Extremidade alta da banda, mm. */
  high: number;
}

/** Compensação por material (mm): quanto o furo impresso "encolhe" no material. */
export const MATERIAL_COMPENSATION: readonly MaterialCompensationEntry[] = [
  { material: "pla", low: 0.1, high: 0.3 },
  { material: "petg", low: 0.15, high: 0.3 },
  { material: "abs", low: 0.2, high: 0.35 },
];

/** Entrada da compensação por diâmetro (mm). */
export interface DiameterCompensationEntry {
  /** Diâmetro nominal do furo, mm. */
  diameter: number;
  /** Compensação, mm. */
  compensation: number;
}

/**
 * Compensação por diâmetro (mm): furos MENORES precisam de uma compensação
 * absolutamente MAIOR (mais plástico acumulado na parede do furo), por isso a
 * tabela é decrescente em compensação. `holeTolerance.sizeComp` interpola
 * linearmente entre os pontos e faz clamp nas pontas.
 */
export const DIAMETER_COMPENSATION: readonly DiameterCompensationEntry[] = [
  { diameter: 3, compensation: 0.27 },
  { diameter: 5, compensation: 0.24 },
  { diameter: 10, compensation: 0.18 },
];

/** Inserts rosqueáveis suportados (parafuso métrico). */
export type InsertSize = "M2" | "M3" | "M4" | "M5" | "M6" | "M8";

/** Entrada do furo recomendado para insert rosqueável. */
export interface InsertHoleEntry {
  size: InsertSize;
  /** Furo recomendado, mm. */
  hole: number;
}

/** Furo recomendado por insert rosqueável (mm). */
export const INSERT_HOLES: readonly InsertHoleEntry[] = [
  { size: "M2", hole: 3.0 },
  { size: "M3", hole: 4.2 },
  { size: "M4", hole: 5.2 },
  { size: "M5", hole: 6.3 },
  { size: "M6", hole: 7.3 },
  { size: "M8", hole: 9.3 },
];

/** Classes de folga ISO 273 para furo de passagem. */
export type ClearanceClass = "fine" | "medium" | "coarse";

/** Entrada do furo de passagem ISO 273 (mm, fina/média/larga). */
export interface ClearanceHoleEntry {
  size: InsertSize;
  fine: number;
  medium: number;
  coarse: number;
}

/** Furos de passagem ISO 273 (mm) por tamanho de parafuso. */
export const CLEARANCE_HOLES: readonly ClearanceHoleEntry[] = [
  { size: "M3", fine: 3.2, medium: 3.4, coarse: 3.6 },
  { size: "M4", fine: 4.3, medium: 4.5, coarse: 4.8 },
  { size: "M5", fine: 5.3, medium: 5.5, coarse: 5.8 },
  { size: "M6", fine: 6.4, medium: 6.6, coarse: 7.0 },
];

/** Entrada do catálogo de rolamentos (furo press-fit recomendado). */
export interface BearingEntry {
  /** Código do rolamento (ex.: "608"). */
  code: string;
  /** Diâmetro externo (OD), mm. */
  od: number;
  /** Furo press-fit recomendado na peça, mm. */
  hole: number;
}

/**
 * Catálogo de rolamentos comuns em impressão 3D (miniatura e projeto
 * mecânico). O furo press-fit é ligeiramente inferior ao OD (−0,10 mm) para
 * prender o rolamento por interferência — `pressFit.bearingPocket` reproduz
 * essa relação aplicando `FIT_OFFSETS["press"]` sobre o OD.
 */
export const BEARING_CATALOG: readonly BearingEntry[] = [
  { code: "623", od: 10, hole: 9.9 },
  { code: "604", od: 12, hole: 11.9 },
  { code: "624", od: 13, hole: 12.9 },
  { code: "605", od: 14, hole: 13.9 },
  { code: "625", od: 16, hole: 15.9 },
  { code: "606", od: 17, hole: 16.9 },
  { code: "607", od: 19, hole: 18.9 },
  { code: "608", od: 22, hole: 21.9 },
  { code: "627", od: 22, hole: 21.9 },
  { code: "628", od: 24, hole: 23.9 },
  { code: "629", od: 26, hole: 25.9 },
  { code: "6201", od: 32, hole: 31.9 },
  { code: "6202", od: 35, hole: 34.9 },
  { code: "6203", od: 40, hole: 39.9 },
];

/** Classes de encaixe suportadas para furo/cavidade por interferência. */
export type FitClass = "press" | "snug" | "sliding" | "never-bind";

/** Entrada do offset por classe de encaixe (mm). */
export interface FitOffsetEntry {
  fit: FitClass;
  /** Offset aplicado sobre a dimensão nominal, mm. Negativo = aperto. */
  offset: number;
}

/**
 * Offsets por classe de encaixe (mm), do mais apertado ao mais solto.
 * Aplicados sobre a dimensão nominal (`pressFit.fitOffset`).
 */
export const FIT_OFFSETS: readonly FitOffsetEntry[] = [
  { fit: "press", offset: -0.1 },
  { fit: "snug", offset: 0.05 },
  { fit: "sliding", offset: 0.15 },
  { fit: "never-bind", offset: 0.35 },
];

/**
 * Origem dos valores — exibida na UI junto às tabelas, como `brandTare`.
 * DISCLAIMER in-copy: são valores de referência, não calibração da máquina
 * do usuário; um teste de impressão precede qualquer lote de produção.
 */
export const PRINT_TOLERANCE_SOURCE_NOTE =
  "Tolerâncias de referência (benchmark Creative3DP Tools, set/2026): " +
  "compensação de furo por material (PLA 0,10–0,30 · PETG 0,15–0,30 · ABS " +
  "0,20–0,35 mm), por diâmetro (3 mm +0,27 · 5 mm +0,24 · 10 mm +0,18), " +
  "inserts rosqueáveis, furos de passagem ISO 273 e catálogo de rolamentos. " +
  "São valores de referência — faça um teste de impressão antes de produzir " +
  "lote; cada par impressora/filamento tem sua própria calibração.";
