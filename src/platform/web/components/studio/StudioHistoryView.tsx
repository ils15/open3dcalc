import React, { useState } from "react";
import {
  Clock,
  Search,
  Printer,
  Droplet,
  TrendingUp,
  DollarSign,
  Trash2,
  Calculator,
  MessageCircle,
  Plus,
  FileText,
  Layers,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { HistoryEntry } from "@/shared/types";
import { guardExport } from "@/shared/lib/demoExportGuard";

interface StudioHistoryViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenQuoteModal: () => void;
}

export const StudioHistoryView: React.FC<StudioHistoryViewProps> = ({
  onTabChange,
  onOpenQuoteModal,
}) => {
  const isDemoMode = useIsDemoMode();
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const loadHistoryItem = useCalculatorStore((s) => s.loadHistoryItem);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "fdm" | "resin">("all");
  const [sortBy, setSortBy] = useState<"date" | "price" | "profit" | "name">(
    "date",
  );
  const [confirmClear, setConfirmClear] = useState(false);

  // Filtered and sorted entries
  const filteredEntries = entries
    .filter((entry) => {
      if (filterType !== "all" && entry.type !== filterType) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        (entry.snapshot?.selectedPrinterId || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "date") return b.timestamp - a.timestamp;
      if (sortBy === "price") return b.sellPrice - a.sellPrice;
      if (sortBy === "profit") return b.profit - a.profit;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  // Aggregates
  const totalRevenue = entries.reduce((acc, e) => acc + (e.sellPrice || 0), 0);
  const totalProfit = entries.reduce((acc, e) => acc + (e.profit || 0), 0);
  const totalCost = entries.reduce((acc, e) => acc + (e.totalCost || 0), 0);
  const avgMargin =
    totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

  const totalMinutes = entries.reduce((acc, e) => {
    const hours =
      e.snapshot?.fdmPrintParams?.printTimeHours ||
      e.snapshot?.resinPrintParams?.printTimeHours ||
      0;
    return acc + Math.round(hours * 60);
  }, 0);
  const displayHours = Math.floor(totalMinutes / 60);
  const displayRemainingMins = totalMinutes % 60;

  const handleLoadItem = (entry: HistoryEntry) => {
    if (entry.snapshot) {
      loadHistoryItem(entry.snapshot);
    }
    onTabChange("calculator");
  };

  const handleWhatsApp = (entry: HistoryEntry) => {
    if (guardExport()) return;
    const text = encodeURIComponent(
      `*Orçamento - Open3DCalc Studio*\n` +
        `Peça: *${entry.name}*\n` +
        `Custo de Produção: R$ ${entry.totalCost.toFixed(2).replace(".", ",")}\n` +
        `*Valor Final: R$ ${entry.sellPrice.toFixed(2).replace(".", ",")}*\n` +
        `Data: ${new Date(entry.timestamp).toLocaleDateString("pt-BR")}\n\n` +
        `Emitido via Open3DCalc Studio.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6 text-text-primary mx-auto w-full max-w-7xl pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-raised border border-border-subtle rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-info font-bold">
              HISTÓRICO DE PRODUÇÃO & VENDAS
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Histórico & Pedidos da Oficina
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Registro detalhado de todos os cálculos, orçamentos emitidos e
            parâmetros salvos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuoteModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-overlay hover:bg-surface-overlay border border-border-subtle text-text-secondary text-xs font-semibold transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-info" />
            <span>Emitir Proposta PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("calculator")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md shadow-accent/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Cálculo</span>
          </button>
        </div>
      </div>

      {/* Top KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Orders */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE PEDIDOS
            </span>
            <Layers className="w-4 h-4 text-info" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              {entries.length}
            </span>
            <span className="text-xs text-text-secondary ml-1.5">
              itens gravados
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            {isDemoMode
              ? "Conjunto fictício Estúdio Maria"
              : "Base de dados local e segura"}
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              FATURAMENTO TOTAL
            </span>
            <DollarSign className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              R$ {totalRevenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-positive font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Soma dos preços de venda</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              LUCRO LÍQUIDO ACUMULADO
            </span>
            <TrendingUp className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-positive">
              R$ {totalProfit.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Margem média de{" "}
            <span className="text-text-primary font-bold">+{avgMargin}%</span>
          </div>
        </div>

        {/* Total Hours */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              HORAS DE MÁQUINA
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              {displayHours}h {displayRemainingMins}m
            </span>
          </div>
          <div className="text-[10px] text-warning font-medium">
            Tempo total estimado de fatiamento
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-raised border border-border-subtle rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da peça, modelo ou material..."
            className="w-full bg-surface-raised border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5 font-semibold">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === "all"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Todos ({entries.length})
            </button>
            <button
              onClick={() => setFilterType("fdm")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                filterType === "fdm"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Printer className="w-3 h-3" />
              <span>FDM</span>
            </button>
            <button
              onClick={() => setFilterType("resin")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                filterType === "resin"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Droplet className="w-3 h-3" />
              <span>Resina</span>
            </button>
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "date" | "price" | "profit" | "name")
            }
            className="bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-secondary font-semibold outline-none cursor-pointer"
          >
            <option value="date">Mais Recentes</option>
            <option value="price">Maior Preço</option>
            <option value="profit">Maior Lucro</option>
            <option value="name">Nome (A-Z)</option>
          </select>

          {/* Clear history */}
          {entries.length > 0 && (
            <div>
              {confirmClear ? (
                <div className="flex items-center gap-1 bg-critical-subtle border border-critical/50 rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      clearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 rounded bg-critical hover:ring-2 hover:ring-critical/40 text-text-inverse font-bold text-[11px]"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded text-text-secondary hover:text-text-primary text-[11px]"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="p-1.5 text-text-secondary hover:text-critical rounded-lg hover:bg-surface-overlay transition-colors"
                  title="Limpar Histórico"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Clock className="w-12 h-12 text-text-disabled mb-3" />
          <h3 className="text-base font-bold text-text-primary mb-1">
            {search
              ? "Nenhum resultado encontrado"
              : "Nenhum pedido registrado no histórico"}
          </h3>
          <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">
            {search
              ? "Tente ajustar os filtros ou pesquisar por outro termo."
              : "Seus cálculos salvos e orçamentos finalizados aparecerão automaticamente nesta central de histórico."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange("calculator")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Cálculo</span>
            </button>
            {!isDemoMode && (
              <button
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-accent text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Carregar Dados de Demonstração</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredEntries.map((entry) => {
            const dateStr = new Date(entry.timestamp).toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              },
            );
            const timeStr = new Date(entry.timestamp).toLocaleTimeString(
              "pt-BR",
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            );

            const hours =
              entry.snapshot?.fdmPrintParams?.printTimeHours ||
              entry.snapshot?.resinPrintParams?.printTimeHours ||
              0;
            const weight =
              entry.snapshot?.fdmMaterial?.weightUsed ||
              entry.snapshot?.resinMaterial?.volumeUsedMl ||
              0;
            const marginCalc =
              entry.totalCost > 0
                ? Math.round((entry.profit / entry.totalCost) * 100)
                : 0;

            return (
              <div
                key={entry.id}
                className="bg-surface-raised hover:bg-surface-raised border border-border-subtle hover:border-border-subtle rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      entry.type === "resin"
                        ? "bg-accent-subtle border-accent/30 text-accent"
                        : "bg-accent-subtle border-accent/30 text-info"
                    }`}
                  >
                    {entry.type === "resin" ? (
                      <Droplet className="w-5 h-5" />
                    ) : (
                      <Printer className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="text-sm font-bold text-text-primary group-hover:text-info transition-colors truncate">
                        {entry.name || "Projeto sem nome"}
                      </h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          entry.type === "resin"
                            ? "bg-accent-subtle text-accent border border-accent/20"
                            : "bg-accent-subtle text-info border border-accent/20"
                        }`}
                      >
                        {entry.type === "resin" ? "Resina" : "FDM"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                      <span className="flex items-center gap-1 text-text-muted">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {dateStr} às {timeStr}
                        </span>
                      </span>
                      {weight > 0 && (
                        <span>
                          •{" "}
                          <strong className="text-text-secondary">
                            {weight}
                            {entry.type === "resin" ? "ml" : "g"}
                          </strong>
                        </span>
                      )}
                      {hours > 0 && (
                        <span>
                          • ⏱️{" "}
                          <strong className="text-text-secondary">
                            {hours.toFixed(1)}h
                          </strong>
                        </span>
                      )}
                      {entry.snapshot?.selectedPrinterId && (
                        <span className="text-text-muted">
                          •{" "}
                          {entry.snapshot.selectedPrinterId.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Values & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 border-border-subtle pt-3 md:pt-0">
                  {/* Prices */}
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-text-muted block">
                        Custo
                      </span>
                      <span className="text-xs font-semibold text-text-secondary">
                        R$ {entry.totalCost.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-text-muted block">
                        Preço Final
                      </span>
                      <span className="text-sm font-extrabold text-text-primary">
                        R$ {entry.sellPrice.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="text-[10px] font-mono uppercase text-positive font-bold block">
                        +{marginCalc}%
                      </span>
                      <span className="text-xs font-bold text-positive">
                        +R$ {entry.profit.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleLoadItem(entry)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-xs font-semibold text-info transition-colors"
                      title="Carregar parâmetros na Calculadora"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Carregar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsApp(entry)}
                      className="p-1.5 rounded-lg bg-positive-subtle hover:bg-positive-subtle border border-positive/30 text-positive transition-colors"
                      title="Enviar proposta via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-critical hover:bg-critical-subtle transition-colors"
                      title="Excluir do Histórico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
