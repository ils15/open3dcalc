/**
 * dataSync.ts — Encrypted export/import for cross-device sync (Issue #55).
 *
 * 100% client-side: no server involved. User data leaves the device only
 * inside an export bundle (optionally encrypted with AES-256-GCM), keeping
 * LGPD compliance since nothing transits through a third party.
 *
 * Encryption spec:
 *  - Algorithm:  AES-256-GCM (window.crypto.subtle)
 *  - Key derivation: PBKDF2, 100.000 iterations, SHA-256
 *  - Salt: 16 random bytes per export
 *  - IV:   12 random bytes per export
 *  - Checksum: SHA-256 of the plaintext JSON (integrity)
 *
 * Zero external dependencies — browser-native Web Crypto only.
 */

export const SYNC_FORMAT = "open3dcalc-export" as const;
export const SYNC_VERSION = "1.0" as const;
/** Kept in sync with package.json version. */
export const APP_VERSION = "1.9.3";

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

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
  encrypted: boolean;
  salt?: string; // base64 — PBKDF2 salt (encrypted bundles)
  iv?: string; // base64 — AES-GCM IV (encrypted bundles)
  checksum?: string; // base64 — SHA-256 of plaintext data
  data: SyncData;
}

export interface EncryptedBundle extends Omit<ExportBundle, "data"> {
  encrypted: true;
  data: string; // base64 — encrypted SyncData
  salt: string;
  iv: string;
  checksum: string;
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
} as const;

/* ------------------------------------------------------------------ */
/*  Base64 helpers                                                     */
/* ------------------------------------------------------------------ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function getRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
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

function readPersistState(key: string): {
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
  return { state: {}, version: 0 };
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
        localStorage.setItem(
          key,
          JSON.stringify({ state: value, version: parsed.version }),
        );
        return;
      }
    } catch {
      /* ignore malformed value */
    }
  }
  localStorage.setItem(key, JSON.stringify(value));
}

/** Patch a persist-wrapped key, keeping its other state fields and version. */
function writePersistState(key: string, patch: Record<string, unknown>): void {
  const { state, version } = readPersistState(key);
  localStorage.setItem(
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
 * Collect all syncable data from localStorage into a SyncData object.
 * Missing/corrupt keys fall back to their empty default so an export
 * never fails because of one bad key.
 */
export function collectSyncData(): SyncData {
  const settings = readPlainJSON<Record<string, unknown>>(KEYS.settings, {});

  const historyRaw = readPlainJSON<unknown>(KEYS.history, null);
  const historyState = unwrapPersist(historyRaw);
  const history = Array.isArray(historyState.entries)
    ? historyState.entries
    : Array.isArray(historyRaw)
      ? historyRaw
      : [];

  const customersRaw = readPlainJSON<unknown>(KEYS.customers, null);
  const customersState = unwrapPersist(customersRaw);
  const customers = Array.isArray(customersState.customers)
    ? customersState.customers
    : Array.isArray(customersRaw)
      ? customersRaw
      : [];

  const quotesRaw = readPlainJSON<unknown>(KEYS.quotes, null);
  const quotesState = unwrapPersist(quotesRaw);
  const quotes = Array.isArray(quotesState.quotes)
    ? quotesState.quotes
    : Array.isArray(quotesRaw)
      ? quotesRaw
      : [];
  const quotesNextNumber =
    typeof quotesState.nextNumber === "number"
      ? quotesState.nextNumber
      : undefined;

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
export function validateBundle(
  data: unknown,
): data is ExportBundle | EncryptedBundle {
  if (!data || typeof data !== "object") return false;
  const b = data as Record<string, unknown>;
  if (b.version !== SYNC_VERSION) return false;
  if (b.format !== SYNC_FORMAT) return false;
  if (typeof b.exportedAt !== "string") return false;
  if (typeof b.appVersion !== "string") return false;
  if (b.platform !== "web" && b.platform !== "electron") return false;
  if (typeof b.encrypted !== "boolean") return false;
  if (b.encrypted) {
    return (
      typeof b.data === "string" &&
      typeof b.salt === "string" &&
      typeof b.iv === "string" &&
      typeof b.checksum === "string"
    );
  }
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

/**
 * Apply imported SyncData to localStorage.
 *
 * Strategy:
 *  - merge:   collections (history/customers/quotes) are unioned and
 *             deduplicated by id (newest wins); settings, theme, dashboard
 *             and sections are replaced by the imported values; catalog
 *             imports only `custom` items, keeping built-ins.
 *  - replace: collections and plain values are fully replaced by the
 *             imported data (built-in catalog items are still preserved).
 *
 * Empty imported categories are ignored in merge mode so a device without
 * data cannot wipe another device's data. Returns the applied categories
 * and the categories where id collisions were resolved.
 */
export function applySyncData(
  data: SyncData,
  mode: "merge" | "replace",
): { imported: string[]; conflicts: string[] } {
  const imported: string[] = [];
  const conflicts: string[] = [];

  if (hasContent(data.settings) || mode === "replace") {
    writeJSON(KEYS.settings, data.settings);
    imported.push("settings");
  }

  if (data.history.length > 0 || mode === "replace") {
    const local = readPersistState(KEYS.history);
    const localEntries = Array.isArray(local.state.entries)
      ? local.state.entries
      : [];
    if (mode === "replace") {
      writePersistState(KEYS.history, { entries: data.history });
    } else {
      const { merged, conflicts: c } = mergeById(localEntries, data.history);
      writePersistState(KEYS.history, { entries: merged });
      if (c > 0) conflicts.push("history");
    }
    imported.push("history");
  }

  if (data.customers.length > 0 || mode === "replace") {
    const local = readPersistState(KEYS.customers);
    const localCustomers = Array.isArray(local.state.customers)
      ? local.state.customers
      : [];
    if (mode === "replace") {
      writePersistState(KEYS.customers, { customers: data.customers });
    } else {
      const { merged, conflicts: c } = mergeById(
        localCustomers,
        data.customers,
      );
      writePersistState(KEYS.customers, { customers: merged });
      if (c > 0) conflicts.push("customers");
    }
    imported.push("customers");
  }

  if (data.quotes.length > 0 || mode === "replace") {
    const local = readPersistState(KEYS.quotes);
    const localQuotes = Array.isArray(local.state.quotes)
      ? local.state.quotes
      : [];
    const localNext =
      typeof local.state.nextNumber === "number" ? local.state.nextNumber : 1;
    const importedNext =
      typeof data.quotesNextNumber === "number" ? data.quotesNextNumber : 1;
    // Next number must be strictly greater than anything used on either
    // device to avoid quote-number collisions.
    const nextNumber = Math.max(localNext, importedNext) + 1;
    if (mode === "replace") {
      writePersistState(KEYS.quotes, { quotes: data.quotes, nextNumber });
    } else {
      const { merged, conflicts: c } = mergeById(localQuotes, data.quotes);
      writePersistState(KEYS.quotes, { quotes: merged, nextNumber });
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
      const { merged, conflicts: c } = mergeById(localProducts, incomingProducts);
      writePersistState(KEYS.products, { products: merged });
      if (c > 0) conflicts.push("products");
    }
    imported.push("products");
  }

  if (data.theme !== "" || mode === "replace") {
    localStorage.setItem(KEYS.theme, data.theme);
    imported.push("theme");
  }

  if (hasContent(data.dashboard) || mode === "replace") {
    const { goal, ...dashboardV1 } = data.dashboard;
    writeJSON(KEYS.dashboard, dashboardV1);
    if (typeof goal === "string" && goal !== "") {
      localStorage.setItem(KEYS.dashboardGoal, goal);
    }
    imported.push("dashboard");
  }

  if (hasContent(data.sections) || mode === "replace") {
    writeJSON(KEYS.sections, data.sections);
    imported.push("sections");
  }

  return { imported, conflicts };
}

/* ------------------------------------------------------------------ */
/*  Crypto helpers (Web Crypto API)                                    */
/* ------------------------------------------------------------------ */

/**
 * Derive an AES-256-GCM key from a password using PBKDF2 (100k iterations,
 * SHA-256) with the given salt.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a string with AES-256-GCM using a fresh random 12-byte IV.
 */
export async function encryptData(
  data: string,
  key: CryptoKey,
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data),
  );
  return { iv, ciphertext };
}

/**
 * Decrypt AES-256-GCM ciphertext. Throws on wrong key or tampered data
 * (GCM authentication failure).
 */
export async function decryptData(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

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
 * Create an export bundle from all localStorage data.
 *
 * With a password the bundle is encrypted (AES-256-GCM + PBKDF2); without
 * one it is stored as plain JSON with a SHA-256 checksum for integrity.
 */
export async function exportBundle(
  password?: string,
  platform?: "web" | "electron",
): Promise<ExportBundle | EncryptedBundle> {
  const syncData = collectSyncData();
  const plaintext = JSON.stringify(syncData);

  const base = {
    version: SYNC_VERSION,
    format: SYNC_FORMAT,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    platform: platform ?? detectPlatform(),
  };

  if (password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await deriveKey(password, salt);
    const { iv, ciphertext } = await encryptData(plaintext, key);
    return {
      ...base,
      encrypted: true,
      data: bytesToBase64(new Uint8Array(ciphertext)),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      checksum: await hashData(plaintext),
    };
  }

  return {
    ...base,
    encrypted: false,
    data: syncData,
    checksum: await hashData(plaintext),
  };
}

function isEncryptedBundle(
  bundle: ExportBundle | EncryptedBundle,
): bundle is EncryptedBundle {
  return (
    bundle.encrypted === true &&
    typeof bundle.salt === "string" &&
    typeof bundle.iv === "string" &&
    typeof bundle.checksum === "string" &&
    typeof bundle.data === "string"
  );
}

/**
 * Validate, decrypt (when needed), verify the checksum and apply a bundle
 * to localStorage. Shared by `importBundle` (merge) and `importData` (UI).
 *
 * Throws PT-BR user-facing errors for: invalid format, missing/wrong
 * password, corrupted data and checksum mismatch.
 */
async function applyImport(
  bundle: ExportBundle | EncryptedBundle,
  password: string | undefined,
  mode: "merge" | "replace",
): Promise<{ imported: string[]; conflicts: string[] }> {
  if (!validateBundle(bundle)) {
    throw new Error(
      "Formato de arquivo de exportação inválido ou não suportado.",
    );
  }

  let syncData: SyncData;

  if (isEncryptedBundle(bundle)) {
    if (!password) {
      throw new Error(
        "Este arquivo está criptografado. Informe a senha para importar.",
      );
    }
    let plaintext: string;
    try {
      const salt = base64ToBytes(bundle.salt);
      const iv = base64ToBytes(bundle.iv);
      const key = await deriveKey(password, salt);
      const ciphertext = base64ToBytes(bundle.data);
      plaintext = await decryptData(ciphertext.buffer as ArrayBuffer, key, iv);
    } catch {
      throw new Error(
        "Senha incorreta ou arquivo corrompido. Não foi possível descriptografar os dados.",
      );
    }
    const checksum = await hashData(plaintext);
    if (checksum !== bundle.checksum) {
      throw new Error(
        "Integridade dos dados comprometida: o checksum não confere. O arquivo pode estar corrompido.",
      );
    }
    try {
      syncData = JSON.parse(plaintext) as SyncData;
    } catch {
      throw new Error(
        "Dados corrompidos: não foi possível interpretar o conteúdo descriptografado.",
      );
    }
    if (!isSyncData(syncData)) {
      throw new Error(
        "Conteúdo do arquivo inválido: a estrutura de dados não é reconhecida.",
      );
    }
  } else {
    syncData = bundle.data;
    if (bundle.checksum) {
      const checksum = await hashData(JSON.stringify(syncData));
      if (checksum !== bundle.checksum) {
        throw new Error(
          "Integridade dos dados comprometida: o checksum não confere. O arquivo pode estar corrompido.",
        );
      }
    }
  }

  return applySyncData(syncData, mode);
}

/**
 * Import a bundle (merge mode): validates format, decrypts when needed,
 * verifies the checksum and applies the data to localStorage.
 */
export async function importBundle(
  bundle: ExportBundle | EncryptedBundle,
  password?: string,
): Promise<{ imported: string[]; conflicts: string[] }> {
  return applyImport(bundle, password, "merge");
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
  code?: "INVALID_FILE" | "WRONG_PASSWORD";
}

function dataSyncError(
  code: "INVALID_FILE" | "WRONG_PASSWORD",
  message: string,
): DataSyncError {
  const err = new Error(message) as DataSyncError;
  err.code = code;
  return err;
}

function triggerDownload(blob: Blob, fileName: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function syncFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `open3dcalc-sync-${stamp}.open3dcalc`;
}

/**
 * UI wrapper: build a bundle from localStorage, trigger the browser
 * download and return file metadata for the success message.
 */
export async function exportData(options: {
  password?: string;
}): Promise<DataSyncExportResult> {
  const bundle = await exportBundle(options.password);
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  const fileName = syncFileName();
  triggerDownload(blob, fileName);
  return { fileName, sizeBytes: blob.size };
}

/**
 * UI wrapper: read a bundle File, import it (merge or replace) and return
 * the applied/conflict counts. Errors carry a `code` so the UI can show the
 * right message ('WRONG_PASSWORD' | 'INVALID_FILE').
 */
export async function importData(
  file: File,
  options: { password?: string; mode: "merge" | "replace" },
): Promise<DataSyncImportResult> {
  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    throw dataSyncError(
      "INVALID_FILE",
      "Formato de arquivo de exportação inválido ou não suportado.",
    );
  }
  if (!validateBundle(bundle)) {
    throw dataSyncError(
      "INVALID_FILE",
      "Formato de arquivo de exportação inválido ou não suportado.",
    );
  }
  try {
    const result = await applyImport(bundle, options.password, options.mode);
    return {
      imported: result.imported.length,
      conflicts: result.conflicts.length,
      errors: 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao importar.";
    const code = /senha|criptografad/i.test(message)
      ? "WRONG_PASSWORD"
      : "INVALID_FILE";
    throw dataSyncError(code, message);
  }
}

/**
 * UI wrapper: peek at a bundle File to tell whether it is encrypted,
 * without decrypting it.
 */
export async function isEncrypted(file: File): Promise<boolean> {
  try {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    return parsed.encrypted === true;
  } catch {
    return false;
  }
}
