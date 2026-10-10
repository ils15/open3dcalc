/** Local JSON export/import for user data. Files and local storage are readable. */

import { guardedSyncStorage } from "@/shared/lib/manifestStorage";
import { downloadBlob } from "./download";
import { APP_VERSION } from "@/shared/version";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { cancelPendingAutoSave } from "@/shared/stores/calculatorStore.helpers";
import { computeValidatedStoreResults } from "@/shared/stores/calculatorStore.validation";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useProductInventory } from "@/shared/stores/productInventory";
import type { Customer, HistoryEntry, Quote } from "@/shared/types";
import {
  useColorPalette,
  type CustomColor,
} from "@/shared/stores/colorPalette";
import { useModelComparison } from "@/shared/stores/modelComparison";
import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";

export const SYNC_FORMAT = "open3dcalc-export" as const;
export const SYNC_VERSION = "1.0" as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SyncData {
  settings: Record<string, unknown>; // open3dcalc_settings_v2
  history: unknown[]; // open3dcalc_history_v2 entries
  customers: unknown[]; // open3dcalc_customers_v1 customers
  quotes: unknown[]; // open3dcalc_quotes_v1 quotes
  /**
   * Next quote number, carried alongside quotes so the import merge can
   * avoid collisions via `Math.max(local, imported) + 1`.
   * Optional for backward compatibility with older bundles.
   */
  quotesNextNumber?: number;
  catalog: {
    printers: unknown[];
    materials: unknown[];
    marketplaces: unknown[];
  }; // open3dcalc_catalog_v1 (only custom: true)
  filaments: unknown[]; // open3dcalc_filaments
  /**
   * Product inventory. Optional for backward compatibility with bundles
   * exported before Issue #68.
   */
  products?: unknown[]; // open3dcalc_products (zustand persist wrapper)
  /** Optional in v1.0 bundles created before these manifest keys were supported. */
  colorPalette?: unknown[]; // open3dcalc_color_palette_v1
  modelComparison?: unknown[]; // open3dcalc_model_comparison.entries
  theme: string; // open3dcalc_theme
  dashboard: Record<string, unknown>; // open3dcalc_dashboard_v1 + goal
  sections: Record<string, boolean>; // open3dcalc_sections
}

export interface ExportBundle {
  version: "1.0";
  format: "open3dcalc-export";
  exportedAt: string; // ISO timestamp
  appVersion: string;
  platform: "web" | "electron";
  checksum?: string; // base64 — SHA-256 of plaintext data
  data: SyncData;
}

/* ------------------------------------------------------------------ */
/*  localStorage keys                                                  */
/* ------------------------------------------------------------------ */

const KEYS = {
  settings: "open3dcalc_settings_v2",
  history: "open3dcalc_history_v2",
  customers: "open3dcalc_customers_v1",
  quotes: "open3dcalc_quotes_v1",
  catalog: "open3dcalc_catalog_v1",
  filaments: "open3dcalc_filaments",
  products: "open3dcalc_products",
  theme: "open3dcalc_theme",
  dashboard: "open3dcalc_dashboard_v1",
  dashboardGoal: "open3dcalc_dashboard_goal",
  sections: "open3dcalc_sections",
  colorPalette: "open3dcalc_color_palette_v1",
  modelComparison: "open3dcalc_model_comparison",
} as const;

/**
 * Persist-wrapper versions for the NON-PII keys that are still plain JSON in
 * `localStorage`. The PII keys are no longer read or written here.
 */
const PERSIST_VERSIONS: Partial<
  Record<(typeof KEYS)[keyof typeof KEYS], number>
> = {
  [KEYS.products]: 1,
  [KEYS.modelComparison]: 1,
};

/* ------------------------------------------------------------------ */
/*  Base64 helpers                                                     */
/* ------------------------------------------------------------------ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function getRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return guardedSyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Zustand persist stores (history/customers/quotes) write a wrapper:
 * `{ state: {...}, version: N }`. Settings, catalog, dashboard, sections
 * and filaments are stored as plain JSON.
 */
function isPersistWrapper(
  value: unknown,
): value is { state: Record<string, unknown>; version: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    !!v.state && typeof v.state === "object" && typeof v.version === "number"
  );
}

function readPlainJSON<T>(key: string, def: T): T {
  const raw = getRaw(key);
  if (raw === null) return def;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return def;
  }
}

function readPersistState(key: (typeof KEYS)[keyof typeof KEYS]): {
  state: Record<string, unknown>;
  version: number;
} {
  const raw = getRaw(key);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (isPersistWrapper(parsed))
        return { state: parsed.state, version: parsed.version };
    } catch {
      /* ignore malformed value */
    }
  }
  return { state: {}, version: PERSIST_VERSIONS[key] ?? 0 };
}

/** Unwrap a zustand persist wrapper; falls back to the raw object. */
function unwrapPersist(value: unknown): Record<string, unknown> {
  if (isPersistWrapper(value)) return value.state;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Write a plain-JSON key. If the key previously held a zustand persist
 * wrapper, the wrapper shape is preserved so stores keep hydrating.
 */
function writeJSON(key: string, value: unknown): void {
  const raw = getRaw(key);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (isPersistWrapper(parsed)) {
        guardedSyncStorage.setItem(
          key,
          JSON.stringify({ state: value, version: parsed.version }),
        );
        return;
      }
    } catch {
      /* ignore malformed value */
    }
  }
  guardedSyncStorage.setItem(key, JSON.stringify(value));
}

/**
 * Patch a persist-wrapped NON-PII key, keeping its other state fields and
 * version. PII keys never reach here — they are applied through their stores.
 */
function writePersistState(
  key: (typeof KEYS)[keyof typeof KEYS],
  patch: Record<string, unknown>,
): void {
  const { state, version } = readPersistState(key);
  guardedSyncStorage.setItem(
    key,
    JSON.stringify({ state: { ...state, ...patch }, version }),
  );
}

function isCustomItem(item: unknown): boolean {
  return (
    !!item &&
    typeof item === "object" &&
    (item as { custom?: unknown }).custom === true
  );
}

/* ------------------------------------------------------------------ */
/*  Collection — gather every user datum from localStorage             */
/* ------------------------------------------------------------------ */

/**
 * Collect every supported category. Customers, quotes and history come from
 * the app's ordinary local stores. Missing/corrupt JSON preferences fall back
 * to empty defaults.
 */
export function collectSyncData(): SyncData {
  const settings = readPlainJSON<Record<string, unknown>>(KEYS.settings, {});

  const history = useHistoryStore.getState().entries;
  const customers = useCustomerStore.getState().customers;
  const quotes = useQuoteStore.getState().quotes;
  const nextNumber = useQuoteStore.getState().nextNumber;
  // Omitted for a fresh store (nextNumber defaults to 1) so an empty export
  // keeps the historical shape; carried once at least one quote exists.
  const quotesNextNumber =
    typeof nextNumber === "number" && nextNumber > 1 ? nextNumber : undefined;

  const catalog = readPlainJSON<{
    printers?: unknown[];
    materials?: unknown[];
    marketplaces?: unknown[];
  }>(KEYS.catalog, {});

  const filamentsRaw = readPlainJSON<unknown>(KEYS.filaments, []);

  const productsRaw = readPlainJSON<unknown>(KEYS.products, null);
  const productsState = unwrapPersist(productsRaw);
  const products = Array.isArray(productsState.products)
    ? productsState.products
    : Array.isArray(productsRaw)
      ? productsRaw
      : [];

  const modelComparisonRaw = readPlainJSON<unknown>(KEYS.modelComparison, null);
  const modelComparisonState = unwrapPersist(modelComparisonRaw);
  const modelComparison = Array.isArray(modelComparisonState.entries)
    ? modelComparisonState.entries
    : Array.isArray(modelComparisonRaw)
      ? modelComparisonRaw
      : [];

  const dashboardRaw = readPlainJSON<Record<string, unknown>>(
    KEYS.dashboard,
    {},
  );
  const goal = getRaw(KEYS.dashboardGoal);
  const dashboard =
    goal === null ? { ...dashboardRaw } : { ...dashboardRaw, goal };

  const sections = readPlainJSON<Record<string, boolean>>(KEYS.sections, {});

  return {
    settings,
    history,
    customers,
    quotes,
    ...(quotesNextNumber !== undefined ? { quotesNextNumber } : {}),
    catalog: {
      // Only custom items are exported — built-ins are app defaults and
      // must not be duplicated on import.
      printers: catalog.printers?.filter(isCustomItem) ?? [],
      materials: catalog.materials?.filter(isCustomItem) ?? [],
      marketplaces: catalog.marketplaces?.filter(isCustomItem) ?? [],
    },
    filaments: Array.isArray(filamentsRaw) ? filamentsRaw : [],
    products,
    colorPalette: readPlainJSON<unknown[]>(KEYS.colorPalette, []),
    modelComparison,
    theme: getRaw(KEYS.theme) ?? "",
    dashboard,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function isSyncData(value: unknown): value is SyncData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  const supportedFields = new Set([
    "settings",
    "history",
    "customers",
    "quotes",
    "quotesNextNumber",
    "catalog",
    "filaments",
    "products",
    "colorPalette",
    "modelComparison",
    "theme",
    "dashboard",
    "sections",
  ]);
  if (Object.keys(d).some((key) => !supportedFields.has(key))) return false;
  if (
    !d.settings ||
    typeof d.settings !== "object" ||
    Array.isArray(d.settings)
  )
    return false;
  if (!Array.isArray(d.history)) return false;
  if (!Array.isArray(d.customers)) return false;
  if (!Array.isArray(d.quotes)) return false;
  if (!Array.isArray(d.filaments)) return false;
  if (d.products !== undefined && !Array.isArray(d.products)) return false;
  if (d.colorPalette !== undefined && !Array.isArray(d.colorPalette))
    return false;
  if (d.modelComparison !== undefined && !Array.isArray(d.modelComparison))
    return false;
  if (
    d.quotesNextNumber !== undefined &&
    (typeof d.quotesNextNumber !== "number" ||
      !Number.isFinite(d.quotesNextNumber) ||
      d.quotesNextNumber < 1)
  )
    return false;
  if (typeof d.theme !== "string") return false;
  if (
    !d.dashboard ||
    typeof d.dashboard !== "object" ||
    Array.isArray(d.dashboard)
  )
    return false;
  if (
    !d.sections ||
    typeof d.sections !== "object" ||
    Array.isArray(d.sections)
  )
    return false;
  if (Object.values(d.sections).some((enabled) => typeof enabled !== "boolean"))
    return false;
  const catalog = d.catalog;
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
    return false;
  const c = catalog as Record<string, unknown>;
  return (
    Array.isArray(c.printers) &&
    Array.isArray(c.materials) &&
    Array.isArray(c.marketplaces)
  );
}

/**
 * Validate a bundle's format and version. Acts as a TS type guard.
 */
export function validateBundle(data: unknown): data is ExportBundle {
  if (!data || typeof data !== "object") return false;
  const b = data as Record<string, unknown>;
  if (b.version !== SYNC_VERSION) return false;
  if (b.format !== SYNC_FORMAT) return false;
  if (typeof b.exportedAt !== "string") return false;
  if (typeof b.appVersion !== "string") return false;
  if (b.platform !== "web" && b.platform !== "electron") return false;
  return isSyncData(b.data);
}

/* ------------------------------------------------------------------ */
/*  Merge strategy                                                     */
/* ------------------------------------------------------------------ */

function itemTimestamp(item: unknown): number {
  const it = item as {
    timestamp?: unknown;
    updatedAt?: unknown;
    createdAt?: unknown;
  };
  if (typeof it.timestamp === "number") return it.timestamp;
  if (typeof it.updatedAt === "number") return it.updatedAt;
  if (typeof it.createdAt === "number") return it.createdAt;
  return 0;
}

function isNewer(a: unknown, b: unknown): boolean {
  return itemTimestamp(a) > itemTimestamp(b);
}

function itemId(item: unknown): string | null {
  const id = (item as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Deduplicate two collections by `id`, keeping the newest item
 * (by timestamp/updatedAt/createdAt). Items without an id are appended.
 */
function mergeById(
  local: unknown[],
  imported: unknown[],
): {
  merged: unknown[];
  conflicts: number;
} {
  const byId = new Map<string, unknown>();
  const withoutId: unknown[] = [];
  let conflicts = 0;

  for (const item of local) {
    const id = itemId(item);
    if (id) byId.set(id, item);
    else withoutId.push(item);
  }
  for (const item of imported) {
    const id = itemId(item);
    if (!id) {
      withoutId.push(item);
      continue;
    }
    const existing = byId.get(id);
    if (existing) {
      conflicts++;
      if (isNewer(item, existing)) byId.set(id, item);
    } else {
      byId.set(id, item);
    }
  }
  return { merged: [...byId.values(), ...withoutId], conflicts };
}

function applyCatalog(
  data: SyncData["catalog"],
  mode: "merge" | "replace",
): { conflicts: number } | null {
  const local = readPlainJSON<{
    printers?: unknown[];
    materials?: unknown[];
    marketplaces?: unknown[];
  }>(KEYS.catalog, {});
  const localPrinters = Array.isArray(local.printers) ? local.printers : [];
  const localMaterials = Array.isArray(local.materials) ? local.materials : [];
  const localMarketplaces = Array.isArray(local.marketplaces)
    ? local.marketplaces
    : [];

  const importedPrinters = data.printers.filter(isCustomItem);
  const importedMaterials = data.materials.filter(isCustomItem);
  const importedMarketplaces = data.marketplaces.filter(isCustomItem);

  const empty =
    importedPrinters.length === 0 &&
    importedMaterials.length === 0 &&
    importedMarketplaces.length === 0;
  if (empty && mode !== "replace") return null;

  let conflicts = 0;
  const mergeCustom = (
    localArr: unknown[],
    importedArr: unknown[],
  ): unknown[] => {
    // Built-in items (custom !== true) are always preserved.
    const builtIn = localArr.filter((i) => !isCustomItem(i));
    if (mode === "replace") return [...builtIn, ...importedArr];
    const result = mergeById(localArr, importedArr);
    conflicts += result.conflicts;
    return result.merged;
  };

  writeJSON(KEYS.catalog, {
    printers: mergeCustom(localPrinters, importedPrinters),
    materials: mergeCustom(localMaterials, importedMaterials),
    marketplaces: mergeCustom(localMarketplaces, importedMarketplaces),
  });
  return { conflicts };
}

function hasContent(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

export interface ApplySyncDataResult {
  /** Categories applied. */
  imported: string[];
  /** Categories where id collisions were resolved. */
  conflicts: string[];
}

/**
 * Apply imported SyncData.
 *
 * Strategy:
 *  - merge:   collections (history/customers/quotes) are unioned and
 *             deduplicated by id (newest wins); settings, theme, dashboard
 *             and sections are replaced by the imported values; catalog
 *             imports only `custom` items, keeping built-ins.
 *  - replace: collections and plain values are fully replaced by the
 *             imported data (built-in catalog items are still preserved).
 *
 * Customer, quote and history categories are written through their ordinary
 * store persistence adapters.
 *
 * Empty imported categories are ignored in merge mode so a device without
 * data cannot wipe another device's data.
 */
export function applySyncData(
  data: SyncData,
  mode: "merge" | "replace",
): ApplySyncDataResult {
  const imported: string[] = [];
  const conflicts: string[] = [];

  if (hasContent(data.settings) || mode === "replace") {
    writeJSON(KEYS.settings, data.settings);
    imported.push("settings");
  }

  if (data.history.length > 0 || mode === "replace") {
    const localEntries = useHistoryStore.getState().entries;
    if (mode === "replace") {
      useHistoryStore.setState({ entries: data.history as HistoryEntry[] });
    } else {
      const { merged, conflicts: c } = mergeById(localEntries, data.history);
      useHistoryStore.setState({ entries: merged as HistoryEntry[] });
      if (c > 0) conflicts.push("history");
    }
    imported.push("history");
  }

  if (data.customers.length > 0 || mode === "replace") {
    const localCustomers = useCustomerStore.getState().customers;
    if (mode === "replace") {
      useCustomerStore.setState({
        customers: data.customers as Customer[],
      });
    } else {
      const { merged, conflicts: c } = mergeById(
        localCustomers,
        data.customers,
      );
      useCustomerStore.setState({ customers: merged as Customer[] });
      if (c > 0) conflicts.push("customers");
    }
    imported.push("customers");
  }

  if (data.quotes.length > 0 || mode === "replace") {
    const quoteState = useQuoteStore.getState();
    const localNext =
      typeof quoteState.nextNumber === "number" ? quoteState.nextNumber : 1;
    const importedNext =
      typeof data.quotesNextNumber === "number" ? data.quotesNextNumber : 1;
    if (mode === "replace") {
      const minimumNext = data.quotes.reduce<number>((maximum, quote) => {
        const number = (quote as { number?: unknown } | null)?.number;
        return typeof number === "number"
          ? Math.max(maximum, number + 1)
          : maximum;
      }, 1);
      useQuoteStore.setState({
        quotes: data.quotes as Quote[],
        nextNumber: Math.max(importedNext, minimumNext),
      });
    } else {
      // A merge must avoid collisions with quote numbers from either device.
      const nextNumber = Math.max(localNext, importedNext) + 1;
      const { merged, conflicts: c } = mergeById(
        quoteState.quotes,
        data.quotes,
      );
      useQuoteStore.setState({
        quotes: merged as Quote[],
        nextNumber,
      });
      if (c > 0) conflicts.push("quotes");
    }
    imported.push("quotes");
  }

  const catalogResult = applyCatalog(data.catalog, mode);
  if (catalogResult) {
    imported.push("catalog");
    if (catalogResult.conflicts > 0) conflicts.push("catalog");
  }

  if (data.filaments.length > 0 || mode === "replace") {
    const local = readPlainJSON<unknown[]>(KEYS.filaments, []);
    const localArr = Array.isArray(local) ? local : [];
    if (mode === "replace") {
      writeJSON(KEYS.filaments, data.filaments);
    } else {
      const { merged, conflicts: c } = mergeById(localArr, data.filaments);
      writeJSON(KEYS.filaments, merged);
      if (c > 0) conflicts.push("filaments");
    }
    imported.push("filaments");
  }

  const incomingProducts = data.products ?? [];
  if (incomingProducts.length > 0 || mode === "replace") {
    const local = readPersistState(KEYS.products);
    const localProducts = Array.isArray(local.state.products)
      ? local.state.products
      : [];
    if (mode === "replace") {
      writePersistState(KEYS.products, { products: incomingProducts });
    } else {
      const { merged, conflicts: c } = mergeById(
        localProducts,
        incomingProducts,
      );
      writePersistState(KEYS.products, { products: merged });
      if (c > 0) conflicts.push("products");
    }
    imported.push("products");
  }

  if (data.theme !== "" || mode === "replace") {
    guardedSyncStorage.setItem(KEYS.theme, data.theme);
    imported.push("theme");
  }

  if (hasContent(data.dashboard) || mode === "replace") {
    const { goal, ...dashboardV1 } = data.dashboard;
    writeJSON(KEYS.dashboard, dashboardV1);
    if (typeof goal === "string" && goal !== "") {
      guardedSyncStorage.setItem(KEYS.dashboardGoal, goal);
    }
    imported.push("dashboard");
  }

  if (hasContent(data.sections) || mode === "replace") {
    writeJSON(KEYS.sections, data.sections);
    imported.push("sections");
  }

  const incomingColors = data.colorPalette ?? [];
  if (incomingColors.length > 0 || mode === "replace") {
    const localColors = readPlainJSON<unknown[]>(KEYS.colorPalette, []);
    if (mode === "replace") {
      writeJSON(KEYS.colorPalette, incomingColors);
    } else {
      const { merged, conflicts: c } = mergeById(localColors, incomingColors);
      writeJSON(KEYS.colorPalette, merged);
      if (c > 0) conflicts.push("colorPalette");
    }
    imported.push("colorPalette");
  }

  const incomingComparisons = data.modelComparison ?? [];
  if (incomingComparisons.length > 0 || mode === "replace") {
    const local = readPersistState(KEYS.modelComparison);
    const localEntries = Array.isArray(local.state.entries)
      ? local.state.entries
      : [];
    if (mode === "replace") {
      writePersistState(KEYS.modelComparison, { entries: incomingComparisons });
    } else {
      const { merged, conflicts: c } = mergeById(
        localEntries,
        incomingComparisons,
      );
      writePersistState(KEYS.modelComparison, { entries: merged });
      if (c > 0) conflicts.push("modelComparison");
    }
    imported.push("modelComparison");
  }

  synchronizeActiveStores(data, mode);

  return { imported, conflicts };
}

const CALCULATOR_SETTING_KEYS = [
  "activeTab",
  "fdmMaterial",
  "fdmPrintParams",
  "fdmSlicerProfile",
  "fdmFilament",
  "fdmMachine",
  "fdmHardware",
  "fdmFinishing",
  "fdmLabor",
  "fdmExtras",
  "fdmSales",
  "fdmOps",
  "fdmSoft",
  "resinMaterial",
  "resinPrintParams",
  "resinPostProcess",
  "resinMachine",
  "resinHardware",
  "resinLabor",
  "resinExtras",
  "resinSales",
  "resinOps",
  "resinSoft",
  "fdmAmsSlots",
  "fixedCosts",
  "productName",
  "quantity",
  "infillPercent",
  "targetMarginMode",
  "enabledSections",
  "calcLevel",
  "hiddenFields",
  "currency",
] as const;

function synchronizeActiveStores(
  data: SyncData,
  mode: "merge" | "replace",
): void {
  // The three PII stores are written directly by `applySyncData`; their
  // in-memory state IS the imported result. Rehydrating them here would
  // overwrite that state with the just-imported local storage snapshot.
  // Products and model comparison are rehydrated separately.
  useProductInventory.persist.rehydrate();
  useModelComparison.persist.rehydrate();
  useColorPalette.setState({
    colors: readPlainJSON<CustomColor[]>(KEYS.colorPalette, []),
  });

  if (!hasContent(data.settings) && mode !== "replace") return;

  cancelPendingAutoSave();
  let current = useCalculatorStore.getState();
  if (mode === "replace") {
    const undoHistory = current.history;
    current.resetCalculator();
    cancelPendingAutoSave();
    useCalculatorStore.setState({
      activeTab: "fdm",
      calcLevel: "basic",
      hiddenFields: [],
      currency: "auto",
      enabledSections: {
        material: true,
        energy: true,
        machine: true,
        hardware: true,
        consumables: true,
        labor: true,
        software: true,
        failure: true,
        extras: true,
        postProcessing: true,
        packaging: true,
        shipping: true,
      },
      history: undoHistory,
    });
    current = useCalculatorStore.getState();
  }
  const merged: Record<string, unknown> = { ...current };
  for (const key of CALCULATOR_SETTING_KEYS) {
    if (Object.hasOwn(data.settings, key)) merged[key] = data.settings[key];
  }

  const selectedPrinterId = data.settings.selectedPrinterId;
  if (typeof selectedPrinterId === "string") {
    const selected =
      printers.find((printer) => printer.id === selectedPrinterId) ??
      data.catalog.printers.find(
        (printer) =>
          !!printer &&
          typeof printer === "object" &&
          (printer as { id?: unknown }).id === selectedPrinterId,
      );
    if (selected) merged.selectedPrinter = selected;
  }
  const selectedMarketplaceId = data.settings.selectedMarketplaceId;
  if (typeof selectedMarketplaceId === "string") {
    const selected =
      marketplaces.find(
        (marketplace) => marketplace.id === selectedMarketplaceId,
      ) ??
      data.catalog.marketplaces.find(
        (marketplace) =>
          !!marketplace &&
          typeof marketplace === "object" &&
          (marketplace as { id?: unknown }).id === selectedMarketplaceId,
      );
    if (selected) merged.selectedMarketplace = selected;
  }

  const validated = computeValidatedStoreResults(merged);
  useCalculatorStore.setState({
    ...merged,
    ...validated.input,
    results: validated.results,
    calculationIssues: validated.calculationIssues,
  });
}

/* ------------------------------------------------------------------ */
/*  SHA-256 integrity checksum helper (Web Crypto digest API)            */
/* ------------------------------------------------------------------ */

/** SHA-256 checksum of a string, returned base64. */
export async function hashData(data: string): Promise<string> {
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return bytesToBase64(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ */
/*  Export / import                                                    */
/* ------------------------------------------------------------------ */

function detectPlatform(): "web" | "electron" {
  if (
    typeof navigator !== "undefined" &&
    /electron/i.test(navigator.userAgent)
  ) {
    return "electron";
  }
  return "web";
}

/**
 * Create a readable JSON export bundle. The checksum detects accidental
 * corruption; it does not protect file contents.
 */
export async function exportBundle(
  platform?: "web" | "electron",
): Promise<ExportBundle> {
  const syncData = collectSyncData();
  const plaintext = JSON.stringify(syncData);

  const base = {
    version: SYNC_VERSION,
    format: SYNC_FORMAT,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    platform: platform ?? detectPlatform(),
  };

  return {
    ...base,
    data: syncData,
    checksum: await hashData(plaintext),
  };
}

/**
 * Validate, verify the checksum and apply a bundle
 * into the app's local stores. Shared by `importBundle` (merge) and
 * `importData` (UI).
 *
 * Throws PT-BR user-facing errors for invalid format, corrupted data and
 * checksum mismatch. Legacy encrypted bundles are not supported.
 */
async function applyImport(
  bundle: ExportBundle,
  mode: "merge" | "replace",
): Promise<ApplySyncDataResult> {
  if (!validateBundle(bundle)) {
    throw new Error(
      "Formato de arquivo de exportação inválido ou não suportado.",
    );
  }

  const syncData = bundle.data;
  if (bundle.checksum) {
    const checksum = await hashData(JSON.stringify(syncData));
    if (checksum !== bundle.checksum) {
      throw new Error(
        "Integridade dos dados comprometida: o checksum não confere. O arquivo pode estar corrompido.",
      );
    }
  }

  return applySyncData(syncData, mode);
}

/**
 * Import a readable bundle (merge mode): validates format, verifies the
 * checksum and applies the data. Non-PII keys land in
 * `localStorage` or the platform's local database adapter.
 */
export async function importBundle(
  bundle: ExportBundle,
): Promise<ApplySyncDataResult> {
  return applyImport(bundle, "merge");
}

/* ------------------------------------------------------------------ */
/*  UI-facing wrapper (contract with DataSyncModal)                    */
/* ------------------------------------------------------------------ */

export interface DataSyncExportResult {
  fileName: string;
  sizeBytes: number;
}

export interface DataSyncImportResult {
  imported: number;
  conflicts: number;
  errors: number;
}

export interface DataSyncError extends Error {
  code?: "INVALID_FILE";
}

function dataSyncError(message: string): DataSyncError {
  const err = new Error(message) as DataSyncError;
  err.code = "INVALID_FILE";
  return err;
}

/**
 * O único caminho de Blob → arquivo é o choke point `downloadBlob`: ele recusa
 * (e explica) enquanto o modo demo está ativo. Manter um funil privado aqui
 * burlaria o guard de exportação por construção.
 */
function triggerDownload(blob: Blob, fileName: string): void {
  if (typeof document === "undefined") return;
  downloadBlob(blob, fileName);
}

function syncFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `open3dcalc-sync-${stamp}.open3dcalc`;
}

/**
 * UI wrapper: create a plain JSON bundle, trigger the browser download and
 * return file metadata for the success message.
 */
export async function exportData(): Promise<DataSyncExportResult> {
  const bundle = await exportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const fileName = syncFileName();
  triggerDownload(blob, fileName);
  return { fileName, sizeBytes: blob.size };
}

/**
 * UI wrapper: read a bundle File, import it (merge or replace) and return
 * the applied/conflict counts. Errors carry a `code` so the UI can show the
 * right message ('INVALID_FILE').
 *
 * Accepts readable v1.0 bundles only. Legacy encrypted exports are unsupported;
 * readable v1.0 files remain importable, including those with the old
 * `encrypted: false` marker.
 */
export async function importData(
  file: File,
  options: { mode: "merge" | "replace" },
): Promise<DataSyncImportResult> {
  const fileText = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw dataSyncError(
      "Formato de arquivo de exportação inválido ou não suportado.",
    );
  }

  if (!validateBundle(parsed)) {
    throw dataSyncError(
      "Este arquivo não é um backup JSON legível compatível.",
    );
  }
  try {
    const result = await applyImport(parsed, options.mode);
    return {
      imported: result.imported.length,
      conflicts: result.conflicts.length,
      errors: 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao importar.";
    throw dataSyncError(message);
  }
}
