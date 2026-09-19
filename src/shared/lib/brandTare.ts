/**
 * Tara (peso do carretel) por marca de filamento — folha estática.
 *
 * A tara é o peso da bobina vazia (carretel + anel + selagem). Ela é subtraída
 * do peso ATUAL medido na balança para dar o peso líquido de plástico
 * realmente disponível (`filamentRemaining.remainingNetGrams`).
 *
 * Os valores são de catálogo/fabricante (benchmark Creative3DP Tools, set/2026):
 * Bambu Lab 210 g, Prusament 194 g, Polymaker (carretel de papelão) 140 g e
 * Anycubic 127 g. Variações de lote existem (Bambu 208–216 g), por isso o
 * usuário pode sempre informar uma tara manual por carretel — este módulo é
 * apenas o fallback razoável, nunca a autoridade.
 *
 * NÃO é CRUD nem tabela do banco: é dado estático de leitura. A edição
 * individual de carretel fica no override do carretel (Wave B).
 */

/** Entrada da tabela estática de tara por marca. */
export interface BrandTareEntry {
  /** Nome canônico da marca (ex.: "Bambu Lab"). */
  brand: string;
  /** Peso do carretel vazio, em gramas. */
  tareGrams: number;
}

/** Tabela estática de tara por marca (g). */
export const BRAND_TARE_GRAMS: readonly BrandTareEntry[] = [
  { brand: "Bambu Lab", tareGrams: 210 },
  { brand: "Prusament", tareGrams: 194 },
  { brand: "Polymaker", tareGrams: 140 }, // carretel de papelão
  { brand: "Anycubic", tareGrams: 127 },
];

/** Origem dos valores — exibida na UI junto à tabela. */
export const BRAND_TARE_SOURCE_NOTE =
  "Tara por marca de catálogo/fabricante (set/2026): Bambu Lab 210 g, " +
  "Prusament 194 g, Polymaker (papelão) 140 g, Anycubic 127 g. Variações de " +
  "lote existem; uma tara manual por carretel sempre vence esta tabela.";

/** Normaliza um nome de marca para lookup: trim, lowercase, espaços colapsados. */
function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Tara de uma marca pelo nome, em gramas; 0 quando desconhecida/ausente.
 *
 * A normalização é só na chave de lookup (o nome que o usuário persistiu na
 * store nunca é mutado). Depois do match exato, aceita match parcial
 * defensivo nos dois sentidos — o campo `brand` do carretel chega como nome
 * de loja ("Bambu Lab X1C 3kg") ou apelido curto ("Bambu"), e nenhum dos dois
 * é igual ao nome canônico da tabela.
 */
export function lookupBrandTare(brand?: string | null): number {
  if (typeof brand !== "string") return 0;
  const needle = normalizeBrand(brand);
  if (!needle) return 0;

  for (const entry of BRAND_TARE_GRAMS) {
    if (normalizeBrand(entry.brand) === needle) return entry.tareGrams;
  }
  for (const entry of BRAND_TARE_GRAMS) {
    const key = normalizeBrand(entry.brand);
    if (needle.includes(key) || key.includes(needle)) return entry.tareGrams;
  }
  return 0;
}
