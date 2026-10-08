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
 * The PII vault's capability gate lives next door, in
 * `crypto/piiStoreCapability.ts`; only the demo flag below is mirrored into
 * it, so there is still one switch and one decision for "may PII be written?".
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
import {
  checkKey,
  getKeyEntry,
  isPiiKey,
  ManifestError,
} from "./manifestGate.js";
import { setDemoSuppressedForPiiGate } from "./crypto/piiStoreCapability.js";

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
 * The flag is ALSO mirrored into the PII gate's decision state, so a demo
 * session suppresses the encrypted vault through the same single switch this
 * module already owns. Two independent predicates would be two choke points: a
 * demo session would stop localStorage writes while still sealing PII into
 * IndexedDB, and a demo session is defined as holding nothing at all. A mirror
 * of one boolean cannot drift the way two separately-owned predicates can.
 *
 * The gate's own state lives in `crypto/piiStoreCapability.ts` rather than
 * here because the Electron main process compiles that directory with no DOM,
 * and a vault reaching into a zustand-and-`window` module would drag a
 * renderer dependency into the main bundle.
 */
export function setDemoPersistenceSuppressed(value: boolean): void {
  demoPersistenceSuppressed = value;
  setDemoSuppressedForPiiGate(value);
}

/** True while a demo session owns the stores (writes are no-ops). */
export function isDemoPersistenceSuppressed(): boolean {
  return demoPersistenceSuppressed;
}

/**
 * Is this the desktop renderer, where PII has a durable OS-backed path?
 *
 * Read at CALL time, never cached at module scope: a renderer can be the web
 * target in one build and Electron in another, and the gate must reflect the
 * runtime it is actually running in.
 */
function isElectronRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Electron")
  );
}

/**
 * Refuse a plaintext PII write on the web target.
 *
 * Every manifest PII key is `encrypted_at_rest`, and the web build has no OS
 * keyring; the encrypted vault is a separate, passphrase-gated path. A write
 * through THIS choke point is therefore plaintext PII by construction. The
 * denial lives here, below the UI, so a direct `guardedStorage.setItem` /
 * `manifestStorage().setItem` call cannot create a plaintext record even when a
 * component forgets to pre-check. Deny-safely: never throw, log the key NAME
 * only, and never touch the backing store.
 *
 * Desktop is out of scope for this slice: its PII path is gated elsewhere and
 * is deliberately left unchanged.
 */
function denyWebPlaintextPiiWrite(key: string): boolean {
  if (isElectronRuntime()) return false;
  const entry = getKeyEntry(key);
  // Only NEW user PII is refused here. Sealed saga artifacts (class
  // `snapshot`) are ciphertext written by the erasure store, not a
  // user-facing PII write, and must keep working.
  if (!entry || entry.pii !== true || entry.class !== "user_content") {
    return false;
  }
  console.warn(
    `[manifestStorage] refused plaintext PII write on web for key "${key}"`,
  );
  return true;
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
 * The cross-device sync path is the one surface that used to (re)write the
 * three vault-backed PII keys (`open3dcalc_history_v2`, `open3dcalc_customers_v1`,
 * `open3dcalc_quotes_v1`) straight into `localStorage`. After Wave 3 those
 * records live only in the encrypted vault, so a sync write there is both
 * wrong (plaintext PII) and useless (the stores do not read it). This wrapper
 * closes that write at the choke point: a declared `pii:true` key is denied —
 * loudly in development, safely in production — while every non-PII key is
 * delegated to `guardedStorage` unchanged. Reads and removes are NOT changed;
 * the guarantee this layer owes is "no plaintext PII write", not "no read".
 */
export const guardedSyncStorage = {
  getItem(key: string): string | null {
    return guardedStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
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
    guardedStorage.removeItem(key);
  },
};
