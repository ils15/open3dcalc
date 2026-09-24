/**
 * Tutorial tour registry (Fase 2).
 *
 * The flat 7-step list became a per-feature tour registry. The engine in
 * `Tutorial.tsx` (spotlight, keyboard nav, sessionDismissed, i18n, a11y) is
 * unchanged — it only reads `TOURS[activeTour]` instead of a module-level array.
 *
 * `tab?` is the cross-tab risk: before spotting an anchor the engine navigates
 * to the tab that owns it and waits for the DOM. If the anchor never shows up
 * the step degrades to a plain card without overlay rather than blocking.
 */

import type { CalcLevel } from "@/shared/stores/calculatorStore";

export type TourId =
  | "calc-basico"
  | "upload-3d-preview"
  | "inventario-bobinas"
  | "dashboard-kpis"
  | "orcamentos-clientes"
  | "nivel-avancado";

/** Ordered list used by the launcher menu. */
export const TOUR_IDS: TourId[] = [
  "calc-basico",
  "upload-3d-preview",
  "inventario-bobinas",
  "dashboard-kpis",
  "orcamentos-clientes",
  "nivel-avancado",
];

/**
 * Top-level surface a step lives on. The list below is the primary tab
 * contract; secondary surfaces remain valid tutorial destinations without
 * appearing in the bottom tab bar.
 */
export type TutorialTab =
  | "calculator"
  | "dashboard"
  | "infill"
  | "inventory"
  | "catalog"
  | "history"
  | "changelog"
  | "quotes"
  | "customers"
  | "products"
  | "privacy"
  | "wiki";

export const TUTORIAL_TABS: readonly TutorialTab[] = [
  "calculator",
  "dashboard",
  "infill",
  "inventory",
  "catalog",
  "history",
  "quotes",
  "customers",
  "products",
  "privacy",
];

export interface StepConfig {
  /** i18n key suffix: `tutorial.steps.<key>.title|.description`. */
  key: string;
  /** CSS selector for the spotlight anchor, or null for a centered card. */
  target: string | null;
  /** Navigate to this tab BEFORE spotting (cross-tab navigation). */
  tab?: TutorialTab;
  /**
   * Switch calculator level before spotting (unlocks gated sections).
   *
   * R3 (engine constraint — permanent): `Tutorial.tsx` bails on `!step.target`
   * BEFORE it dispatches the tab hop and BEFORE the level switch, so any step
   * that sets `level` MUST also set a non-null `target`. A `level` on a centered
   * card is silently dropped — no error, no log, the only symptom is the gated
   * sections never unlocking. Enforced statically in `tutorialTours.test.tsx`
   * ("R3: every step that sets level has a non-null target").
   */
  level?: CalcLevel;
}

/**
 * Tours are filled incrementally; an empty array means "not available yet" and
 * the launcher hides it. Keeps `Record<TourId, …>` closed for type-safety.
 */
export const TOURS: Record<TourId, StepConfig[]> = {
  "calc-basico": [
    { key: "welcome", target: null, tab: "calculator" },
    { key: "material", target: '[data-tutorial="material"]', tab: "calculator" },
    { key: "print", target: '[data-tutorial="print"]', tab: "calculator" },
    { key: "sales", target: '[data-tutorial="sales"]', tab: "calculator" },
    {
      key: "results",
      target: '[data-tutorial="results-sidebar"], [data-tutorial="results"]',
      tab: "calculator",
    },
    { key: "export", target: '[data-tutorial="export"]', tab: "calculator" },
    { key: "complete", target: null, tab: "calculator" },
  ],
  "upload-3d-preview": [
    { key: "upload-intro", target: null },
    {
      key: "upload-dropzone",
      target: '[data-tutorial="stl-dropzone"]',
    },
    {
      key: "upload-samples",
      target: '[data-tutorial="stl-samples"]',
    },
    {
      key: "upload-viewport",
      target: '[data-tutorial="stl-viewport"]',
    },
    { key: "upload-complete", target: null },
  ],
  "inventario-bobinas": [
    { key: "inv-intro", target: null },
    {
      key: "inv-add",
      target: '[data-tutorial="inventory-add"]',
      tab: "inventory",
    },
    {
      key: "inv-search",
      target: '[data-tutorial="inventory-search"]',
      tab: "inventory",
    },
    {
      key: "inv-filters",
      target: '[data-tutorial="inventory-filters"]',
      tab: "inventory",
    },
    {
      key: "inv-grid",
      target: '[data-tutorial="inventory-grid"]',
      tab: "inventory",
    },
    { key: "inv-complete", target: null },
  ],
  "dashboard-kpis": [
    { key: "dash-intro", target: null },
    {
      key: "dash-summary",
      target: '[data-tutorial="dashboard-summary"]',
      tab: "dashboard",
    },
    {
      key: "dash-date-range",
      target: '[data-tutorial="dashboard-date-range"]',
      tab: "dashboard",
    },
    {
      key: "dash-kpis",
      target: '[data-tutorial="dashboard-kpis"]',
      tab: "dashboard",
    },
    {
      key: "dash-projection",
      target: '[data-tutorial="dashboard-projection"]',
      tab: "dashboard",
    },
    { key: "dash-complete", target: null },
  ],
  // R3 (engine constraint): `Tutorial.tsx` bails on `!step.target` BEFORE it runs
  // the calculator-level switch, so any step that sets `level` MUST also set a
  // non-null `target` — otherwise the level change is silently skipped. This tour
  // is pure cross-tab navigation (no `level` anywhere); the same rule is what the
  // `nivel-avancado` tour must respect when it unlocks the advanced sections.
  "orcamentos-clientes": [
    { key: "qc-intro", target: null },
    {
      key: "qc-list",
      target: '[data-tutorial="quotes-list"]',
      tab: "quotes",
    },
    {
      key: "qc-new",
      target: '[data-tutorial="quote-new"]',
      tab: "quotes",
    },
    {
      key: "qc-customer",
      target: '[data-tutorial="quote-form-customer"]',
      tab: "quotes",
    },
    { key: "cs-intro", target: null },
    {
      key: "cs-list",
      target: '[data-tutorial="customers-list"]',
      tab: "customers",
    },
    {
      key: "cs-new",
      target: '[data-tutorial="customer-new"]',
      tab: "customers",
    },
    { key: "qc-complete", target: null },
  ],
  // nivel-avancado — the only tour that switches `calcLevel`. Every anchored
  // step carries `level: "advanced"` + a non-null target (R3 above); the
  // centered intro carries `tab` for documentation only (the engine returns on
  // `!step.target` before dispatching), so the real hop to the calculator tab
  // happens on `adv-level`, which also spotlights the LevelToggle it flips.
  "nivel-avancado": [
    { key: "adv-intro", target: null, tab: "calculator" },
    {
      key: "adv-level",
      target: '[data-tutorial="level-toggle"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-failure",
      target: '[data-tutorial="failure"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-hardware",
      target: '[data-tutorial="hardware"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-machine",
      target: '[data-tutorial="machine"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-fixedCost",
      target: '[data-tutorial="fixedCost"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-labor",
      target: '[data-tutorial="labor"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-ops",
      target: '[data-tutorial="ops"]',
      tab: "calculator",
      level: "advanced",
    },
    {
      key: "adv-results",
      target: '[data-tutorial="results-sidebar"], [data-tutorial="results"]',
      tab: "calculator",
      level: "advanced",
    },
    { key: "adv-complete", target: null },
  ],
};

export const DEFAULT_TOUR: TourId = "calc-basico";

export function getTourSteps(tourId: TourId): StepConfig[] {
  return TOURS[tourId] ?? [];
}

export function getTourStepCount(tourId: TourId): number {
  return getTourSteps(tourId).length;
}

export function isTourAvailable(tourId: TourId): boolean {
  return getTourStepCount(tourId) > 0;
}

/** Event the App listens to to switch tabs during a tour. */
export const TUTORIAL_NAVIGATE_EVENT = "open3dcalc:tutorial-navigate";

export function dispatchTutorialNavigate(tab: TutorialTab): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TutorialTab>(TUTORIAL_NAVIGATE_EVENT, { detail: tab }),
  );
}
