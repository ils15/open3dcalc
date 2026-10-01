import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  X,
  Plus,
  ArrowDownAZ,
  ArrowUpZA,
  Spool,
  AlertTriangle,
  Scale,
  DollarSign,
  Package,
} from "lucide-react";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  isLowStockSpool,
  SPOOL_MATERIALS,
  type FilamentSpool,
  type SpoolSortDir,
  type SpoolSortKey,
  type SpoolStatus,
} from "@/shared/stores/spoolStore";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { Select } from "@/shared/components/ui/Select";
import { SpoolCard, LOW_STOCK_GRAMS } from "./SpoolCard";
import { SpoolForm, type SpoolFormValues } from "./SpoolForm";

const STATUSES: SpoolStatus[] = ["in_stock", "on_the_way", "empty"];

const STATUS_KEY: Record<SpoolStatus, string> = {
  in_stock: "spools.statusInStock",
  on_the_way: "spools.statusOnTheWay",
  empty: "spools.statusEmpty",
};

const SORT_OPTIONS: { value: SpoolSortKey; key: string }[] = [
  { value: "name", key: "spools.sortName" },
  { value: "material", key: "spools.sortMaterial" },
  { value: "remaining", key: "spools.sortRemaining" },
  { value: "weight", key: "spools.sortWeight" },
  { value: "dateAdded", key: "spools.sortDate" },
];

const NO_MATERIAL = "Todos";

export function SpoolShelf(): React.ReactElement {
  const { t } = useTranslation();
  const spools = useSpoolStore((s) => s.spools);
  const addSpool = useSpoolStore((s) => s.addSpool);
  const updateSpool = useSpoolStore((s) => s.updateSpool);
  const removeSpool = useSpoolStore((s) => s.removeSpool);
  const getVisibleSpools = useSpoolStore((s) => s.getVisibleSpools);
  const unitWeight = useCalculatorStore((s) => s.results?.unitWeight ?? 0);
  const quantity = useCalculatorStore((s) => s.quantity);
  const activeTab = useCalculatorStore((s) => s.activeTab);
  const requiredGrams =
    activeTab === "fdm" && unitWeight > 0 ? unitWeight * quantity : 0;

  const [search, setSearch] = useState("");
  const [filterMaterial, setFilterMaterial] = useState<string>(NO_MATERIAL);
  const [filterStatus, setFilterStatus] = useState<SpoolStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SpoolSortKey>("dateAdded");
  const [sortDir, setSortDir] = useState<SpoolSortDir>("desc");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FilamentSpool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FilamentSpool | null>(null);

  const visible = useMemo(
    () =>
      getVisibleSpools(
        { search, material: filterMaterial, status: filterStatus },
        sortKey,
        sortDir,
      ),
    [getVisibleSpools, search, filterMaterial, filterStatus, sortKey, sortDir],
  );

  const { format } = useCurrency();

  const totalWeightGrams = useMemo(
    () => spools.reduce((sum, s) => sum + (s.weightGrams || 0), 0),
    [spools],
  );

  const totalInvested = useMemo(
    () =>
      spools.reduce(
        (sum, s) =>
          sum + ((s.costPerKg || 0) * (s.originalWeightGrams || 1000)) / 1000,
        0,
      ),
    [spools],
  );

  const lowCount = useMemo(
    () => spools.filter((s) => isLowStockSpool(s, LOW_STOCK_GRAMS)).length,
    [spools],
  );

  const hasSpools = spools.length > 0;

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (spool: FilamentSpool) => {
    setEditing(spool);
    setShowForm(true);
  };

  const handleSubmit = (values: SpoolFormValues) => {
    if (editing) {
      updateSpool(editing.id, values);
    } else {
      addSpool(values);
    }
    setShowForm(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) removeSpool(deleteTarget.id);
    setDeleteTarget(null);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterMaterial(NO_MATERIAL);
    setFilterStatus("all");
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
            Inventário de Filamentos & Insumos
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Controle de carretéis, pesagem restante e custos por grama
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t("spools.newSpool")}
        </button>
      </div>

      {/* ── 4 KPI CARDS (MATCHING SCREENSHOT 3) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="surface rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Total em Estoque</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black font-mono text-[var(--color-text-primary)]">
            {spools.length} carretéis
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Cadastrados na oficina
          </div>
        </div>

        <div className="surface rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Peso Restante</span>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black font-mono text-[var(--color-text-primary)]">
            {(totalWeightGrams / 1000).toFixed(1)} kg
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {totalWeightGrams}g disponíveis
          </div>
        </div>

        <div className="surface rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Valor Investido</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {format(totalInvested)}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Custo total de aquisição
          </div>
        </div>

        <div className="surface rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Alerta de Estoque</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div
            className={`text-xl font-black font-mono ${lowCount > 0 ? "text-amber-400" : "text-slate-400"}`}
          >
            {lowCount}{" "}
            {lowCount === 1 ? "carretel baixo" : "carretéis acabando"}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Abaixo de 100g de filamento
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("spools.searchPlaceholder")}
          aria-label={t("spools.searchPlaceholder")}
          className="w-full h-11 pl-10 pr-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("spools.clearFilters")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filtros + ordenação */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {[NO_MATERIAL, ...SPOOL_MATERIALS].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setFilterMaterial(m)}
            aria-pressed={filterMaterial === m}
            className={`px-3 py-1.5 min-h-[32px] rounded-[6px] text-xs font-semibold transition-colors border ${
              filterMaterial === m
                ? "bg-[var(--accent-fill)] text-white border-[var(--color-accent)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {m === NO_MATERIAL ? t("spools.filterAll") : m}
          </button>
        ))}
        <div
          className="w-px h-5 bg-[var(--color-border)] mx-0.5"
          aria-hidden="true"
        />
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            aria-pressed={filterStatus === s}
            className={`px-3 py-1.5 min-h-[32px] rounded-[6px] text-xs font-semibold transition-colors border ${
              filterStatus === s
                ? "bg-[var(--accent-fill)] text-white border-[var(--color-accent)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {s === "all" ? t("spools.filterAllStatuses") : t(STATUS_KEY[s])}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-44">
          <Select
            label={t("spools.sortLabel")}
            value={sortKey}
            onChange={(v) => setSortKey(v as SpoolSortKey)}
            options={SORT_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.key),
            }))}
            search={false}
          />
        </div>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-pressed={sortDir === "desc"}
          className="h-11 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {sortDir === "asc" ? (
            <ArrowDownAZ className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ArrowUpZA className="w-4 h-4" aria-hidden="true" />
          )}
          {sortDir === "asc" ? t("spools.sortAsc") : t("spools.sortDesc")}
        </button>
      </div>

      {/* Grade */}
      {hasSpools ? (
        <div
          role="list"
          aria-label={t("spools.title")}
          className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {visible.map((spool) => (
            <div role="listitem" key={spool.id} className="contents">
              <SpoolCard
                spool={spool}
                requiredGrams={requiredGrams}
                onEdit={openEdit}
                onRemove={setDeleteTarget}
              />
            </div>
          ))}
          {visible.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Search}
                title={t("spools.filteredEmptyTitle")}
                description={t("spools.filteredEmptyDescription")}
                action={{
                  label: t("spools.clearFilters"),
                  onClick: clearFilters,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Spool}
          title={t("spools.emptyTitle")}
          description={t("spools.emptyDescription")}
          action={{ label: t("spools.emptyAction"), onClick: openAdd }}
        />
      )}

      <SpoolForm
        open={showForm}
        initial={editing}
        onSubmit={handleSubmit}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("spools.deleteTitle")}
        message={t("spools.deleteMessage", {
          color: deleteTarget?.color ?? "",
        })}
        confirmLabel={t("spools.deleteConfirm")}
        cancelLabel={t("spools.cancel")}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
