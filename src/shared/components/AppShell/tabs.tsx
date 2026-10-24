import {
  Calculator as CalculatorIcon,
  Clock,
  Warehouse,
  BarChart3,
  Grid3x3,
  Spool,
  FileText,
  Users,
  Package,
  Store,
  ShieldCheck,
  MoreHorizontal,
} from "lucide-react";

import { MORE_TAB_IDS, PRIMARY_TAB_IDS } from "@/shared/lib/navigationPrefs";

/**
 * Navigation surfaces and the Phase 7o s3 primary/demoted split (V2.0).
 *
 * `Tab` is the surface contract: it is the vocabulary every platform, the tab
 * → surface switch and the tutorial registry already speak, and it is
 * unchanged by this phase. Inventory and marketplace remain valid route IDs
 * for subsections inside My Workshop, but are no longer standalone navigation
 * destinations. The remaining surfaces are split between primary and More.
 *
 * The primary destinations are calculator→Pricing, dashboard→Dashboard,
 * history→History and catalog→My Workshop. Infill is demoted, not removed —
 * its standalone screen and its in-calculator field are untouched.
 *
 * `TABS` stays the full ordered catalog (primary first, then demoted) and is
 * locked by tabsParity.test (web ≡ desktop ≡ TUTORIAL_TABS) — keep all three in
 * sync. Wiki and Novidades are footer-only surfaces and are intentionally not
 * part of this array.
 */
export type Tab =
  | "calculator"
  | "dashboard"
  | "catalog"
  | "history"
  | "infill"
  | "inventory"
  | "changelog"
  | "quotes"
  | "customers"
  | "products"
  | "privacy"
  | "marketplace"
  | "wiki";

export interface TabEntry {
  id: Tab;
  icon: React.ReactNode;
  labelKey: string;
  label: string;
}

export const TABS: TabEntry[] = [
  {
    id: "calculator",
    icon: <CalculatorIcon className="w-[18px] h-[18px]" />,
    labelKey: "nav.pricing",
    label: "Precificação",
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="w-[18px] h-[18px]" />,
    labelKey: "nav.dashboard",
    label: "Dashboard",
  },
  {
    id: "history",
    icon: <Clock className="w-[18px] h-[18px]" />,
    labelKey: "nav.history",
    label: "Histórico",
  },
  {
    id: "catalog",
    icon: <Warehouse className="w-[18px] h-[18px]" />,
    labelKey: "nav.catalog",
    label: "Minha Oficina",
  },
  {
    id: "inventory",
    icon: <Spool className="w-[18px] h-[18px]" />,
    labelKey: "nav.spools",
    label: "Carretéis",
  },
  {
    id: "infill",
    icon: <Grid3x3 className="w-[18px] h-[18px]" />,
    labelKey: "nav.infill",
    label: "Calc. Infill",
  },
  {
    id: "quotes",
    icon: <FileText className="w-[18px] h-[18px]" />,
    labelKey: "nav.quotes",
    label: "Orçamentos",
  },
  {
    id: "customers",
    icon: <Users className="w-[18px] h-[18px]" />,
    labelKey: "nav.customers",
    label: "Clientes",
  },
  {
    id: "products",
    icon: <Package className="w-[18px] h-[18px]" />,
    labelKey: "nav.products",
    label: "Produtos",
  },
  {
    id: "privacy",
    icon: <ShieldCheck className="w-[18px] h-[18px]" />,
    labelKey: "nav.privacy",
    label: "Privacidade",
  },
  {
    id: "marketplace",
    icon: <Store className="w-[18px] h-[18px]" />,
    labelKey: "nav.marketplace",
    label: "Canais de venda",
  },
];

/** The four always-available primary destinations, in nav order. */
export const PRIMARY_TABS: TabEntry[] = TABS.filter((tab) =>
  (PRIMARY_TAB_IDS as readonly string[]).includes(tab.id),
);

/** Standalone surfaces reachable through the "More" disclosure. */
export const MORE_TABS: TabEntry[] = TABS.filter((tab) =>
  (MORE_TAB_IDS as readonly string[]).includes(tab.id),
);

/** Destinations users can show or hide in navigation settings. */
export const NAVIGATION_TABS: TabEntry[] = TABS.filter(
  (tab) => tab.id !== "inventory" && tab.id !== "marketplace",
);

/** Route IDs that render a section inside the My Workshop hub. */
export function isWorkshopRoute(tab: Tab): boolean {
  return tab === "catalog" || tab === "inventory" || tab === "marketplace";
}

/** Treat all workshop sections as one active navigation destination. */
export function isNavigationTabActive(activeTab: Tab, navTab: Tab): boolean {
  return (
    activeTab === navTab || (navTab === "catalog" && isWorkshopRoute(activeTab))
  );
}

/**
 * True when a destination lives behind "More" rather than in the nav bar.
 *
 * Single definition on purpose: the "More" trigger and the tablet strip's
 * active styling must agree on exactly which surfaces are demoted, and a
 * hidden-but-active demoted surface still belongs to More (the panel filters
 * it out, but More is what owns it) — so this is deliberately about ownership,
 * not about visibility.
 */
export function holdsDemotedSurface(tab: Tab): boolean {
  return MORE_TABS.some((entry) => entry.id === tab);
}

/** Icon for the shared "More" trigger. Exported so both shells stay identical. */
export const MORE_ICON = <MoreHorizontal className="w-[18px] h-[18px]" />;
