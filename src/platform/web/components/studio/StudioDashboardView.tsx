import React, { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Layers,
  Clock,
  Package,
  Percent,
  Plus,
  Printer,
  Sparkles,
  ShieldCheck,
  Sliders,
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
  // recharts animates in JS, so the CSS backstop for reduced motion cannot
  // reach it — the chart has to honour the preference itself.
  const prefersReduced = useReducedMotion();

  const [activeRange, setActiveRange] = useState<
    "7d" | "30d" | "month" | "all"
  >("30d");
  const [activeWorkspace, setActiveWorkspace] = useState<
    "overview" | "profit" | "ops" | "eng"
  >("overview");
  const [activeProjectionTab, setActiveProjectionTab] = useState<
    "quarter" | "trend" | "cap"
  >("quarter");

  // Determine whether to use demo figures or real figures
  const hasRealData = entries.length > 0;
  const isUsingDemo = isDemoMode;

  // Values calculation
  let revenue = 0;
  let netProfit = 0;
  let cost = 0;
  let machineHours = 0;
  let totalWeight = 0;
  let ordersCount = 0;
  let avgTicket = 0;
  let marginPct = 0;

  if (isUsingDemo) {
    // Values from Screenshot 1 (Fictional Studio Maria Print)
    revenue = 3737.94;
    netProfit = 1980.05;
    cost = 1457.13;
    machineHours = 106.5;
    totalWeight = 4.02;
    ordersCount = 9;
    avgTicket = 415.33;
    marginPct = 53.0;
  } else if (hasRealData) {
    revenue = entries.reduce((s, e) => s + (e.sellPrice || 0), 0);
    netProfit = entries.reduce((s, e) => s + (e.profit || 0), 0);
    cost = entries.reduce((s, e) => s + (e.totalCost || 0), 0);
    ordersCount = entries.length;
    avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
    marginPct = cost > 0 ? (netProfit / cost) * 100 : 0;

    const totalMinutes = entries.reduce((acc, e) => {
      const h =
        e.snapshot?.fdmPrintParams?.printTimeHours ||
        e.snapshot?.resinPrintParams?.printTimeHours ||
        0;
      return acc + Math.round(h * 60);
    }, 0);
    machineHours = totalMinutes / 60;

    const totalGrams = entries.reduce((acc, e) => {
      const g =
        e.snapshot?.fdmMaterial?.weightUsed ||
        e.snapshot?.resinMaterial?.volumeUsedMl ||
        0;
      return acc + g;
    }, 0);
    totalWeight = totalGrams / 1000;
  }

  // Performance chart data
  const revenueChartData = isUsingDemo
    ? [
        { date: "07/09", venda: 450, lucro: 240, custo: 210 },
        { date: "10/09", venda: 180, lucro: 95, custo: 85 },
        { date: "16/09", venda: 620, lucro: 330, custo: 290 },
        { date: "18/09", venda: 320, lucro: 170, custo: 150 },
        { date: "21/09", venda: 480, lucro: 255, custo: 225 },
        { date: "22/09", venda: 390, lucro: 205, custo: 185 },
        { date: "24/09", venda: 1250, lucro: 670, custo: 580 },
        { date: "25/09", venda: 210, lucro: 110, custo: 100 },
        { date: "25/09", venda: 80, lucro: 42, custo: 38 },
      ]
    : hasRealData
      ? entries.slice(0, 10).map((e) => ({
          date: new Date(e.timestamp).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          venda: Math.round(e.sellPrice || 0),
          lucro: Math.round(e.profit || 0),
          custo: Math.round(e.totalCost || 0),
        }))
      : [{ date: "Hoje", venda: 0, lucro: 0, custo: 0 }];

  // Material distribution donut data
  const materialData = isUsingDemo
    ? [
        { name: "PLA", value: 1235, color: "var(--color-info)" },
        { name: "PETG", value: 280, color: "var(--color-positive)" },
        { name: "PLA Silk", value: 1470, color: "var(--color-info)" },
        { name: "Resina Standard", value: 140, color: "var(--color-warning)" },
        { name: "Nylon (PA)", value: 310, color: "var(--color-cost-filament)" },
      ]
    : hasRealData
      ? [
          {
            name: "Filamento FDM",
            value: Math.max(1, Math.round(totalWeight * 700)),
            color: "var(--color-info)",
          },
          {
            name: "Outros Materiais",
            value: Math.max(1, Math.round(totalWeight * 300)),
            color: "var(--color-positive)",
          },
        ]
      : [
          {
            name: "Sem Consumo",
            value: 1,
            color: "var(--color-text-secondary)",
          },
        ];

  const totalMaterialWeight = materialData.reduce(
    (acc, curr) => acc + curr.value,
    0,
  );

  return (
    <div className="flex flex-col gap-6 text-text-primary mx-auto w-full max-w-7xl pb-16">
      {/* Top Notice if in Normal Mode without data */}
      {!isDemoMode && !hasRealData && (
        <div className="bg-surface-overlay border border-accent/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-subtle border border-accent/40 flex items-center justify-center shrink-0 text-info">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Dashboard em Tempo Real (Base Limpa)
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Os indicadores mostram os dados reais da sua oficina. Salve
                novos cálculos para acompanhar seu faturamento, ou ative o Modo
                Demo para simular uma oficina em produção.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onTabChange("calculator")}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              Criar Primeiro Cálculo
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
              {ordersCount} {ordersCount === 1 ? "orçamento" : "orçamentos"}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Métricas organizadas por espaços de trabalho para acesso rápido e
            zero sobrecarga visual.
          </p>
        </div>

        {/* Right action filters and buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time filters */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5 text-xs font-medium">
            <button
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
            <span>Histórico ({ordersCount})</span>
          </button>

          <button
            onClick={() => onTabChange("catalog")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-accent" />
            <span>Frota</span>
          </button>

          <button
            onClick={() => onTabChange("inventory")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-warning" />
            <span>Estoque</span>
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

      {/* 4 Workspace Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <button
          onClick={() => setActiveWorkspace("overview")}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
            activeWorkspace === "overview"
              ? "bg-surface-overlay border-accent/50 shadow-md shadow-accent/40 ring-1 ring-accent/30"
              : "bg-surface-raised border-border-subtle hover:bg-surface-overlay text-text-secondary"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-info" />
              Visão Geral & Finanças
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent-subtle text-info font-semibold">
              {ordersCount} pedidos
            </span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1">
            KPIs, receitas, projeção trimestral e fluxo recente
          </span>
        </button>

        <button
          onClick={() => setActiveWorkspace("profit")}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
            activeWorkspace === "profit"
              ? "bg-surface-overlay border-accent/50 shadow-md shadow-accent/40 ring-1 ring-accent/30"
              : "bg-surface-raised border-border-subtle hover:bg-surface-overlay text-text-secondary"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-positive" />
              Rentabilidade & Preços
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-positive-subtle text-positive font-semibold">
              {Math.round(marginPct)}% margem
            </span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1">
            Lucro por material, recomendador de preços e ROI
          </span>
        </button>

        <button
          onClick={() => setActiveWorkspace("ops")}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
            activeWorkspace === "ops"
              ? "bg-surface-overlay border-accent/50 shadow-md shadow-accent/40 ring-1 ring-accent/30"
              : "bg-surface-raised border-border-subtle hover:bg-surface-overlay text-text-secondary"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-info" />
              Operação & Qualidade
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-info-subtle text-info font-semibold">
              2 ativas • 1 manutenção
            </span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1">
            Taxas de sucesso/falha, saúde das máquinas e checklists
          </span>
        </button>

        <button
          onClick={() => setActiveWorkspace("eng")}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
            activeWorkspace === "eng"
              ? "bg-surface-overlay border-accent/50 shadow-md shadow-accent/40 ring-1 ring-accent/30"
              : "bg-surface-raised border-border-subtle hover:bg-surface-overlay text-text-secondary"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              Engenharia & Fatiador
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent-subtle text-accent font-semibold">
              STL Optimizer
            </span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1">
            Otimizador volumétrico, estimador de bicos e perda de purga
          </span>
        </button>
      </div>

      {/* 6 Top Metric Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Faturamento */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              FATURAMENTO
            </span>
            <DollarSign className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {revenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            {ordersCount} pedidos faturados
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              LUCRO LÍQUIDO
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
              CUSTO FABRIL
            </span>
            <Layers className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {cost.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            Insumos, luz & depreciação
          </div>
        </div>

        {/* Horas Máquina */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              HORAS MÁQUINA
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              {Math.floor(machineHours)}h {Math.round((machineHours % 1) * 60)}m
            </span>
          </div>
          <div className="text-[10px] text-warning font-medium">
            2 impressoras em uso
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
              {totalWeight.toFixed(2)} kg
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            Filamento e resina gastos
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TICKET MÉDIO
            </span>
            <ArrowUpRight className="w-4 h-4 text-accent" />
          </div>
          <div className="my-2">
            <span className="text-xl font-extrabold text-text-primary">
              R$ {avgTicket.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">Por peça produzida</div>
        </div>
      </div>

      {/* Monthly Sales Goal Progress Bar */}
      <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary">
              Meta Mensal de Vendas
            </span>
            <span className="text-text-secondary">
              R$ {revenue.toFixed(2).replace(".", ",")} / R$ 5.000,00
            </span>
          </div>
          <span className="font-mono font-bold text-info">
            {revenue >= 5000
              ? "100%"
              : `${Math.min(100, Math.round((revenue / 5000) * 100))}%`}
          </span>
        </div>
        <div className="w-full bg-surface-overlay h-2.5 rounded-full overflow-hidden border border-border-subtle">
          <div
            className="bg-gradient-to-r from-accent via-accent to-positive h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (revenue / 5000) * 100)}%` }}
          />
        </div>
      </div>

      {/* Charts Row: Financial Area Chart (Left) and Donut Material Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financial Performance Chart */}
        <div className="lg:col-span-2 bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Desempenho Financeiro
              </h2>
              <span className="text-[11px] text-text-secondary">
                Evolução diária de faturamento, lucro e custos
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-info font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>{" "}
                Venda
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

          <div className="h-64 w-full">
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
                  dataKey="venda"
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Material Consumption Donut */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Consumo por Material
              </h2>
              <span className="text-[11px] text-text-secondary">
                Total: {totalMaterialWeight}g rastreados
              </span>
            </div>
            <button
              onClick={() => onTabChange("inventory")}
              className="text-xs text-info hover:text-info font-semibold"
            >
              Estoque →
            </button>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
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
                  formatter={(val) => [`${val}g`, "Consumo"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-extrabold text-text-primary">
                {totalMaterialWeight}g
              </span>
              <span className="text-[10px] text-text-secondary uppercase font-mono">
                Consumo
              </span>
            </div>
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
                  {mat.value}g
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Previsões Financeiras & Projeções (QoQ) */}
      <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-warning" />
              Previsões Financeiras & Projeções (QoQ)
            </h2>
            <span className="text-[11px] text-text-secondary">
              Modelos preditivos baseados no histórico de horas de impressão e
              margem líquida média
            </span>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveProjectionTab("quarter")}
              className={`px-3 py-1 rounded transition-colors ${
                activeProjectionTab === "quarter"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Trimestral (Q4)
            </button>
            <button
              onClick={() => setActiveProjectionTab("trend")}
              className={`px-3 py-1 rounded transition-colors ${
                activeProjectionTab === "trend"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Tendência Linear
            </button>
            <button
              onClick={() => setActiveProjectionTab("cap")}
              className={`px-3 py-1 rounded transition-colors ${
                activeProjectionTab === "cap"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Capacidade Máxima
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono uppercase text-text-secondary block mb-1">
              BACKLOG EM CARTEIRA
            </span>
            <div className="text-xl font-bold text-text-primary mb-1">
              {isUsingDemo
                ? "R$ 486,19"
                : `R$ ${(revenue * 0.15).toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-[11px] text-text-muted">
              Valor estimado de pedidos em fila de fatiamento e impressão
            </p>
          </div>

          <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono uppercase text-text-secondary block mb-1">
              PREVISÃO FECHAMENTO TRIMESTRE
            </span>
            <div className="text-xl font-bold text-positive mb-1">
              {isUsingDemo
                ? "R$ 4.719,00"
                : `R$ ${(revenue * 1.35).toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-[11px] text-positive font-medium">
              +{isUsingDemo ? "26.2%" : "15%"} de crescimento com taxa atual de
              ocupação
            </p>
          </div>

          <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono uppercase text-text-secondary block mb-1">
              PROJEÇÃO ANUAL (RUN-RATE)
            </span>
            <div className="text-xl font-bold text-accent mb-1">
              {isUsingDemo
                ? "R$ 37.457,00"
                : `R$ ${(revenue * 12).toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-[11px] text-text-muted">
              Projeção mantendo a frota em 65% de capacidade útil
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
