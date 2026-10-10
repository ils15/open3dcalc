/**
 * A single unreadable key must not stop the app from starting.
 *
 * ## The regression this pins
 *
 * `loadFromDatabase()` awaited `db().load(key)` per key inside a bare loop. A
 * storage read error from a single row propagated all the way out, so
 * `initPersistenceBridge()` rejected BEFORE
 * reaching its step 3 and 4. That means the app never registered:
 *
 *   - the `beforeunload` save-on-close handler, and
 *   - the `AUTO_SAVE_INTERVAL_MS` auto-save interval and stale-key sweep,
 *
 * and `main.tsx` rendered `<StartupBridgeFailure/>` instead of `<App/>`. One
 * unreadable row took down the whole application, and a user who could not
 * start the app could not reach the UI that would have told them which class was
 * unavailable.
 *
 * ## What is NOT being changed here
 *
 * A structural failure still refuses to start: if `listKeys` itself fails, or the
 * manifest will not load, the bridge has no key set to work from and hydration
 * must not be applied from stale localStorage. That contract is unchanged and is
 * covered by `main.bridge-failure.test.tsx`. The change is narrower: a refusal
 * about ONE VALUE is isolated to that key.
 *
 * The `electronAPI.db` seam here is backed by real better-sqlite3 over a real
 * temporary file migrated by the app's own runner, and every statement is the
 * statement `electron/main.ts` runs for the same IPC channel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ElectronAPI } from "@/platform/desktop/types/electron";
import { initPersistenceBridge } from "../persistence-bridge";
import { runMigrations } from "../../../../../db/database";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const SETTINGS = "open3dcalc_settings_v2";
const HISTORY = "open3dcalc_history_v2";

const MARKER = "Synthetic Customer";
const OTHER = '["Synthetic Quote"]';
const THEME_VALUE = "system";
const HISTORY_VALUE = '["encerrado"]';
const UNREADABLE_NON_PII_VALUE = "synthetic-unreadable-row";

let dir: string;
let db: Database.Database;
let registered: Array<[string, EventListenerOrEventListenerObject]>;
let deleteCalls: string[];

function storedValue(key: string): string | null {
  return (
    (
      db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
        { value: string } | undefined
    )?.value ?? null
  );
}

/**
 * The hydration seam is backed by the real table. A simulated storage failure
 * crosses the `db:load` boundary and is isolated to the affected key.
 */
function sqliteBackedDb(): ElectronAPI["db"] {
  return {
    load: async (key: string): Promise<string | null> => {
      const row = db
        .prepare("SELECT value FROM storage WHERE key = ?")
        .get(key) as { value: string } | undefined;
      if (!row) return null;
      if (row.value === UNREADABLE_NON_PII_VALUE) {
        throw new Error("stored row is unreadable");
      }
      return row.value;
    },
    save: async (key: string, value: string) => {
      db.prepare(
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      ).run(key, value, Date.now());
    },
    delete: async (key: string) => {
      deleteCalls.push(key);
      db.prepare("DELETE FROM storage WHERE key = ?").run(key);
    },
    listKeys: async () =>
      (
        db.prepare("SELECT key FROM storage ORDER BY key").all() as Array<{
          key: string;
        }>
      ).map((row) => row.key),
  } as unknown as ElectronAPI["db"];
}

function seedProfile(): void {
  // A NON-PII key the read will reject: the isolation guarantee (one
  // unreadable row must not brick startup) is about a key the bridge DOES
  // attempt to hydrate. `open3dcalc_settings_v2` is pii:false and remains on
  // the bridge's mirror list, so it is the honest target for "unreadable".
  db.prepare("INSERT OR REPLACE INTO storage VALUES (?, ?, ?)").run(
    SETTINGS,
    UNREADABLE_NON_PII_VALUE,
    1,
  );
  // A readable NON-PII key, so the spec can prove hydration continues.
  db.prepare("INSERT OR REPLACE INTO storage VALUES (?, ?, ?)").run(
    "open3dcalc_theme",
    THEME_VALUE,
    1,
  );
  // The PII rows: their absence from localStorage is now BY DESIGN (T3.1), so
  // they must be seeded with values that COULD be read, to prove the bridge
  // refuses them rather than failing on them.
  db.prepare("INSERT OR REPLACE INTO storage VALUES (?, ?, ?)").run(
    CUSTOMERS,
    MARKER,
    1,
  );
  db.prepare("INSERT OR REPLACE INTO storage VALUES (?, ?, ?)").run(
    QUOTES,
    OTHER,
    1,
  );
  db.prepare("INSERT OR REPLACE INTO storage VALUES (?, ?, ?)").run(
    HISTORY,
    HISTORY_VALUE,
    1,
  );
}

beforeEach(() => {
  registered = [];
  deleteCalls = [];
  localStorage.clear();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-hydrate-iso-"));
  db = new Database(path.join(dir, "live.sqlite3"));
  runMigrations(db);
  seedProfile();

  (
    window as unknown as { electronAPI: { db: ElectronAPI["db"] } }
  ).electronAPI = { db: sqliteBackedDb() };

  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      registered.push([type, listener]);
      add(type, listener, options);
    },
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const [type, listener] of registered) {
    window.removeEventListener(type, listener);
  }
  vi.restoreAllMocks();
  localStorage.clear();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("one unreadable key does not brick the app", () => {
  it("registers the beforeunload handler and the auto-save interval anyway", async () => {
    // THE specific failure. Before the fix this rejected at step 2, so neither
    // handler was ever registered and `<App/>` never mounted.
    await expect(initPersistenceBridge()).resolves.toBeUndefined();

    expect(
      registered.map(([type]) => type),
      "the save-on-close handler must register even with an unreadable key",
    ).toContain("beforeunload");
  });

  it("hydrates every readable NON-PII key, and mirrors no PII key at all", async () => {
    await initPersistenceBridge();

    // The readable non-PII rows are mirrored.
    expect(localStorage.getItem("open3dcalc_theme")).toBe(THEME_VALUE);
    // The unreadable non-PII row is refused (its own spec below), and the
    // readable SETTINGS row was replaced by the unreadable blob in the fixture.
    expect(localStorage.getItem(SETTINGS)).toBeNull();

    // Wave 3 (T3.1): NO PII key is hydrated — the bridge refuses them wholesale,
    // readable or not (QUOTES and HISTORY here are perfectly readable).
    expect(localStorage.getItem(QUOTES)).toBeNull();
    expect(localStorage.getItem(HISTORY)).toBeNull();
    expect(localStorage.getItem(CUSTOMERS)).toBeNull();
    // The PII rows remain on disk and use their dedicated local-data route.
    expect(storedValue(QUOTES)).not.toBeNull();
    expect(storedValue(HISTORY)).not.toBeNull();
    expect(storedValue(CUSTOMERS)).toBe(MARKER);
  });

  it("does not hydrate the unreadable NON-PII key, and does not show it as empty", async () => {
    await initPersistenceBridge();

    // Fail-closed: the unreadable value is NOT materialized.
    expect(localStorage.getItem(SETTINGS)).toBeNull();
    // The unreadable raw value is not surfaced to the renderer.
    expect(localStorage.getItem(SETTINGS) ?? "").not.toContain(
      UNREADABLE_NON_PII_VALUE,
    );
    expect(localStorage.getItem(SETTINGS) ?? "").not.toContain(MARKER);
  });

  it("leaves the unreadable row on disk, untouched, across sweep cycles", async () => {
    // The row's absence from localStorage is a REFUSAL, not staleness. If the
    // 10 s sweep reads it as stale it deletes the very §3.6 recovery target the
    // refusal exists to preserve, within one cycle. Two cycles here, because a
    // single one cannot distinguish "survived the sweep" from "the sweep never
    // ran" — which is the vacuous pass this test used to be.
    vi.useFakeTimers();
    try {
      await initPersistenceBridge();
      expect(storedValue(SETTINGS)).toBe(UNREADABLE_NON_PII_VALUE);

      for (let cycle = 0; cycle < 2; cycle++) {
        await vi.advanceTimersByTimeAsync(10_000);
        expect(storedValue(SETTINGS), `cycle ${cycle + 1}`).toBe(
          UNREADABLE_NON_PII_VALUE,
        );
      }

      expect(
        deleteCalls,
        "the sweep must never issue a delete for a key it could not read",
      ).not.toContain(SETTINGS);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("preserves a declared key whose read failed for a reason that is not the legacy shape", async () => {
    // Any per-key read failure leaves the key absent from localStorage, and absence caused by a
    // failure is not evidence of staleness — whatever the failure's shape. The
    // failure below is deliberately an unforeseen one: its code is not in the
    // known set, so the reason falls back to the generic `unreadable`. The key
    // is NON-PII (`open3dcalc_theme`), which is the only kind the bridge now
    // attempts to load at all.
    const THEME = "open3dcalc_theme";
    const dbApi = (
      window as unknown as { electronAPI: { db: ElectronAPI["db"] } }
    ).electronAPI.db;
    const originalLoad = dbApi.load.bind(dbApi);
    dbApi.load = async (key: string): Promise<string | null> => {
      if (key === THEME) {
        throw new Error(
          "Error invoking remote method 'db:load': Error: a_failure_reason_that_did_not_exist_at_head",
        );
      }
      return originalLoad(key);
    };

    vi.useFakeTimers();
    try {
      await initPersistenceBridge();
      expect(storedValue(THEME)).toBe(THEME_VALUE);

      for (let cycle = 0; cycle < 2; cycle++) {
        await vi.advanceTimersByTimeAsync(10_000);
        expect(storedValue(THEME), `cycle ${cycle + 1}`).toBe(THEME_VALUE);
      }

      expect(
        deleteCalls,
        "a new failure reason must be covered by the same exclusion",
      ).not.toContain(THEME);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("surfaces WHICH classes are unavailable and why, in a way the UI can read", async () => {
    const seen: Array<unknown> = [];
    const listener = (event: Event): void => {
      seen.push((event as CustomEvent).detail);
    };
    window.addEventListener("open3dcalc:pii-unavailable", listener);

    await initPersistenceBridge();

    expect(
      seen.length,
      "an unavailable class must be announced, not silently skipped",
    ).toBeGreaterThan(0);
    const detail = seen[0] as {
      unavailable: Array<{ key: string; reason: string }>;
    };
    expect(detail.unavailable.map((u) => u.key)).toContain(SETTINGS);
    // The refusal reuses the main process's own codes rather than inventing
    // renderer-side wording.
    expect(detail.unavailable[0]!.reason).toBeTruthy();
    window.removeEventListener("open3dcalc:pii-unavailable", listener);
  });

  it("still auto-saves: the handler is live and a good key persists", async () => {
    // Init FIRST: each spec gets its own registration, because the handler is
    // installed by the call and an assertion placed before it asserts on an
    // empty array and looks like a bridge that registered nothing.
    await initPersistenceBridge();

    const beforeunload = registered.filter(([t]) => t === "beforeunload");
    expect(
      beforeunload,
      "the save-on-close handler must be registered exactly once",
    ).toHaveLength(1);

    localStorage.setItem(SETTINGS, '{"theme":"light"}');
    const saved = new Map<string, string>();
    const dbApi = (
      window as unknown as {
        electronAPI: {
          db: { save: (k: string, v: string) => Promise<void> };
        };
      }
    ).electronAPI.db;
    dbApi.save = async (k: string, v: string) => {
      saved.set(k, v);
    };

    // Fire the REAL registered listener — the assertion is that the handler the
    // bridge installed actually works, not that a stub was called.
    const listener = beforeunload[0]![1];
    if (typeof listener === "function") {
      (listener as EventListener)(new Event("beforeunload"));
    }
    await vi.waitFor(() =>
      expect(saved.get(SETTINGS), "a readable key must still persist").toBe(
        '{"theme":"light"}',
      ),
    );
  });

  it("registers the auto-save interval, not just the beforeunload handler", async () => {
    // The interval is a different failure from the handler: it is what makes
    // saves happen at all if `beforeunload` never fires. Both were skipped by
    // the same throw, so both are asserted.
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    await initPersistenceBridge();
    expect(
      setIntervalSpy.mock.calls.length,
      "the auto-save interval must be registered despite the unreadable key",
    ).toBeGreaterThan(0);
  });

  it("a structural failure is still terminal — this fix is not a blanket catch", async () => {
    // If `listKeys` itself fails there is no key set to isolate, and hydrating
    // from stale localStorage would look like success and then lose every write.
    (
      window as unknown as {
        electronAPI: { db: ElectronAPI["db"] };
      }
    ).electronAPI.db.listKeys = async () => {
      throw new Error("SQLITE_CANTOPEN: unable to open database file");
    };

    await expect(initPersistenceBridge()).rejects.toThrow();
    expect(
      registered.map(([type]) => type),
      "a structural failure must not register handlers either",
    ).not.toContain("beforeunload");
  });
});
