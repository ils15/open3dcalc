import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCatalogStore } from "@/shared/stores/catalogStore";
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
} from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { PrinterProfile } from "@/shared/types";
import type { CatalogPrinter } from "@/shared/stores/catalogStore";

type Section = "printers" | "materials" | "marketplaces";

const uid = () => Math.random().toString(36).slice(2, 9);

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
        <div className="flex gap-2 text-xs">
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

      <div
        className="surface rounded-xl p-2 flex gap-2"
        role="tablist"
        aria-label={t("catalog.title")}
      >
        <button
          role="tab"
          aria-selected={section === "printers"}
          aria-controls="tabpanel-printers"
          onClick={() => setSection("printers")}
          onKeyDown={(e) => handleTabKeyDown(e, "printers")}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "printers" ? "bg-[var(--accent-fill)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
        >
          {t("catalog.printers")}
        </button>
        <button
          role="tab"
          aria-selected={section === "materials"}
          aria-controls="tabpanel-materials"
          onClick={() => setSection("materials")}
          onKeyDown={(e) => handleTabKeyDown(e, "materials")}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "materials" ? "bg-[var(--accent-fill)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
        >
          {t("catalog.materials")}
        </button>
        <button
          role="tab"
          aria-selected={section === "marketplaces"}
          aria-controls="tabpanel-marketplaces"
          onClick={() => setSection("marketplaces")}
          onKeyDown={(e) => handleTabKeyDown(e, "marketplaces")}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${section === "marketplaces" ? "bg-[var(--accent-fill)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
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
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [search, setSearch] = useState("");
  const [technology, setTechnology] = useState<"all" | "fdm" | "resin">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(
    null,
  );
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PrinterEditForm>(emptyPrinterForm());
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const editFormRef = useRef<PrinterEditForm>(emptyPrinterForm());
  const modalRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    store.printers.forEach((printer) =>
      (printer.tags ?? []).forEach((tag) => tags.add(tag)),
    );
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [store.printers]);

  const filteredPrinters = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return store.printers.filter((printer) => {
      const matchesSearch =
        !normalizedSearch ||
        `${printer.name} ${printer.brand}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      const matchesTechnology =
        technology === "all" || printer.technology === technology;
      const matchesTag =
        !store.selectedPrinterTag ||
        (printer.tags ?? []).includes(store.selectedPrinterTag);
      return matchesSearch && matchesTechnology && matchesTag;
    });
  }, [search, store.printers, store.selectedPrinterTag, technology]);

  const tagChipClass = (active: boolean) =>
    `whitespace-nowrap rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active
        ? "border-transparent bg-[#2563eb] text-white"
        : "border-[#262a3c] bg-[#161824] text-slate-300 hover:text-white"
    }`;

  const selectPrinterForCalculation = useCallback(
    async (printer: CatalogPrinter) => {
      setSelectedPrinterId(printer.id);
      const { useCalculatorStore } =
        await import("@/shared/stores/calculatorStore");
      useCalculatorStore.getState().setSelectedPrinter(printer);
    },
    [],
  );

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
      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        role="search"
      >
        <label className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            aria-label={t("catalog.printerName")}
            placeholder={t("catalog.printerName")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-[30px] w-full rounded border border-[#292e42] bg-[#161824] pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </label>
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
        {allTags.length > 0 && (
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
        <button
          type="button"
          aria-expanded={showCreateForm}
          onClick={() => setShowCreateForm((visible) => !visible)}
          className="flex h-[30px] shrink-0 items-center justify-center gap-1.5 rounded bg-[#2563eb] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          {t("catalog.addPrinter")}
        </button>
      </div>

      {showCreateForm && (
        <PrinterCreateForm
          onCancel={() => setShowCreateForm(false)}
          onCreated={() => setShowCreateForm(false)}
        />
      )}

      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        role="group"
        aria-label={t("catalog.printers")}
      >
        {filteredPrinters.map((printer) => (
          <PrinterProfileCard
            key={printer.id}
            printer={printer}
            selected={selectedPrinterId === printer.id}
            onSelect={() => void selectPrinterForCalculation(printer)}
            onEdit={() => openEditPrinter(printer)}
            onRemove={() => store.removePrinter(printer.id)}
          />
        ))}
        {filteredPrinters.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            {t("history.noResults")}
          </p>
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
  onCreated: () => void;
}

function PrinterCreateForm({ onCancel, onCreated }: PrinterCreateFormProps) {
  const store = useCatalogStore();
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [power, setPower] = useState("");
  const [value, setValue] = useState("");
  const [usefulLife, setUsefulLife] = useState("3000");
  const [maintenancePerHour, setMaintenancePerHour] = useState("0.25");
  const [technology, setTechnology] = useState<PrinterProfile["technology"]>();
  const [buildVolumeMm, setBuildVolumeMm] =
    useState<PrinterProfile["buildVolumeMm"]>();

  const add = () => {
    if (!name.trim()) return;
    store.addPrinter({
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
    });
    onCreated();
  };

  return (
    <section
      className="surface rounded-xl border border-[var(--color-border)] p-4"
      aria-label={t("catalog.addPrinter")}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select
          label={t("catalog.selectPrinter")}
          value=""
          onChange={(id) => {
            const profile = printers.find((item) => item.id === id);
            if (!profile) {
              setTechnology(undefined);
              setBuildVolumeMm(undefined);
              return;
            }
            setName(profile.name);
            setBrand(profile.brand);
            setPower(String(profile.power));
            setValue(String(profile.value));
            setUsefulLife(String(profile.usefulLife));
            setMaintenancePerHour(String(profile.maintenancePerHour));
            setTechnology(profile.technology);
            setBuildVolumeMm(profile.buildVolumeMm);
          }}
          options={[
            { label: t("catalog.customPrinter"), value: "" },
            ...printers.map((profile) => ({
              label: profile.name,
              value: profile.id,
              subtitle: `${profile.power}W · ${currencySymbol} ${profile.value}`,
              group: profile.brand,
            })),
          ]}
          groups
          search
        />
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
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {t("catalog.cancel")}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={!name.trim()}
            className="h-10 flex-1 rounded-lg bg-[var(--accent-fill)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {t("catalog.save")}
          </button>
        </div>
      </div>
    </section>
  );
}

interface PrinterProfileCardProps {
  printer: CatalogPrinter;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function PrinterProfileCard({
  printer,
  selected,
  onSelect,
  onEdit,
  onRemove,
}: PrinterProfileCardProps) {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const technologyLabel = printer.technology
    ? t(`catalog.${printer.technology}`)
    : "—";
  const volumeLabel = printer.buildVolumeMm
    ? `${printer.buildVolumeMm.x} × ${printer.buildVolumeMm.y} × ${printer.buildVolumeMm.z} mm`
    : "—";
  const specs = [
    { label: t("catalog.materialType"), value: technologyLabel },
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
    <article
      aria-label={`${printer.name} ${printer.brand}`}
      className={`min-w-0 flex flex-col justify-between gap-2.5 rounded-md border p-3 transition-colors ${
        selected
          ? "border-blue-500 bg-[#161927]"
          : "border-[#262b3c] bg-[#151722] hover:border-[#383e57]"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#2d3348] bg-[#1c1f2e] text-slate-300">
            <PrinterIcon aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-slate-100">
              {printer.name}
            </h3>
            <p className="truncate font-mono text-[10px] text-slate-400">
              {printer.brand} · {technologyLabel}
            </p>
          </div>
        </div>
        {printer.custom ? (
          <span className="shrink-0 rounded border border-[#2d3348] bg-[#11131c] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {t("catalog.customPrinter")}
          </span>
        ) : (
          <span className="shrink-0 rounded border border-[#2d3348] bg-[#11131c] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {t("catalog.defaultPrinter")}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-1.5 rounded border border-[#232738] bg-[#11131c] p-2 font-mono text-[11px]">
        {specs.map((spec) => (
          <div key={spec.label} className="min-w-0">
            <dt className="truncate text-[10px] text-slate-400">
              {spec.label}
            </dt>
            <dd className="truncate font-semibold text-[11px] text-slate-100">
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
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            selected
              ? "border-blue-500/80 bg-[#1b2234] text-blue-300"
              : "border-[#262b3c] bg-transparent text-slate-300 hover:bg-[#1f2232]"
          }`}
        >
          {selected ? <Check aria-hidden="true" className="h-3 w-3" /> : null}
          {t("catalog.selectPrinter")}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("catalog.editPrinter")}
            title={t("catalog.editPrinter")}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-[#1f2232] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          {printer.custom && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("catalog.remove")}
              title={t("catalog.remove")}
              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-[#1f2232] hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
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
          onClick={add}
          className="w-full py-3 rounded-xl bg-[var(--accent-fill)] text-white font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {t("catalog.save")}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {store.materials.map((m) => (
          <div key={m.id} className="surface rounded-xl p-4 space-y-2">
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
          </div>
        ))}
      </div>
    </div>
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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
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
          onClick={add}
          className="w-full py-3 rounded-xl bg-[var(--accent-fill)] text-white font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {t("catalog.save")}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {store.marketplaces.map((m) => (
          <div key={m.id} className="surface rounded-xl p-4 space-y-2">
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
          </div>
        ))}
      </div>
    </div>
  );
}
