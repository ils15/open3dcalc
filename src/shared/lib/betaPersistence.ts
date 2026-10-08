import type {
  PersistStorage,
  StateStorage,
  StorageValue,
} from "zustand/middleware";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { isKeyAllowed } from "./manifestGate.js";
import { setBetaReadabilityChecker } from "@/shared/lib/crypto/piiStoreHydration";

export const BETA_TEST_STORAGE_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

export type BetaTestStorageKey = (typeof BETA_TEST_STORAGE_KEYS)[number];

const BETA_KEY_SET: ReadonlySet<string> = new Set(BETA_TEST_STORAGE_KEYS);
const PERSISTED_ARRAY_FIELD: Record<BetaTestStorageKey, string> = {
  open3dcalc_beta_test_customers_v1: "customers",
  open3dcalc_beta_test_quotes_v1: "quotes",
  open3dcalc_beta_test_history_v1: "entries",
};

export class BetaPersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BetaPersistenceError";
  }
}

function getBetaStorage(key: string): Storage {
  if (!isBetaChannel || !BETA_KEY_SET.has(key) || !isKeyAllowed(key)) {
    throw new BetaPersistenceError(
      `[betaPersistence] storage key "${key}" is unavailable`,
    );
  }
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new Error("localStorage is unavailable");
    }
    return window.localStorage;
  } catch (error) {
    console.error(`[betaPersistence] localStorage unavailable for "${key}"`);
    throw new BetaPersistenceError(
      `[betaPersistence] localStorage unavailable for "${key}"`,
      { cause: error },
    );
  }
}

function reportStorageFailure(
  key: string,
  operation: string,
  error: unknown,
): never {
  console.error(`[betaPersistence] failed to ${operation} "${key}"`, error);
  throw new BetaPersistenceError(
    `[betaPersistence] failed to ${operation} "${key}"`,
    { cause: error },
  );
}

/** Exact-key localStorage facade used only by the synthetic Beta channel. */
export const betaTestStorage = {
  getItem(key: string): string | null {
    if (!isBetaChannel || !BETA_KEY_SET.has(key) || !isKeyAllowed(key)) {
      return null;
    }
    const storage = getBetaStorage(key);
    try {
      return storage.getItem(key);
    } catch (error) {
      return reportStorageFailure(key, "read", error);
    }
  },

  setItem(key: string, value: string): void {
    if (!isBetaChannel || !BETA_KEY_SET.has(key) || !isKeyAllowed(key)) return;
    const storage = getBetaStorage(key);
    try {
      storage.setItem(key, value);
    } catch (error) {
      reportStorageFailure(key, "write", error);
    }
  },

  removeItem(key: string): void {
    if (!isBetaChannel || !BETA_KEY_SET.has(key) || !isKeyAllowed(key)) return;
    console.warn(`[betaPersistence] removal is unsupported for "${key}"`);
  },
};

/** StateStorage dispatch for non-PII stores: Beta keys persist, all others stay in memory. */
export function betaStateStorage(): StateStorage {
  return {
    getItem: (key) => betaTestStorage.getItem(key),
    setItem: (key, value) => betaTestStorage.setItem(key, value),
    removeItem: (key) => betaTestStorage.removeItem(key),
  };
}

/**
 * Is Beta plaintext persistence readable for `key` right now?
 *
 * Gate-level mirror of `betaPlaintextPersistStorage.getItem` validation,
 * without touching that closure's `readable` flag: empty (null) is readable
 * when the manifest allows the key, a valid envelope (state object, expected
 * array field, version 1) is readable, and malformed/unavailable storage is
 * not. Lets the PII surface gate (`getPiiSurfaceWriteBlockReason`) allow Beta
 * writes at the choke point instead of per call site, while staying
 * fail-closed on unreadable data — so defaults can never overwrite it.
 */
export function isBetaPlainPersistenceReadable(
  key: BetaTestStorageKey,
): boolean {
  if (!isBetaChannel || !BETA_KEY_SET.has(key) || !isKeyAllowed(key)) {
    return false;
  }
  let raw: string | null;
  try {
    raw = betaTestStorage.getItem(key);
  } catch {
    return false;
  }
  if (raw === null) return true;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("state" in parsed) ||
      typeof parsed.state !== "object" ||
      parsed.state === null ||
      Array.isArray(parsed.state) ||
      !Array.isArray(
        (parsed.state as Record<string, unknown>)[PERSISTED_ARRAY_FIELD[key]],
      ) ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * A strict Zustand adapter for one Beta customer/quote/history key.
 * Reads are validated before hydration; malformed or inaccessible data blocks
 * subsequent writes so defaults can never overwrite unreadable user data.
 */
export function betaPlaintextPersistStorage<S>(
  key: BetaTestStorageKey,
): PersistStorage<S, unknown> {
  let readable = false;

  return {
    getItem(name: string): StorageValue<S> | null {
      if (name !== key) {
        throw new BetaPersistenceError(
          `[betaPersistence] unexpected store key "${name}"`,
        );
      }
      let raw: string | null;
      try {
        raw = betaTestStorage.getItem(key);
      } catch (error) {
        readable = false;
        throw error;
      }
      if (raw === null) {
        // A genuinely empty key may be initialized by the first user action.
        readable = isBetaChannel && isKeyAllowed(key);
        return null;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("state" in parsed) ||
          typeof parsed.state !== "object" ||
          parsed.state === null ||
          Array.isArray(parsed.state) ||
          !Array.isArray(
            (parsed.state as Record<string, unknown>)[
              PERSISTED_ARRAY_FIELD[key]
            ],
          ) ||
          (parsed as { version?: unknown }).version !== 1
        ) {
          throw new TypeError("invalid persisted state envelope");
        }
        readable = true;
        return parsed as StorageValue<S>;
      } catch (error) {
        readable = false;
        console.error(`[betaPersistence] malformed data for "${key}"`);
        throw new BetaPersistenceError(
          `[betaPersistence] malformed data for "${key}"`,
          { cause: error },
        );
      }
    },

    setItem(name: string, value: StorageValue<S>): void {
      if (name !== key || !readable || !isBetaChannel || !isKeyAllowed(key)) {
        throw new BetaPersistenceError(
          `[betaPersistence] refusing write before readable hydration for "${key}"`,
        );
      }
      betaTestStorage.setItem(key, JSON.stringify(value));
    },

    removeItem(name: string): void {
      if (name !== key) {
        throw new BetaPersistenceError(
          `[betaPersistence] unexpected store key "${name}"`,
        );
      }
      betaTestStorage.removeItem(key);
    },
  };
}

/**
 * Stable PII key → Beta synthetic key, for the surface write gate.
 *
 * The UI asks about Stable keys (`PII_STORE_KEY.*`) even on Beta; the stores
 * persist under Beta keys. Registered here (renderer-only) so the gate
 * (`piiStoreHydration`, also compiled by Electron main) needs no static Beta
 * imports: main never loads this module, so its checker stays null and
 * fail-closed there.
 */
const PII_TO_BETA_KEY: Record<string, BetaTestStorageKey> = {
  open3dcalc_customers_v1: "open3dcalc_beta_test_customers_v1",
  open3dcalc_quotes_v1: "open3dcalc_beta_test_quotes_v1",
  open3dcalc_history_v2: "open3dcalc_beta_test_history_v1",
};

if (isBetaChannel) {
  setBetaReadabilityChecker((piiKey: string) => {
    const betaKey = PII_TO_BETA_KEY[piiKey];
    return betaKey !== undefined && isBetaPlainPersistenceReadable(betaKey);
  });
} else {
  setBetaReadabilityChecker(null);
}
