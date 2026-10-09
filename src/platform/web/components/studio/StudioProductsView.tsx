import React, { useState, useMemo } from "react";
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  List,
  LayoutGrid,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  useProductInventory,
  isBelowCost,
  exportProductsCSV,
} from "@/shared/stores/productInventory";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { downloadBlob } from "@/shared/lib/download";
import type { Product, ProductFormData } from "@/shared/types";
import confetti from "canvas-confetti";
import { Tab } from "@/shared/components/AppShell/tabs";

interface StudioProductsViewProps {
  onTabChange?: (tab: Tab) => void;
}

export const StudioProductsView: React.FC<StudioProductsViewProps> = () => {
  const isDemoMode = useIsDemoMode();
  const { symbol: currencySymbol } = useCurrency();
  const products = useProductInventory((s) => s.products);
  const addProduct = useProductInventory((s) => s.addProduct);
  const updateProduct = useProductInventory((s) => s.updateProduct);
  const removeProduct = useProductInventory((s) => s.removeProduct);
  const markSold = useProductInventory((s) => s.markSold);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "sold"
  >("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form input states
  const [name, setName] = useState("");
  const [weightGrams, setWeightGrams] = useState<number | "">("");
  const [filamentType, setFilamentType] = useState("PLA");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [salePrice, setSalePrice] = useState<number | "">("");

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === "sold" && !p.sold) return false;
      if (statusFilter === "available" && p.sold) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.filamentType && p.filamentType.toLowerCase().includes(q))
      );
    });
  }, [products, search, statusFilter]);

  // KPIs
  const totalProducts = products.length;
  const availableProducts = products.filter((p) => !p.sold);
  const soldProducts = products.filter((p) => p.sold);

  const stockCostValue = availableProducts.reduce(
    (acc, p) => acc + (p.costPrice || 0),
    0,
  );
  const potentialRevenue = availableProducts.reduce(
    (acc, p) => acc + (p.salePrice || 0),
    0,
  );
  const projectedProfit = potentialRevenue - stockCostValue;
  const avgMargin =
    stockCostValue > 0
      ? Math.round((projectedProfit / stockCostValue) * 100)
      : 0;

  // Open modal handlers
  const openCreateModal = () => {
    setEditingProduct(null);
    setName("");
    setWeightGrams(100);
    setFilamentType("PLA");
    setCostPrice(15.0);
    setSalePrice(45.0);
    setIsFormOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setWeightGrams(p.weightGrams);
    setFilamentType(p.filamentType || "PLA");
    setCostPrice(p.costPrice);
    setSalePrice(p.salePrice);
    setIsFormOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) return;

    const payload: ProductFormData = {
      name: name.trim(),
      weightGrams: Number(weightGrams) || 0,
      filamentType: filamentType.trim() || "PLA",
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
    } else {
      addProduct(payload);
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    }

    setIsFormOpen(false);
    setEditingProduct(null);
  };

  const handleExportCsv = () => {
    downloadBlob(
      new Blob([exportProductsCSV()], { type: "text/csv;charset=utf-8" }),
      "catalogo_produtos_3d.csv",
    );
  };

  // Real-time calculation in modal
  const formCostNum = Number(costPrice) || 0;
  const formSaleNum = Number(salePrice) || 0;
  const formProfit = formSaleNum - formCostNum;
  const formMargin =
    formCostNum > 0
      ? Math.round((formProfit / formCostNum) * 100)
      : formSaleNum > 0
        ? 100
        : 0;
  const formIsBelowCost = formSaleNum < formCostNum;

  return (
    <div className="flex flex-col gap-6 text-text-primary mx-auto w-full max-w-7xl pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-raised border border-border-subtle rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">
              CATÁLOGO DE PRODUTOS & PRONTA ENTREGA
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Estoque de Peças Prontas para Venda
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Gerencie o estoque de peças acabadas, calcule preços de venda e
            acompanhe margens de lucro
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-sunken text-text-secondary border border-border-subtle text-xs font-semibold transition-all"
            title="Exportar inventário para CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md shadow-accent/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Peças */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE PRODUTOS
            </span>
            <Package className="w-4 h-4 text-accent" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              {totalProducts}
            </span>
            <span className="text-xs text-text-secondary ml-1.5">
              itens cadastrados
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            {availableProducts.length} disponíveis • {soldProducts.length}{" "}
            vendidos
          </div>
        </div>

        {/* Faturamento Potencial */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              FATURAMENTO POTENCIAL
            </span>
            <DollarSign className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-positive">
              {currencySymbol} {potentialRevenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-positive font-medium">
            Valor bruto se todo estoque for vendido
          </div>
        </div>

        {/* Custo do Estoque */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              CUSTO TOTAL DE PRODUÇÃO
            </span>
            <Layers className="w-4 h-4 text-info" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              {currencySymbol} {stockCostValue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Filamento + energia + desgaste investidos
          </div>
        </div>

        {/* Lucro e Margem */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              LUCRO PROJETADO
            </span>
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-accent">
              {currencySymbol} {projectedProfit.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Margem média prevista de{" "}
            <span className="text-text-primary font-bold">+{avgMargin}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-raised border border-border-subtle rounded-2xl p-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da peça ou filamento..."
            className="w-full bg-surface-raised border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls: Status Pills and View Switcher */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                ["all", "Todos", products.length],
                ["available", "Disponíveis", availableProducts.length],
                ["sold", "Vendidos", soldProducts.length],
              ] as const
            ).map(([st, label, count]) => {
              const isActive = statusFilter === st;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                      : "bg-surface-raised text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive ? "bg-surface-sunken" : "bg-surface-sunken"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle: Lista vs Cards */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-xl p-0.5 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                viewMode === "list"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Visualização em Lista / Tabela"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                viewMode === "grid"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Visualização em Grade de Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Content */}
      {filteredProducts.length === 0 ? (
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center text-accent mb-3">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">
            Nenhum produto encontrado
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mb-4">
            {search || statusFilter !== "all"
              ? "Nenhum item corresponde aos filtros selecionados."
              : "Cadastre peças prontas para venda ou pronta entrega com cálculo de custo, preço sugerido e controle de estoque."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Primeiro Produto</span>
            </button>
            {!isDemoMode && (
              <button
                type="button"
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-accent text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>Carregar Demonstração</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* Modern Studio List / Table View */
        <div className="bg-surface-raised border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken text-[10px] font-mono uppercase tracking-wider text-text-secondary">
                  <th className="py-3.5 px-4 font-bold text-center w-16">
                    STATUS
                  </th>
                  <th className="py-3.5 px-4 font-bold">NOME DO PRODUTO</th>
                  <th className="py-3.5 px-4 font-bold">
                    MATERIAL / FILAMENTO
                  </th>
                  <th className="py-3.5 px-4 font-bold">PESO</th>
                  <th className="py-3.5 px-4 font-bold text-right">
                    CUSTO FABRIL
                  </th>
                  <th className="py-3.5 px-4 font-bold text-right">
                    PREÇO VENDA
                  </th>
                  <th className="py-3.5 px-4 font-bold text-right">
                    LUCRO / MARGEM
                  </th>
                  <th className="py-3.5 px-4 font-bold text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProducts.map((p) => {
                  const belowCost = isBelowCost(p);
                  const profitVal = p.salePrice - p.costPrice;
                  const marginPct =
                    p.costPrice > 0
                      ? Math.round((profitVal / p.costPrice) * 100)
                      : p.salePrice > 0
                        ? 100
                        : 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-surface-raised transition-colors group ${p.sold ? "opacity-75" : ""}`}
                    >
                      {/* Checkbox de Vendido / Disponível */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.sold}
                            onChange={(e) => markSold(p.id, e.target.checked)}
                            className="sr-only"
                          />
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold border transition-colors ${
                              p.sold
                                ? "bg-surface-sunken text-text-secondary border-border-subtle"
                                : "bg-positive-subtle text-positive border-positive/40"
                            }`}
                          >
                            {p.sold ? "Vendido" : "Disponível"}
                          </span>
                        </label>
                      </td>

                      {/* Nome do Produto */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary group-hover:text-accent transition-colors">
                            {p.name}
                          </span>
                          {belowCost && (
                            <span
                              title="Alerta: Preço de venda abaixo do custo de fabricação!"
                              className="text-warning bg-warning-subtle border border-warning/30 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="font-mono text-[9px]">
                                Abaixo do Custo
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Material */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-surface-overlay border border-border-subtle text-[11px] text-text-secondary font-mono">
                          {p.filamentType || "PLA"}
                        </span>
                      </td>

                      {/* Peso */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-text-secondary">
                        {p.weightGrams} g
                      </td>

                      {/* Custo Fabril */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono text-text-secondary">
                        {currencySymbol}{" "}
                        {p.costPrice.toFixed(2).replace(".", ",")}
                      </td>

                      {/* Preço Venda */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-positive text-sm">
                        {currencySymbol}{" "}
                        {p.salePrice.toFixed(2).replace(".", ",")}
                      </td>

                      {/* Lucro / Margem */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono font-bold text-xs ${
                              profitVal >= 0 ? "text-positive" : "text-critical"
                            }`}
                          >
                            {profitVal >= 0 ? "+" : ""}
                            {currencySymbol}{" "}
                            {profitVal.toFixed(2).replace(".", ",")}
                          </span>
                          <span
                            className={`text-[10px] font-mono ${
                              marginPct >= 0
                                ? "text-text-secondary"
                                : "text-critical"
                            }`}
                          >
                            {marginPct >= 0
                              ? `+${marginPct}%`
                              : `${marginPct}%`}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle transition-colors"
                            title="Editar Produto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="p-1.5 rounded-lg bg-surface-sunken hover:bg-critical-subtle text-text-secondary hover:text-critical border border-border-subtle hover:border-critical/30 transition-colors"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern Studio Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const belowCost = isBelowCost(p);
            const profitVal = p.salePrice - p.costPrice;
            const marginPct =
              p.costPrice > 0
                ? Math.round((profitVal / p.costPrice) * 100)
                : p.salePrice > 0
                  ? 100
                  : 0;

            return (
              <div
                key={p.id}
                className={`bg-surface-raised hover:bg-surface-raised border border-border-subtle hover:border-border-subtle rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all group relative ${
                  p.sold ? "opacity-80" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-surface-overlay border border-border-subtle text-[10px] text-text-secondary font-mono">
                      {p.filamentType || "PLA"} • {p.weightGrams}g
                    </span>
                    <button
                      type="button"
                      onClick={() => markSold(p.id, !p.sold)}
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border transition-colors ${
                        p.sold
                          ? "bg-surface-sunken text-text-secondary border-border-subtle"
                          : "bg-positive-subtle text-positive border-positive/40"
                      }`}
                    >
                      {p.sold ? "Vendido" : "Disponível"}
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                    {p.name}
                  </h3>

                  {belowCost && (
                    <div className="flex items-center gap-1.5 text-xs text-warning bg-warning-subtle border border-warning/30 rounded-lg p-2 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] font-medium">
                        Preço de venda inferior ao custo fabril
                      </span>
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3 mt-3 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Custo de Fabricação:</span>
                      <span>
                        {currencySymbol}{" "}
                        {p.costPrice.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Lucro Líquido:</span>
                      <span
                        className={
                          profitVal >= 0
                            ? "text-accent font-bold"
                            : "text-critical font-bold"
                        }
                      >
                        {profitVal >= 0 ? "+" : ""}
                        {currencySymbol}{" "}
                        {profitVal.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Margem:</span>
                      <span
                        className={
                          marginPct >= 0 ? "text-positive" : "text-critical"
                        }
                      >
                        +{marginPct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-text-muted block">
                      PREÇO DE VENDA
                    </span>
                    <span className="text-base font-extrabold text-positive font-mono">
                      {currencySymbol}{" "}
                      {p.salePrice.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle transition-colors"
                      title="Editar Produto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="p-1.5 rounded-lg bg-surface-sunken hover:bg-critical-subtle text-text-secondary hover:text-critical border border-border-subtle hover:border-critical/30 transition-colors"
                      title="Excluir Produto"
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

      {/* Create / Edit Modal in Studio Dark Theme */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 text-text-secondary animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  {editingProduct
                    ? "Editar Peça / Produto"
                    : "Cadastrar Novo Produto para Pronta Entrega"}
                </h3>
                <span className="text-xs text-text-secondary">
                  Defina os custos fabris e o preço de venda para calcular a
                  margem real
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveProduct}
              className="flex flex-col gap-3.5"
            >
              <div>
                <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                  NOME DO PRODUTO / PEÇA 3D
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Vaso Geométrico Espiral 20cm"
                  className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    FILAMENTO / MATERIAL UTILIZADO
                  </label>
                  <input
                    type="text"
                    value={filamentType}
                    onChange={(e) => setFilamentType(e.target.value)}
                    placeholder="Ex: PLA Silk Bicolor, PETG..."
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    PESO DA PEÇA (GRAMAS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={weightGrams}
                    onChange={(e) =>
                      setWeightGrams(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Ex: 120"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CUSTO FABRIL (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={costPrice}
                    onChange={(e) =>
                      setCostPrice(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Ex: 18.50"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    PREÇO DE VENDA (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={salePrice}
                    onChange={(e) =>
                      setSalePrice(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Ex: 45.00"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent font-bold text-positive"
                  />
                </div>
              </div>

              {/* Real-time Profit Simulation Box */}
              <div className="bg-surface-sunken border border-border-subtle p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-secondary block">
                    LUCRO PROJETADO:
                  </span>
                  <span
                    className={`text-base font-extrabold font-mono ${formProfit >= 0 ? "text-accent" : "text-critical"}`}
                  >
                    {formProfit >= 0 ? "+" : ""}
                    {currencySymbol} {formProfit.toFixed(2).replace(".", ",")}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-text-secondary block">
                    MARGEM:
                  </span>
                  <span
                    className={`text-base font-extrabold font-mono ${formMargin >= 0 ? "text-positive" : "text-critical"}`}
                  >
                    +{formMargin}%
                  </span>
                </div>
              </div>

              {formIsBelowCost && (
                <div className="flex items-center gap-1.5 text-xs text-warning bg-warning-subtle border border-warning/30 rounded-xl p-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-medium">
                    Atenção: O preço de venda está menor que o custo de
                    produção.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] shadow-md disabled:opacity-40 transition-colors"
                >
                  {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-border-subtle rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-3 text-text-secondary">
            <h4 className="text-sm font-bold text-text-primary">
              Excluir Produto do Catálogo?
            </h4>
            <p className="text-xs text-text-secondary">
              Esta ação removerá este produto do seu inventário de pronta
              entrega. Deseja prosseguir?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteId) removeProduct(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-critical hover:ring-2 hover:ring-critical/40 text-text-inverse"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
