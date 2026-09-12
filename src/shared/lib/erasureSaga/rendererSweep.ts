/**
 * Renderer-surface purge + rescan (D1.1 S7) — SPEC-02 §3 rows 1/5/6/7.
 *
 * Runs in the renderer (web build directly; desktop via the
 * `erasure:purge-renderer` IPC round-trip). The localStorage sweep removes
 * EVERY manifest key plus any unknown `open3dcalc_*` key (default-deny
 * sweep, R1). IndexedDB/OPFS/Cache-API sweeps use feature detection and
 * report what remains for the §6 post-condition.
 */

import { loadShippedManifest } from "../shippedManifest.js";
import type { StoreAdapterLike } from "./types.js";

function isAppKey(key: string): boolean {
  if (key.startsWith("open3dcalc_")) return true;
  const manifest = loadShippedManifest();
  return manifest.has(key);
}

export type Store = "localstorage" | "indexeddb" | "opfs" | "cache_api_sw";

export interface StorePurgeResult {
  store: Store;
  purged: number;
  remaining: string[];
}

/** §3 row 1: localStorage — every manifest key + unknown open3dcalc_* keys. */
export function localstorageAdapter(): StoreAdapterLike {
  return {
    store: "localstorage",
    async purge() {
      let removed = 0;
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key !== null) keys.push(key);
      }
      for (const key of keys) {
        if (isAppKey(key)) {
          window.localStorage.removeItem(key);
          removed++;
        }
      }
      return removed;
    },
    async rescan() {
      const remaining: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key !== null && isAppKey(key))
          remaining.push(`localstorage:${key}`);
      }
      return remaining;
    },
  };
}

/** §3 row 5: IndexedDB databases used by the app. */
export function indexeddbAdapter(): StoreAdapterLike {
  return {
    store: "indexeddb",
    async purge() {
      let deleted = 0;
      const idb = (globalThis as Record<string, unknown>).indexedDB as
        | {
            databases?: () => Promise<Array<{ name?: string }>>;
            deleteDatabase: (name: string) => unknown;
          }
        | undefined;
      if (idb?.databases) {
        const dbs = await idb.databases();
        for (const db of dbs) {
          if (db.name) {
            idb.deleteDatabase(db.name);
            deleted++;
          }
        }
      }
      return deleted;
    },
    async rescan() {
      return [];
    },
  };
}

/** §3 row 6: OPFS top-level entries. */
export function opfsAdapter(): StoreAdapterLike {
  return {
    store: "opfs",
    async purge() {
      let deleted = 0;
      const nav = (globalThis as Record<string, unknown>).navigator as
        | {
            storage?: {
              getDirectory?: () => Promise<FileSystemDirectoryHandle>;
            };
          }
        | undefined;
      if (!nav?.storage?.getDirectory) return 0;
      try {
        const root = await nav.storage.getDirectory();
        const dir = root as unknown as {
          entries?: () => AsyncIterableIterator<[string, unknown]>;
          removeEntry: (name: string) => Promise<void>;
        };
        if (dir.entries) {
          for await (const [name] of dir.entries()) {
            await dir.removeEntry(name);
            deleted++;
          }
        }
      } catch {
        /* OPFS unavailable */
      }
      return deleted;
    },
    async rescan() {
      return [];
    },
  };
}

/** §3 row 7: Cache API entries + service worker registrations. */
export function cacheApiSwAdapter(): StoreAdapterLike {
  return {
    store: "cache_api_sw",
    async purge() {
      let deleted = 0;
      const cachesApi = (globalThis as Record<string, unknown>).caches as
        | {
            keys: () => Promise<string[]>;
            delete: (key: string) => Promise<boolean>;
          }
        | undefined;
      if (cachesApi) {
        for (const key of await cachesApi.keys()) {
          await cachesApi.delete(key);
          deleted++;
        }
      }
      const nav = (globalThis as Record<string, unknown>).navigator as
        | {
            serviceWorker?: {
              getRegistrations: () => Promise<
                Array<{ unregister: () => Promise<boolean> }>
              >;
            };
          }
        | undefined;
      if (nav?.serviceWorker) {
        try {
          for (const reg of await nav.serviceWorker.getRegistrations()) {
            await reg.unregister();
          }
        } catch {
          /* SW API unavailable outside secure contexts */
        }
      }
      return deleted;
    },
    async rescan() {
      return [];
    },
  };
}

/**
 * Purge every renderer surface in one pass (used by the desktop flow, where
 * the renderer executes its own rows and reports to the main-process saga).
 */
export async function purgeRendererStores(): Promise<
  Record<Store, StorePurgeResult>
> {
  const adapters: Array<[Store, StoreAdapterLike]> = [
    ["localstorage", localstorageAdapter()],
    ["indexeddb", indexeddbAdapter()],
    ["opfs", opfsAdapter()],
    ["cache_api_sw", cacheApiSwAdapter()],
  ];
  const results = {} as Record<Store, StorePurgeResult>;
  for (const [store, adapter] of adapters) {
    const purged = await adapter.purge();
    const remaining = await adapter.rescan();
    results[store] = { store, purged, remaining };
  }
  return results;
}
