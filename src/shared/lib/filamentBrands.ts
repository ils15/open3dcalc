/**
 * Marcas de filamento reais — cadastro de referência para o formulário de
 * carretéis e materiais. Dados factuais públicos (marca, país, faixa de
 * preço típica em BRL/kg, site). Preços são FAIXAS de referência para
 * sanidade de cadastro — o preço real é sempre o que a pessoa paga.
 *
 * Marcas brasileiras primeiro (mercado local do app), depois globais.
 */
export interface FilamentBrand {
  readonly id: string;
  readonly name: string;
  /** ISO country code where the brand is headquartered. */
  readonly country: "BR" | "CN" | "CZ" | "EU" | "PL" | "US";
  /** Typical retail range for PLA/PETG in BRL per kg (reference only). */
  readonly priceRangeBrl: readonly [number, number];
  readonly website: string;
}

export const filamentBrands: FilamentBrand[] = [
  {
    id: "bambu_lab",
    name: "Bambu Lab",
    country: "CN",
    priceRangeBrl: [130, 200],
    website: "https://bambulab.com",
  },
  {
    id: "polymaker",
    name: "Polymaker",
    country: "CN",
    priceRangeBrl: [90, 150],
    website: "https://polymaker.com",
  },
  {
    id: "esun",
    name: "eSun",
    country: "CN",
    priceRangeBrl: [80, 120],
    website: "https://esun3d.net",
  },
  {
    id: "sunlu",
    name: "Sunlu",
    country: "CN",
    priceRangeBrl: [70, 110],
    website: "https://www.sunlu.com",
  },
  {
    id: "prusament",
    name: "Prusament",
    country: "CZ",
    priceRangeBrl: [140, 190],
    website: "https://www.prusa3d.com",
  },
  {
    id: "elegoo",
    name: "Elegoo",
    country: "CN",
    priceRangeBrl: [70, 110],
    website: "https://www.elegoo.com",
  },
  {
    id: "creality_hyper",
    name: "Creality Hyper",
    country: "CN",
    priceRangeBrl: [90, 140],
    website: "https://www.creality.com",
  },
  {
    id: "overture",
    name: "Overture",
    country: "US",
    priceRangeBrl: [90, 130],
    website: "https://overture3d.com",
  },
  {
    id: "hatchbox",
    name: "HATCHBOX",
    country: "US",
    priceRangeBrl: [100, 150],
    website: "https://www.hatchbox3d.com",
  },
  {
    id: "fiberlogy",
    name: "Fiberlogy",
    country: "PL",
    priceRangeBrl: [90, 140],
    website: "https://fiberlogy.com",
  },
  // ── Marcas brasileiras ──
  {
    id: "3d_fila",
    name: "3D Fila",
    country: "BR",
    priceRangeBrl: [90, 140],
    website: "https://www.3dfila.com.br",
  },
  {
    id: "voolt3d",
    name: "Voolt3D",
    country: "BR",
    priceRangeBrl: [85, 130],
    website: "https://voolt3d.com.br",
  },
  {
    id: "national_3d",
    name: "National 3D",
    country: "BR",
    priceRangeBrl: [80, 120],
    website: "https://national3d.com.br",
  },
];
