import type { PersistStorage, StorageValue } from "zustand/middleware";
import { isElectronRuntime } from "./manifestStorage";

export const PII_STORE_KEY = {
  customers: "open3dcalc_customers_v1",
  quotes: "open3dcalc_quotes_v1",
  history: "open3dcalc_history_v2",
} as const;

export const PII_STORE_KEYS = [
  PII_STORE_KEY.customers,
  PII_STORE_KEY.quotes,
  PII_STORE_KEY.history,
] as const;

export type PiiStoreKey = (typeof PII_STORE_KEYS)[number];
export type PiiHydrationStatus = "idle" | "hydrating" | "hydrated" | "failed";
export type PiiPersistenceReason = "storage_not_ready";

export type PiiRehydrateOutcome =
  | { key: PiiStoreKey; status: "hydrated" }
  | { key: PiiStoreKey; status: "failed" }
  | { key: PiiStoreKey; status: "unregistered" };

export interface PiiPersistHandle {
  rehydrate: () => Promise<void> | void;
  hasHydrated: () => boolean;
}

export interface PiiWriteRefusal {
  key: string;
  reason: PiiPersistenceReason;
}

const hydrationStates = new Map<string, PiiHydrationStatus>();
const persistHandles = new Map<string, PiiPersistHandle>();
const refusalListeners = new Set<() => void>();
let lastWriteRefusal: PiiWriteRefusal | null = null;

function setLastWriteRefusal(refusal: PiiWriteRefusal | null): void {
  lastWriteRefusal = refusal;
  refusalListeners.forEach((listener) => listener());
}

export function subscribePiiWriteRefusals(listener: () => void): () => void {
  refusalListeners.add(listener);
  return () => refusalListeners.delete(listener);
}

export function getLastPiiWriteRefusal(): PiiWriteRefusal | null {
  return lastWriteRefusal;
}

export function recordPiiWriteRefusal(
  key: string,
  reason: PiiPersistenceReason,
): void {
  setLastWriteRefusal({ key, reason });
}

export function registerPiiPersistStore(
  key: string,
  handle: PiiPersistHandle,
): void {
  persistHandles.set(key, handle);
  if (!hydrationStates.has(key)) hydrationStates.set(key, "idle");
}

export function getPiiStoreHydrationStatus(key: string): PiiHydrationStatus {
  return hydrationStates.get(key) ?? "idle";
}

export function getPiiSurfaceWriteBlockReason(
  key: string,
): PiiPersistenceReason | null {
  if (!isElectronRuntime() || getPiiStoreHydrationStatus(key) === "hydrated") {
    return null;
  }
  return "storage_not_ready";
}

export function beginPiiSurfaceWrite(key: string): PiiPersistenceReason | null {
  const reason = getPiiSurfaceWriteBlockReason(key);
  if (reason !== null) recordPiiWriteRefusal(key, reason);
  return reason;
}

/** Hydrate the Desktop's local database stores before allowing writes. */
export async function rehydratePiiStores(): Promise<PiiRehydrateOutcome[]> {
  const outcomes: PiiRehydrateOutcome[] = [];

  for (const key of PII_STORE_KEYS) {
    const handle = persistHandles.get(key);
    if (!handle) {
      outcomes.push({ key, status: "unregistered" });
      continue;
    }

    hydrationStates.set(key, "hydrating");
    try {
      await handle.rehydrate();
      if (!handle.hasHydrated()) throw new Error("Store hydration incomplete");
      hydrationStates.set(key, "hydrated");
      if (lastWriteRefusal?.key === key) setLastWriteRefusal(null);
      outcomes.push({ key, status: "hydrated" });
    } catch {
      hydrationStates.set(key, "failed");
      outcomes.push({ key, status: "failed" });
    }
  }

  return outcomes;
}

/** Plain storage adapter used by web builds for local PII stores. */
export function plainPiiPersistStorage<S>(
  key: string,
  storage: Storage,
): PersistStorage<S> {
  return {
    getItem(name): StorageValue<S> | null {
      if (name !== key) throw new Error(`Unexpected local data key: ${name}`);
      const raw = storage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as StorageValue<S>);
    },
    setItem(name, value): void {
      if (name !== key) throw new Error(`Unexpected local data key: ${name}`);
      storage.setItem(key, JSON.stringify(value));
    },
    removeItem(name): void {
      if (name !== key) throw new Error(`Unexpected local data key: ${name}`);
      storage.removeItem(key);
    },
  };
}

export function resetLocalPiiPersistenceForTests(): void {
  hydrationStates.clear();
  lastWriteRefusal = null;
}
