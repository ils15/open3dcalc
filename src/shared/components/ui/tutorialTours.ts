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
 * Top-level surface a step lives on. Mirrors the tab ids both platforms render;
 * the App subscribes to `open3dcalc:tutorial-navigate` and validates before
 * switching, so a typo can never crash the nav.
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
  | "privacy";

export const TUTORIAL_TABS: readonly TutorialTab[] = [
  "calculator",
  "dashboard",
  "infill",
  "inventory",
  "catalog",
  "history",
  "changelog",
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
  /** Switch calculator level before spotting (unlocks gated sections). */
  level?: CalcLevel;
}

/**
 * Tours are filled incrementally; an empty array means "not available yet" and
 * the launcher hides it. Keeps `Record<TourId, …>` closed for type-safety.
 */
export const TOURS: Record<TourId, StepConfig[]> = {
  "calc-basico": [
    { key: "welcome", target: null },
    { key: "material", target: '[data-tutorial="material"]' },
    { key: "print", target: '[data-tutorial="print"]' },
    { key: "sales", target: '[data-tutorial="sales"]' },
    {
      key: "results",
      target: '[data-tutorial="results-sidebar"], [data-tutorial="results"]',
    },
    { key: "export", target: '[data-tutorial="export"]' },
    { key: "complete", target: null },
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
  "dashboard-kpis": [],
  "orcamentos-clientes": [],
  "nivel-avancado": [],
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
