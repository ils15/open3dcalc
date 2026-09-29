/**
 * Minimal in-memory IndexedDB double for the PII vault tests.
 *
 * ## Why a double and not a real IndexedDB
 *
 * jsdom does not implement IndexedDB at all (`globalThis.indexedDB` is
 * `undefined` under the vitest jsdom environment), and the vault is the one
 * component in this repo that must not have a test-only bypass: it is the
 * storage that holds sealed PII, so "just pretend the browser has it" is
 * exactly the sort of shortcut that hides a real defect. Rather than
 * introduce a dependency, this double implements the SUBSET of IndexedDB the
 * vault uses, with the semantics that actually matter for correctness:
 *
 *  - a request made after the transaction has completed raises
 *    `TransactionInactiveError` (the auto-commit footgun — the reason the
 *    vault never holds a transaction open across an `await` of crypto);
 *  - readwrite transactions on a store are serialised, and the double RECORDS
 *    the peak number open at once, so a test can assert the vault never lets
 *    two writers into the same store concurrently;
 *  - `oncomplete` fires on a macrotask, after the microtask queue has drained,
 *    so a consumer that `await`s between requests sees the real behaviour.
 *
 * It is a test double, not a mock: there are no call assertions and no
 * hand-fed results, so what the tests exercise is the vault's own logic.
 */

import type { VaultIdbFactory } from "@/shared/lib/crypto/indexedDbPort";

/** Thrown by the double where the real API would raise an `InvalidStateError`. */
export function inactiveTransactionError(): DOMException {
  return new DOMException(
    "TransactionInactiveError: the transaction is not active",
    "InvalidStateError",
  );
}

class FakeRequest<T> {
  result: T | undefined = undefined;
  error: unknown = null;
  onsuccess: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onupgradeneeded: ((event: unknown) => void) | null = null;
  onblocked: ((event: unknown) => void) | null = null;
  readyState: "pending" | "done" = "pending";
}

class FakeObjectStore {
  constructor(
    private readonly tx: FakeTransaction,
    readonly name: string,
  ) {}

  put(value: unknown, key: string): FakeRequest<string> {
    return this.tx.enqueue(() => {
      // An injected failure models a storage backend that refuses this write
      // (a quota error, an aborted transaction). It must surface as a request
      // error so the vault's `commit_failed` path is exercised for real.
      const fail = this.tx.shouldFailPut(key, value);
      if (fail !== null) throw fail;
      this.tx.data(this.name).set(key, value);
      return key;
    });
  }

  get(key: string): FakeRequest<unknown> {
    return this.tx.enqueue(() => this.tx.data(this.name).get(key));
  }

  delete(key: string): FakeRequest<undefined> {
    return this.tx.enqueue(() => {
      this.tx.data(this.name).delete(key);
      return undefined;
    });
  }
}

class FakeTransaction {
  oncomplete: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onabort: ((event: unknown) => void) | null = null;
  error: unknown = null;

  private readonly stores: Map<string, FakeObjectStore> = new Map();
  private queue: Array<() => void> = [];
  private draining = false;
  private closed = false;

  constructor(
    private readonly db: FakeDatabase,
    readonly mode: IDBTransactionMode,
    storeNames: string[],
    private readonly tally: (delta: number) => void,
    readonly shouldFailPut: (
      key: string,
      value: unknown,
    ) => unknown | null = () => null,
  ) {
    for (const name of storeNames) {
      if (!db.stores.has(name)) {
        throw new DOMException(`NotFoundError: ${name}`, "NotFoundError");
      }
      this.stores.set(name, new FakeObjectStore(this, name));
    }
    if (mode === "readwrite") tally(1);
  }

  data(storeName: string): Map<string, unknown> {
    return this.db.stores.get(storeName)!;
  }

  objectStore(name: string): FakeObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new DOMException(`NotFoundError: ${name}`, "NotFoundError");
    }
    return store;
  }

  enqueue<T>(operation: () => T): FakeRequest<T> {
    if (this.closed) throw inactiveTransactionError();
    const request = new FakeRequest<T>();
    this.queue.push(() => {
      if (this.closed) return;
      try {
        request.result = operation();
        request.readyState = "done";
        request.onsuccess?.({ target: request });
      } catch (error) {
        request.error = error;
        request.onerror?.({ target: request });
      }
      this.next();
    });
    this.next();
    return request;
  }

  /** Run the next queued operation on a fresh microtask. */
  private next(): void {
    if (this.draining) return;
    const operation = this.queue.shift();
    if (operation === undefined) {
      // Queue empty. Complete on a MACROTASK, so any `await` the consumer
      // performs in between drains first — that is what makes an
      // "await-then-request" write fail here, as it does in a real browser.
      setTimeout(() => this.complete(), 0);
      return;
    }
    this.draining = true;
    queueMicrotask(() => {
      this.draining = false;
      operation();
    });
  }

  private complete(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.mode === "readwrite") this.tally(-1);
    this.oncomplete?.({ target: this });
  }
}

class FakeDatabase {
  readonly stores = new Map<string, Map<string, unknown>>();
  private open: boolean = true;

  constructor(
    readonly name: string,
    readonly version: number,
    /** Injected per-`put` failure, or null. Set at creation by the factory. */
    readonly shouldFailPut: (
      key: string,
      value: unknown,
    ) => unknown | null = () => null,
  ) {}

  get objectStoreNames(): { contains: (n: string) => boolean } {
    return { contains: (n: string) => this.stores.has(n) };
  }

  createObjectStore(name: string): FakeObjectStore {
    const data = new Map<string, unknown>();
    this.stores.set(name, data);
    const tx = new FakeTransaction(this, "versionchange", [], () => {});
    return new FakeObjectStore(tx, name);
  }

  transaction(
    storeNames: string | string[],
    mode: IDBTransactionMode = "readonly",
  ): FakeTransaction {
    if (!this.open) {
      throw new DOMException(
        "InvalidStateError: db is closed",
        "InvalidStateError",
      );
    }
    const names = typeof storeNames === "string" ? [storeNames] : storeNames;
    return new FakeTransaction(
      this,
      mode,
      names,
      (delta) => {
        if (delta > 0) this.stats.readWriteOpen++;
        else this.stats.readWriteOpen--;
        this.stats.maxConcurrentReadWrite = Math.max(
          this.stats.maxConcurrentReadWrite,
          this.stats.readWriteOpen,
        );
      },
      this.shouldFailPut,
    );
  }

  readonly stats = { readWriteOpen: 0, maxConcurrentReadWrite: 0 };

  close(): void {
    this.open = false;
  }
}

export interface FakeIndexedDb {
  /**
   * Use as the `indexedDb` option on the PII vault under test.
   *
   * Typed as the vault's PORT, not as the DOM's `IDBFactory`, so the tests
   * exercise the same structural contract production injects. The one cast
   * from this double's own classes lives at the bottom of this file.
   */
  factory: VaultIdbFactory;
  /** Peak number of readwrite transactions open at the same time. */
  maxConcurrentReadWrite(): number;
  /** The raw stored value, for byte-level assertions. */
  raw(storeName: string, key: string): unknown;
  /** Store a raw value directly, to plant a tampered record. */
  seed(storeName: string, key: string, value: unknown): void;
  /** Every key currently present in a store. */
  keys(storeName: string): string[];
  /** Names of the databases that have been opened, so a test can assert that
   *  a refused call never reached storage at all. */
  databaseNames(): string[];
  /**
   * Make the Nth `put` from now fail, then stop failing. `null` disarms.
   *
   * This models a storage backend that refuses a write — the interrupted
   * startup a recovery marker exists for. The counter is per-call so a test
   * can arm it, observe the interruption, then disarm for the resume.
   */
  failPutsOnCall(n: number | null): void;
  /**
   * Make every `put` whose (key, sealed value) matches the predicate fail,
   * until disarmed with `null`.
   *
   * Unlike `failPutsOnCall`, this is anchored on the WRITE rather than on a
   * global call ordinal, so unrelated same-key writes cannot shift the
   * failure off the write a spec means to interrupt. The double only ever
   * sees the SEALED record, so the predicate is handed the storage key and
   * the opaque serialised value: use it for key- or size-level predicates
   * that exercise the vault's `commit_failed` path, never to read plaintext.
   */
  failPutsMatching(
    matcher: ((key: string, value: unknown) => boolean) | null,
  ): void;
  /** How many `put` calls have been observed. */
  putCalls(): number;
}

/**
 * Build a fresh in-memory IndexedDB. Each call is an isolated origin-like
 * namespace, so tests never share state.
 */
export function createFakeIndexedDb(): FakeIndexedDb {
  const databases = new Map<string, FakeDatabase>();
  // Set by `failPutsOnCall`; read on every put so a test can arm it mid-run.
  let failPutOnCall: number | null = null;
  // Set by `failPutsMatching`; read on every put. Anchored on the write's own
  // (key, value) so a stray same-key write cannot consume the armed slot.
  let failPutMatcher: ((key: string, value: unknown) => boolean) | null = null;
  let putCalls = 0;
  const shouldFailPut = (key: string, value: unknown): unknown | null => {
    // Count only while a fault is armed, so `putCalls()` keeps its meaning as
    // "puts observed since the injection was armed" for the ordinal mode.
    if (failPutMatcher !== null || failPutOnCall !== null) putCalls += 1;
    if (failPutMatcher !== null && failPutMatcher(key, value)) {
      return new DOMException("simulated put failure", "UnknownError");
    }
    if (failPutOnCall !== null && putCalls === failPutOnCall) {
      return new DOMException("simulated put failure", "UnknownError");
    }
    return null;
  };

  const factory = {
    open(name: string, version?: number): FakeRequest<FakeDatabase> {
      const request = new FakeRequest<FakeDatabase>();
      const requested = version ?? 1;
      const existing = databases.get(name);
      setTimeout(() => {
        if (existing && existing.version >= requested) {
          request.result = existing;
          request.readyState = "done";
          request.onsuccess?.({ target: request });
          return;
        }
        const db = new FakeDatabase(name, requested, shouldFailPut);
        databases.set(name, db);
        request.result = db;
        // `onupgradeneeded` fires before `onsuccess`, and the caller creates
        // its object stores inside that handler.
        request.onupgradeneeded?.({ target: request });
        request.readyState = "done";
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    },

    deleteDatabase(name: string): FakeRequest<undefined> {
      const request = new FakeRequest<undefined>();
      setTimeout(() => {
        databases.delete(name);
        request.readyState = "done";
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    },
  } as unknown as VaultIdbFactory;

  const storeOf = (storeName: string): Map<string, unknown> => {
    for (const db of databases.values()) {
      const data = db.stores.get(storeName);
      if (data) return data;
    }
    throw new Error(`no fake database holds the store "${storeName}"`);
  };

  return {
    factory,
    maxConcurrentReadWrite(): number {
      let peak = 0;
      for (const db of databases.values()) {
        peak = Math.max(peak, db.stats.maxConcurrentReadWrite);
      }
      return peak;
    },
    raw(storeName: string, key: string): unknown {
      return storeOf(storeName).get(key);
    },
    seed(storeName: string, key: string, value: unknown): void {
      storeOf(storeName).set(key, value);
    },
    keys(storeName: string): string[] {
      return [...storeOf(storeName).keys()];
    },
    databaseNames(): string[] {
      return [...databases.keys()];
    },
    failPutsOnCall(n: number | null): void {
      failPutOnCall = n;
      putCalls = 0;
    },
    failPutsMatching(
      matcher: ((key: string, value: unknown) => boolean) | null,
    ): void {
      failPutMatcher = matcher;
    },
    putCalls(): number {
      return putCalls;
    },
  };
}
