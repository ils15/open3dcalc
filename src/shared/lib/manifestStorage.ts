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
} from "zustand/middleware";
import { checkKey } from "./manifestGate";

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
      if (!checkKey(name).allowed) return;
      backing.setItem(name, value);
    },
    removeItem: (name) => {
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
    const backing = rawStorage();
    if (!checkKey(key).allowed) return;
    backing.setItem(key, value);
  },
  removeItem(key: string): void {
    const backing = rawStorage();
    if (!checkKey(key).allowed) return;
    backing.removeItem(key);
  },
};
