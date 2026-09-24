import { create } from "zustand";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { printers } from "@/shared/lib/printers";
import type { CalculatorState } from "@/shared/stores/calculatorStore.types";

/**
 * Guided wizard state — V2.0 Wave 4 (Progressive Onboarding).
 *
 * The wizard is a *collection surface* over the real calculator store, not a
 * parallel data path. It keeps a transient draft of the handful of fields a
 * beginner actually needs, then commits them through the calculator store's
 * existing public actions (`setFdmMaterial`, `setSelectedPrinter`, …) exactly
 * like the classic section UI does. Step 4 therefore reads
 * `useCalculatorStore(state => state.results)` — the real `calculateFDM` output
 * — and there is no second calculation path to drift.
 *
 * Persistence: deliberately NONE. The draft is working memory for a guided
 * session; persisting it would need a new SPEC-01 localStorage key (policy
 * bump + manifestGate + fixture). Same reasoning as `demoModeStore` — keep it
 * in memory and re-seed from the calculator on next entry. `layoutMode` (the
 * fact the user is *in* guided mode) is persisted by layoutStore, which is the
 * only durable part of this feature.
 *
 * Undo isolation: mirrors layoutStore's reasoning. The wizard lives outside the
 * calculator undo snapshot; only the committed writes enter it, and they enter
 * through the same public setters any other surface uses.
 */

export type WizardStep = 1 | 2 | 3 | 4;
export type WizardDirection = "forward" | "backward";
/** Validation kinds the UI renders via `t("wizard.errors.<kind>")`. */
export type WizardErrorKind = "required" | "positive" | "minQuantity";

export const WIZARD_TOTAL_STEPS = 4;
export const WIZARD_STEPS: readonly WizardStep[] = [1, 2, 3, 4];

/** Materials offered on step 1 — a beginner-focused subset, not the full catalog. */
export const WIZARD_MATERIALS: readonly string[] = [
  "PLA",
  "PLA+",
  "PETG",
  "ABS",
  "TPU",
];

export interface WizardDraft {
  productName: string;
  materialType: string;
  weightGrams: number;
  costPerKg: number;
  quantity: number;
  printerId: string;
  printTimeHours: number;
  energyCostPerKwh: number;
  setupTimeMinutes: number;
  postProcessingMinutes: number;
  hourlyRate: number;
  packagingCost: number;
  profitMarginPercent: number;
}

interface WizardState {
  step: WizardStep;
  direction: WizardDirection;
  draft: WizardDraft;
  /** Field-keyed error kinds for the active step. Empty when the step is clean. */
  errors: Partial<Record<keyof WizardDraft, WizardErrorKind>>;
  /** Whether the draft has been seeded from the calculator store this session. */
  seeded: boolean;

  /** Seed the draft from the current calculator values (idempotent per session). */
  start: () => void;
  setField: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
  /** Validate one step; records its errors and returns whether it is clean. */
  validateStep: (step: WizardStep) => boolean;
  /** Validate, commit, advance. Returns whether it advanced. */
  next: () => boolean;
  prev: () => void;
  /** Free backward jump; forward jump requires every skipped step to be valid. */
  goTo: (step: WizardStep) => void;
  /** Push the draft into the real calculator store via its public actions. */
  commit: () => void;
  /** Commit and graduate to the classic layout. */
  finish: () => void;
  /** Leave the wizard without committing (committed values are kept). */
  exit: () => void;
  reset: () => void;
}

/** Beginner-safe defaults so the draft is never half-formed before seeding. */
function createInitialDraft(): WizardDraft {
  return {
    productName: "",
    materialType: "PLA",
    weightGrams: 50,
    costPerKg: 125,
    quantity: 1,
    printerId: printers[0].id,
    printTimeHours: 5,
    energyCostPerKwh: 0.8,
    setupTimeMinutes: 10,
    postProcessingMinutes: 5,
    hourlyRate: 25,
    packagingCost: 2,
    profitMarginPercent: 40,
  };
}

/** Pre-fill the wizard with whatever the calculator already holds. */
function seedFromCalculator(c: CalculatorState): WizardDraft {
  return {
    productName: c.productName,
    materialType: c.fdmMaterial.type,
    weightGrams: c.fdmMaterial.weightUsed,
    costPerKg: c.fdmMaterial.costPerKg,
    quantity: c.quantity,
    printerId: c.selectedPrinter.id,
    printTimeHours: c.fdmPrintParams.printTimeHours,
    energyCostPerKwh: c.fdmPrintParams.energyCostPerKwh,
    setupTimeMinutes: c.fdmLabor.setupTimeMinutes,
    postProcessingMinutes: c.fdmLabor.postProcessingTimeMinutes,
    hourlyRate: c.fdmLabor.hourlyRate,
    packagingCost: c.fdmSales.packagingCost,
    profitMarginPercent: c.fdmSales.profitMarginPercent,
  };
}

const STEP_FIELDS: Record<WizardStep, (keyof WizardDraft)[]> = {
  1: ["materialType", "weightGrams", "costPerKg", "quantity"],
  2: ["printerId", "printTimeHours", "energyCostPerKwh"],
  3: [
    "setupTimeMinutes",
    "postProcessingMinutes",
    "hourlyRate",
    "packagingCost",
    "profitMarginPercent",
  ],
  4: [],
};

function fieldError(
  key: keyof WizardDraft,
  value: unknown,
): WizardErrorKind | null {
  switch (key) {
    case "materialType":
      return typeof value === "string" && value.trim().length > 0
        ? null
        : "required";
    case "printerId":
      if (typeof value !== "string" || value.length === 0) return "required";
      return printers.some((p) => p.id === value) ? null : "required";
    case "quantity":
      return Number(value) >= 1 ? null : "minQuantity";
    case "weightGrams":
    case "printTimeHours":
      return Number(value) > 0 ? null : "positive";
    case "costPerKg":
    case "energyCostPerKwh":
    case "setupTimeMinutes":
    case "postProcessingMinutes":
    case "hourlyRate":
    case "packagingCost":
    case "profitMarginPercent":
      return Number(value) >= 0 ? null : "positive";
    default:
      return null;
  }
}

function validateDraft(
  draft: WizardDraft,
  step: WizardStep,
): Partial<Record<keyof WizardDraft, WizardErrorKind>> {
  const errors: Partial<Record<keyof WizardDraft, WizardErrorKind>> = {};
  for (const field of STEP_FIELDS[step]) {
    const kind = fieldError(field, draft[field]);
    if (kind) errors[field] = kind;
  }
  return errors;
}

function isEmpty(errors: Record<string, unknown>): boolean {
  for (const key in errors) return false;
  return true;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  step: 1,
  direction: "forward",
  draft: createInitialDraft(),
  errors: {},
  seeded: false,

  start: () => {
    if (get().seeded) return;
    set({
      draft: seedFromCalculator(useCalculatorStore.getState()),
      seeded: true,
      step: 1,
      direction: "forward",
      errors: {},
    });
  },

  setField: (key, value) =>
    set((state) => {
      const rest = { ...state.errors };
      delete rest[key];
      return {
        draft: { ...state.draft, [key]: value },
        errors: isEmpty(rest) ? {} : rest,
      };
    }),

  validateStep: (step) => {
    const errors = validateDraft(get().draft, step);
    set({ errors });
    return isEmpty(errors);
  },

  next: () => {
    const { step, draft } = get();
    if (step >= WIZARD_TOTAL_STEPS) return false;
    const errors = validateDraft(draft, step);
    if (!isEmpty(errors)) {
      set({ errors });
      return false;
    }
    // Commit before advancing so step 4 reads live results from the real store.
    get().commit();
    set({
      step: (step + 1) as WizardStep,
      direction: "forward",
      errors: {},
    });
    return true;
  },

  prev: () => {
    const step = get().step;
    if (step <= 1) return;
    set({ step: (step - 1) as WizardStep, direction: "backward", errors: {} });
  },

  goTo: (target) => {
    const { step, draft } = get();
    if (target === step) return;
    if (target < step) {
      set({ step: target, direction: "backward", errors: {} });
      return;
    }
    // Forward jumps must clear every step they skip; land on the first offender.
    for (let s = step; s < target; s++) {
      const errors = validateDraft(draft, s as WizardStep);
      if (!isEmpty(errors)) {
        set({ step: s as WizardStep, direction: "forward", errors });
        return;
      }
    }
    set({ step: target, direction: "forward", errors: {} });
  },

  commit: () => {
    const d = get().draft;
    const calc = useCalculatorStore.getState();
    const printer =
      printers.find((p) => p.id === d.printerId) ?? calc.selectedPrinter;

    // Order matters: print params are set BEFORE the printer so the catalog's
    // power figure wins the merge inside setSelectedPrinter (it also derives
    // machine cost/depreciation/maintenance from the printer entry).
    // The printer is exposed by the wizard, so its catalog-owned derived values
    // are intentionally refreshed; every other unexposed value is preserved.
    calc.setActiveTab("fdm");
    calc.setProductName(d.productName);
    calc.setQuantity(d.quantity);
    // Merge the current material so fields absent from WizardDraft (notably
    // purgeWeight) survive a Guided commit.
    calc.setFdmMaterial({
      ...calc.fdmMaterial,
      type: d.materialType,
      weightUsed: d.weightGrams,
      costPerKg: d.costPerKg,
    });
    calc.setFdmPrintParams({
      ...calc.fdmPrintParams,
      printTimeHours: d.printTimeHours,
      energyCostPerKwh: d.energyCostPerKwh,
    });
    calc.setSelectedPrinter(printer);
    // Labor is an explicit Guided step. Enable it so the exposed time/rate
    // values contribute to the result; no other labor setting is overwritten.
    calc.setFdmLabor({
      ...calc.fdmLabor,
      enabled: true,
      setupTimeMinutes: d.setupTimeMinutes,
      postProcessingTimeMinutes: d.postProcessingMinutes,
      hourlyRate: d.hourlyRate,
    });
    calc.setFdmSales({
      ...calc.fdmSales,
      packagingCost: d.packagingCost,
      profitMarginPercent: d.profitMarginPercent,
    });
  },

  finish: () => {
    get().commit();
    // Graduate: the guided path is a ladder into the full calculator.
    useLayoutStore.getState().setLayoutMode("classic");
    set({ seeded: false });
  },

  exit: () => {
    useLayoutStore.getState().setLayoutMode("classic");
  },

  reset: () => {
    set({
      step: 1,
      direction: "forward",
      errors: {},
      seeded: false,
      draft: createInitialDraft(),
    });
  },
}));
