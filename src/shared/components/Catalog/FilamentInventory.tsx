import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useFilamentInventory,
  type FilamentSpool,
  type SpoolStatus,
} from "@/shared/stores/filamentInventory";
import { useColorPalette } from "@/shared/stores/colorPalette";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import { SpoolRemainingBlock } from "./SpoolRemainingBlock";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Palette,
} from "lucide-react";

const FILTER_MATERIALS = [
  "Todos",
  "PLA",
  "PETG",
  "ABS",
  "TPU",
  "ASA",
  "SILK",
  "Outro",
];
const FILTER_STATUSES = [
  { value: "all", label: "Todos status" },
  { value: "in_stock", label: "Em estoque" },
  { value: "on_the_way", label: "A caminho" },
  { value: "empty", label: "Vazio" },
];
const MATERIALS = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "SILK",
  "Nylon",
  "PLA-CF",
  "PETG-CF",
  "PVA",
  "HIPS",
  "Outro",
];
const STORES = [
  "Aliexpress",
  "Mercado Livre",
  "Amazon",
  "Voolt 3D",
  "3DPrime",
  "Bambu Store",
  "Creality Store",
  "Shopee",
  "Outro",
];
const STATUS_OPTIONS = [
  { value: "in_stock", label: "Em estoque" },
  { value: "on_the_way", label: "A caminho" },
  { value: "empty", label: "Vazio" },
];

type ColorGroup = "Neutras" | "Sólidas" | "Escuras";

interface StdColor {
  name: string;
  hex: string;
  group: ColorGroup;
}

/**
 * Paleta padrão — fonte única da verdade.
 *
 * A estrutura é flat (um nível); o agrupamento é visual e fica no seletor
 * (Select `groups`) e no modal. `COLOR_HEX` é derivado dela para o lookup
 * do resolveHex, então não há duplicação de hexes.
 */
const STD_COLORS: StdColor[] = [
  // ── Neutras ──────────────────────────────────────────────
  { name: "preto", hex: "#374151", group: "Neutras" },
  { name: "grafite", hex: "#1f2937", group: "Neutras" },
  { name: "cinza", hex: "#9ca3af", group: "Neutras" },
  { name: "prata", hex: "#94a3b8", group: "Neutras" },
  { name: "branco", hex: "#e2e8f0", group: "Neutras" },
  { name: "branco dental", hex: "#f8f5e4", group: "Neutras" },
  { name: "bege", hex: "#e7d8b8", group: "Neutras" },
  { name: "natural", hex: "#d4b896", group: "Neutras" },
  { name: "transparente", hex: "#94a3b8", group: "Neutras" },
  // ── Sólidas ──────────────────────────────────────────────
  { name: "vermelho", hex: "#ef4444", group: "Sólidas" },
  { name: "rosa", hex: "#ec4899", group: "Sólidas" },
  { name: "rosa bebe", hex: "#fda4af", group: "Sólidas" },
  { name: "laranja", hex: "#f97316", group: "Sólidas" },
  { name: "amarelo", hex: "#eab308", group: "Sólidas" },
  { name: "amarelo claro", hex: "#facc15", group: "Sólidas" },
  { name: "dourado", hex: "#d97706", group: "Sólidas" },
  { name: "bronze", hex: "#b45309", group: "Sólidas" },
  { name: "marrom", hex: "#92400e", group: "Sólidas" },
  { name: "verde", hex: "#22c55e", group: "Sólidas" },
  { name: "verde lima", hex: "#84cc16", group: "Sólidas" },
  { name: "ciano", hex: "#06b6d4", group: "Sólidas" },
  { name: "turquesa", hex: "#2dd4bf", group: "Sólidas" },
  { name: "azul", hex: "#3b82f6", group: "Sólidas" },
  { name: "roxo", hex: "#a855f7", group: "Sólidas" },
  { name: "lilás", hex: "#c4b5fd", group: "Sólidas" },
  { name: "violeta", hex: "#7c3aed", group: "Sólidas" },
  { name: "magenta", hex: "#d946ef", group: "Sólidas" },
  // ── Escuras ──────────────────────────────────────────────
  { name: "azul velvet", hex: "#1e40af", group: "Escuras" },
  { name: "azul marinho", hex: "#1e3a8a", group: "Escuras" },
  { name: "verde escuro", hex: "#15803d", group: "Escuras" },
  { name: "laranja escuro", hex: "#c2410c", group: "Escuras" },
  { name: "vermelho escuro", hex: "#b91c1c", group: "Escuras" },
  { name: "vinho", hex: "#9f1239", group: "Escuras" },
];

/** Lookup flat nome → hex, derivado da paleta (resolveHex usa isto). */
const COLOR_HEX: Record<string, string> = Object.fromEntries(
  STD_COLORS.map((c) => [c.name, c.hex]),
);

/** Primeira letra de cada palavra em maiúscula, pro display do swatch. */
function titleCaseColor(name: string): string {
  return name
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function resolveHex(color: string, stored?: string): string {
  if (stored) return stored;
  const lower = color.toLowerCase();
  // 1. Match exato — nomes compostos ("azul marinho") não podem ser
  //    sombreados pela cor base ("azul") no match por inclusão.
  if (COLOR_HEX[lower]) return COLOR_HEX[lower];
  // 2. Match por inclusão (rolos antigos/digitados): a key mais longa
  //    vence — é a mais específica. Não quebra o que já resolvia antes.
  let bestKey = "";
  for (const key of Object.keys(COLOR_HEX)) {
    if (lower.includes(key) && key.length > bestKey.length) bestKey = key;
  }
  return bestKey ? COLOR_HEX[bestKey] : "#6366f1";
}

function SpoolIcon({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="10" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <ellipse cx="34" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <rect x="10" y="15" width="24" height="14" fill={color} opacity="0.25" />
      <rect
        x="10"
        y="17"
        width="24"
        height="3.5"
        rx="1"
        fill={color}
        opacity="0.55"
      />
      <rect
        x="10"
        y="23.5"
        width="24"
        height="3.5"
        rx="1"
        fill={color}
        opacity="0.55"
      />
      <circle cx="22" cy="22" r="3.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

function StatusBadge({ status }: { status: SpoolStatus }) {
  const cfg: Record<SpoolStatus, { label: string; cls: string }> = {
    in_stock: {
      label: "Em estoque",
      cls: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
    },
    on_the_way: {
      label: "A caminho",
      cls: "bg-amber-600/20  text-amber-400  border-amber-600/30",
    },
    empty: {
      label: "Vazio",
      cls: "bg-gray-600/20   text-[var(--color-text-secondary)]   border-gray-600/30",
    },
  };
  const { label, cls } = cfg[status];
  return (
    <span
      className={`text-[11px] px-2.5 py-0.5 rounded-[6px] border font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

interface FormState {
  brand: string;
  material: string;
  color: string;
  colorHex: string;
  weight: string;
  costPerKg: string;
  diameter: string;
  notes: string;
  status: SpoolStatus;
  purchaseStore: string;
}

const emptyForm = (): FormState => ({
  brand: "",
  material: "PLA",
  color: "",
  colorHex: "",
  weight: "",
  costPerKg: "",
  diameter: "1.75",
  notes: "",
  status: "in_stock",
  purchaseStore: "",
});

function spoolToForm(s: FilamentSpool): FormState {
  return {
    brand: s.brand,
    material: s.material,
    color: s.color,
    colorHex: s.colorHex || "",
    weight: s.weightGrams.toString(),
    costPerKg: s.costPerKg > 0 ? s.costPerKg.toString() : "",
    diameter: s.diameterMm.toString(),
    notes: s.notes || "",
    status: s.status || "in_stock",
    purchaseStore: s.purchaseStore || "",
  };
}

export function FilamentInventory() {
  const { t } = useTranslation();
  const store = useFilamentInventory();
  const { format: fmtCurrency, symbol } = useCurrency();
  const customColors = useColorPalette((s) => s.colors);
  const addPaletteColor = useColorPalette((s) => s.addColor);
  const removePaletteColor = useColorPalette((s) => s.removeColor);

  // Peça ativa do calculatorStore: define a necessidade de plástico para o
  // badge de cobertura de cada carretel (0 = sem peça ativa → sem badge).
  const unitWeight = useCalculatorStore((s) => s.results?.unitWeight ?? 0);
  const quantity = useCalculatorStore((s) => s.quantity);
  const activeTab = useCalculatorStore((s) => s.activeTab);
  const requiredGrams =
    activeTab === "fdm" && unitWeight > 0 ? unitWeight * quantity : 0;

  const [search, setSearch] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  // Linha "adicionar cor" dentro do formulário (paleta custom).
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#6366f1");

  /**
   * Seletor de cores mesclado: paleta padrão + paleta custom do usuário,
   * separadas por grupo. O value é o nome "title-cased" (display), que o
   * resolveHex aceita em qualquer casing.
   */
  const colorOptions = useMemo(() => {
    const std = STD_COLORS.map((c) => ({
      value: titleCaseColor(c.name),
      label: titleCaseColor(c.name),
      color: c.hex,
      group: "Padrão",
    }));
    const custom = customColors.map((c) => ({
      value: c.name,
      label: c.name,
      color: c.hex,
      group: "Minhas cores",
    }));
    return [...std, ...custom];
  }, [customColors]);

  const upd = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Picking no seletor: grava nome + hex da paleta (hex exato do swatch). */
  const handleColorSelect = (name: string) => {
    const found = colorOptions.find((o) => o.value === name);
    upd("color", name);
    if (found) upd("colorHex", found.color);
  };

  /** "Adicionar cor": salva na paleta custom e já seleciona a cor nova. */
  const handleAddColor = () => {
    const name = newColorName.trim();
    if (!name) return;
    const existing = colorOptions.find(
      (o) => o.value.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      // Nome já existe (padrão ou custom) — não duplica, só seleciona.
      handleColorSelect(existing.value);
    } else {
      addPaletteColor(name, newColorHex);
      handleColorSelect(name);
    }
    setNewColorName("");
    setNewColorHex("#6366f1");
    setShowAddColor(false);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (s: FilamentSpool) => {
    setForm(spoolToForm(s));
    setEditingId(s.id);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const saveForm = () => {
    if (!form.brand.trim() || !form.color.trim() || !form.weight) return;
    const hex = form.colorHex || resolveHex(form.color);
    const origWeight = editingId
      ? (store.spools.find((s) => s.id === editingId)?.originalWeightGrams ??
        (parseFloat(form.weight) || 1000))
      : parseFloat(form.weight) || 1000;
    const data: Omit<FilamentSpool, "id" | "dateAdded"> = {
      brand: form.brand,
      material: form.material,
      color: form.color,
      colorHex: hex,
      weightGrams: parseFloat(form.weight) || 1000,
      originalWeightGrams: origWeight,
      costPerKg: parseFloat(form.costPerKg) || 0,
      diameterMm: parseFloat(form.diameter) || 1.75,
      notes: form.notes,
      status: form.status,
      purchaseStore: form.purchaseStore,
    };
    if (editingId) store.updateSpool(editingId, data);
    else store.addSpool(data);
    closeForm();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const main = ["PLA", "PETG", "ABS", "TPU", "ASA", "SILK"];
    return store.spools.filter((s) => {
      if (
        q &&
        !s.color.toLowerCase().includes(q) &&
        !s.brand.toLowerCase().includes(q) &&
        !s.material.toLowerCase().includes(q) &&
        !(s.purchaseStore || "").toLowerCase().includes(q)
      )
        return false;
      if (filterMaterial !== "Todos") {
        const isOther = filterMaterial === "Outro";
        if (isOther ? main.includes(s.material) : s.material !== filterMaterial)
          return false;
      }
      if (filterStatus !== "all" && (s.status || "in_stock") !== filterStatus)
        return false;
      return true;
    });
  }, [store.spools, search, filterMaterial, filterStatus]);

  const lowCount = store.getLowStockSpools(100).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
            {t("inventory.title")}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {store.spools.length} rolos cadastrados
            {lowCount > 0 && (
              <span className="ml-2 text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {lowCount} com estoque baixo
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPalette(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors border border-[var(--color-border)]"
          >
            <Palette className="w-4 h-4" />
            Paleta de Cores
          </button>
          <button
            onClick={openAdd}
            data-tutorial="inventory-add"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-fill-hover)] active:bg-[var(--accent-fill-hover)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("inventory.newSpool")}
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div data-tutorial="inventory-search" className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cor, marca, material..."
            className="w-full h-11 pl-10 pr-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div
          data-tutorial="inventory-filters"
          className="flex flex-wrap gap-1.5 items-center"
        >
          {FILTER_MATERIALS.map((m) => (
            <button
              key={m}
              onClick={() => setFilterMaterial(m)}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors border ${
                filterMaterial === m
                  ? "bg-[var(--accent-fill)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {m}
            </button>
          ))}
          <div className="w-px h-4 bg-[var(--color-border)] mx-0.5" />
          {FILTER_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors border ${
                filterStatus === s.value
                  ? "bg-[var(--accent-fill)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      <div
        data-tutorial="inventory-grid"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {filtered.map((s) => {
          const pct = Math.min(
            100,
            Math.round((s.weightGrams / s.originalWeightGrams) * 100),
          );
          const isLow =
            (s.status || "in_stock") === "in_stock" && s.weightGrams < 100;
          const hex = resolveHex(s.color, s.colorHex);
          const status: SpoolStatus = s.status || "in_stock";
          const barColor = pct < 20 ? "#f97316" : hex;

          return (
            <div
              key={s.id}
              className="surface rounded-xl p-4 group relative flex flex-col gap-3 hover:shadow-xl transition-shadow"
            >
              {isLow && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[6px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Estoque baixo
                </div>
              )}

              <div className="flex items-center gap-3">
                <SpoolIcon color={hex} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--color-text-primary)] text-[15px] leading-tight break-words pr-4">
                    {s.color}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {s.material} · {s.brand}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[var(--color-text-secondary)] font-medium">
                    {t("inventory.remaining")}
                  </span>
                  <span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {s.weightGrams}g
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {" "}
                      / {s.originalWeightGrams}g
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-1">
                  {pct}%
                </div>
              </div>

              <SpoolRemainingBlock spool={s} requiredGrams={requiredGrams} />

              <div className="flex items-center justify-between gap-2">
                <span className="text-sm min-w-0">
                  {s.costPerKg > 0 ? (
                    <>
                      <span className="font-bold text-[var(--color-text-primary)]">
                        {fmtCurrency(s.costPerKg)}
                      </span>
                      {s.purchaseStore && (
                        <span className="text-[var(--color-text-muted)] text-xs">
                          {" "}
                          · {s.purchaseStore}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-xs">
                      {s.purchaseStore || "\u2014"}
                    </span>
                  )}
                </span>
                <StatusBadge status={status} />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[var(--color-border)] opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
                <button
                  onClick={() => store.removeSpool(s.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600/10 text-[var(--color-danger)] hover:bg-red-600/30 hover:text-red-300 transition-colors"
                  aria-label="Remover rolo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full surface rounded-xl p-12 text-center text-[var(--color-text-muted)] text-sm">
            {search || filterMaterial !== "Todos" || filterStatus !== "all"
              ? "Nenhum rolo encontrado com esses filtros."
              : 'Nenhum rolo cadastrado. Clique em "+ Novo Rolo" para começar.'}
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeForm}
        >
          <div
            className="surface rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                {editingId ? t("inventory.editSpool") : t("inventory.newSpool")}
              </h3>
              <button
                onClick={closeForm}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <Select
                    label="Cor"
                    value={form.color}
                    onChange={handleColorSelect}
                    options={colorOptions}
                    groups
                    search
                    placeholder="Selecione a cor"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddColor((v) => !v)}
                  title="Adicionar cor personalizada"
                  aria-label="Adicionar cor personalizada"
                  aria-expanded={showAddColor}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
                    Hex
                  </label>
                  <input
                    type="color"
                    value={form.colorHex || resolveHex(form.color)}
                    onChange={(e) => upd("colorHex", e.target.value)}
                    className="w-11 h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] cursor-pointer p-0.5"
                    title="Cor da bobina"
                  />
                </div>
              </div>

              {showAddColor && (
                <div className="col-span-2 flex gap-2 items-end rounded-xl border border-dashed border-[var(--color-border)] p-3 bg-[var(--color-bg-elevated)]">
                  <div className="flex-1 min-w-0">
                    <InputGroup
                      label="Nome da cor"
                      value={newColorName}
                      onChange={setNewColorName}
                      type="text"
                      placeholder="Ex: Verde Neon"
                    />
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
                      Hex
                    </label>
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="w-11 h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] cursor-pointer p-0.5"
                      title="Hex da cor personalizada"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    disabled={!newColorName.trim()}
                    className="shrink-0 h-11 px-4 rounded-xl bg-[var(--accent-fill)] text-white text-sm font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Adicionar
                  </button>
                </div>
              )}
              <Select
                label="Material"
                value={form.material}
                onChange={(v) => upd("material", v)}
                options={MATERIALS.map((m) => ({ label: m, value: m }))}
                search={false}
              />
              <InputGroup
                label="Marca"
                value={form.brand}
                onChange={(v) => upd("brand", v)}
                type="text"
                placeholder="Ex: Overture, eSun..."
              />
              <InputGroup
                label="Peso (g)"
                value={form.weight}
                onChange={(v) => upd("weight", v)}
                type="number"
                unit="g"
              />
              <InputGroup
                label="Custo/kg"
                value={form.costPerKg}
                onChange={(v) => upd("costPerKg", v)}
                type="number"
                prefix={symbol}
              />
              <Select
                label="Loja"
                value={form.purchaseStore}
                onChange={(v) => upd("purchaseStore", v)}
                options={STORES.map((s) => ({ label: s, value: s }))}
                search
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(v) => upd("status", v as SpoolStatus)}
                options={STATUS_OPTIONS}
                search={false}
              />
              <InputGroup
                label="Diametro"
                value={form.diameter}
                onChange={(v) => upd("diameter", v)}
                type="number"
                unit="mm"
              />
              <div className="col-span-2">
                <InputGroup
                  label="Notas"
                  value={form.notes}
                  onChange={(v) => upd("notes", v)}
                  type="text"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <button
              onClick={saveForm}
              disabled={
                !form.brand.trim() || !form.color.trim() || !form.weight
              }
              className="mt-5 w-full py-3 rounded-xl bg-[var(--accent-fill)] text-white font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {editingId
                ? t("inventory.saveChanges")
                : t("inventory.saveSpool")}
            </button>
          </div>
        </div>
      )}

      {showPalette && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="surface rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--color-accent)]" />
                Paleta de Cores
              </h3>
              <button
                onClick={() => setShowPalette(false)}
                aria-label="Fechar paleta"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-5">
              <section>
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                  Padrão
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {STD_COLORS.map((c) => (
                    <div
                      key={c.name}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className="w-12 h-12 rounded-xl border border-[var(--color-border)]"
                        style={{ backgroundColor: c.hex }}
                      />
                      <p className="text-[10px] text-[var(--color-text-secondary)] text-center leading-tight break-words w-full font-medium">
                        {titleCaseColor(c.name)}
                      </p>
                      <p className="text-[9px] text-[var(--color-text-muted)] text-center uppercase">
                        {c.hex}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                  Minhas cores
                </h4>
                {customColors.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                    Nenhuma cor personalizada.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {customColors.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-12 h-12 rounded-xl border border-[var(--color-border)]"
                          style={{ backgroundColor: c.hex }}
                        />
                        <p className="text-[10px] text-[var(--color-text-secondary)] text-center leading-tight break-words w-full font-medium">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-1">
                          <p className="text-[9px] text-[var(--color-text-muted)] text-center uppercase">
                            {c.hex}
                          </p>
                          <button
                            type="button"
                            onClick={() => removePaletteColor(c.id)}
                            aria-label={`Remover cor ${c.name}`}
                            title="Remover cor"
                            className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
