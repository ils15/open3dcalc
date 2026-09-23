import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Plus, ArrowDownAZ, ArrowUpZA, Spool } from "lucide-react";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import {
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

  const lowCount = useMemo(
    () =>
      spools.filter(
        (s) => s.status === "in_stock" && s.weightGrams < LOW_STOCK_GRAMS,
      ).length,
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
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
            {t("spools.title")}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {t("spools.count", { count: spools.length })}
            {lowCount > 0 && (
              <span className="ml-2 text-amber-500 dark:text-amber-300 inline-flex items-center gap-1">
                {t("spools.lowStockCount", { count: lowCount })}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t("spools.newSpool")}
        </button>
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
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {m === NO_MATERIAL ? t("spools.filterAll") : m}
          </button>
        ))}
        <div className="w-px h-5 bg-[var(--color-border)] mx-0.5" aria-hidden="true" />
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            aria-pressed={filterStatus === s}
            className={`px-3 py-1.5 min-h-[32px] rounded-[6px] text-xs font-semibold transition-colors border ${
              filterStatus === s
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
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
