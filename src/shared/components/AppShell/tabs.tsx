import {
  Calculator as CalculatorIcon,
  Clock,
  Settings2,
  BarChart3,
  Grid3x3,
  Spool,
  FileText,
  Users,
  Package,
  ShieldCheck,
} from "lucide-react";

/**
 * Primary app sections (V2.0 Wave 1 — extracted from the duplicated App.tsx).
 *
 * The bottom/nav bar contains only primary sections; secondary surfaces
 * (Wiki and Novidades) live in the footer hub / desktop sidebar footer
 * instead of competing with the primary tabs. The set is locked by
 * tabsParity.test (web ≡ desktop ≡ TUTORIAL_TABS) — keep all three in sync.
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
    labelKey: "nav.calculator",
    label: "Calculadora",
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="w-[18px] h-[18px]" />,
    labelKey: "nav.dashboard",
    label: "Dashboard",
  },
  {
    id: "infill",
    icon: <Grid3x3 className="w-[18px] h-[18px]" />,
    labelKey: "nav.infill",
    label: "Calc. Infill",
  },
  {
    id: "inventory",
    icon: <Spool className="w-[18px] h-[18px]" />,
    labelKey: "nav.inventory",
    label: "Filamentos",
  },
  {
    id: "catalog",
    icon: <Settings2 className="w-[18px] h-[18px]" />,
    labelKey: "nav.catalog",
    label: "Cadastros",
  },
  {
    id: "history",
    icon: <Clock className="w-[18px] h-[18px]" />,
    labelKey: "nav.history",
    label: "Histórico",
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
];
