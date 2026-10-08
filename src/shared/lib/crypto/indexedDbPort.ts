/**
 * The IndexedDB port the browser PII vault depends on.
 *
 * ## Why this is a port and not the DOM's `IDBFactory`
 *
 * Two reasons, and the first is the important one.
 *
 * 1. **The Electron main process has no IndexedDB.** `electron/tsconfig.json`
 *    compiles `src/shared/lib/crypto/**` with `lib: ["ES2023"]` and
 *    `types: ["node"]` — no DOM — so every `IDBFactory`/`IDBDatabase` in this
 *    file was a hard type error there, and the file was therefore kept out of
 *    the only build that could have caught it. Naming the four operations the
 *    vault actually uses makes the dependency explicit and structural: the
 *    main process can now *load* this module and see a type it can satisfy
 *    with "nothing", instead of failing to compile.
 *
 * 2. **An ambient global is not an injectable dependency.** The vault reached
 *    for `globalThis.indexedDB` through a cast, which means a caller cannot
 *    tell where the store came from and a main-process import would throw at
 *    call time rather than being refused. The factory is now a constructor
 *    argument all the way down, and the absence of one is a typed refusal
 *    (`indexeddb_unavailable`).
 *
 * The shapes below are deliberately minimal — `get`, `put`, `delete` on a
 * single object store, plus the open/upgrade handshake. A wider port would be
 * an abstraction nobody needs yet (YAGNI), and every member here is one the
 * vault calls.
 */

import { isBetaChannel } from "../../config/betaChannel.js";

/** Minimal request: a result plus the two terminal callbacks. */
export interface VaultIdbRequest<T> {
  result: T;
  error: unknown;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** Minimal open request: the upgrade callback fires before `onsuccess`. */
export interface VaultIdbOpenRequest extends VaultIdbRequest<unknown> {
  onupgradeneeded: ((event: unknown) => void) | null;
  onblocked: ((event: unknown) => void) | null;
}

export interface VaultIdbObjectStore {
  get(key: string): VaultIdbRequest<unknown>;
  put(value: string, key: string): VaultIdbRequest<unknown>;
  delete(key: string): VaultIdbRequest<unknown>;
}

export interface VaultIdbTransaction {
  objectStore(name: string): VaultIdbObjectStore;
  oncomplete: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onabort: ((event: unknown) => void) | null;
  error: unknown;
}

export interface VaultIdbDatabase {
  readonly objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore(name: string): unknown;
  transaction(
    storeNames: string | string[],
    mode?: string,
  ): VaultIdbTransaction;
  close(): void;
}

export interface VaultIdbFactory {
  open(name: string, version?: number): VaultIdbOpenRequest;
}

function requestResult<T>(request: VaultIdbRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("[indexedDbPort] request failed"));
  });
}

/**
 * Resolve when the transaction commits.
 *
 * The handlers are attached at CREATION time, before the first `await`. This
 * is not stylistic: a transaction auto-commits as soon as its request queue
 * drains, so attaching `oncomplete` after awaiting a request is a race that
 * hangs forever against a real IndexedDB.
 */
function transactionDone(tx: VaultIdbTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("[indexedDbPort] transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("[indexedDbPort] transaction aborted"));
  });
}

export interface VaultIdb {
  /** The raw stored value for `key`, or null when there is no record. */
  get(key: string): Promise<string | null>;
  /** Replace the record for `key`. */
  put(key: string, value: string): Promise<void>;
  /** Delete the record for `key`. */
  delete(key: string): Promise<void>;
}

/**
 * Bind a factory to one database, creating the object store on first open.
 *
 * The handle is cached per factory, so every store in one database shares one
 * connection. A rejected open is NOT cached: a transient failure must not
 * poison the vault for the rest of the session.
 */
export function openVaultIdb(
  factory: VaultIdbFactory,
  databaseName: string,
  storeName: string,
  version: number,
): VaultIdb {
  if (isBetaChannel) {
    throw new Error("[indexedDbPort] IndexedDB is unavailable in Beta");
  }
  const handles = new WeakMap<VaultIdbFactory, Promise<VaultIdbDatabase>>();

  function open(): Promise<VaultIdbDatabase> {
    const existing = handles.get(factory);
    if (existing) return existing;
    const opening = new Promise<VaultIdbDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, version);
      request.onupgradeneeded = () => {
        const db = request.result as VaultIdbDatabase;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result as VaultIdbDatabase);
      request.onerror = () =>
        reject(request.error ?? new Error("[indexedDbPort] open failed"));
      request.onblocked = () =>
        reject(new Error("[indexedDbPort] open blocked by another connection"));
    });
    handles.set(factory, opening);
    return opening.catch((error: unknown) => {
      handles.delete(factory);
      throw error;
    });
  }

  return {
    async get(key: string): Promise<string | null> {
      const db = await open();
      const tx = db.transaction(storeName, "readonly");
      const done = transactionDone(tx);
      const value = await requestResult(tx.objectStore(storeName).get(key));
      await done;
      return typeof value === "string" ? value : null;
    },

    async put(key: string, value: string): Promise<void> {
      const db = await open();
      const tx = db.transaction(storeName, "readwrite");
      const done = transactionDone(tx);
      await requestResult(tx.objectStore(storeName).put(value, key));
      await done;
    },

    async delete(key: string): Promise<void> {
      const db = await open();
      const tx = db.transaction(storeName, "readwrite");
      const done = transactionDone(tx);
      await requestResult(tx.objectStore(storeName).delete(key));
      await done;
    },
  };
}

/**
 * Adapt a DOM `IDBFactory` to the port. The cast is confined here, at the one
 * place where the ambient global legitimately lives, instead of being
 * scattered through the vault.
 */
export function idbFactoryFromGlobal(): VaultIdbFactory | null {
  if (isBetaChannel) return null;
  const global = (globalThis as { indexedDB?: unknown }).indexedDB;
  return global === undefined || global === null
    ? null
    : (global as VaultIdbFactory);
}
