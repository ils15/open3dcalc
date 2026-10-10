/**
 * Desktop adapter for the passwordless new-PII route (Beta12 Phase4).
 *
 * The thinnest renderer-side seam over `window.electronAPI.piiNew`. It exists so
 * that:
 *
 *  1. **Web is blocked below the UI.** The web build has no `piiNew` member, so
 *     `getNewPiiRoute()` returns null and every load/save throws
 *     `NewPiiRouteUnavailableError`. No policy lives in a component.
 *  2. **The renderer cannot invent a key.** Callers name a logical domain; only
 *     `NEW_PII_DOMAIN_KEYS` maps it to an authorised storage key. The main
 *     process re-authorises the exact key anyway.
 *  3. **Absence is not success.** A missing/unknown route is a typed refusal,
 *     never a silent no-op: a PII write that "succeeded" into nothing would read
 *     as saved and vanish on reload.
 *
 * The Desktop app installs this adapter for the customer, quote and history
 * stores. Web never installs it; a missing or refused route never falls back to
 * or legacy local-data rows.
 */

import {
  NEW_PII_DOMAIN_KEYS,
  type NewPiiDomain,
  type NewPiiStorageKey,
} from "@/shared/lib/localData/newPiiNamespace";
import { isWithdrawalPending } from "@/shared/lib/localDataLifecycle";
import { getPiiStoreHydrationStatus } from "@/shared/lib/localPiiPersistence";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { isBetaChannel } from "@/shared/config/betaChannel";

/** The gate verdict the main process reports. Metadata only. */
export type NewPiiCapability =
  { available: true; backend: string } | { available: false; reason: string };

/** The `piiNew` member of the preload bridge. */
export interface NewPiiRoute {
  capability(): Promise<{
    available: boolean;
    backend?: string;
    reason?: string;
  }>;
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
}

/** A reason the adapter itself produces (not a main-process gate code). */
export const NEW_PII_ROUTE_UNAVAILABLE = "route_unavailable";
export const NEW_PII_ROUTE_ERROR = "route_error";
const REFUSED_BACKENDS = new Set(["memory_only", "blocked"]);
export const NEW_PII_RECORD_SAVED_EVENT = "open3dcalc:new-pii-record-saved";

/** Raised when the route is absent or fails at the boundary. */
export class NewPiiRouteUnavailableError extends Error {
  readonly code = "new_pii_route_unavailable";
  readonly reason: string;
  constructor(reason: string) {
    super(`[newPiiStorage] route unavailable (${reason})`);
    this.name = "NewPiiRouteUnavailableError";
    this.reason = reason;
  }
}

/** The route, or null on the web build / a preload without it. */
export function getNewPiiRoute(): NewPiiRoute | null {
  if (isBetaChannel) return null;
  if (typeof window === "undefined") return null;
  const api = window.electronAPI?.piiNew;
  return api ?? null;
}

/** True only on the Desktop build with the new route present. */
export function isNewPiiRoutePresent(): boolean {
  return getNewPiiRoute() !== null;
}

/** The authorised storage key for a logical PII domain. */
export function newPiiKeyFor(domain: NewPiiDomain): NewPiiStorageKey {
  return NEW_PII_DOMAIN_KEYS[domain];
}

/**
 * The gate verdict, never throwing: a UI asking "is the passwordless path
 * available?" must render a state, not crash.
 */
export async function getNewPiiCapability(): Promise<NewPiiCapability> {
  if (isWithdrawalPending()) {
    return { available: false, reason: "withdrawal_pending" };
  }
  const route = getNewPiiRoute();
  if (route === null) {
    return { available: false, reason: NEW_PII_ROUTE_UNAVAILABLE };
  }
  try {
    const verdict = await route.capability();
    if (verdict.available === true && typeof verdict.backend === "string") {
      const backend = verdict.backend.trim();
      if (backend.length === 0) {
        return { available: false, reason: NEW_PII_ROUTE_ERROR };
      }
      if (REFUSED_BACKENDS.has(backend.toLowerCase())) {
        return { available: false, reason: backend.toLowerCase() };
      }
      return { available: true, backend };
    }
    return {
      available: false,
      reason: verdict.reason ?? NEW_PII_ROUTE_ERROR,
    };
  } catch {
    return { available: false, reason: NEW_PII_ROUTE_ERROR };
  }
}

/** Open a new-PII record, or null when absent. Throws when the route is absent. */
export async function loadNewPii(
  key: NewPiiStorageKey,
): Promise<string | null> {
  const route = await requireNewPiiRoute();
  return route.load(key);
}

/** Store a validated plaintext envelope. Throws when the route is absent. */
export async function saveNewPii(
  key: NewPiiStorageKey,
  value: string,
): Promise<void> {
  const route = await requireNewPiiRoute();
  await route.save(key, value);
}

async function requireNewPiiRoute(): Promise<NewPiiRoute> {
  if (isWithdrawalPending()) {
    throw new NewPiiRouteUnavailableError("withdrawal_pending");
  }
  const route = getNewPiiRoute();
  if (route === null) {
    throw new NewPiiRouteUnavailableError(NEW_PII_ROUTE_UNAVAILABLE);
  }
  const capability = await getNewPiiCapability();
  if (!capability.available) {
    throw new NewPiiRouteUnavailableError(capability.reason);
  }
  return route;
}

function parseStorageValue<S>(raw: string): StorageValue<S> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Passwordless PII record is not valid JSON");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("state" in parsed) ||
    parsed.state === null ||
    typeof parsed.state !== "object" ||
    ("version" in parsed && typeof parsed.version !== "number")
  ) {
    throw new Error("Passwordless PII record has an invalid storage shape");
  }
  return parsed as StorageValue<S>;
}

function observePersistWrite<T>(run: () => Promise<T>): Promise<T> {
  let attempt: Promise<T>;
  try {
    attempt = run();
  } catch (error) {
    attempt = Promise.reject(error);
  }
  // Zustand does not await the promise returned by persist.setItem after a
  // state action. Keep the rejection available to direct callers/tests while
  // preventing an orphaned refusal from becoming an unhandled console error.
  void attempt.catch(() => undefined);
  return attempt;
}

/** Zustand storage that only uses the exact Desktop passwordless domain key. */
export function createNewPiiPersistStorage<S>(
  domain: NewPiiDomain,
  requireHydrated = false,
): PersistStorage<S, Promise<void>> {
  const key = newPiiKeyFor(domain);
  const hydrationKey = {
    customers: "open3dcalc_customers_v1",
    quotes: "open3dcalc_quotes_v1",
    history: "open3dcalc_history_v2",
  }[domain];
  return {
    async getItem(): Promise<StorageValue<S> | null> {
      const raw = await loadNewPii(key);
      return raw === null ? null : parseStorageValue<S>(raw);
    },
    setItem(_name, value): Promise<void> {
      return observePersistWrite(async () => {
        if (
          requireHydrated &&
          getPiiStoreHydrationStatus(hydrationKey) !== "hydrated"
        ) {
          throw new NewPiiRouteUnavailableError("not_hydrated");
        }
        await saveNewPii(key, JSON.stringify(value));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(NEW_PII_RECORD_SAVED_EVENT));
        }
      });
    },
    removeItem(): Promise<void> {
      return observePersistWrite(async () => {
        // The authorized route deliberately exposes no delete primitive. Refuse
        // rather than claiming deletion or falling back to a legacy storage key.
        throw new NewPiiRouteUnavailableError("remove_unsupported");
      });
    },
  };
}

/** True only when one of the passwordless domains already holds a record. */
export async function hasPersistedNewPiiRecord(): Promise<boolean> {
  const capability = await getNewPiiCapability();
  if (!capability.available) return false;
  for (const domain of ["customers", "quotes", "history"] as const) {
    try {
      if (await loadNewPii(newPiiKeyFor(domain))) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * The slice of a Zustand `persist` store this installer needs. A store can be
 * partial in a test double (mock without the middleware) or in a broken build,
 * so both `persist` and `setOptions` are optional and probed at runtime.
 */
export interface PersistInstallTarget<S> {
  persist?: {
    setOptions?: (options: {
      storage: PersistStorage<S, Promise<void>>;
    }) => void;
  };
}

/**
 * Point a single store at the passwordless Desktop storage.
 *
 * Fail-closed and side-effect-free on a partial store: when the persist
 * middleware (or its `setOptions`) is absent, the store is left untouched and
 * `false` is returned instead of dereferencing `undefined`. This runs at module
 * import time (see `App.tsx`), so throwing here would take the whole renderer
 * down before it mounts; skipping only means the store keeps whatever storage
 * it already had.
 *
 * Exported so the missing-persist regression can be driven with a bare object,
 * without mutating the real store singletons.
 */
export function installNewPiiStorageOnStore<S>(
  store: PersistInstallTarget<S> | null | undefined,
  domain: NewPiiDomain,
): boolean {
  if (isBetaChannel) return false;
  const setOptions = store?.persist?.setOptions;
  if (typeof setOptions !== "function") {
    console.warn(
      `[newPiiStorage] ${domain} store has no persist.setOptions; passwordless storage not installed`,
    );
    return false;
  }
  setOptions({
    storage: createNewPiiPersistStorage<S>(domain, true),
  });
  return true;
}

/** Install the Desktop SQLite adapter; Web never calls this. */
export function installNewPiiStorageForDesktop(): void {
  if (isBetaChannel) {
    console.warn(
      "[newPiiStorage] SQLite-backed PII storage is unavailable in Beta",
    );
    return;
  }
  installNewPiiStorageOnStore<ReturnType<typeof useCustomerStore.getState>>(
    useCustomerStore,
    "customers",
  );
  installNewPiiStorageOnStore<ReturnType<typeof useQuoteStore.getState>>(
    useQuoteStore,
    "quotes",
  );
  installNewPiiStorageOnStore<ReturnType<typeof useHistoryStore.getState>>(
    useHistoryStore,
    "history",
  );
}
