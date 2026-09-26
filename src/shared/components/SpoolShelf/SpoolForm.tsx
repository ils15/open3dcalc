import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { PackageCheck, X } from "lucide-react";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import {
  SPOOL_MATERIALS,
  type FilamentSpool,
  type SpoolStatus,
} from "@/shared/stores/spoolStore";

/** Valores do formulário — espelham o payload do store (sem id/dateAdded). */
export interface SpoolFormValues {
  brand: string;
  material: string;
  color: string;
  colorHex: string;
  weightGrams: number;
  originalWeightGrams: number;
  costPerKg: number;
  diameterMm: number;
  notes: string;
  status: SpoolStatus;
  purchaseStore: string;
}

/** Valores parciais permitidos ao abrir um novo carretel a partir do cálculo. */
export type SpoolFormInitialValues = Partial<SpoolFormValues>;

export interface SpoolFormProps {
  open: boolean;
  /** Spool existente = modo edição; null = cadastro. */
  initial: FilamentSpool | null;
  /** Pré-preenche campos de um novo carretel sem transformar o cálculo em edição. */
  initialValues?: SpoolFormInitialValues;
  /** Carretéis que podem ser reutilizados em vez de criar uma duplicata. */
  compatibleSpools?: readonly FilamentSpool[];
  onUseExisting?: (spool: FilamentSpool) => void;
  onSubmit: (values: SpoolFormValues) => void;
  onClose: () => void;
}

const STATUSES: SpoolStatus[] = ["in_stock", "on_the_way", "empty"];

const STATUS_KEY: Record<SpoolStatus, string> = {
  in_stock: "spools.statusInStock",
  on_the_way: "spools.statusOnTheWay",
  empty: "spools.statusEmpty",
};

const toStr = (n: number): string => (n > 0 ? String(n) : "");

function toValues(
  spool: FilamentSpool | null,
  initialValues?: SpoolFormInitialValues,
): Record<string, string> {
  if (spool) {
    return {
      brand: spool.brand,
      material: spool.material,
      color: spool.color,
      colorHex: spool.colorHex,
      weight: toStr(spool.weightGrams),
      originalWeight: toStr(spool.originalWeightGrams),
      costPerKg: toStr(spool.costPerKg),
      diameter: toStr(spool.diameterMm),
      notes: spool.notes,
      status: spool.status,
      purchaseStore: spool.purchaseStore,
    };
  }

  const values: Record<string, string> = {
    brand: "",
    material: "PLA",
    color: "",
    colorHex: "",
    weight: "",
    originalWeight: "",
    costPerKg: "",
    diameter: "1.75",
    notes: "",
    status: "in_stock",
    purchaseStore: "",
  };
  if (!initialValues) return values;

  if (initialValues.brand !== undefined) values.brand = initialValues.brand;
  if (initialValues.material !== undefined)
    values.material = initialValues.material;
  if (initialValues.color !== undefined) values.color = initialValues.color;
  if (initialValues.colorHex !== undefined)
    values.colorHex = initialValues.colorHex;
  if (initialValues.weightGrams !== undefined) {
    values.weight = toStr(initialValues.weightGrams);
  }
  if (initialValues.originalWeightGrams !== undefined) {
    values.originalWeight = toStr(initialValues.originalWeightGrams);
  }
  if (initialValues.costPerKg !== undefined) {
    values.costPerKg = toStr(initialValues.costPerKg);
  }
  if (initialValues.diameterMm !== undefined) {
    values.diameter = toStr(initialValues.diameterMm);
  }
  if (initialValues.notes !== undefined) values.notes = initialValues.notes;
  if (initialValues.status !== undefined) values.status = initialValues.status;
  if (initialValues.purchaseStore !== undefined) {
    values.purchaseStore = initialValues.purchaseStore;
  }
  return values;
}

export function SpoolForm({
  open,
  initial,
  initialValues,
  compatibleSpools = [],
  onUseExisting,
  onSubmit,
  onClose,
}: SpoolFormProps): React.ReactElement | null {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const [values, setValues] = useState<Record<string, string>>(() =>
    toValues(initial, initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  const compatibleSpool = useMemo(() => {
    const material = values.material.trim().toLowerCase();
    const brand = values.brand.trim().toLowerCase();
    if (!material || !brand) return null;
    return compatibleSpools.find(
      (spool) =>
        spool.material.trim().toLowerCase() === material &&
        spool.brand.trim().toLowerCase() === brand,
    );
  }, [compatibleSpools, values.brand, values.material]);

  // Reseta o formulário toda vez que o modal (re)abre — cobre cadastro→edição.
  useEffect(() => {
    if (!open) return;

    const resetId = setTimeout(() => {
      setValues(toValues(initial, initialValues));
      setErrors({});
    }, 0);
    // Foco no próprio diálogo (tabbable) — leitor de tela anuncia o título.
    dialogRef.current?.focus();
    return () => clearTimeout(resetId);
  }, [open, initial, initialValues]);

  const upd = useCallback(
    (key: string, value: string) => setValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!values.brand.trim()) e.brand = t("spools.form.errBrand");
    if (!values.color.trim()) e.color = t("spools.form.errColor");
    const weight = Number(values.weight);
    if (!(weight > 0)) e.weight = t("spools.form.errWeight");
    const original = Number(values.originalWeight);
    if (!(original > 0)) e.originalWeight = t("spools.form.errOriginal");
    return e;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (compatibleSpool && onUseExisting) {
      onUseExisting(compatibleSpool);
      return;
    }

    onSubmit({
      brand: values.brand.trim(),
      material: values.material,
      color: values.color.trim(),
      colorHex: values.colorHex,
      weightGrams: Number(values.weight),
      originalWeightGrams: Number(values.originalWeight),
      costPerKg: Number(values.costPerKg) || 0,
      diameterMm: Number(values.diameterMm) || 1.75,
      notes: values.notes.trim(),
      status: values.status as SpoolStatus,
      purchaseStore: values.purchaseStore.trim(),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spool-form-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.15 }}
            className="surface rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center justify-between mb-5">
              <h3
                id="spool-form-title"
                className="text-base font-bold text-[var(--color-text-primary)]"
              >
                {initial ? t("spools.editSpool") : t("spools.newSpool")}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("spools.close")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-2 gap-3"
              noValidate
            >
              {compatibleSpool && onUseExisting && (
                <div
                  role="status"
                  className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[var(--color-text-primary)]">
                    <PackageCheck
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    {t("spools.compatibleExisting", {
                      brand: compatibleSpool.brand,
                      material: compatibleSpool.material,
                    })}
                  </span>
                  {/* contrast-site: spool-form-use-existing-button */}
                  <button
                    type="button"
                    onClick={() => onUseExisting(compatibleSpool)}
                    className="min-h-[36px] rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  >
                    {t("spools.useExisting")}
                  </button>
                </div>
              )}

              <div className="col-span-2 flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <InputGroup
                    label={t("spools.form.color")}
                    value={values.color}
                    onChange={(v) => upd("color", v)}
                    type="text"
                    placeholder={t("spools.form.colorPlaceholder")}
                    error={errors.color ?? null}
                  />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
                    {t("spools.form.hex")}
                  </label>
                  <input
                    type="color"
                    value={values.colorHex || "#6366f1"}
                    onChange={(e) => upd("colorHex", e.target.value)}
                    className="w-11 h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] cursor-pointer p-0.5"
                    aria-label={t("spools.form.hex")}
                  />
                </div>
              </div>

              <div className="col-span-2">
                <InputGroup
                  label={t("spools.form.brand")}
                  value={values.brand}
                  onChange={(v) => upd("brand", v)}
                  type="text"
                  placeholder="Bambu Lab"
                  error={errors.brand ?? null}
                />
              </div>

              <Select
                label={t("spools.form.material")}
                value={values.material}
                onChange={(v) => upd("material", v)}
                options={SPOOL_MATERIALS.map((m) => ({ value: m, label: m }))}
                search={false}
              />
              <Select
                label={t("spools.form.status")}
                value={values.status}
                onChange={(v) => upd("status", v)}
                options={STATUSES.map((s) => ({
                  value: s,
                  label: t(STATUS_KEY[s]),
                }))}
                search={false}
              />

              <InputGroup
                label={t("spools.form.weight")}
                value={values.weight}
                onChange={(v) => upd("weight", v)}
                type="number"
                step="1"
                error={errors.weight ?? null}
              />
              <InputGroup
                label={t("spools.form.originalWeight")}
                value={values.originalWeight}
                onChange={(v) => upd("originalWeight", v)}
                type="number"
                step="1"
                error={errors.originalWeight ?? null}
              />
              <InputGroup
                label={t("spools.form.costPerKg")}
                value={values.costPerKg}
                onChange={(v) => upd("costPerKg", v)}
                type="number"
                step="0.01"
              />
              <InputGroup
                label={t("spools.form.diameter")}
                value={values.diameter}
                onChange={(v) => upd("diameter", v)}
                type="number"
                step="0.01"
              />
              <div className="col-span-2">
                <InputGroup
                  label={t("spools.form.purchaseStore")}
                  value={values.purchaseStore}
                  onChange={(v) => upd("purchaseStore", v)}
                  type="text"
                  placeholder={t("spools.form.purchaseStore")}
                />
              </div>
              <div className="col-span-2">
                <InputGroup
                  label={t("spools.form.notes")}
                  value={values.notes}
                  onChange={(v) => upd("notes", v)}
                  type="text"
                  placeholder={t("spools.form.notes")}
                />
              </div>

              <div className="col-span-2 flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-xl bg-[var(--accent-fill)] text-white text-sm font-bold hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  {t("spools.form.save")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 rounded-xl text-sm font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  {t("spools.cancel")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
