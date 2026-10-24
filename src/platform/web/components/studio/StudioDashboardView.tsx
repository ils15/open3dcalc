import React, { useState } from "react";
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
import { Tab } from "@/shared/components/AppShell/tabs";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

interface StudioDashboardViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenCopilot: () => void;
}

export const StudioDashboardView: React.FC<StudioDashboardViewProps> = ({
  onTabChange,
  onOpenCopilot,
}) => {
  const isDemoMode = useIsDemoMode();
  const entries = useHistoryStore((s) => s.entries);
  const printers = useCatalogStore((s) => s.printers);
  const salesChannels = useCatalogStore((s) => s.marketplaces);
  // recharts animates in JS, so the CSS backstop for reduced motion cannot
  // reach it — the chart has to honour the preference itself.
  const prefersReduced = useReducedMotion();

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
      if (snapshot.fdmAmsEnabled && snapshot.fdmAmsSlots?.length) {
        for (const slot of snapshot.fdmAmsSlots) {
          if (!slot.enabled) continue;
          const grams =
            slot.weightUsedGrams +
            slot.purgeWeightGrams +
            slot.transitionPurgeGrams;
          if (grams <= 0) continue;
          const material = slot.materialType || "FDM";
          fdmMaterialByType.set(
            material,
            (fdmMaterialByType.get(material) ?? 0) + grams,
          );
          realFdmGrams += grams;
        }
      } else {
        const grams =
          snapshot.fdmMaterial.weightUsed + snapshot.fdmMaterial.purgeWeight;
        if (grams > 0) {
          const material = snapshot.fdmMaterial.type || "FDM";
          fdmMaterialByType.set(
            material,
            (fdmMaterialByType.get(material) ?? 0) + grams,
          );
          realFdmGrams += grams;
        }
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
                  ? "Dashboard aguardando seus dados"
                  : "Sem cálculos neste período"}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Os indicadores abaixo usam apenas cálculos salvos no histórico.
                {entries.length === 0
                  ? " Salve um cálculo para começar a acompanhar sua atividade."
                  : " Ajuste o período ou escolha “Tudo” para consultar registros anteriores."}
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
            Resumo do histórico local e dos perfis configurados na sua oficina.
          </p>
        </div>

        {/* Right action filters and buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time filters */}
          <div
            role="group"
            aria-label="Período do dashboard"
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
            <span>Novo Cálculo</span>
          </button>

          <button
            onClick={() => onTabChange("history")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-info" />
            <span>Histórico ({calculationCount})</span>
          </button>

          <button
            onClick={() => onTabChange("catalog")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-accent" />
            <span>Minha Oficina</span>
          </button>

          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-warning/30 text-warning text-xs font-bold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>IA Copilot</span>
          </button>
        </div>
      </div>

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
            no período selecionado
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
            no período selecionado
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
            ver em Minha Oficina →
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
            ver em Minha Oficina →
          </div>
        </button>
      </div>

      {/* 6 Top Metric Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Faturamento */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              VALOR DE VENDA CALCULADO
            </span>
            <DollarSign className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {revenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            {calculationCount} cálculos salvos no período
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              LUCRO ESTIMADO
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
            <span>{Math.round(marginPct)}% margem líquida</span>
          </div>
        </div>

        {/* Custo Fabril */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              CUSTO CALCULADO
            </span>
            <Layers className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {cost.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            Soma dos custos salvos no histórico
          </div>
        </div>

        {/* Horas Máquina */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TEMPO DE IMPRESSÃO
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              {Math.floor(machineHours)}h {Math.round((machineHours % 1) * 60)}m
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            estimado nos cálculos salvos
          </div>
        </div>

        {/* Consumo Total */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              CONSUMO TOTAL
            </span>
            <Package className="w-4 h-4 text-info" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              {fdmGrams.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            {resinMillilitres.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}{" "}
            ml de resina
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              PREÇO MÉDIO CALCULADO
            </span>
            <ArrowUpRight className="w-4 h-4 text-accent" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {avgTicket.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">por cálculo salvo</div>
        </div>
      </div>

      {/* Charts Row: Financial Area Chart (Left) and Donut Material Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financial Performance Chart */}
        <div className="lg:col-span-2 bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Histórico de valores calculados
              </h2>
              <span className="text-[11px] text-text-secondary">
                Preço sugerido, lucro estimado e custo dos cálculos salvos
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
                Nenhum cálculo salvo neste período.
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                // recharts animates via JS requestAnimationFrame, so the
                // global `animation-duration: 0.01ms !important` backstop in
                // components.css cannot reach it. This grow-in is the only
                // motion in the inventory that carries information — it is how
                // the series reads as a trend — so it is gated on the user's
                // own reduced-motion preference instead of being left on.
              >
                <defs>
                  <linearGradient id="colorVenda" x1="0" y1="0" x2="0" y2="1">
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
                  <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
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
                {/* recharts animates these grow-ins via JS requestAnimationFrame,
                    so the global `animation-duration: 0.01ms !important`
                    backstop in components.css cannot reach them. This is the
                    only motion in the inventory that carries information — it
                    is how the series reads as a trend — so it is gated on the
                    user's own reduced-motion preference rather than dropped. */}
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
                Consumo FDM por material
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
              Estoque →
            </button>
          </div>

          <div className="relative flex h-48 w-full items-center justify-center">
            {materialData.length === 0 ? (
              <div className="text-center text-sm text-text-secondary">
                Sem consumo FDM registrado no período.
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

      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Cálculos recentes
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
            Abrir histórico
          </button>
        </div>
        {visibleEntries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            {isUsingDemo
              ? "O histórico da demonstração aparecerá aqui."
              : "Nenhum cálculo salvo para exibir."}
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
                    {entry.name || entry.summary || "Cálculo sem nome"}
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
