/**
 * The `pii_stage` preimage must survive the 10 s stale-key sweep — and the
 * bridge must not carry any PII value into the renderer at all (Wave 3, T3.1).
 *
 * ## The structural hazard this file pins
 *
 * The separate table keeps staged values outside the bridge's renderer-facing
 * key surface. Unknown storage rows are now preserved too, but this spec pins
 * that fact against the REAL bridge rather than a description of it.
 *
 * Before T3.1 there was a second fate: a manifest-ALLOWED `storage` row was
 * decrypted into renderer `localStorage` as PLAINTEXT by the startup pass. That
 * is the plaintext mirror Wave 3 removes, and it is now asserted as ABSENT: the
 * manifest-allowed PII row's stored bytes are REWRITTEN AS PLAINTEXT by the
 * legacy writer, but the renderer NEVER holds the decrypted value, and the
 * sweep NEVER destroys the row. The row is retained (copy-without-delete) and
 * the renderer copy is refused.
 *
 * The `pii_stage` row, written through the real `stagePreimage`, is untouched
 * by both.
 *
 * The `electronAPI.db` seam is backed by REAL better-sqlite3 over a real
 * temporary file migrated by the app's own runner, and every statement it runs
 * is the statement `electron/main.ts` runs for the same IPC channel
 * (`db:load` :230, `db:save` :249, `db:delete` :271, `db:list-keys` :286).
 * `load` additionally mirrors `loadGated`'s contract — a PII row stored as an
 * `enc1:` envelope is handed back decrypted — because the IPC surface still
 * decrypts on the way out and the bridge is what must refuse to mirror it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ElectronAPI } from "@/platform/desktop/types/electron";
import { initPersistenceBridge } from "../persistence-bridge";
import { runMigrations } from "../../../../../db/database";
import { stagePreimage, type StageDb } from "../../../../../electron/piiStage";

/** Synthetic PII marker — never real personal data. */
const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";
/** A sealed envelope, in the shape `loadGated` would hand back decrypted. */
const SEALED = `enc1:plain:${Buffer.from(MARKER, "utf8").toString("base64")}`;
/** Manifest-declared PII key: the bridge refuses to materialize it. */
const ALLOWED_KEY = "open3dcalc_customers_v1";
const LEGACY_PII_KEY = "open3dcalc_quotes_v1";
const LEGACY_PII_BYTES = '{"quotes":[{"customer":"Legacy PII 🧪"}]}';
/** A key the manifest does not know: default-deny, never materialized. */
const INTERNAL_KEY = "open3dcalc_pii_stage_tx1";

let dir: string;
let dbPath: string;
let db: Database.Database;
let registered: Array<[string, EventListenerOrEventListenerObject]>;
let loadCalls: string[];

/** The value `storage` holds for a key, straight off disk. */
function storedValue(key: string): string | null {
  return (
    (
      db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
        { value: string } | undefined
    )?.value ?? null
  );
}

function stageRowCount(): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM pii_stage").get() as { c: number }
  ).c;
}

function storedStageBlob(): string | undefined {
  return (
    db
      .prepare(
        "SELECT blob FROM pii_stage WHERE transaction_id = ? AND generation = ?",
      )
      .get("tx-0001", 1) as { blob: string } | undefined
  )?.blob;
}

/** Every `storage` key currently holding the sealed preimage, in key order. */
async function preimageHolders(): Promise<string[]> {
  const keys = await sqliteBackedDb().listKeys();
  return keys.filter((k) => storedValue(k) === SEALED);
}

/**
 * `window.electronAPI.db` over a real SQLite file, statement for statement the
 * handlers in `electron/main.ts` use.
 */
function sqliteBackedDb(): ElectronAPI["db"] {
  return {
    load: async (key: string) => {
      loadCalls.push(key);
      const row = db
        .prepare("SELECT value FROM storage WHERE key = ?")
        .get(key) as { value: string } | undefined;
      if (!row) return null;
      // Mirrors loadGated: a PII row is stored sealed and read back decrypted.
      return row.value.startsWith("enc1:plain:")
        ? Buffer.from(row.value.slice("enc1:plain:".length), "base64").toString(
            "utf8",
          )
        : row.value;
    },
    save: async (key: string, value: string) => {
      db.prepare(
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      ).run(key, value, Date.now());
    },
    delete: async (key: string) => {
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
  // First: the teardown loop iterates `registered`, so it must be iterable even
  // when the setup below throws. Assigned further down, it was `undefined` here
  // and a failing `beforeEach` made `afterEach` throw
  // `TypeError: registered is not iterable` — which replaced the test's own
  // failure with a teardown failure two stacks deeper.
  registered = [];
  loadCalls = [];

  vi.useFakeTimers();
  localStorage.clear();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-stage-sweep-"));
  dbPath = path.join(dir, "live.sqlite3");
  db = new Database(dbPath);
  runMigrations(db);

  // The real stage write, through the real state machine.
  stagePreimage(db as unknown as StageDb, {
    transactionId: "tx-0001",
    generation: 1,
    privacyEpoch: 2,
    schemaVersion: 1,
    envelopeVersion: 3,
    state: "staged",
    blob: SEALED,
    createdAt: 1_700_000_000_000,
  });

  // Control A: what a `storage`-table stage would look like for a key the
  // renderer never has — the manifest does not know it, so it is never
  // materialized and the sweep owns it.
  db.prepare("INSERT INTO storage VALUES (?, ?, ?)").run(
    INTERNAL_KEY,
    SEALED,
    1,
  );
  // Control B: …and for a key the manifest DOES allow, where the danger is not
  // deletion but the plaintext copy the renderer is entitled to hold.
  db.prepare("INSERT INTO storage VALUES (?, ?, ?)").run(
    ALLOWED_KEY,
    SEALED,
    1,
  );
  db.prepare("INSERT INTO storage VALUES (?, ?, ?)").run(
    LEGACY_PII_KEY,
    LEGACY_PII_BYTES,
    2,
  );

  (
    window as unknown as { electronAPI: { db: ElectronAPI["db"] } }
  ).electronAPI = { db: sqliteBackedDb() };

  // initPersistenceBridge() adds one beforeunload listener per call; they close
  // over this spec's db, so they are torn down per spec.
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
});

afterEach(() => {
  for (const [type, listener] of registered) {
    window.removeEventListener(type, listener);
  }
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  localStorage.clear();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("pii_stage vs. the 10 s persistence-bridge sweep", () => {
  it("preserves unknown storage rows and the staged preimage byte for byte", async () => {
    await initPersistenceBridge();

    // T3.1 ABSENCE ASSERTION. The manifest-allowed PII row must NOT be mirrored
    // into the renderer. Before Wave 3 this line read `toBe(MARKER)` — the
    // plaintext mirror the remediation removes — so this is the exact inversion
    // the task calls for: prove NO PII plaintext is rehydrated.
    expect(localStorage.getItem(ALLOWED_KEY)).toBeNull();

    // One sweep cycle must not interpret an unknown/internal row as stale.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(storedValue(INTERNAL_KEY)).toBe(SEALED);

    // The manifest-allowed PII row is RETAINED (copy-without-delete): the
    // sweep must not destroy a row the app may still need, even though the
    // renderer never holds it.
    expect(storedValue(ALLOWED_KEY)).not.toBeNull();

    // The staged preimage: still there, byte for byte, and never materialized
    // in the renderer. The renderer holds only what the app is entitled to hold
    // (the `open3dcalc_theme` row migration 0001 seeds) — nothing stage-related,
    // and no sealed envelope anywhere.
    expect(storedStageBlob()).toBe(SEALED);
    expect(stageRowCount()).toBe(1);
    expect(storedValue(LEGACY_PII_KEY)).toBe(LEGACY_PII_BYTES);
    expect(Object.keys(localStorage)).not.toContain("pii_stage");
    expect(Object.keys(localStorage).join(",")).not.toContain("tx-0001");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      expect(
        localStorage.getItem(key),
        `renderer key ${key} must not hold the sealed preimage`,
      ).not.toBe(SEALED);
      expect(
        localStorage.getItem(key),
        `renderer key ${key} must not hold decrypted PII`,
      ).not.toBe(MARKER);
    }
  });

  it("survives repeated sweep cycles, and the sweep really is the 10 s one", async () => {
    await initPersistenceBridge();

    // Nothing before the interval fires.
    expect(storedStageBlob()).toBe(SEALED);

    // Several cycles, the way a long session runs.
    for (let cycle = 0; cycle < 3; cycle++) {
      await vi.advanceTimersByTimeAsync(10_000);
      expect(storedStageBlob(), `cycle ${cycle + 1}`).toBe(SEALED);
    }
    expect(stageRowCount()).toBe(1);
    // The bytes are on disk, not just in a returned object.
    expect(fs.readFileSync(dbPath).includes(Buffer.from(SEALED, "utf8"))).toBe(
      true,
    );
    // The sweep ran, but unknown rows are not eligible for destructive cleanup.
    expect(storedValue(INTERNAL_KEY)).toBe(SEALED);
  });

  it("never puts the sealed preimage on the key surface the sweep enumerates", async () => {
    // `deleteStaleKeys` iterates `db().listKeys()` — the `storage` keys. A
    // `storage`-backed stage is on that surface BY CONSTRUCTION, whether or not
    // the pass goes on to delete it, so the surface is checked on the VALUE:
    // which keys hold the sealed preimage. The only one allowed to is the
    // controls this test inserted itself are retained; the bridge is not
    // allowed to infer ownership or staleness for unknown keys.
    //
    // Asserting on key NAMES cannot do this, and the reason is worth recording:
    // no `storage` key is ever literally called "pii_stage", so
    // `expect(keys).not.toContain("pii_stage")` is a tautology over the schema
    // and passes against a stage that IS a `storage` row. Equally, a
    // `not.toBe(SEALED)` over `load(k)` does not discriminate either, because
    // this spec's `load` shim mirrors `loadGated` and hands `enc1:plain:` back
    // DECRYPTED — a storage-backed stage reads back as the marker, not the
    // sealed bytes. The stored bytes are the only thing that tells them apart.
    await initPersistenceBridge();
    expect(await preimageHolders()).toEqual([ALLOWED_KEY, INTERNAL_KEY]);

    // One cycle later both rows remain byte-identical: only an explicitly
    // allowlisted non-PII key hydrated this session is eligible for cleanup.
    await vi.advanceTimersByTimeAsync(10_000);
    const holders = await preimageHolders();
    expect(holders).toEqual([ALLOWED_KEY, INTERNAL_KEY]);
    // T3.1: no PII was rehydrated from the decrypted IPC payload.
    expect(localStorage.getItem(ALLOWED_KEY)).toBeNull();
    expect(localStorage.getItem(ALLOWED_KEY)).not.toBe(MARKER);
  });

  it("retains the manifest-allowed PII row while never re-materializing it", async () => {
    // T3.2: a PII `storage` row is NOT stale merely because the renderer has no
    // counterpart — the bridge refuses to mirror it, and the sweep must read
    // that refusal as a refusal, not as deletion evidence. The row is retained
    // (copy-without-delete) with its stored bytes untouched (the sweep writes
    // nothing back; it has no business rewriting a row it refuses to hydrate).
    await initPersistenceBridge();
    expect(storedValue(ALLOWED_KEY)).toBe(SEALED);

    await vi.advanceTimersByTimeAsync(10_000);

    // Retained, byte for byte.
    expect(storedValue(ALLOWED_KEY)).toBe(SEALED);
    // And still not materialized in the renderer.
    expect(localStorage.getItem(ALLOWED_KEY)).toBeNull();
  });

  it("preserves old plaintext PII bytes when absent from renderer localStorage", async () => {
    await initPersistenceBridge();
    expect(localStorage.getItem(LEGACY_PII_KEY)).toBeNull();
    expect(loadCalls).not.toContain(LEGACY_PII_KEY);
    expect(loadCalls).not.toContain(ALLOWED_KEY);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(storedValue(LEGACY_PII_KEY)).toBe(LEGACY_PII_BYTES);
    expect(localStorage.getItem(LEGACY_PII_KEY)).toBeNull();
    expect(loadCalls).not.toContain(LEGACY_PII_KEY);
  });

  it("never writes a decrypted PII value even when the IPC load returns one", async () => {
    // T3.1, the rehydration half. The `db:load` seam here returns the marker
    // DECRYPTED for the manifest-allowed PII key (exactly what `loadGated` does
    // on the way out). Before Wave 3 the bridge wrote that returned string
    // straight into localStorage; after Wave 3 it must be refused, because the
    // value came back decrypted and the renderer is not entitled to it.
    await initPersistenceBridge();
    expect(localStorage.getItem(ALLOWED_KEY)).toBeNull();
    // And the row is still on disk, retained for the encrypted adapter to read.
    expect(storedValue(ALLOWED_KEY)).not.toBeNull();
  });
});
