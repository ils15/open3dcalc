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
    <div className="flex flex-col gap-6 text-slate-100 max-w-full pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0c111e] border border-[#1b253b] rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
              HISTÓRICO DE PRODUÇÃO & VENDAS
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Histórico & Pedidos da Oficina
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro detalhado de todos os cálculos, orçamentos emitidos e
            parâmetros salvos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuoteModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131b2e] hover:bg-[#1a253e] border border-[#212d47] text-slate-200 text-xs font-semibold transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Emitir Proposta PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("calculator")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Cálculo</span>
          </button>
        </div>
      </div>

      {/* Top KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Orders */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE PEDIDOS
            </span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              {entries.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">
              itens gravados
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {isDemoMode
              ? "Conjunto fictício Estúdio Maria"
              : "Base de dados local e segura"}
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              FATURAMENTO TOTAL
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              R$ {totalRevenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Soma dos preços de venda</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              LUCRO LÍQUIDO ACUMULADO
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-emerald-400">
              R$ {totalProfit.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Margem média de{" "}
            <span className="text-white font-bold">+{avgMargin}%</span>
          </div>
        </div>

        {/* Total Hours */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              HORAS DE MÁQUINA
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              {displayHours}h {displayRemainingMins}m
            </span>
          </div>
          <div className="text-[10px] text-amber-400/90 font-medium">
            Tempo total estimado de fatiamento
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0c111e] border border-[#1b253b] rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da peça, modelo ou material..."
            className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#111728] border border-[#212c45] rounded-lg p-0.5 font-semibold">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Todos ({entries.length})
            </button>
            <button
              onClick={() => setFilterType("fdm")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                filterType === "fdm"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Printer className="w-3 h-3" />
              <span>FDM</span>
            </button>
            <button
              onClick={() => setFilterType("resin")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                filterType === "resin"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
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
            className="bg-[#111728] border border-[#1f2b45] rounded-lg px-2.5 py-1.5 text-slate-300 font-semibold outline-none cursor-pointer"
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
                <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-600/50 rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      clearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-bold text-[11px]"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded text-slate-300 hover:text-white text-[11px]"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#161f36] transition-colors"
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
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Clock className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {search
              ? "Nenhum resultado encontrado"
              : "Nenhum pedido registrado no histórico"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {search
              ? "Tente ajustar os filtros ou pesquisar por outro termo."
              : "Seus cálculos salvos e orçamentos finalizados aparecerão automaticamente nesta central de histórico."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange("calculator")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Cálculo</span>
            </button>
            {!isDemoMode && (
              <button
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14122b] hover:bg-[#1b1938] border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
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
                className="bg-[#0c111e] hover:bg-[#0f1526] border border-[#1b253b] hover:border-slate-700/60 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      entry.type === "resin"
                        ? "bg-purple-950/40 border-purple-500/30 text-purple-400"
                        : "bg-blue-950/40 border-blue-500/30 text-blue-400"
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
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {entry.name || "Projeto sem nome"}
                      </h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          entry.type === "resin"
                            ? "bg-purple-900/30 text-purple-300 border border-purple-500/20"
                            : "bg-blue-900/30 text-blue-300 border border-blue-500/20"
                        }`}
                      >
                        {entry.type === "resin" ? "Resina" : "FDM"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {dateStr} às {timeStr}
                        </span>
                      </span>
                      {weight > 0 && (
                        <span>
                          •{" "}
                          <strong className="text-slate-300">
                            {weight}
                            {entry.type === "resin" ? "ml" : "g"}
                          </strong>
                        </span>
                      )}
                      {hours > 0 && (
                        <span>
                          • ⏱️{" "}
                          <strong className="text-slate-300">
                            {hours.toFixed(1)}h
                          </strong>
                        </span>
                      )}
                      {entry.snapshot?.selectedPrinterId && (
                        <span className="text-slate-500">
                          •{" "}
                          {entry.snapshot.selectedPrinterId.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Values & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 border-[#1b253b] pt-3 md:pt-0">
                  {/* Prices */}
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">
                        Custo
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        R$ {entry.totalCost.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">
                        Preço Final
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        R$ {entry.sellPrice.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="text-[10px] font-mono uppercase text-emerald-500 font-bold block">
                        +{marginCalc}%
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        +R$ {entry.profit.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleLoadItem(entry)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111728] hover:bg-[#1a253e] border border-[#202c46] text-xs font-semibold text-blue-400 transition-colors"
                      title="Carregar parâmetros na Calculadora"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Carregar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsApp(entry)}
                      className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 transition-colors"
                      title="Enviar proposta via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
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
