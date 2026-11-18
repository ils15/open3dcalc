import React, { useMemo, useState } from "react";
import {
  Clock,
  Printer,
  Droplet,
  TrendingUp,
  DollarSign,
  Trash2,
  Calculator,
  Plus,
  FileText,
  Layers,
  Calendar,
  Sparkles,
  PackagePlus,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useProductInventory } from "@/shared/stores/productInventory";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { HistoryEntry } from "@/shared/types";
import { guardExport } from "@/shared/lib/demoExportGuard";
import {
  calculatorToProduct,
  isDuplicateProductName,
} from "@/shared/lib/calculatorToProduct";
import { useWorkspaceContainerClass } from "./workspaceWidth";
import { StudioKpiStrip, type StudioKpiItem } from "./StudioKpiStrip";
import { StudioViewToolbar } from "./StudioViewToolbar";
import { StudioSplitInspector } from "./StudioSplitInspector";
import type { StudioQuoteModalSeed } from "./StudioQuoteModal";

interface StudioHistoryViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenQuoteModal: (seed?: StudioQuoteModalSeed) => void;
}

export const StudioHistoryView: React.FC<StudioHistoryViewProps> = ({
  onTabChange,
  onOpenQuoteModal,
}) => {
  const containerClass = useWorkspaceContainerClass();
  const { format: formatCurrency } = useCurrency();
  const isDemoMode = useIsDemoMode();
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const loadHistoryItem = useCalculatorStore((s) => s.loadHistoryItem);
  const products = useProductInventory((s) => s.products);
  const addProduct = useProductInventory((s) => s.addProduct);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "fdm" | "resin">("all");
  const [sortBy, setSortBy] = useState<"date" | "price" | "profit" | "name">(
    "date",
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Filtered and sorted entries
  const filteredEntries = useMemo(
    () =>
      entries
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
        }),
    [entries, filterType, search, sortBy],
  );

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [filteredEntries, selectedEntryId],
  );

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

  const kpiItems: StudioKpiItem[] = [
    {
      id: "total-orders",
      label: "TOTAL DE PEDIDOS",
      value: entries.length,
      unit: "itens gravados",
      subtitle: isDemoMode
        ? "Conjunto fictício Estúdio Maria"
        : "Base de dados local e segura",
      icon: <Layers className="w-4 h-4 text-info" />,
    },
    {
      id: "total-revenue",
      label: "FATURAMENTO TOTAL",
      value: formatCurrency(totalRevenue),
      subtitle: "Soma dos preços de venda",
      icon: <DollarSign className="w-4 h-4 text-positive" />,
      tone: "positive",
    },
    {
      id: "total-profit",
      label: "LUCRO LÍQUIDO ACUMULADO",
      value: formatCurrency(totalProfit),
      subtitle: `Margem média de +${avgMargin}%`,
      icon: <TrendingUp className="w-4 h-4 text-positive" />,
      tone: "positive",
    },
    {
      id: "total-hours",
      label: "HORAS DE MÁQUINA",
      value: `${displayHours}h ${displayRemainingMins}m`,
      subtitle: "Tempo total estimado de fatiamento",
      icon: <Clock className="w-4 h-4 text-warning" />,
      tone: "warning",
    },
  ];

  const handleLoadItem = (entry: HistoryEntry) => {
    if (entry.snapshot) {
      loadHistoryItem(entry.snapshot);
    }
    onTabChange("calculator");
  };

  const handleCreateQuoteFromEntry = (entry: HistoryEntry) => {
    const hoursFloat =
      entry.snapshot?.fdmPrintParams?.printTimeHours ||
      entry.snapshot?.resinPrintParams?.printTimeHours ||
      0;
    const weight =
      entry.snapshot?.fdmMaterial?.weightUsed ||
      entry.snapshot?.resinMaterial?.volumeUsedMl ||
      0;
    const material =
      entry.type === "resin"
        ? entry.snapshot?.resinMaterial?.type || "Resina"
        : entry.snapshot?.fdmMaterial?.type || "PLA";

    onOpenQuoteModal({
      projectName: entry.name || "Peça 3D",
      material,
      weightGrams: Math.round(weight),
      hours: Math.floor(hoursFloat),
      minutes: Math.round((hoursFloat % 1) * 60),
      totalCost: entry.totalCost,
      sellPrice: entry.sellPrice,
      profit: entry.profit,
    });
  };

  const handleSaveAsProduct = (entry: HistoryEntry) => {
    const productName = (entry.name || entry.summary || "Peça 3D").trim();
    const weight =
      entry.snapshot?.fdmMaterial?.weightUsed ||
      entry.snapshot?.resinMaterial?.volumeUsedMl ||
      0;
    const filamentType =
      entry.type === "resin"
        ? entry.snapshot?.resinMaterial?.type || "Resina"
        : entry.snapshot?.fdmMaterial?.type || "PLA";

    const isDuplicate = isDuplicateProductName(productName, products);
    const payload = calculatorToProduct({
      productName,
      unitWeight: weight,
      filamentType,
      totalCost: entry.totalCost,
      displaySellPrice: entry.sellPrice,
    });
    addProduct(payload);
    setStatusFeedback(
      isDuplicate
        ? `"${productName}" salvo novamente no catálogo de produtos.`
        : `"${productName}" adicionado ao catálogo de produtos!`,
    );
  };

  const handleWhatsApp = (entry: HistoryEntry) => {
    if (guardExport()) return;
    const text = encodeURIComponent(
      `*Orçamento - Open3DCalc Studio*\n` +
        `Peça: *${entry.name}*\n` +
        `Custo de Produção: ${formatCurrency(entry.totalCost)}\n` +
        `*Valor Final: ${formatCurrency(entry.sellPrice)}*\n` +
        `Data: ${new Date(entry.timestamp).toLocaleDateString("pt-BR")}\n\n` +
        `Emitido via Open3DCalc Studio.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const selectedHours =
    selectedEntry?.snapshot?.fdmPrintParams?.printTimeHours ||
    selectedEntry?.snapshot?.resinPrintParams?.printTimeHours ||
    0;
  const selectedWeight =
    selectedEntry?.snapshot?.fdmMaterial?.weightUsed ||
    selectedEntry?.snapshot?.resinMaterial?.volumeUsedMl ||
    0;
  const selectedMargin =
    selectedEntry && selectedEntry.totalCost > 0
      ? Math.round((selectedEntry.profit / selectedEntry.totalCost) * 100)
      : 0;

  return (
    <div
      className={`flex flex-col gap-6 text-text-primary ${containerClass} pb-20`}
    >
      {statusFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-positive/40 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-positive flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusFeedback}</span>
          </span>
          <button
            type="button"
            onClick={() => onTabChange("products")}
            className="underline font-bold hover:opacity-80 shrink-0"
          >
            Ver Produtos →
          </button>
        </div>
      ) : null}

      <StudioKpiStrip items={kpiItems} />

      <StudioViewToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome da peça, modelo ou material..."
        filters={
          <>
            <div className="flex items-center bg-surface-sunken border border-border-subtle rounded-xl p-0.5 font-semibold">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`min-h-10 px-3 py-1 rounded-lg transition-all ${
                  filterType === "all"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Todos ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("fdm")}
                className={`flex min-h-10 items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                  filterType === "fdm"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Printer className="w-3 h-3" />
                <span>FDM</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType("resin")}
                className={`flex min-h-10 items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                  filterType === "resin"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Droplet className="w-3 h-3" />
                <span>Resina</span>
              </button>
            </div>

            <select
              value={sortBy}
              aria-label="Ordenar histórico"
              onChange={(e) =>
                setSortBy(
                  e.target.value as "date" | "price" | "profit" | "name",
                )
              }
              className="min-h-11 bg-surface-sunken border border-border-subtle rounded-xl px-3 py-1.5 text-text-secondary font-semibold outline-none cursor-pointer focus:border-accent"
            >
              <option value="date">Mais Recentes</option>
              <option value="price">Maior Preço</option>
              <option value="profit">Maior Lucro</option>
              <option value="name">Nome (A-Z)</option>
            </select>

            {entries.length > 0 ? (
              confirmClear ? (
                <div className="flex items-center gap-1 bg-critical-subtle border border-critical/50 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setConfirmClear(false);
                      setSelectedEntryId(null);
                    }}
                    className="min-h-9 px-2.5 py-1 rounded-lg bg-critical hover:ring-2 hover:ring-critical/40 text-text-inverse font-bold text-[11px]"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-9 px-2.5 py-1 rounded-lg text-text-secondary hover:text-text-primary text-[11px]"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-11 min-w-11 items-center justify-center p-2 text-text-secondary hover:text-critical rounded-xl border border-border-subtle bg-surface-sunken hover:bg-critical-subtle transition-colors"
                  title="Limpar Histórico"
                  aria-label="Limpar Histórico"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
            ) : null}
          </>
        }
        actions={
          entries.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => onOpenQuoteModal()}
                className="flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-info" />
                <span>Emitir Proposta PDF</span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange("calculator")}
                className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Cálculo</span>
              </button>
            </>
          ) : null
        }
      />

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
              type="button"
              onClick={() => onTabChange("calculator")}
              className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Cálculo</span>
            </button>
            {!isDemoMode ? (
              <button
                type="button"
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-accent text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Carregar Dados de Demonstração</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <StudioSplitInspector
          isOpen={selectedEntry !== null}
          onClose={() => setSelectedEntryId(null)}
          title={selectedEntry?.name || "Detalhes do Cálculo"}
          subtitle={
            selectedEntry
              ? `${selectedEntry.type === "resin" ? "Resina SLA" : "Filamento FDM"} • ${new Date(selectedEntry.timestamp).toLocaleDateString("pt-BR")}`
              : undefined
          }
          badge={
            selectedEntry ? (
              <span className="inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-accent-subtle text-info border border-accent/20">
                {selectedEntry.type === "resin" ? "Resina" : "FDM"}
              </span>
            ) : null
          }
          inspectorContent={
            selectedEntry ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 bg-surface-sunken border border-border-subtle rounded-xl p-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      Custo Total
                    </span>
                    <span className="text-sm font-bold text-text-primary font-mono">
                      {formatCurrency(selectedEntry.totalCost)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      Preço Final
                    </span>
                    <span className="text-base font-extrabold text-positive font-mono">
                      {formatCurrency(selectedEntry.sellPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      Lucro Líquido
                    </span>
                    <span className="text-sm font-bold text-positive font-mono">
                      +{formatCurrency(selectedEntry.profit)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      Margem
                    </span>
                    <span className="text-sm font-bold text-accent font-mono">
                      +{selectedMargin}%
                    </span>
                  </div>
                </div>

                {selectedEntry.result ? (
                  <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase font-bold text-text-secondary block mb-1">
                      Detalhamento de Custos
                    </span>
                    <div className="flex justify-between text-text-secondary">
                      <span>Material</span>
                      <span className="font-mono text-text-primary">
                        {formatCurrency(selectedEntry.result.materialCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Energia</span>
                      <span className="font-mono text-text-primary">
                        {formatCurrency(selectedEntry.result.energyCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Máquina & Depreciação</span>
                      <span className="font-mono text-text-primary">
                        {formatCurrency(selectedEntry.result.machineCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Mão de Obra</span>
                      <span className="font-mono text-text-primary">
                        {formatCurrency(selectedEntry.result.laborCost)}
                      </span>
                    </div>
                    {selectedEntry.result.marketplaceFee > 0 ? (
                      <div className="flex justify-between text-text-secondary">
                        <span>Taxa de Canal</span>
                        <span className="font-mono text-text-primary">
                          {formatCurrency(selectedEntry.result.marketplaceFee)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3 space-y-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Consumo</span>
                    <strong className="text-text-primary">
                      {selectedWeight}
                      {selectedEntry.type === "resin" ? "ml" : "g"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tempo de Impressão</span>
                    <strong className="text-text-primary">
                      {selectedHours.toFixed(1)}h
                    </strong>
                  </div>
                  {selectedEntry.snapshot?.selectedPrinterId ? (
                    <div className="flex justify-between">
                      <span>Impressora</span>
                      <strong className="text-text-primary truncate max-w-[11rem]">
                        {selectedEntry.snapshot.selectedPrinterId.replace(
                          /_/g,
                          " ",
                        )}
                      </strong>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null
          }
          footer={
            selectedEntry ? (
              <>
                <button
                  type="button"
                  onClick={() => handleLoadItem(selectedEntry)}
                  className="flex-1 flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:brightness-110 text-[var(--color-accent-fill-fg)] font-bold text-xs transition-all"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Abrir na Calculadora</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAsProduct(selectedEntry)}
                  className="flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-text-primary font-semibold text-xs transition-colors"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-accent" />
                  <span>Salvar Produto</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateQuoteFromEntry(selectedEntry)}
                  className="flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-info font-semibold text-xs transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Gerar Orçamento</span>
                </button>
              </>
            ) : null
          }
        >
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
              const isSelected = selectedEntry?.id === entry.id;

              return (
                <div
                  key={entry.id}
                  onClick={() =>
                    setSelectedEntryId((prev) =>
                      prev === entry.id ? null : entry.id,
                    )
                  }
                  className={`cursor-pointer bg-surface-raised hover:bg-surface-overlay/50 border rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                    isSelected
                      ? "border-accent ring-1 ring-accent/30"
                      : "border-border-subtle hover:border-border"
                  }`}
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
                        {weight > 0 ? (
                          <span>
                            •{" "}
                            <strong className="text-text-secondary">
                              {weight}
                              {entry.type === "resin" ? "ml" : "g"}
                            </strong>
                          </span>
                        ) : null}
                        {hours > 0 ? (
                          <span>
                            •{" "}
                            <strong className="text-text-secondary">
                              {hours.toFixed(1)}h
                            </strong>
                          </span>
                        ) : null}
                        {entry.snapshot?.selectedPrinterId ? (
                          <span className="text-text-muted">
                            •{" "}
                            {entry.snapshot.selectedPrinterId.replace(
                              /_/g,
                              " ",
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Right: Values & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 border-border-subtle pt-3 md:pt-0">
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block">
                          Custo
                        </span>
                        <span className="text-xs font-semibold text-text-secondary">
                          {formatCurrency(entry.totalCost)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block">
                          Preço Final
                        </span>
                        <span className="text-sm font-extrabold text-text-primary">
                          {formatCurrency(entry.sellPrice)}
                        </span>
                      </div>

                      <div className="hidden sm:block">
                        <span className="text-[10px] font-mono uppercase text-positive font-bold block">
                          +{marginCalc}%
                        </span>
                        <span className="text-xs font-bold text-positive">
                          +{formatCurrency(entry.profit)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEntryId((prev) =>
                            prev === entry.id ? null : entry.id,
                          )
                        }
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                        title="Inspecionar detalhes"
                        aria-label={`Inspecionar ${entry.name || "cálculo"}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadItem(entry)}
                        className="flex min-h-11 items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-xs font-semibold text-info transition-colors"
                        title="Carregar parâmetros na Calculadora"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Carregar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWhatsApp(entry)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-positive/30 bg-positive-subtle p-1.5 text-positive transition-colors hover:border-[var(--positive-fill)] hover:bg-[var(--positive-fill)] hover:text-[var(--positive-fill-fg)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                        title="Enviar proposta via WhatsApp"
                        aria-label="Enviar proposta via WhatsApp"
                      >
                        <BrandIcon brand="whatsapp" className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg text-text-muted hover:text-critical hover:bg-critical-subtle transition-colors"
                        title="Excluir do Histórico"
                        aria-label={`Excluir ${entry.name || "cálculo"} do histórico`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </StudioSplitInspector>
      )}
    </div>
  );
};
