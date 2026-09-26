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
import { Pencil, X } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";

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
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [power, setPower] = useState("");
  const [value, setValue] = useState("");
  const [usefulLife, setUsefulLife] = useState("3000");
  const [maintPerHour, setMaintPerHour] = useState("0.25");

  // Edit modal state
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PrinterEditForm>(emptyPrinterForm());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const editFormRef = useRef<PrinterEditForm>(emptyPrinterForm());
  const modalRef = useRef<HTMLDivElement>(null);

  const updEdit = (k: keyof PrinterEditForm, v: string) => {
    setEditForm((f) => {
      const next = { ...f, [k]: v };
      editFormRef.current = next;
      return next;
    });
  };

  const openEditPrinter = useCallback(
    (p: {
      id: string;
      name: string;
      brand: string;
      power: number;
      value: number;
      usefulLife: number;
      maintenancePerHour: number;
    }) => {
      const form: PrinterEditForm = {
        name: p.name,
        brand: p.brand,
        power: String(p.power),
        value: String(p.value),
        usefulLife: String(p.usefulLife),
        maintenancePerHour: String(p.maintenancePerHour),
      };
      setEditingPrinterId(p.id);
      setEditForm(form);
      editFormRef.current = form;
      setShowEditModal(true);
    },
    [],
  );

  const closeEditPrinter = useCallback(() => {
    setEditingPrinterId(null);
    setEditForm(emptyPrinterForm());
    editFormRef.current = emptyPrinterForm();
    setShowEditModal(false);
    setShowUnsavedConfirm(false);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (!editingPrinterId) return false;
    const original = store.printers.find((p) => p.id === editingPrinterId);
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
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      closeEditPrinter();
    }
  }, [hasUnsavedChanges, closeEditPrinter]);

  const savePrinter = useCallback(() => {
    if (!editingPrinterId) return;
    store.updatePrinter(editingPrinterId, {
      name: editForm.name || "Impressora",
      brand: editForm.brand || "Custom",
      power: Number(editForm.power) || 0,
      value: Number(editForm.value) || 0,
      usefulLife: Number(editForm.usefulLife) || 3000,
      maintenancePerHour: Number(editForm.maintenancePerHour) || 0.25,
    });
    closeEditPrinter();
  }, [editingPrinterId, editForm, store, closeEditPrinter]);

  // Focus trap for edit modal
  useEffect(() => {
    if (!showEditModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = modalRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        "input, button, [tabindex]",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showEditModal, requestClose]);

  const add = () => {
    if (!name.trim()) return;
    store.addPrinter({
      id: uid(),
      name,
      brand: brand || "Custom",
      power: Number(power) || 0,
      value: Number(value) || 0,
      usefulLife: Number(usefulLife) || 3000,
      maintenancePerHour: Number(maintPerHour) || 0.25,
      custom: true,
    });
    setName("");
    setBrand("");
    setPower("");
    setValue("");
    setUsefulLife("3000");
    setMaintPerHour("0.25");
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    store.printers.forEach((p) =>
      (p.tags ?? []).forEach((tag) => set.add(tag)),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [store.printers]);

  const filteredPrinters = useMemo(() => {
    if (!store.selectedPrinterTag) return store.printers;
    return store.printers.filter((p) =>
      (p.tags ?? []).includes(store.selectedPrinterTag as string),
    );
  }, [store.printers, store.selectedPrinterTag]);

  const chipClass = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${active ? "bg-[var(--accent-fill)] text-white border-[var(--color-accent)]" : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="surface rounded-xl p-5 space-y-3">
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("catalog.addPrinter")}
        </div>
        <Select
          label={t("catalog.selectPrinter")}
          value=""
          onChange={(id) => {
            const p = printers.find((pr) => pr.id === id);
            if (p) {
              setName(p.name);
              setBrand(p.brand);
              setPower(String(p.power));
              setValue(String(p.value));
            }
          }}
          options={[
            { label: t("catalog.customPrinter"), value: "" },
            ...printers.map((p) => ({
              label: p.name,
              value: p.id,
              subtitle: `${p.power}W · ${currencySymbol} ${p.value}`,
              group: p.brand,
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
          label={t("catalog.printerName")}
          value={name}
          onChange={setName}
        />
        <InputGroup
          label={t("catalog.printerBrand")}
          value={brand}
          onChange={setBrand}
        />
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InputGroup
            label={t("catalog.usefulLife")}
            value={usefulLife}
            onChange={setUsefulLife}
            type="number"
            unit="h"
            placeholder="3000"
          />
          <InputGroup
            label={t("catalog.maintenancePerHour")}
            value={maintPerHour}
            onChange={setMaintPerHour}
            type="number"
            prefix={currencySymbol}
            placeholder="0.25"
          />
        </div>
        <button
          onClick={add}
          className="w-full py-3 rounded-xl bg-[var(--accent-fill)] text-white font-semibold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {t("catalog.save")}
        </button>
      </div>
      {allTags.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("catalog.filterByTag")}
        >
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("catalog.filterByTag")}
          </span>
          <button
            type="button"
            aria-pressed={store.selectedPrinterTag === null}
            onClick={() => store.setPrinterTagFilter(null)}
            className={chipClass(store.selectedPrinterTag === null)}
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
              className={chipClass(store.selectedPrinterTag === tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {filteredPrinters.map((p) => (
          <div key={p.id} className="surface rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--color-text-primary)] truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {p.brand}
                  </div>
                </div>
                <button
                  onClick={() => openEditPrinter(p)}
                  className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  aria-label={t("catalog.editPrinter")}
                  title={t("catalog.editPrinter")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {p.custom ? (
                <span className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] shrink-0">
                  Custom
                </span>
              ) : (
                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-600/20 text-emerald-300 shrink-0">
                  {t("catalog.defaultPrinter")}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.power")}: {p.power}W
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.value")}: {currencySymbol} {p.value}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.usefulLife")}: {p.usefulLife}h
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t("catalog.maintenancePerHour")}: {currencySymbol}{" "}
              {p.maintenancePerHour}/h
            </div>
            {p.custom && <PrinterTagEditor printer={p} />}
            {p.custom && (
              <button
                onClick={() => store.removePrinter(p.id)}
                className="text-xs text-[var(--color-danger)] hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded"
              >
                {t("catalog.remove")}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit Printer Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={requestClose}
          role="dialog"
          aria-modal="true"
          aria-label={t("catalog.editPrinter")}
        >
          <div
            ref={modalRef}
            className="surface rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                {t("catalog.editPrinter")}
              </h3>
              <button
                onClick={requestClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              onClick={savePrinter}
              disabled={!editForm.name.trim()}
              className="mt-5 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              {t("catalog.saveChanges")}
            </button>
          </div>
        </div>
      )}

      {/* Unsaved changes confirmation */}
      <ConfirmDialog
        open={showUnsavedConfirm}
        title={t("common.confirm")}
        message="Você tem alterações não salvas. Deseja sair sem salvar?"
        confirmLabel={t("catalog.cancel")}
        cancelLabel={t("catalog.saveChanges")}
        variant="warning"
        onConfirm={closeEditPrinter}
        onCancel={() => {
          setShowUnsavedConfirm(false);
        }}
      />
    </div>
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
