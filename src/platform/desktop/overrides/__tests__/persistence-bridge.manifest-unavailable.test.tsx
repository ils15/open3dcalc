// @vitest-environment jsdom

/**
 * An unloadable SPEC-01 manifest must never cause DELETION, and must never make
 * a refused write look like a successful no-op.
 *
 * ## The defect this pins
 *
 * The renderer's manifest gate (`manifestGate.ts`) is fail-closed: when the
 * manifest cannot be loaded it denies EVERY key. The bridge did not distinguish
 * that from "this key is not declared", and the two consequences were both
 * silent:
 *
 *   1. `loadFromDatabase` skipped every key, so localStorage was never
 *      populated — indistinguishable from a fresh profile or data loss; and
 *   2. the 10 s sweep (`deleteStaleKeys`) treats "a DB row whose key is absent
 *      from localStorage" as stale. Since hydration had populated nothing,
 *      EVERY row looked stale, and the sweep deleted the user's entire profile
 *      from SQLite. That is the data-loss bug: a broken manifest became
 *      destruction of the data it could not classify.
 *
 * The sweep whose premise is "these rows are not in localStorage" is INVALID
 * when localStorage was never populated. It is therefore gated on BOTH a
 * complete hydration and an available manifest, and deletion refuses outright
 * at the IPC boundary (`db:delete`, see the closed database IPC allowlist).
 *
 * The `electronAPI.db` seam is backed by REAL better-sqlite3 over a real
 * temporary file migrated by the app's own runner, and every statement it runs
 * is the statement `electron/main.ts` runs for the same IPC channel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ElectronAPI } from "@/platform/desktop/types/electron";
import type { ManifestDocument } from "@/shared/lib/dataManifest";
import {
  isManifestUnavailable,
  resetManifestForTests,
} from "@/shared/lib/manifestGate";
import manifestFixture from "../../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  initPersistenceBridge,
  ManifestUnavailableError,
} from "../persistence-bridge";
import {
  getUnavailableClasses,
  resetUnavailableClassesForTests,
} from "../unavailableClasses";
import { PiiUnavailableBanner } from "@/platform/desktop/components/PersistenceBridgeError/PersistenceBridgeError";
import { runMigrations } from "../../../../../db/database";
import i18n from "@/shared/i18n/i18n";

// Real i18next, not a key-echo: the rendered detail is
// `persistence.recovery.detail` with `{{reason}}` interpolation, so a `t` that
// returned the key would make "the class reached the surface" unfalsifiable.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: i18n.t }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

const CUSTOMERS = "open3dcalc_customers_v1";
const SETTINGS = "open3dcalc_settings_v2";
const INTERNAL = "open3dcalc_synthetic_internal";
const QUOTES = "open3dcalc_quotes_v1";

interface RowSnapshot {
  key: string;
  valueBytes: string;
  updated_at: number;
}

let dir: string;
let db: Database.Database;
let deleteCalls: string[];
let saveCalls: Array<[string, string]>;
let registered: Array<[string, EventListenerOrEventListenerObject]>;

/** Every `storage` row, as bytes, so "byte-identical" means exactly that. */
function snapshot(): RowSnapshot[] {
  return (
    db
      .prepare("SELECT key, value, updated_at FROM storage ORDER BY key")
      .all() as Array<{ key: string; value: string; updated_at: number }>
  ).map(({ key, value, updated_at }) => ({
    key,
    valueBytes: Buffer.from(value, "utf8").toString("hex"),
    updated_at,
  }));
}

function seedRow(key: string, value: string, updatedAt: number): void {
  db.prepare("INSERT INTO storage VALUES (?, ?, ?)").run(key, value, updatedAt);
}

function sqliteBackedDb(): ElectronAPI["db"] {
  return {
    load: async (key: string): Promise<string | null> => {
      const row = db
        .prepare("SELECT value FROM storage WHERE key = ?")
        .get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    save: async (key: string, value: string) => {
      saveCalls.push([key, value]);
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

beforeEach(() => {
  registered = [];
  deleteCalls = [];
  saveCalls = [];
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-manifest-unavailable-"));
  db = new Database(path.join(dir, "live.sqlite3"));
  runMigrations(db);
  seedRow(CUSTOMERS, '{"customers":["synthetic"]}', 7);
  seedRow(SETTINGS, '{"theme":"dark"}', 8);
  seedRow(INTERNAL, "internal-only", 9);

  (
    window as unknown as { electronAPI: { db: ElectronAPI["db"] } }
  ).electronAPI = { db: sqliteBackedDb() };
  resetUnavailableClassesForTests();
  // The state under test: the manifest itself will not load, so no key can be
  // classified. Nothing is in localStorage, exactly as after an empty hydration.
  resetManifestForTests(null);
});

afterEach(() => {
  for (const [type, listener] of registered) {
    window.removeEventListener(type, listener);
  }
  resetManifestForTests(undefined);
  resetUnavailableClassesForTests();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  localStorage.clear();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("persistence bridge — unloadable manifest", () => {
  it("a sweep cycle deletes NOTHING and leaves every row byte-identical", async () => {
    // The headline guarantee. Against the unfixed bridge this fails at the
    // first assertion: the sweep treats every row as stale because hydration
    // populated nothing, and deletes the whole profile.
    await initPersistenceBridge();
    const before = snapshot();
    expect(before.length).toBeGreaterThan(0);

    for (let cycle = 0; cycle < 3; cycle++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }

    expect(
      deleteCalls,
      "an unloadable manifest must never drive a deletion",
    ).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it("refuses a write visibly instead of reporting an empty successful pass", async () => {
    await initPersistenceBridge();
    const before = snapshot();

    const refused: Array<{ reason: string }> = [];
    const listener = (event: Event): void => {
      const detail = (event as CustomEvent<{ unavailable?: unknown }>).detail;
      const unavailable = Array.isArray(detail?.unavailable)
        ? detail.unavailable
        : [];
      for (const entry of unavailable as Array<{ reason?: unknown }>) {
        if (typeof entry.reason === "string")
          refused.push({ reason: entry.reason });
      }
    };
    window.addEventListener("open3dcalc:pii-unavailable", listener);

    // The real registered save-on-close handler, which is the write path a
    // user actually triggers by closing the window.
    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();

    window.removeEventListener("open3dcalc:pii-unavailable", listener);

    // Not a silent no-op: no write was attempted…
    expect(saveCalls).toEqual([]);
    // …and the refusal is announced with the manifest's own class, rather than
    // the pass reporting "Saved 0 keys" as though everything were fine.
    expect(
      refused.map((entry) => entry.reason),
      "a refused write must raise the manifest_unavailable signal",
    ).toContain("manifest_unavailable");
    expect(snapshot()).toEqual(before);
  });

  it("latches the class and renders it through the user-visible banner", async () => {
    await initPersistenceBridge();

    // The class is latched from the manifest failure itself, without depending
    // on a `db:load` that is never issued (every key is denied before any load).
    expect(isManifestUnavailable()).toBe(true);
    expect(getUnavailableClasses().map((entry) => entry.reason)).toContain(
      "manifest_unavailable",
    );

    // …and it reaches the component a user actually sees, not merely the IPC
    // payload: the banner reads the latch and renders the code in its detail.
    render(<PiiUnavailableBanner />);
    expect(document.body.textContent).toContain("manifest_unavailable");
  });

  it("couples the two invariants: deletes are refused only while writes are too", async () => {
    // INVARIANT COUPLING. Deferring every delete while the manifest is
    // unloadable is safe ONLY because the write path is refused at the same
    // time: a delete refusal alone would let a later write resurrect a value
    // the user removed, and worse, an unclassifiable row has no owner to
    // protect it. This spec links the two so a future change that re-enables
    // writes under an unloadable manifest fails loudly here, next to the
    // delete-refusal guarantee it invalidates.
    await initPersistenceBridge();
    const before = snapshot();

    // The refused WRITE, through the real registered save-on-close handler.
    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();

    const refusedWrite = vi
      .mocked(console.warn)
      .mock.calls.map(([, error]) => error)
      .find((error) => error instanceof ManifestUnavailableError);
    expect(
      refusedWrite,
      "a write attempted while the manifest is unloadable must be REFUSED, not silently saved",
    ).toBeInstanceOf(ManifestUnavailableError);

    // …and the paired delete refusal, in the same run.
    for (let cycle = 0; cycle < 3; cycle++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(deleteCalls, "…and the paired delete refusal holds").toEqual([]);
    expect(snapshot()).toEqual(before);
  });
});

describe("persistence bridge — a healthy manifest still sweeps", () => {
  it("cleans a hydrated settings key but preserves unknown and PII rows", async () => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    await initPersistenceBridge();
    expect(localStorage.getItem(SETTINGS)).toBe('{"theme":"dark"}');
    // A runtime removal of a positively hydrated, known non-PII key is the only
    // condition that permits stale cleanup.
    localStorage.removeItem(SETTINGS);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(
      deleteCalls,
      "the sweep must clean a positively hydrated non-PII settings key",
    ).toContain(SETTINGS);
    expect(deleteCalls).not.toContain(INTERNAL);
    expect(
      db.prepare("SELECT value FROM storage WHERE key = ?").get(CUSTOMERS),
    ).toBeDefined();
    expect(
      db.prepare("SELECT value FROM storage WHERE key = ?").get(INTERNAL),
    ).toEqual({ value: "internal-only" });
  });

  it("preserves a declared key that enters storage after hydration", async () => {
    // A MISSING `hydrationOutcomes` record is not positive proof of staleness.
    // The sweep re-reads `listKeys()` every cycle, so a row can appear in
    // `storage` that hydration never enumerated: a second writer (another app
    // instance, a restored or copied profile) or a future store that writes to
    // the dedicated local-data route. Here the key IS manifest-declared
    // (`open3dcalc_quotes_v1`), so the old sweep — which deleted any row with no
    // record — destroyed it without ever having classified it. The fix fails
    // closed on a missing record for a declared key, exactly as it does for a
    // refused read (`not_hydrated`).
    resetManifestForTests(manifestFixture as ManifestDocument);
    await initPersistenceBridge();

    // Inserted AFTER hydration has finished enumerating `storage`.
    seedRow(QUOTES, '{"quotes":["synthetic"]}', 11);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(
      deleteCalls,
      "a declared key with no hydrated record must not be swept: absence of a record is not proof of staleness",
    ).not.toContain(QUOTES);
    expect(
      db.prepare("SELECT value FROM storage WHERE key = ?").get(QUOTES),
      "the post-hydration row must survive the sweep",
    ).toBeDefined();
  });
});
