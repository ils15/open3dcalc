import type { Marketplace } from "@/shared/types";

export type { Marketplace };

// Thumbnails are original stylized artwork (shopping-bag silhouettes with
// characteristic brand colors) — NOT registered trademark logos.
export const marketplaces: Marketplace[] = [
  {
    id: "direct",
    name: "Venda Direta",
    feePercent: 0,
    feeFixed: 0,
    hasFreeShipping: false,
    logo: "/images/marketplaces/direct.svg",
  },
  {
    id: "shopee_ate79",
    name: "Shopee (até R$79)",
    feePercent: 20,
    feeFixed: 4,
    hasFreeShipping: true,
    shippingFeePercent: 0,
    logo: "/images/marketplaces/shopee_ate79.svg",
  },
  {
    id: "shopee_80mais",
    name: "Shopee (R$80+)",
    feePercent: 14,
    feeFixed: 16,
    hasFreeShipping: true,
    shippingFeePercent: 0,
    logo: "/images/marketplaces/shopee_80mais.svg",
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    feePercent: 16,
    feeFixed: 6.5,
    hasFreeShipping: true,
    shippingFeePercent: 0,
    logo: "/images/marketplaces/mercadolivre.svg",
  },
  {
    id: "amazon",
    name: "Amazon",
    feePercent: 15,
    feeFixed: 0,
    hasFreeShipping: false,
    logo: "/images/marketplaces/amazon.svg",
  },
  {
    id: "etsy",
    name: "Etsy",
    feePercent: 6.5,
    feeFixed: 3,
    hasFreeShipping: false,
    logo: "/images/marketplaces/etsy.svg",
  },
];

export function getMarketplace(id: string): Marketplace {
  return marketplaces.find((m) => m.id === id) ?? marketplaces[0];
}

export function calculateMarketplaceFee(
  price: number,
  market: Marketplace,
): { fee: number; feePercent: number } {
  const percentFee = price * (market.feePercent / 100);
  const totalFee = percentFee + market.feeFixed;
  return { fee: totalFee, feePercent: market.feePercent };
}
