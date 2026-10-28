import React, { Suspense, lazy, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Layers,
  Clock,
  Package,
  Percent,
  Plus,
  Sparkles,
  ArrowUpRight,
  Info,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useSpoolStore, isLowStockSpool } from "@/shared/stores/spoolStore";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

/* A5: the four workspaces are lazy-mounted so a workspace nobody opens never
   pays for its chart/heatmap code. */
const MaterialEfficiencyHeatmap = lazy(() =>
  import("@/shared/components/Dashboard/MaterialEfficiencyHeatmap").then(
    (m) => ({ default: m.MaterialEfficiencyHeatmap }),
  ),
);

type Workspace = "finance" | "pricing" | "operations" | "engineering";

const WORKSPACES: {
  id: Workspace;
  labelKey: string;
  icon: typeof TrendingUp;
}[] = [
  { id: "finance", labelKey: "dashboard.ws.finance", icon: TrendingUp },
  { id: "pricing", labelKey: "dashboard.ws.pricing", icon: DollarSign },
  { id: "operations", labelKey: "dashboard.ws.operations", icon: Boxes },
  { id: "engineering", labelKey: "dashboard.ws.engineering", icon: Layers },
];

interface StudioDashboardViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenCopilot: () => void;
}

export const StudioDashboardView: React.FC<StudioDashboardViewProps> = ({
  onTabChange,
  onOpenCopilot,
}) => {
  const { t } = useTranslation();
  const isDemoMode = useIsDemoMode();
  const entries = useHistoryStore((s) => s.entries);
  const printers = useCatalogStore((s) => s.printers);
  const salesChannels = useCatalogStore((s) => s.marketplaces);
  const spools = useSpoolStore((s) => s.spools);
  // recharts animates in JS, so the CSS backstop for reduced motion cannot
  // reach it — the chart has to honour the preference itself.
  const prefersReduced = useReducedMotion();

  const [workspace, setWorkspace] = useState<Workspace>("finance");
  const [activeRange, setActiveRange] = useState<
    "7d" | "30d" | "month" | "all"
  >("30d");
  const isUsingDemo = isDemoMode;
  const now = new Date();
  const rangeStart = new Date(now);
  if (activeRange === "7d") rangeStart.setDate(now.getDate() - 6);
  if (activeRange === "30d") rangeStart.setDate(now.getDate() - 29);
  if (activeRange === "month") rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);
  const visibleEntries =
    activeRange === "all"
      ? entries
      : entries.filter((entry) => entry.timestamp >= rangeStart.getTime());
  const hasRealData = visibleEntries.length > 0;

  // The dashboard reports saved calculations, not completed orders. Weight
  // units remain separate: FDM is grams while resin is millilitres.
  const realRevenue = visibleEntries.reduce(
    (sum, entry) => sum + entry.sellPrice,
    0,
  );
  const realProfit = visibleEntries.reduce(
    (sum, entry) => sum + entry.profit,
    0,
  );
  const realCost = visibleEntries.reduce(
    (sum, entry) => sum + entry.totalCost,
    0,
  );
  const realMachineHours = visibleEntries.reduce((sum, entry) => {
    const snapshot = entry.snapshot;
    return (
      sum +
      (entry.type === "fdm"
        ? (snapshot?.fdmPrintParams.printTimeHours ?? 0)
        : (snapshot?.resinPrintParams.printTimeHours ?? 0))
    );
  }, 0);
  const fdmMaterialByType = new Map<string, number>();
  const hoursByMaterial = new Map<string, number>();
  let realFdmGrams = 0;
  let realResinMl = 0;
  const fdmCalculations = visibleEntries.filter(
    (entry) => entry.type === "fdm",
  ).length;
  const resinCalculations = visibleEntries.filter(
    (entry) => entry.type === "resin",
  ).length;
  for (const entry of visibleEntries) {
    const snapshot = entry.snapshot;
    if (!snapshot) continue;
    if (entry.type === "fdm") {
      const material =
        snapshot.fdmMaterial.type ||
        (snapshot.fdmAmsEnabled && snapshot.fdmAmsSlots?.length
          ? (snapshot.fdmAmsSlots.find((slot) => slot.enabled)?.materialType ??
            "FDM")
          : "FDM");
      let grams = 0;
      if (snapshot.fdmAmsEnabled && snapshot.fdmAmsSlots?.length) {
        for (const slot of snapshot.fdmAmsSlots) {
          if (!slot.enabled) continue;
          grams +=
            slot.weightUsedGrams +
            slot.purgeWeightGrams +
            slot.transitionPurgeGrams;
        }
      } else {
        grams =
          snapshot.fdmMaterial.weightUsed + snapshot.fdmMaterial.purgeWeight;
      }
      if (grams > 0) {
        fdmMaterialByType.set(
          material,
          (fdmMaterialByType.get(material) ?? 0) + grams,
        );
        realFdmGrams += grams;
      }
      const hours = snapshot.fdmPrintParams.printTimeHours ?? 0;
      if (hours > 0) {
        hoursByMaterial.set(
          material,
          (hoursByMaterial.get(material) ?? 0) + hours,
        );
      }
    } else {
      realResinMl += snapshot.resinMaterial.volumeUsedMl;
    }
  }
  const calculationCount = isUsingDemo ? 9 : visibleEntries.length;
  const revenue = isUsingDemo ? 3737.94 : realRevenue;
  const netProfit = isUsingDemo ? 1980.05 : realProfit;
  const cost = isUsingDemo ? 1457.13 : realCost;
  const machineHours = isUsingDemo ? 106.5 : realMachineHours;
  const fdmGrams = isUsingDemo ? 4020 : realFdmGrams;
  const resinMillilitres = isUsingDemo ? 140 : realResinMl;
  const avgTicket = calculationCount > 0 ? revenue / calculationCount : 0;
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // ── Pricing workspace derivations (saved entries only) ──
  const aboveBreakEven = visibleEntries.filter((entry) => entry.profit > 0);
  const aboveBreakEvenPct =
    visibleEntries.length > 0
      ? (aboveBreakEven.length / visibleEntries.length) * 100
      : 0;
  const topEntries = [...visibleEntries]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
  const marginByMaterial = [...fdmMaterialByType.entries()].flatMap(
    ([material]) => {
      const materialEntries = visibleEntries.filter(
        (entry) =>
          entry.type === "fdm" &&
          (entry.snapshot?.fdmMaterial.type ?? "FDM") === material,
      );
      const sell = materialEntries.reduce((sum, e) => sum + e.sellPrice, 0);
      const profit = materialEntries.reduce((sum, e) => sum + e.profit, 0);
      return sell > 0
        ? [
            {
              material,
              margin: (profit / sell) * 100,
              count: materialEntries.length,
            },
          ]
        : [];
    },
  );

  // ── Operations workspace derivations ──
  const lowSpools = spools.filter((spool) =>
    isLowStockSpool(spool, LOW_STOCK_GRAMS),
  );
  const failureRates = visibleEntries.flatMap((entry) => {
    const params =
      entry.type === "fdm"
        ? entry.snapshot?.fdmPrintParams
        : entry.snapshot?.resinPrintParams;
    if (!params || params.failureMode !== "percent") return [];
    const rate = params.failureValue * (params.riskMultiplier ?? 1);
    return Number.isFinite(rate) ? [rate] : [];
  });
  const avgFailureRate =
    failureRates.length > 0
      ? failureRates.reduce((sum, rate) => sum + rate, 0) / failureRates.length
      : null;

  // Performance chart data
  const revenueChartData = isUsingDemo
    ? [
        { date: "07/09", preco: 450, lucro: 240, custo: 210 },
        { date: "10/09", preco: 180, lucro: 95, custo: 85 },
        { date: "16/09", preco: 620, lucro: 330, custo: 290 },
        { date: "18/09", preco: 320, lucro: 170, custo: 150 },
        { date: "21/09", preco: 480, lucro: 255, custo: 225 },
        { date: "22/09", preco: 390, lucro: 205, custo: 185 },
        { date: "24/09", preco: 1250, lucro: 670, custo: 580 },
        { date: "25/09", preco: 210, lucro: 110, custo: 100 },
        { date: "25/09", preco: 80, lucro: 42, custo: 38 },
      ]
    : hasRealData
      ? [...visibleEntries].reverse().reduce<
          {
            date: string;
            dateKey: string;
            preco: number;
            lucro: number;
            custo: number;
          }[]
        >((points, entry) => {
          const date = new Date(entry.timestamp);
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const label = date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          });
          const point = points.find((item) => item.dateKey === dateKey);
          if (point) {
            point.preco += entry.sellPrice;
            point.lucro += entry.profit;
            point.custo += entry.totalCost;
          } else {
            points.push({
              date: label,
              dateKey,
              preco: entry.sellPrice,
              lucro: entry.profit,
              custo: entry.totalCost,
            });
          }
          return points;
        }, [])
      : [];

  // The material chart is FDM-only because FDM grams and resin millilitres
  // cannot be combined into one truthful total.
  const materialData = isUsingDemo
    ? [
        { name: "PLA", value: 1235, color: "var(--color-info)" },
        { name: "PETG", value: 280, color: "var(--color-positive)" },
        { name: "PLA Silk", value: 1470, color: "var(--color-info)" },
        {
          name: "Nylon (PA)",
          value: 1035,
          color: "var(--color-cost-filament)",
        },
      ]
    : [...fdmMaterialByType.entries()].map(([name, value], index) => ({
        name,
        value: Math.round(value),
        color: [
          "var(--color-info)",
          "var(--color-positive)",
          "var(--color-warning)",
          "var(--color-cost-filament)",
          "var(--color-accent)",
        ][index % 5],
      }));

  const totalMaterialWeight = materialData.reduce(
    (acc, curr) => acc + curr.value,
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-5 pb-16 text-text-primary">
      {/* Top Notice if in Normal Mode without data */}
      {!isDemoMode && !hasRealData && (
        <div className="bg-surface-overlay border border-accent/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-subtle border border-accent/40 flex items-center justify-center shrink-0 text-info">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {entries.length === 0
                  ? t("dashboardView.waitingTitle")
                  : t("dashboardView.periodEmptyTitle")}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {t("dashboardView.waitingDesc")}
                {entries.length === 0
                  ? t("dashboardView.waitingFirst")
                  : t("dashboardView.waitingOlder")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onTabChange("calculator")}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              Ir à calculadora
            </button>
            <button
              onClick={() => useDemoModeStore.getState().enter()}
              className="px-3 py-1.5 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-accent text-xs font-semibold transition-all"
            >
              Ativar Modo Demo
            </button>
          </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-info" />
              Painel de Gestão & Oficina 3D
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-subtle text-info border border-accent/30">
              {calculationCount}{" "}
              {calculationCount === 1 ? "cálculo" : "cálculos"}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {t("dashboardView.subtitle")}
          </p>
        </div>

        {/* Right action filters and buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time filters */}
          <div
            role="group"
            aria-label={t("dashboardView.periodLabel")}
            className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              aria-pressed={activeRange === "7d"}
              onClick={() => setActiveRange("7d")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRange === "7d"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              7 Dias
            </button>
            <button
              type="button"
              aria-pressed={activeRange === "30d"}
              onClick={() => setActiveRange("30d")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRange === "30d"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              30 Dias
            </button>
            <button
              type="button"
              aria-pressed={activeRange === "month"}
              onClick={() => setActiveRange("month")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRange === "month"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              aria-pressed={activeRange === "all"}
              onClick={() => setActiveRange("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRange === "all"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Tudo
            </button>
          </div>

          <button
            onClick={() => onTabChange("calculator")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("dashboardView.newCalc")}</span>
          </button>

          <button
            onClick={() => onTabChange("history")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-info" />
            <span>
              {t("dashboardView.historyBtn", { count: calculationCount })}
            </span>
          </button>

          <button
            onClick={() => onTabChange("catalog")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-accent" />
            <span>{t("dashboardView.workshopBtn")}</span>
          </button>

          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-warning/30 text-warning text-xs font-bold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t("dashboardView.copilot")}</span>
          </button>
        </div>
      </div>

      {/* A5: workspace switcher — four distinct, data-backed contents */}
      <div
        role="tablist"
        aria-label={t("dashboard.ws.label")}
        className="surface grid grid-cols-2 gap-1.5 rounded-xl border border-border-subtle p-1.5 sm:grid-cols-4"
      >
        {WORKSPACES.map(({ id, labelKey, icon: Icon }) => {
          const selected = workspace === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="dashboard-ws-panel"
              onClick={() => setWorkspace(id)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm ${
                selected
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                  : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div
        id="dashboard-ws-panel"
        role="tabpanel"
        aria-label={t(
          WORKSPACES.find((w) => w.id === workspace)?.labelKey ??
            "dashboard.ws.finance",
        )}
        className="flex min-w-0 flex-col gap-5"
      >
        {workspace === "finance" && (
          <>
            {/* Live activity counts: only history/configuration data, no inferred
          machine state or fabricated operational status. */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Cálculos FDM
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {isUsingDemo ? 7 : fdmCalculations}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {t("dashboardView.inPeriod")}
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Cálculos de resina
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {isUsingDemo ? 2 : resinCalculations}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {t("dashboardView.inPeriod")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTabChange("catalog")}
                className="rounded-xl border border-border-subtle bg-surface-raised p-3.5 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Impressoras personalizadas
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {printers.filter((printer) => printer.custom).length}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {t("dashboardView.seeWorkshop")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onTabChange("marketplace")}
                className="rounded-xl border border-border-subtle bg-surface-raised p-3.5 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Canais de venda personalizados
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {salesChannels.filter((channel) => channel.custom).length}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {t("dashboardView.seeWorkshop")}
                </div>
              </button>
            </div>

            {/* 6 Top Metric Bento Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Faturamento */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.revenueLabel")}
                  </span>
                  <DollarSign className="w-4 h-4 text-positive" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-text-primary">
                    R$ {revenue.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {t("dashboardView.savedInPeriod", {
                    count: calculationCount,
                  })}
                </div>
              </div>

              {/* Lucro Líquido */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.profitLabel")}
                  </span>
                  <Percent className="w-4 h-4 text-positive" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-positive">
                    R$ {netProfit.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="text-[10px] text-positive font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    {t("dashboardView.marginLiquid", {
                      pct: Math.round(marginPct),
                    })}
                  </span>
                </div>
              </div>

              {/* Custo Fabril */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.costLabel")}
                  </span>
                  <Layers className="w-4 h-4 text-text-secondary" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-text-primary">
                    R$ {cost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {t("dashboardView.costSum")}
                </div>
              </div>

              {/* Horas Máquina */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.hoursLabel")}
                  </span>
                  <Clock className="w-4 h-4 text-warning" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-text-primary">
                    {Math.floor(machineHours)}h{" "}
                    {Math.round((machineHours % 1) * 60)}m
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {t("dashboardView.hoursHint")}
                </div>
              </div>

              {/* Consumo Total */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.consumptionLabel")}
                  </span>
                  <Package className="w-4 h-4 text-info" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-text-primary">
                    {fdmGrams.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    g
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {t("dashboardView.resinMl", {
                    ml: resinMillilitres.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    }),
                  })}
                </div>
              </div>

              {/* Ticket Médio */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="text-[10px] font-mono uppercase font-semibold">
                    {t("dashboardView.avgTicketLabel")}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-accent" />
                </div>
                <div className="my-2">
                  <span className="text-xl font-extrabold text-text-primary">
                    R$ {avgTicket.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {t("dashboardView.avgTicketHint")}
                </div>
              </div>
            </div>

            {/* Charts Row: Financial Area Chart (Left) and Donut Material Chart (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Financial Performance Chart */}
              <div className="lg:col-span-2 bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      {t("dashboardView.revenueChartTitle")}
                    </h2>
                    <span className="text-[11px] text-text-secondary">
                      {t("dashboardView.revenueChartSub")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-info font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>{" "}
                      Preço sugerido
                    </span>
                    <span className="flex items-center gap-1.5 text-positive font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-positive"></span>{" "}
                      Lucro
                    </span>
                    <span className="flex items-center gap-1.5 text-text-secondary font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-text-muted"></span>{" "}
                      Custo
                    </span>
                  </div>
                </div>

                <div className="relative h-64 w-full">
                  {!isUsingDemo && revenueChartData.length === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-dashed border-border-subtle text-sm text-text-secondary">
                      {t("dashboardView.noDataInPeriod")}
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={revenueChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorVenda"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--color-info)"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-info)"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorLucro"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--color-positive)"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-positive)"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `R$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-bg-elevated)",
                          borderColor: "var(--color-text-secondary)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [
                          `R$ ${Number(val).toFixed(2).replace(".", ",")}`,
                          "",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="preco"
                        stroke="var(--color-info)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVenda)"
                        isAnimationActive={!prefersReduced}
                      />
                      <Area
                        type="monotone"
                        dataKey="lucro"
                        stroke="var(--color-positive)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorLucro)"
                        isAnimationActive={!prefersReduced}
                      />
                      <Area
                        type="monotone"
                        dataKey="custo"
                        stroke="var(--color-text-muted)"
                        strokeWidth={1.5}
                        fill="transparent"
                        fillOpacity={0}
                        isAnimationActive={!prefersReduced}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Material Consumption Donut */}
              <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-base font-bold text-text-primary">
                      {t("dashboardView.materialTitle")}
                    </h2>
                    <span className="text-[11px] text-text-secondary">
                      Total: {totalMaterialWeight.toLocaleString("pt-BR")} g no
                      histórico
                    </span>
                  </div>
                  <button
                    onClick={() => onTabChange("inventory")}
                    className="text-xs text-info hover:text-info font-semibold"
                  >
                    {t("dashboardView.stockLink")}
                  </button>
                </div>

                <div className="relative flex h-48 w-full items-center justify-center">
                  {materialData.length === 0 ? (
                    <div className="text-center text-sm text-text-secondary">
                      {t("dashboardView.noFdmConsumption")}
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={materialData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            isAnimationActive={!prefersReduced}
                          >
                            {materialData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--color-bg-elevated)",
                              borderColor: "var(--color-text-secondary)",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                            formatter={(val) => [`${val} g`, "Consumo"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-extrabold text-text-primary">
                          {totalMaterialWeight.toLocaleString("pt-BR")} g
                        </span>
                        <span className="text-[10px] font-mono uppercase text-text-secondary">
                          FDM
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-text-secondary mt-2">
                  {materialData.map((mat) => (
                    <div
                      key={mat.name}
                      className="flex items-center gap-1.5 truncate"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: mat.color }}
                      ></span>
                      <span className="truncate">{mat.name}</span>
                      <span className="text-text-muted font-mono ml-auto">
                        {mat.value.toLocaleString("pt-BR")} g
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {workspace === "pricing" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Margem média no período
                </div>
                <div className="mt-1 text-xl font-bold text-positive">
                  {Math.round(marginPct)}%
                </div>
                <div className="text-[11px] text-text-secondary">
                  sobre R$ {revenue.toFixed(2).replace(".", ",")} de venda
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Acima do ponto de equilíbrio
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {Math.round(aboveBreakEvenPct)}%
                </div>
                <div className="text-[11px] text-text-secondary">
                  {aboveBreakEven.length} de {visibleEntries.length} cálculos
                  com lucro
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Margem por material (FDM)
                </div>
                <div className="mt-1 space-y-1">
                  {marginByMaterial.length === 0 ? (
                    <div className="text-[11px] text-text-secondary">
                      Sem cálculos FDM no período.
                    </div>
                  ) : (
                    marginByMaterial.map((row) => (
                      <div
                        key={row.material}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-text-secondary">
                          {row.material}
                        </span>
                        <span className="font-mono font-semibold text-text-primary">
                          {Math.round(row.margin)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Cálculos mais lucrativos
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Ranking do lucro por peça t("dashboardView.inPeriod").
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange("history")}
                  className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t("dashboardView.openHistory")}
                </button>
              </div>
              {topEntries.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-text-secondary">
                  Nenhum cálculo salvo para exibir.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {topEntries.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-text-muted">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text-primary">
                            {entry.name ||
                              entry.summary ||
                              t("dashboardView.unnamed")}
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            {entry.type === "fdm" ? "FDM" : "Resina"} ·{" "}
                            {new Date(entry.timestamp).toLocaleDateString(
                              "pt-BR",
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-positive">
                          R$ {entry.profit.toFixed(2).replace(".", ",")}
                        </div>
                        <div className="text-[11px] text-text-secondary">
                          margem{" "}
                          {entry.sellPrice > 0
                            ? Math.round((entry.profit / entry.sellPrice) * 100)
                            : 0}
                          %
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {workspace === "operations" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Carretéis cadastrados
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {spools.length}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {spools.length - lowSpools.length} com estoque saudável
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTabChange("inventory")}
                className="rounded-xl border border-border-subtle bg-surface-raised p-3.5 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Estoque baixo (&lt;{LOW_STOCK_GRAMS}g)
                </div>
                <div
                  className={`mt-1 text-xl font-bold ${
                    lowSpools.length > 0 ? "text-warning" : "text-positive"
                  }`}
                >
                  {lowSpools.length}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {t("dashboardView.seeWorkshop")}
                </div>
              </button>
              <div className="rounded-xl border border-border-subtle bg-surface-raised p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Risco médio de falha (estimativa)
                </div>
                <div className="mt-1 text-xl font-bold text-text-primary">
                  {avgFailureRate !== null
                    ? `${avgFailureRate.toFixed(1)}%`
                    : "—"}
                </div>
                <div className="text-[11px] text-text-secondary">
                  taxa declarada nos {failureRates.length} cálculos do período
                </div>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-warning" />
                    Carretéis com estoque baixo
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Abaixo de {LOW_STOCK_GRAMS} g restantes — recomenda-se
                    reposição.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange("inventory")}
                  className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Abrir Estoque
                </button>
              </div>
              {lowSpools.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-text-secondary">
                  Nenhum carretel em nível baixo. Estoque saudável.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {lowSpools.map((spool) => (
                    <li
                      key={spool.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full border border-border-subtle"
                          style={{ backgroundColor: spool.colorHex }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text-primary">
                            {spool.material} • {spool.color}
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            {spool.brand}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-bold text-warning">
                        {spool.weightGrams} g restantes
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {workspace === "engineering" && (
          <>
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Eficiência por material
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Lucro por grama dos cálculos salvos no período.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange("history")}
                  className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t("dashboardView.openHistory")}
                </button>
              </div>
              <div className="p-5">
                {hasRealData ? (
                  <Suspense
                    fallback={
                      <p className="py-8 text-center text-sm text-text-secondary">
                        {t("dashboard.loadingCharts")}
                      </p>
                    }
                  >
                    <MaterialEfficiencyHeatmap entries={visibleEntries} />
                  </Suspense>
                ) : (
                  <p className="py-8 text-center text-sm text-text-secondary">
                    Nenhum cálculo salvo para analisar neste período.
                  </p>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Tempo de máquina por material
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Horas estimadas nos cálculos FDM salvos.
                  </p>
                </div>
              </div>
              {hoursByMaterial.size === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-text-secondary">
                  Nenhum tempo registrado no período.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {[...hoursByMaterial.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([material, hours]) => (
                      <li
                        key={material}
                        className="flex items-center justify-between px-5 py-3 text-sm"
                      >
                        <span className="font-semibold text-text-primary">
                          {material}
                        </span>
                        <span className="font-mono text-text-secondary">
                          {Math.floor(hours)}h {Math.round((hours % 1) * 60)}m
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              {t("dashboardView.recentTitle")}
            </h2>
            <p className="text-[11px] text-text-secondary">
              Histórico salvo neste dispositivo, respeitando o período
              selecionado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("dashboardView.openHistory")}
          </button>
        </div>
        {visibleEntries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            {isUsingDemo
              ? t("dashboardView.noRecentDemo")
              : t("dashboardView.noRecent")}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {visibleEntries.slice(0, 5).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {entry.name || entry.summary || t("dashboardView.unnamed")}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    {entry.type === "fdm" ? "FDM" : "Resina"} ·{" "}
                    {new Date(entry.timestamp).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-text-primary">
                    R$ {entry.sellPrice.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    custo R$ {entry.totalCost.toFixed(2).replace(".", ",")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
