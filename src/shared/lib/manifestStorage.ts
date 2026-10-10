/**
 * SPEC-01 gated storage wiring (D1.1 S1).
 *
 * Two narrow choke points that connect the manifest loader to the stores
 * WITHOUT changing store behavior:
 *
 * 1. `manifestStorage()` — a zustand `StateStorage` wrapper around
 *    `localStorage` that runs `checkKey(name)` before every get/set/remove.
 *    Drop-in for the default `persist` storage: same sync semantics, same
 *    JSON handling (delegated to zustand's `createJSONStorage`).
 *
 * 2. `guardedStorage` — a `localStorage`-shaped object for the handful of
 *    stores that call `localStorage` directly. Same API, gate-checked.
 *
 * Gate semantics (see manifestGate): known keys pass through untouched;
 * unknown keys throw in dev and deny-safely in production. Values are never
 * logged — only key names (TEST-MATRIX 3.2).
 */

import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
  type StorageValue,
} from "zustand/middleware";
import {
  checkKey,
  getKeyEntry,
  isPiiKey,
  ManifestError,
} from "./manifestGate.js";
import { isBetaChannel } from "@/shared/config/betaChannel";

/**
 * Ephemeral demo-data mode (onboarding Fase 0).
 *
 * While a demo session is active, the stores are still driven through their
 * REAL actions (addSpool, addEntry, setters…) but every write is intercepted
 * here so nothing ever lands in localStorage/SQLite/manifest — the mode is
 * in-memory only, so there is nothing to inventory, export or erase (LGPD:
 * dado efêmero não é dado pessoal tratado). The choke point stays single:
 * suppression is checked before the backing store is ever touched, and reads
 * keep returning the user's real persisted data.
 */
let demoPersistenceSuppressed = false;

/**
 * Engage/release write suppression. Called only by demoModeStore.
 *
 * Every local adapter checks this single switch before persisting, keeping demo
 * sessions in memory without writing to browser storage or SQLite.
 */
export function setDemoPersistenceSuppressed(value: boolean): void {
  demoPersistenceSuppressed = value;
}

/** True while a demo session owns the stores (writes are no-ops). */
export function isDemoPersistenceSuppressed(): boolean {
  return demoPersistenceSuppressed;
}

/**
 * Is this the Desktop renderer, where user-content stores use the SQLite adapter?
 *
 * Read at CALL time, never cached at module scope: a renderer can be the web
 * target in one build and Electron in another, and the gate must reflect the
 * runtime it is actually running in.
 */
export function isElectronRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Electron")
  );
}

/**
 * Refuse web plaintext PII writes outside the exact policy-approved scope.
 * Stable policy 1.9 explicitly allows the three localStorage user-content
 * entries; other PII remains denied below the UI. Denials log key names only
 * and never touch the backing store.
 *
 * Desktop is out of scope for this slice: its PII path is gated elsewhere and
 * is deliberately left unchanged.
 */
function denyWebPlaintextPiiWrite(key: string): boolean {
  if (isElectronRuntime()) return false;
  const entry = getKeyEntry(key);
  // Only current user-content persistence is allowed through its dedicated
  // adapters. Rollback snapshots use their separately declared manifest key.
  if (!entry || entry.pii !== true || entry.class !== "user_content") {
    return false;
  }
  if (
    entry.persistence === "plaintext_allowed" &&
    entry.surface === "localStorage" &&
    entry.platforms.includes("web")
  ) {
    return false;
  }
  console.warn(
    `[manifestStorage] refused plaintext PII write on web for key "${key}"`,
  );
  return true;
}

const PII_PERSISTED_SCHEMAS: Readonly<
  Record<string, { field: string; version: number }>
> = {
  open3dcalc_customers_v1: { field: "customers", version: 1 },
  open3dcalc_quotes_v1: { field: "quotes", version: 1 },
  open3dcalc_history_v2: { field: "entries", version: 2 },
};

/**
 * The retired disposable-Beta namespace may contain records from earlier
 * previews. Copy a valid record to its Stable/V2 key on first read, then leave
 * the destination as the sole source of truth. Values are never discarded if
 * the destination is already present or the old envelope is malformed.
 */
export const LEGACY_BETA_USER_CONTENT_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

const LEGACY_BETA_PII_KEYS: Readonly<
  Record<string, { key: string; field: string; version: number }>
> = {
  open3dcalc_customers_v1: {
    key: "open3dcalc_beta_test_customers_v1",
    field: "customers",
    version: 1,
  },
  open3dcalc_quotes_v1: {
    key: "open3dcalc_beta_test_quotes_v1",
    field: "quotes",
    version: 1,
  },
  open3dcalc_history_v2: {
    key: "open3dcalc_beta_test_history_v1",
    field: "entries",
    version: 1,
  },
};

function requiredLocalStorage(key: string): Storage {
  if (typeof window === "undefined") {
    throw new Error(`[manifestStorage] localStorage unavailable for "${key}"`);
  }
  try {
    const storage = window.localStorage;
    if (!storage) throw new Error("localStorage unavailable");
    return storage;
  } catch (error) {
    throw new Error(`[manifestStorage] localStorage unavailable for "${key}"`, {
      cause: error,
    });
  }
}

function validateStablePiiKey(key: string): { field: string; version: number } {
  const schema = PII_PERSISTED_SCHEMAS[key];
  const entry = getKeyEntry(key);
  if (
    !schema ||
    !entry ||
    entry.pii !== true ||
    entry.persistence !== "plaintext_allowed" ||
    entry.surface !== "localStorage" ||
    !entry.platforms.includes("web")
  ) {
    throw new ManifestError(
      `[manifestStorage] Stable plaintext persistence is not approved for "${key}"`,
    );
  }
  return schema;
}

function parsePersistedArray(
  raw: string,
  field: string,
  version: number,
): { state: Record<string, unknown>; version: number } {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("state" in parsed) ||
    typeof parsed.state !== "object" ||
    parsed.state === null ||
    Array.isArray(parsed.state) ||
    !Array.isArray((parsed.state as Record<string, unknown>)[field]) ||
    !("version" in parsed) ||
    parsed.version !== version
  ) {
    throw new TypeError("invalid persisted state envelope");
  }
  return parsed as { state: Record<string, unknown>; version: number };
}

function mergeById(
  current: readonly unknown[],
  legacy: readonly unknown[],
): unknown[] {
  const ids = new Set(
    current.flatMap((item) =>
      item &&
      typeof item === "object" &&
      "id" in item &&
      typeof item.id === "string"
        ? [item.id]
        : [],
    ),
  );
  return [
    ...current,
    ...legacy.filter((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return true;
      if (typeof item.id !== "string") return true;
      if (ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    }),
  ];
}

/**
 * Web persistence for the three user-content stores shared by Stable and Beta.
 * Hydration must positively read an empty or valid record before writes are
 * allowed; corrupt or inaccessible bytes remain untouched and writes fail
 * rather than replacing them with the store's initial state.
 */
export function stablePiiPersistStorage<S>(key: string): PersistStorage<S> {
  let readable = false;

  function validateName(name: string): void {
    if (name !== key) {
      throw new Error(`[manifestStorage] unexpected PII key "${name}"`);
    }
  }

  return {
    getItem(name: string): StorageValue<S> | null {
      validateName(name);
      try {
        const schema = validateStablePiiKey(key);
        const storage = requiredLocalStorage(key);
        let raw = storage.getItem(key);
        const legacy = isBetaChannel ? LEGACY_BETA_PII_KEYS[key] : undefined;
        const legacyRaw = legacy ? storage.getItem(legacy.key) : null;
        if (legacy && legacyRaw !== null) {
          const oldRecord = parsePersistedArray(
            legacyRaw,
            legacy.field,
            legacy.version,
          );
          const currentRecord =
            raw === null
              ? null
              : parsePersistedArray(raw, schema.field, schema.version);
          const state = {
            ...oldRecord.state,
            ...currentRecord?.state,
            [schema.field]: mergeById(
              (currentRecord?.state[schema.field] as unknown[] | undefined) ??
                [],
              oldRecord.state[legacy.field] as unknown[],
            ),
          };
          const migrated = JSON.stringify({ state, version: schema.version });
          storage.setItem(key, migrated);
          raw = migrated;
          try {
            storage.removeItem(legacy.key);
          } catch {
            // The validated destination is durable; a stale source copy is
            // safer than failing startup after a successful copy.
          }
        }
        if (raw === null) {
          readable = true;
          return null;
        }

        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("state" in parsed) ||
          typeof parsed.state !== "object" ||
          parsed.state === null ||
          Array.isArray(parsed.state) ||
          !(schema.field in parsed.state) ||
          !Array.isArray(
            (parsed.state as Record<string, unknown>)[schema.field],
          ) ||
          !("version" in parsed) ||
          parsed.version !== schema.version
        ) {
          throw new TypeError("invalid persisted state envelope");
        }

        readable = true;
        return parsed as StorageValue<S>;
      } catch (error) {
        readable = false;
        console.error(`[manifestStorage] failed to hydrate "${key}"`);
        throw new Error(`[manifestStorage] failed to hydrate "${key}"`, {
          cause: error,
        });
      }
    },

    setItem(name: string, value: StorageValue<S>): void {
      validateName(name);
      if (demoPersistenceSuppressed) return;
      if (!readable) {
        throw new Error(
          `[manifestStorage] refusing write before readable hydration for "${key}"`,
        );
      }
      try {
        validateStablePiiKey(key);
        requiredLocalStorage(key).setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`[manifestStorage] failed to persist "${key}"`);
        throw new Error(`[manifestStorage] failed to persist "${key}"`, {
          cause: error,
        });
      }
    },

    removeItem(name: string): void {
      validateName(name);
      if (demoPersistenceSuppressed) return;
      validateStablePiiKey(key);
      requiredLocalStorage(key).removeItem(key);
      readable = true;
    },
  };
}

function rawStorage(): StateStorage {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
}

function gatedStateStorage(): StateStorage {
  const backing = rawStorage();
  return {
    getItem: (name) => {
      // Deny = no-op: dev throws inside checkKey; production returns
      // allowed:false and we never touch the backing store.
      if (!checkKey(name).allowed) return null;
      return backing.getItem(name);
    },
    setItem: (name, value) => {
      // Demo mode: ephemeral by design — never persist.
      if (demoPersistenceSuppressed) return;
      if (denyWebPlaintextPiiWrite(name)) return;
      if (!checkKey(name).allowed) return;
      backing.setItem(name, value);
    },
    removeItem: (name) => {
      if (demoPersistenceSuppressed) return;
      if (!checkKey(name).allowed) return;
      backing.removeItem(name);
    },
  };
}

/**
 * Drop-in zustand persist storage with manifest key-checking.
 * Identical to zustand's default (`createJSONStorage(() => localStorage)`)
 * except every key is validated against SPEC-01 first.
 */
export function manifestStorage<S>(): PersistStorage<S, unknown> | undefined {
  return createJSONStorage<S>(() => gatedStateStorage());
}

/**
 * `localStorage`-shaped facade with per-key manifest checks, for stores
 * that touch `localStorage` directly. API-compatible for get/set/remove.
 * Like `rawStorage()`, an unavailable backing store degrades to no-ops
 * (reads return null) — storage failure never crashes the app.
 */
export const guardedStorage = {
  getItem(key: string): string | null {
    const backing = rawStorage();
    if (!checkKey(key).allowed) return null;
    // rawStorage() is always the synchronous window.localStorage (or the
    // no-op stub), so the Promise variant of StateStorage never occurs.
    return backing.getItem(key) as string | null;
  },
  setItem(key: string, value: string): void {
    // Demo mode: ephemeral by design — never persist.
    if (demoPersistenceSuppressed) return;
    if (denyWebPlaintextPiiWrite(key)) return;
    const backing = rawStorage();
    if (!checkKey(key).allowed) return;
    backing.setItem(key, value);
  },
  removeItem(key: string): void {
    if (demoPersistenceSuppressed) return;
    const backing = rawStorage();
    if (!checkKey(key).allowed) return;
    backing.removeItem(key);
  },
};

/**
 * Sync-scoped sibling of `guardedStorage` that refuses to WRITE a
 * manifest-declared PII key as plaintext.
 *
 * User-content stores have dedicated persistence adapters. This wrapper keeps
 * declared PII keys out of the generic sync-storage write path, while every
 * non-PII key is delegated to `guardedStorage` unchanged.
 */
export const guardedSyncStorage = {
  getItem(key: string): string | null {
    if (isBetaChannel) return null;
    return guardedStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (isBetaChannel) {
      console.warn("[manifestStorage] sync storage is unavailable in Beta");
      return;
    }
    if (isPiiKey(key)) {
      const message = `refused plaintext PII write for sync key "${key}"`;
      console.warn(`[manifestStorage] ${message}`);
      if (
        typeof process !== "undefined" &&
        process?.env?.NODE_ENV !== "production"
      ) {
        throw new ManifestError(message);
      }
      return;
    }
    guardedStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (isBetaChannel) return;
    guardedStorage.removeItem(key);
  },
};
