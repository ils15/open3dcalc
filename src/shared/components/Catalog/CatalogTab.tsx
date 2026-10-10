import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { PrinterTagEditor } from "@/shared/components/Catalog/PrinterTagEditor";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { printers } from "@/shared/lib/printers";
import { materials } from "@/shared/lib/materials";
import { marketplaces } from "@/shared/lib/marketplace";
import {
  Check,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  Search,
  Trash2,
  X,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { PrinterProfile } from "@/shared/types";
import type { CatalogPrinter } from "@/shared/stores/catalogStore";

type Section = "printers" | "materials" | "marketplaces";

const uid = () => Math.random().toString(36).slice(2, 9);
const BUILTIN_PRINTER_IDS = new Set(printers.map((printer) => printer.id));

function isPersonalPrinter(printer: CatalogPrinter): boolean {
  return (
    printer.custom === true ||
    (printer.custom === undefined && !BUILTIN_PRINTER_IDS.has(printer.id))
  );
}

const SHIPPED_PRINTER_IMAGE_PATHS = new Set([
  "/images/printers/fallback-fdm.svg",
  "/images/printers/fallback-resin.svg",
]);

function getImageSource(source: string | undefined): string | null {
  const normalizedSource = source?.trim();
  if (!normalizedSource || !SHIPPED_PRINTER_IMAGE_PATHS.has(normalizedSource)) {
    return null;
  }

  const baseUrl = import.meta.env.BASE_URL;
  if (baseUrl === "/") return normalizedSource;
  return `${baseUrl.replace(/\/?$/, "/")}${normalizedSource.slice(1)}`;
}

interface CatalogCardProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

function CatalogCard({
  ariaLabel,
  children,
  className = "",
}: CatalogCardProps) {
  return (
    <article
      aria-label={ariaLabel}
      className={`surface min-w-0 rounded-xl border border-[var(--color-border)] p-4 shadow-sm ${className}`}
    >
      {children}
    </article>
  );
}

interface CatalogSearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function CatalogSearchField({
  label,
  value,
  onChange,
}: CatalogSearchFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative min-w-0 flex-1" role="search" aria-label={label}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-2 pl-9 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      />
      {value && (
        <button
          type="button"
          aria-label={t("catalog.clearSearch")}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface CatalogSectionLayoutProps {
  form: ReactNode;
  toolbar: ReactNode;
  children: ReactNode;
}

function CatalogSectionLayout({
  form,
  toolbar,
  children,
}: CatalogSectionLayoutProps) {
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {form}
      <section className="min-w-0 space-y-3">
        {toolbar}
        {children}
      </section>
    </div>
  );
}

interface PrinterThumbnailProps {
  source?: string;
  name: string;
  className?: string;
}

function PrinterThumbnail({
  source,
  name,
  className = "",
}: PrinterThumbnailProps) {
  const { t } = useTranslation();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSource = getImageSource(source) ?? "";
  const showImage = Boolean(imageSource) && failedSource !== imageSource;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] ${className}`}
    >
      {showImage ? (
        <img
          src={imageSource}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(imageSource)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span
          role="img"
          aria-label={t("catalog.imageUnavailable")}
          className="flex h-full w-full items-center justify-center"
        >
          <PrinterIcon aria-hidden="true" className="h-5 w-5" />
        </span>
      )}
    </span>
  );
}

const SECTION_ORDER: Section[] = ["printers", "materials", "marketplaces"];

export function CatalogTab() {
  const { t } = useTranslation();
  const store = useCatalogStore();
  const [section, setSection] = useState<Section>("printers");

  const load = useCatalogStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      printers: store.printers.length,
      materials: store.materials.length,
      marketplaces: store.marketplaces.length,
    }),
    [store.printers.length, store.materials.length, store.marketplaces.length],
  );

  const handleTabKeyDown = (e: React.KeyboardEvent, current: Section) => {
    const idx = SECTION_ORDER.indexOf(current);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSection(SECTION_ORDER[(idx + 1) % SECTION_ORDER.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSection(
        SECTION_ORDER[(idx - 1 + SECTION_ORDER.length) % SECTION_ORDER.length],
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="surface rounded-xl p-5 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {t("catalog.title")}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("catalog.subtitle")}
          </p>
        </div>
        {/*
         VIS-003(a) — `flex-wrap` so the three stat chips reflow instead of
         pushing the page wide. Measured at 390px: this row was 294px inside a
         242px column and reached x=420, making the document 420px wide on the
         Cadastros destination even after the shell and the dock were fixed. The
         chips were already token-driven; only the layout was at fault.
         */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-[6px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            {stats.printers} {t("catalog.printers")}
          </span>
          <span className="px-3 py-1.5 rounded-[6px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            {stats.materials} {t("catalog.materials")}
          </span>
          <span className="px-3 py-1.5 rounded-[6px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            {stats.marketplaces} {t("catalog.marketplaces")}
          </span>
        </div>
      </div>

      {/*
         VIS-004 — the fee tabs were uneven and clipped at 390px.

         Measured before: 83 / 61 / 92px. `flex-1` alone does not equalise them,
         because a flex item defaults to `min-width: auto` and therefore cannot
         shrink below its longest label. On the 390px layout, the collapsed
         sidebar leaves too little room for three legible labels in one row.
         `grid-cols-1` gives each tab the full row on mobile; `sm:grid-cols-3`
         restores equal-width columns once the content area can fit the labels.
         `whitespace-nowrap` keeps each label uncut.
         */}
      <div
        className="surface grid grid-cols-1 gap-2 rounded-xl p-2 sm:grid-cols-3"
        role="tablist"
        aria-label={t("catalog.title")}
      >
        <button
          role="tab"
          aria-selected={section === "printers"}
          aria-controls="tabpanel-printers"
          onClick={() => setSection("printers")}
          onKeyDown={(e) => handleTabKeyDown(e, "printers")}
          className={`min-h-11 w-full rounded-xl px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "printers" ? "bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
        >
          {t("catalog.printers")}
        </button>
        <button
          role="tab"
          aria-selected={section === "materials"}
          aria-controls="tabpanel-materials"
          onClick={() => setSection("materials")}
          onKeyDown={(e) => handleTabKeyDown(e, "materials")}
          className={`min-h-11 w-full rounded-xl px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "materials" ? "bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
        >
          {t("catalog.materials")}
        </button>
        <button
          role="tab"
          aria-selected={section === "marketplaces"}
          aria-controls="tabpanel-marketplaces"
          onClick={() => setSection("marketplaces")}
          onKeyDown={(e) => handleTabKeyDown(e, "marketplaces")}
          className={`min-h-11 w-full rounded-xl px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "marketplaces" ? "bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
        >
          {t("catalog.marketplaces")}
        </button>
      </div>

      {section === "printers" && (
        <div id="tabpanel-printers" role="tabpanel">
          <PrinterManager />
        </div>
      )}
      {section === "materials" && (
        <div id="tabpanel-materials" role="tabpanel">
          <MaterialManager />
        </div>
      )}
      {section === "marketplaces" && (
        <div id="tabpanel-marketplaces" role="tabpanel">
          <MarketplaceManager />
        </div>
      )}
    </div>
  );
}

interface PrinterEditForm {
  name: string;
  brand: string;
  power: string;
  value: string;
  usefulLife: string;
  maintenancePerHour: string;
}

const emptyPrinterForm = (): PrinterEditForm => ({
  name: "",
  brand: "",
  power: "",
  value: "",
  usefulLife: "3000",
  maintenancePerHour: "0.25",
});

function PrinterManager() {
  const store = useCatalogStore();
  const activePrinterId = useCalculatorStore(
    (state) => state.selectedPrinter.id,
  );
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [collection, setCollection] = useState<"mine" | "library">("mine");
  const [search, setSearch] = useState("");
  const [technology, setTechnology] = useState<"all" | "fdm" | "resin">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PrinterEditForm>(emptyPrinterForm());
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const editFormRef = useRef<PrinterEditForm>(emptyPrinterForm());
  const modalRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  const personalPrinters = useMemo(
    () => store.printers.filter(isPersonalPrinter),
    [store.printers],
  );
  const libraryPrinters = useMemo(
    () => store.printers.filter((printer) => !isPersonalPrinter(printer)),
    [store.printers],
  );
  const visiblePrinters =
    collection === "mine" ? personalPrinters : libraryPrinters;

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    store.printers.forEach((printer) =>
      (printer.tags ?? []).forEach((tag) => tags.add(tag)),
    );
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [store.printers]);

  const filteredPrinters = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return visiblePrinters.filter((printer) => {
      const matchesSearch =
        !normalizedSearch ||
        `${printer.name} ${printer.brand}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      const matchesTechnology =
        technology === "all" || printer.technology === technology;
      const matchesTag =
        collection !== "mine" ||
        !store.selectedPrinterTag ||
        (printer.tags ?? []).includes(store.selectedPrinterTag);
      return matchesSearch && matchesTechnology && matchesTag;
    });
  }, [
    collection,
    search,
    store.selectedPrinterTag,
    technology,
    visiblePrinters,
  ]);

  const tagChipClass = (active: boolean) =>
    `whitespace-nowrap rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active
        ? "border-transparent bg-[#2563eb] text-white"
        : "border-[#262a3c] bg-[#161824] text-slate-300 hover:text-white"
    }`;

  const selectPrinterForCalculation = useCallback((printer: CatalogPrinter) => {
    useCalculatorStore.getState().setSelectedPrinter(printer);
  }, []);

  const updEdit = (key: keyof PrinterEditForm, value: string) => {
    setEditForm((form) => {
      const next = { ...form, [key]: value };
      editFormRef.current = next;
      return next;
    });
  };

  const openEditPrinter = useCallback((printer: CatalogPrinter) => {
    editTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const form: PrinterEditForm = {
      name: printer.name,
      brand: printer.brand,
      power: String(printer.power),
      value: String(printer.value),
      usefulLife: String(printer.usefulLife),
      maintenancePerHour: String(printer.maintenancePerHour),
    };
    setEditingPrinterId(printer.id);
    setEditForm(form);
    editFormRef.current = form;
  }, []);

  const closeEditPrinter = useCallback(() => {
    setEditingPrinterId(null);
    setEditForm(emptyPrinterForm());
    editFormRef.current = emptyPrinterForm();
    setShowUnsavedConfirm(false);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (!editingPrinterId) return false;
    const original = store.printers.find(
      (printer) => printer.id === editingPrinterId,
    );
    if (!original) return false;
    return (
      editForm.name !== original.name ||
      editForm.brand !== original.brand ||
      editForm.power !== String(original.power) ||
      editForm.value !== String(original.value) ||
      editForm.usefulLife !== String(original.usefulLife) ||
      editForm.maintenancePerHour !== String(original.maintenancePerHour)
    );
  }, [editingPrinterId, editForm, store.printers]);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) setShowUnsavedConfirm(true);
    else closeEditPrinter();
  }, [closeEditPrinter, hasUnsavedChanges]);

  const savePrinter = useCallback(() => {
    if (!editingPrinterId) return;
    store.updatePrinter(editingPrinterId, {
      name: editForm.name || "Impressora",
      brand: editForm.brand || t("catalog.customPrinter"),
      power: Number(editForm.power) || 0,
      value: Number(editForm.value) || 0,
      usefulLife: Number(editForm.usefulLife) || 3000,
      maintenancePerHour: Number(editForm.maintenancePerHour) || 0.25,
    });
    closeEditPrinter();
  }, [closeEditPrinter, editForm, editingPrinterId, store, t]);

  useEffect(() => {
    if (!editingPrinterId) {
      const trigger = editTriggerRef.current;
      editTriggerRef.current = null;
      if (trigger?.isConnected) trigger.focus();
      return;
    }

    const dialog = modalRef.current;
    const initialFocus =
      dialog?.querySelector<HTMLElement>("input:not(:disabled)") ??
      dialog?.querySelector<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
    initialFocus?.focus();
  }, [editingPrinterId]);

  useEffect(() => {
    if (!editingPrinterId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const activeDialog = modalRef.current;
      if (!activeDialog) return;
      const focusable = activeDialog.querySelectorAll<HTMLElement>(
        'input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!activeDialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingPrinterId, requestClose]);

  const editingPrinter = store.printers.find(
    (printer) => printer.id === editingPrinterId,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0e1424] border border-[#1b253b]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
              FROTA DA OFICINA
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {t(
              collection === "mine"
                ? "catalog.myPrinters"
                : "catalog.printerLibrary",
            )}
          </h3>
          <p className="text-xs text-slate-400">
            {collection === "mine"
              ? t("catalog.personalPrintersSummary", {
                  count: personalPrinters.length,
                })
              : t("catalog.printerLibrarySummary", {
                  count: libraryPrinters.length,
                })}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={showCreateForm}
          onClick={() => setShowCreateForm(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:ring-2 hover:ring-blue-500/40 px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-blue-950/40 hover:scale-[1.02] active:scale-[0.98] shrink-0 self-start sm:self-auto"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span>{t("catalog.addPrinter")}</span>
        </button>
      </div>

      <div
        className="inline-flex max-w-full flex-wrap rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1"
        role="group"
        aria-label={t("catalog.printerCollections")}
      >
        {(
          [
            ["mine", "catalog.myPrinters", personalPrinters.length],
            ["library", "catalog.printerLibrary", libraryPrinters.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={collection === value}
            onClick={() => {
              setCollection(value);
              store.setPrinterTagFilter(null);
            }}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              collection === value
                ? "bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]"
            }`}
          >
            {t(label)} <span className="opacity-75">({count})</span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <CatalogSearchField
          label={t("catalog.printerSearch")}
          value={search}
          onChange={setSearch}
        />
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t("catalog.materialType")}
        >
          <span className="mr-1 text-xs text-slate-400">
            {t("catalog.materialType")}
          </span>
          {(
            [
              ["all", t("spools.filterAll")],
              ["fdm", t("catalog.fdm")],
              ["resin", t("catalog.resin")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={technology === value}
              onClick={() => setTechnology(value)}
              className={tagChipClass(technology === value)}
            >
              {label}
            </button>
          ))}
        </div>
        {collection === "mine" && allTags.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("catalog.filterByTag")}
          >
            <span className="mr-1 text-xs text-[var(--color-text-muted)]">
              {t("catalog.filterByTag")}
            </span>
            <button
              type="button"
              aria-pressed={store.selectedPrinterTag === null}
              onClick={() => store.setPrinterTagFilter(null)}
              className={tagChipClass(store.selectedPrinterTag === null)}
            >
              {t("catalog.allTags")}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={store.selectedPrinterTag === tag}
                onClick={() =>
                  store.setPrinterTagFilter(
                    store.selectedPrinterTag === tag ? null : tag,
                  )
                }
                className={tagChipClass(store.selectedPrinterTag === tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateForm && (
        <PrinterCreateForm
          onCancel={() => setShowCreateForm(false)}
          onCreated={(printer) => {
            setCollection("mine");
            setShowCreateForm(false);
            void selectPrinterForCalculation(printer);
          }}
        />
      )}

      <div
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        role="group"
        aria-label={t("catalog.printers")}
      >
        {filteredPrinters.map((printer) => {
          const personal = isPersonalPrinter(printer);
          return (
            <PrinterProfileCard
              key={printer.id}
              printer={printer}
              personal={personal}
              selected={activePrinterId === printer.id}
              onSelect={() => void selectPrinterForCalculation(printer)}
              onEdit={() => openEditPrinter(printer)}
              onRemove={() => store.removePrinter(printer.id)}
            />
          );
        })}
        {filteredPrinters.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center"
          >
            <p className="text-sm text-[var(--color-text-muted)]">
              {collection === "mine" && personalPrinters.length === 0
                ? t("catalog.emptyPersonalPrinters")
                : t("history.noResults")}
            </p>
            {collection === "mine" && personalPrinters.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t("catalog.emptyPersonalPrintersHint")}
              </p>
            )}
            {collection === "mine" && personalPrinters.length === 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-fill-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("catalog.addPrinter")}
              </button>
            )}
          </div>
        )}
      </div>

      {editingPrinter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={requestClose}
          role="dialog"
          aria-modal="true"
          aria-label={t("catalog.editPrinter")}
        >
          <div
            ref={modalRef}
            className="surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                {t("catalog.editPrinter")}
              </h3>
              <button
                type="button"
                onClick={requestClose}
                aria-label={t("catalog.cancel")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputGroup
                label={t("catalog.printerName")}
                value={editForm.name}
                onChange={(v) => updEdit("name", v)}
              />
              <InputGroup
                label={t("catalog.printerBrand")}
                value={editForm.brand}
                onChange={(v) => updEdit("brand", v)}
              />
              <InputGroup
                label={t("catalog.power")}
                value={editForm.power}
                onChange={(v) => updEdit("power", v)}
                type="number"
                unit="W"
              />
              <InputGroup
                label={t("catalog.value")}
                value={editForm.value}
                onChange={(v) => updEdit("value", v)}
                type="number"
                prefix={currencySymbol}
              />
              <InputGroup
                label={t("catalog.usefulLife")}
                value={editForm.usefulLife}
                onChange={(v) => updEdit("usefulLife", v)}
                type="number"
                unit="h"
              />
              <InputGroup
                label={t("catalog.maintenancePerHour")}
                value={editForm.maintenancePerHour}
                onChange={(v) => updEdit("maintenancePerHour", v)}
                type="number"
                prefix={currencySymbol}
              />
            </div>
            <button
              data-testid="catalog-tab-save-printer-button"
              type="button"
              onClick={savePrinter}
              disabled={!editForm.name.trim()}
              className="mt-5 w-full rounded-xl bg-[var(--positive-fill)] py-3 font-semibold text-[var(--positive-fill-fg)] transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--positive-fill)]"
            >
              {t("catalog.saveChanges")}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showUnsavedConfirm}
        title={t("common.confirm")}
        message="Você tem alterações não salvas. Deseja sair sem salvar?"
        confirmLabel={t("catalog.cancel")}
        cancelLabel={t("catalog.saveChanges")}
        variant="warning"
        onConfirm={closeEditPrinter}
        onCancel={() => setShowUnsavedConfirm(false)}
      />
    </div>
  );
}

interface PrinterCreateFormProps {
  onCancel: () => void;
  onCreated: (printer: CatalogPrinter) => void;
}

function PrinterCreateForm({ onCancel, onCreated }: PrinterCreateFormProps) {
  const store = useCatalogStore();
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();

  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetSearch, setPresetSearch] = useState("");
  const [presetTechFilter, setPresetTechFilter] = useState<
    "all" | "fdm" | "resin"
  >("all");
  const [presetBrandFilter, setPresetBrandFilter] = useState<string>("all");

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [power, setPower] = useState("");
  const [value, setValue] = useState("");
  const [usefulLife, setUsefulLife] = useState("3000");
  const [maintenancePerHour, setMaintenancePerHour] = useState("0.25");
  const [technology, setTechnology] = useState<PrinterProfile["technology"]>();
  const [buildVolumeMm, setBuildVolumeMm] =
    useState<PrinterProfile["buildVolumeMm"]>();

  // Unique list of brands in presets
  const presetBrands = useMemo(() => {
    const bSet = new Set<string>();
    printers.forEach((p) => bSet.add(p.brand));
    return ["all", ...Array.from(bSet).sort()];
  }, []);

  // Filter presets
  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    return printers.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);
      const matchesTech =
        presetTechFilter === "all" || p.technology === presetTechFilter;
      const matchesBrand =
        presetBrandFilter === "all" || p.brand === presetBrandFilter;
      return matchesSearch && matchesTech && matchesBrand;
    });
  }, [presetSearch, presetTechFilter, presetBrandFilter]);

  const selectPreset = (profile: PrinterProfile) => {
    setSelectedPresetId(profile.id);
    setName(profile.name);
    setBrand(profile.brand);
    setPower(String(profile.power));
    setValue(String(profile.value));
    setUsefulLife(String(profile.usefulLife));
    setMaintenancePerHour(String(profile.maintenancePerHour));
    setTechnology(profile.technology);
    setBuildVolumeMm(profile.buildVolumeMm);
  };

  const add = () => {
    if (!name.trim()) return;
    const printer: CatalogPrinter = {
      id: uid(),
      name,
      brand: brand || t("catalog.customPrinter"),
      power: Number(power) || 0,
      value: Number(value) || 0,
      usefulLife: Number(usefulLife) || 3000,
      maintenancePerHour: Number(maintenancePerHour) || 0.25,
      custom: true,
      ...(technology ? { technology } : {}),
      ...(buildVolumeMm ? { buildVolumeMm } : {}),
    };
    store.addPrinter(printer);
    onCreated(printer);
  };

  const numVal = Number(value) || 0;
  const numLife = Number(usefulLife) || 3000;
  const numMaint = Number(maintenancePerHour) || 0;
  const depreciationPerHour = numLife > 0 ? numVal / numLife : 0;
  const totalMachineHourCost = depreciationPerHour + numMaint;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <section
        className="bg-[#0c1220] border border-[#21304f] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-200 animate-scale-in"
        aria-label={t("catalog.addPrinter")}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1b253b] bg-[#090e1a]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                ADICIONAR À MINHA FROTA
              </span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <PrinterIcon className="w-5 h-5 text-blue-400" />
              Catálogo de Presets & Cadastro de Impressoras 3D
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha um modelo homologado da biblioteca ou cadastre uma
              impressora personalizada
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("catalog.cancel")}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {!selectedPresetId && mode === "presets" && (
          <div className="flex items-center justify-between p-3 border-b border-[#1b253b] bg-[#0c1220] gap-3">
            <div className="flex items-center bg-[#111728] border border-[#212c45] rounded-xl p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode("presets");
                  setSelectedPresetId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  mode === "presets"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Presets Homologados ({printers.length} modelos)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("custom");
                  setSelectedPresetId("custom");
                  setName("Impressora Personalizada");
                  setBrand("DIY / Custom");
                  setPower("200");
                  setValue("2000");
                  setUsefulLife("3000");
                  setMaintenancePerHour("0.30");
                  setTechnology("fdm");
                  setBuildVolumeMm({ x: 220, y: 220, z: 250 });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-slate-400 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Impressora Personalizada / Do Zero</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono hidden sm:block">
              {filteredPresets.length} modelos encontrados
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!selectedPresetId && mode === "presets" ? (
            /* Presets Gallery View */
            <div className="space-y-4">
              {/* Preset Search and Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0a0f1c] border border-[#1b253b] p-3 rounded-xl">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    placeholder="Buscar por modelo ou marca (ex: Ender, P1S, A1, K1, Mars, Saturn, Prusa...)"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  {presetSearch && (
                    <button
                      onClick={() => setPresetSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Technology Filter */}
                <div className="flex items-center bg-[#111728] border border-[#1f2b45] rounded-lg p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setPresetTechFilter("all")}
                    className={`px-2.5 py-1 rounded transition-all ${
                      presetTechFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTechFilter("fdm")}
                    className={`px-2.5 py-1 rounded transition-all ${
                      presetTechFilter === "fdm"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    FDM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTechFilter("resin")}
                    className={`px-2.5 py-1 rounded transition-all ${
                      presetTechFilter === "resin"
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Resina
                  </button>
                </div>
              </div>

              {/* Brands Horizontal Scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <span className="text-[10px] text-slate-500 font-mono uppercase shrink-0 mr-1">
                  MARCA:
                </span>
                {presetBrands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPresetBrandFilter(b)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      presetBrandFilter === b
                        ? "bg-blue-600 text-white"
                        : "bg-[#111728] text-slate-400 hover:text-white border border-[#1b253b]"
                    }`}
                  >
                    {b === "all" ? "Todas as Marcas" : b}
                  </button>
                ))}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPresets.map((preset) => {
                  const vol = preset.buildVolumeMm
                    ? `${preset.buildVolumeMm.x}×${preset.buildVolumeMm.y}×${preset.buildVolumeMm.z} mm`
                    : "Padrão";
                  const technologyLabel = preset.technology
                    ? t(`catalog.${preset.technology}`)
                    : t("catalog.technologyUnknown");

                  return (
                    <div
                      key={preset.id}
                      className="bg-[#090e1a] hover:bg-[#0f1629] border border-[#1b253b] hover:border-blue-500/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all group"
                    >
                      <div>
                        <PrinterThumbnail
                          source={preset.image}
                          name={preset.name}
                          className="mb-3 h-20 w-full"
                        />
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {preset.brand}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                              preset.technology
                                ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {technologyLabel}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {preset.name}
                        </h4>

                        <div className="mt-2 space-y-1 text-[11px] font-mono text-slate-400 bg-[#060a14] p-2 rounded-lg border border-[#141b2e]">
                          <div className="flex items-center justify-between">
                            <span>Volume:</span>
                            <span className="text-slate-200">{vol}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Potência:</span>
                            <span className="text-slate-200">
                              {preset.power} W
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Valor Base:</span>
                            <span className="text-emerald-400 font-bold">
                              {currencySymbol} {preset.value}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs border border-blue-500/30 hover:border-transparent transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar esta Máquina</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Selected Preset / Custom Config Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1b253b]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(null);
                    setMode("presets");
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para a Lista de Presets</span>
                </button>
                <span className="text-xs font-mono text-slate-400">
                  Ajuste os parâmetros conforme os dados da sua oficina
                </span>
              </div>

              {/* Form Fields */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <InputGroup
                  label={t("catalog.printerName")}
                  value={name}
                  onChange={setName}
                />
                <InputGroup
                  label={t("catalog.printerBrand")}
                  value={brand}
                  onChange={setBrand}
                />
                <InputGroup
                  label={t("catalog.power")}
                  value={power}
                  onChange={setPower}
                  type="number"
                  unit="W"
                />
                <InputGroup
                  label={t("catalog.value")}
                  value={value}
                  onChange={setValue}
                  type="number"
                  prefix={currencySymbol}
                />
                <InputGroup
                  label={t("catalog.usefulLife")}
                  value={usefulLife}
                  onChange={setUsefulLife}
                  type="number"
                  unit="h"
                />
                <InputGroup
                  label={t("catalog.maintenancePerHour")}
                  value={maintenancePerHour}
                  onChange={setMaintenancePerHour}
                  type="number"
                  prefix={currencySymbol}
                />
              </div>

              {/* Economic & Hourly Cost Summary */}
              <div className="bg-[#080d18] border border-[#192338] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    CUSTO CALCULADO DA HORA DE MÁQUINA
                  </span>
                  <div className="text-sm font-bold text-white flex items-center gap-3">
                    <span>
                      Depreciação:{" "}
                      <strong className="font-mono text-slate-300">
                        {currencySymbol} {depreciationPerHour.toFixed(2)}/h
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Manutenção:{" "}
                      <strong className="font-mono text-slate-300">
                        {currencySymbol} {numMaint.toFixed(2)}/h
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    TOTAL DE HORA-MÁQUINA:
                  </span>
                  <span className="text-xl font-extrabold text-emerald-400 font-mono">
                    {currencySymbol}{" "}
                    {totalMachineHourCost.toFixed(2).replace(".", ",")}/h
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1b253b] bg-[#090e1a] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            {t("catalog.cancel")}
          </button>

          {(selectedPresetId || mode === "custom") && (
            <button
              type="button"
              onClick={add}
              disabled={!name.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:ring-2 hover:ring-blue-500/40 text-white text-xs font-bold transition-all shadow-md disabled:opacity-40"
            >
              {t("catalog.save")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

interface PrinterProfileCardProps {
  printer: CatalogPrinter;
  personal: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function PrinterProfileCard({
  printer,
  personal,
  selected,
  onSelect,
  onEdit,
  onRemove,
}: PrinterProfileCardProps) {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const technologyLabel = printer.technology
    ? t(`catalog.${printer.technology}`)
    : t("catalog.technologyUnknown");
  const volumeLabel = printer.buildVolumeMm
    ? `${printer.buildVolumeMm.x} × ${printer.buildVolumeMm.y} × ${printer.buildVolumeMm.z} mm`
    : "—";
  const specs = [
    { label: t("stl.volume"), value: volumeLabel },
    { label: t("catalog.power"), value: `${printer.power} W` },
    { label: t("catalog.value"), value: `${currencySymbol} ${printer.value}` },
    { label: t("catalog.usefulLife"), value: `${printer.usefulLife} h` },
    {
      label: t("catalog.maintenancePerHour"),
      value: `${currencySymbol} ${printer.maintenancePerHour}/h`,
    },
  ];

  return (
    <CatalogCard
      ariaLabel={`${printer.name} ${printer.brand}`}
      className={`flex flex-col justify-between gap-3 transition-colors ${
        selected
          ? "border-[var(--color-accent)]"
          : "hover:border-[var(--color-accent)]"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PrinterThumbnail
            source={printer.image}
            name={printer.name}
            className="h-14 w-14"
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {printer.name}
            </h3>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {printer.brand}
            </p>
            <span
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                printer.technology === "fdm"
                  ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : printer.technology === "resin"
                    ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
              }`}
            >
              {technologyLabel}
            </span>
          </div>
        </div>
        {personal ? (
          <span className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
            {t("catalog.customPrinter")}
          </span>
        ) : (
          <span className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
            {t("catalog.defaultPrinter")}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-xs">
        {specs.map((spec) => (
          <div key={spec.label} className="min-w-0">
            <dt className="truncate text-[10px] text-[var(--color-text-muted)]">
              {spec.label}
            </dt>
            <dd className="truncate font-semibold text-[var(--color-text-primary)]">
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>

      {printer.custom && <PrinterTagEditor printer={printer} />}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            selected
              ? "border-[var(--color-accent)] bg-[var(--color-bg-elevated)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          }`}
        >
          {selected ? <Check aria-hidden="true" className="h-3 w-3" /> : null}
          {t("catalog.selectPrinter")}
        </button>
        <div className="flex items-center gap-1">
          {personal && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("catalog.editPrinter")}
              title={t("catalog.editPrinter")}
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
          {personal && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("catalog.remove")}
              title={t("catalog.remove")}
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </CatalogCard>
  );
}

function MaterialManager() {
  const store = useCatalogStore();
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [name, setName] = useState("");
  const [type, setType] = useState<"fdm" | "resin">("fdm");
  const [density, setDensity] = useState("");
  const [price, setPrice] = useState("");
  const [search, setSearch] = useState("");

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return store.materials.filter(
      (material) => !query || material.name.toLocaleLowerCase().includes(query),
    );
  }, [search, store.materials]);

  const add = () => {
    if (!name.trim()) return;
    store.addMaterial({
      id: uid(),
      name,
      type,
      density: Number(density) || 0,
      avgPrice: Number(price) || 0,
      custom: true,
    });
    setName("");
    setType("fdm");
    setDensity("");
    setPrice("");
  };

  return (
    <CatalogSectionLayout
      form={
        <div className="surface rounded-xl p-5 space-y-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("catalog.addMaterial")}
          </div>
          <Select
            label={t("catalog.selectMaterial")}
            value=""
            onChange={(id) => {
              const m = materials.find((mat) => mat.id === id);
              if (m) {
                setName(m.name);
                setType(m.type);
                setDensity(String(m.density));
                setPrice(String(m.avgPrice));
              }
            }}
            options={[
              { label: t("catalog.customMaterial"), value: "" },
              ...materials.map((m) => ({
                label: m.name,
                value: m.id,
                subtitle: `${m.density}g/cm³ · ${currencySymbol} ${m.avgPrice}`,
                group: t(m.type === "fdm" ? "catalog.fdm" : "catalog.resin"),
              })),
            ]}
            groups
            search
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs text-[var(--color-text-muted)]">
              <span className="bg-[var(--color-bg-primary)] px-2">
                {t("catalog.orManual")}
              </span>
            </div>
          </div>
          <InputGroup
            label={t("catalog.materialName")}
            value={name}
            onChange={setName}
          />
          <Select
            label={t("catalog.materialType")}
            value={type}
            onChange={(v) => setType(v as "fdm" | "resin")}
            options={[
              { label: "FDM", value: "fdm" },
              { label: "Resin", value: "resin" },
            ]}
            search={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputGroup
              label={t("catalog.density")}
              value={density}
              onChange={setDensity}
              type="number"
            />
            <InputGroup
              label={t("catalog.avgPrice")}
              value={price}
              onChange={setPrice}
              type="number"
              prefix={currencySymbol}
            />
          </div>
          <button
            type="button"
            onClick={add}
            className="w-full py-3 rounded-xl bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)] font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t("catalog.save")}
          </button>
        </div>
      }
      toolbar={
        <CatalogSearchField
          label={t("catalog.materialSearch")}
          value={search}
          onChange={setSearch}
        />
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredMaterials.map((m) => (
          <CatalogCard key={m.id} ariaLabel={m.name} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--color-text-primary)]">
                  {m.name}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">
                  {m.type}
                </div>
              </div>
              {m.custom && (
                /* contrast-site: catalog-tab-material-custom-badge */
                <span className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                  Custom
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.density")}: {m.density}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.avgPrice")}: {currencySymbol} {m.avgPrice}
            </div>
            {m.custom && (
              <button
                onClick={() => store.removeMaterial(m.id)}
                className="text-xs text-[var(--color-danger)] hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded"
              >
                {t("catalog.remove")}
              </button>
            )}
          </CatalogCard>
        ))}
        {filteredMaterials.length === 0 && (
          <p
            role="status"
            aria-live="polite"
            className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]"
          >
            {t("history.noResults")}
          </p>
        )}
      </div>
    </CatalogSectionLayout>
  );
}

function MarketplaceManager() {
  const store = useCatalogStore();
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [name, setName] = useState("");
  const [feePercent, setFeePercent] = useState("");
  const [feeFixed, setFeeFixed] = useState("");
  const [hasFreeShipping, setHasFreeShipping] = useState(false);
  const [search, setSearch] = useState("");

  const filteredMarketplaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return store.marketplaces.filter(
      (marketplace) =>
        !query || marketplace.name.toLocaleLowerCase().includes(query),
    );
  }, [search, store.marketplaces]);

  const add = () => {
    if (!name.trim()) return;
    store.addMarketplace({
      id: uid(),
      name,
      feePercent: Number(feePercent) || 0,
      feeFixed: Number(feeFixed) || 0,
      hasFreeShipping,
      custom: true,
    });
    setName("");
    setFeePercent("");
    setFeeFixed("");
    setHasFreeShipping(false);
  };

  return (
    <CatalogSectionLayout
      form={
        <div className="surface rounded-xl p-5 space-y-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("catalog.addMarketplace")}
          </div>
          <Select
            label={t("catalog.selectMarketplace")}
            value=""
            onChange={(id) => {
              const m = marketplaces.find((mp) => mp.id === id);
              if (m) {
                setName(m.name);
                setFeePercent(String(m.feePercent));
                setFeeFixed(String(m.feeFixed));
                setHasFreeShipping(m.hasFreeShipping);
              }
            }}
            options={[
              { label: t("catalog.customMarketplace"), value: "" },
              ...marketplaces.map((m) => ({
                label: m.name,
                value: m.id,
                subtitle: `${m.feePercent}% + ${currencySymbol}${m.feeFixed}`,
              })),
            ]}
            search
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs text-[var(--color-text-muted)]">
              <span className="bg-[var(--color-bg-primary)] px-2">
                {t("catalog.orManual")}
              </span>
            </div>
          </div>
          <InputGroup
            label={t("catalog.marketplaceName")}
            value={name}
            onChange={setName}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputGroup
              label={t("catalog.feePercent")}
              value={feePercent}
              onChange={setFeePercent}
              type="number"
              unit="%"
            />
            <InputGroup
              label={t("catalog.feeFixed")}
              value={feeFixed}
              onChange={setFeeFixed}
              type="number"
              prefix={currencySymbol}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={hasFreeShipping}
              onChange={(e) => setHasFreeShipping(e.target.checked)}
              className="rounded bg-[var(--color-bg-elevated)] border-[var(--color-border)]"
            />
            {t("catalog.freeShipping")}
          </label>
          <button
            type="button"
            onClick={add}
            className="w-full py-3 rounded-xl bg-[var(--accent-fill)] text-[var(--color-accent-fill-fg)] font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t("catalog.save")}
          </button>
        </div>
      }
      toolbar={
        <CatalogSearchField
          label={t("catalog.marketplaceSearch")}
          value={search}
          onChange={setSearch}
        />
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredMarketplaces.map((m) => (
          <CatalogCard key={m.id} ariaLabel={m.name} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--color-text-primary)]">
                  {m.name}
                </div>
              </div>
              {m.custom && (
                /* contrast-site: catalog-tab-marketplace-custom-badge */
                <span className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                  Custom
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.fee")}: {m.feePercent}% + {currencySymbol}{" "}
              {m.feeFixed}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {m.hasFreeShipping
                ? t("catalog.hasFreeShipping")
                : t("catalog.noFreeShipping")}
            </div>
            {m.custom && (
              <button
                onClick={() => store.removeMarketplace(m.id)}
                className="text-xs text-[var(--color-danger)] hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded"
              >
                {t("catalog.remove")}
              </button>
            )}
          </CatalogCard>
        ))}
        {filteredMarketplaces.length === 0 && (
          <p
            role="status"
            aria-live="polite"
            className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]"
          >
            {t("history.noResults")}
          </p>
        )}
      </div>
    </CatalogSectionLayout>
  );
}
