import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NEW_PII_CHANNELS,
  registerPasswordlessPiiHandlers,
} from "../newPiiIpc.js";
import {
  NEW_PII_STORAGE_KEYS,
  assertNewPiiStorageKey,
} from "../../src/shared/lib/crypto/newPiiNamespace.js";
import { registerDatabaseStorageHandlers } from "../databaseIpc.js";
import { requestNewPiiErasure } from "../newPiiErasure.js";
import type { MinimalStorageDb } from "../persistGate.js";

type Handler = (...args: unknown[]) => unknown;

const ENVELOPE = JSON.stringify({
  state: { records: [{ id: "synthetic-record-01", label: "Example" }] },
  version: 1,
});
const TRUSTED_EVENT = { senderFrame: { url: "file:///app/index.html" } };

function makeDatabase(seed: Array<[string, string]> = []) {
  const rows = new Map(seed);
  const sql: string[] = [];
  const db: MinimalStorageDb = {
    prepare(statement: string) {
      sql.push(statement);
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          if (statement.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (statement.includes("DELETE FROM storage")) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all() {
          return [...rows.keys()].map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows, sql };
}

function registerRoute(
  db: MinimalStorageDb,
  profileDir: string,
  assertTrustedSender: (event: unknown) => void = () => {},
) {
  const handlers = new Map<string, Handler>();
  registerPasswordlessPiiHandlers(
    {
      handle: (channel: string, handler: Handler) =>
        handlers.set(channel, handler),
    } as never,
    { $client: db },
    assertTrustedSender,
    profileDir,
  );
  return handlers;
}

let profileDir: string;
let previousBetaSetting: string | undefined;

beforeEach(() => {
  profileDir = mkdtempSync(join(tmpdir(), "o3dc-plaintext-pii-"));
  previousBetaSetting = process.env.VITE_BETA_CHANNEL;
  delete process.env.VITE_BETA_CHANNEL;
});

afterEach(() => {
  if (previousBetaSetting === undefined) delete process.env.VITE_BETA_CHANNEL;
  else process.env.VITE_BETA_CHANNEL = previousBetaSetting;
  rmSync(profileDir, { recursive: true, force: true });
});

describe("exact Desktop plaintext PII route", () => {
  it("reports plaintext availability without a crypto capability", async () => {
    const { db } = makeDatabase();
    const handlers = registerRoute(db, profileDir);
    expect(handlers.get(NEW_PII_CHANNELS.capability)!(TRUSTED_EVENT)).toEqual({
      available: true,
      backend: "plaintext",
    });
  });

  it.each(NEW_PII_STORAGE_KEYS)(
    "saves and reads a plaintext envelope at the exact key %s",
    async (key) => {
      const { db, rows, sql } = makeDatabase();
      const handlers = registerRoute(db, profileDir);
      await expect(
        handlers.get(NEW_PII_CHANNELS.save)!(TRUSTED_EVENT, key, ENVELOPE),
      ).resolves.toBeUndefined();
      expect(rows.get(key)).toBe(ENVELOPE);
      await expect(
        handlers.get(NEW_PII_CHANNELS.load)!(TRUSTED_EVENT, key),
      ).resolves.toBe(ENVELOPE);
      expect(sql).toEqual([
        "SELECT value FROM storage WHERE key = ?",
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        "SELECT value FROM storage WHERE key = ?",
      ]);
    },
  );

  it("loads the persisted plaintext envelope after handlers are re-registered", async () => {
    const firstProcessStore = makeDatabase();
    const firstProcessHandlers = registerRoute(
      firstProcessStore.db,
      profileDir,
    );

    await firstProcessHandlers.get(NEW_PII_CHANNELS.save)!(
      TRUSTED_EVENT,
      NEW_PII_STORAGE_KEYS[0],
      ENVELOPE,
    );

    // Simulate a process restart: handler state is discarded while SQLite rows
    // survive and are loaded into the new process's database handle.
    const persistedRows = [...firstProcessStore.rows.entries()];
    const restartedProcessStore = makeDatabase(persistedRows);
    const restartedProcessHandlers = registerRoute(
      restartedProcessStore.db,
      profileDir,
    );

    await expect(
      restartedProcessHandlers.get(NEW_PII_CHANNELS.load)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
      ),
    ).resolves.toBe(ENVELOPE);
  });

  it("authorizes exact keys before parameterized SQL and preserves sender validation", async () => {
    const rejectSender = vi.fn(() => {
      throw new Error("Untrusted IPC sender rejected");
    });
    const { db, sql } = makeDatabase();
    const handlers = registerRoute(db, profileDir, rejectSender);

    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        "open3dcalc_pwless_customers_v1",
        ENVELOPE,
      ),
    ).rejects.toThrow(/Untrusted IPC sender/);
    expect(rejectSender).toHaveBeenCalledOnce();
    expect(sql).toEqual([]);

    const route = registerRoute(db, profileDir);
    await expect(
      route.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        "open3dcalc_pwless_invented_v9",
        ENVELOPE,
      ),
    ).rejects.toMatchObject({ reason: "new_pii_key_refused" });
    await expect(
      route.get(NEW_PII_CHANNELS.load)!(
        TRUSTED_EVENT,
        "open3dcalc_customers_v1",
      ),
    ).rejects.toMatchObject({ reason: "new_pii_key_refused" });
    expect(sql).toEqual([]);
  });

  it("refuses malformed or legacy rows rather than reading or overwriting them", async () => {
    const legacy = "enc1:profileKey:{synthetic-encrypted-row}";
    const { db, rows } = makeDatabase([[NEW_PII_STORAGE_KEYS[0], legacy]]);
    const handlers = registerRoute(db, profileDir);
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
      ),
    ).rejects.toMatchObject({ reason: "non_plaintext_record_shape" });
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
        ENVELOPE,
      ),
    ).rejects.toMatchObject({ reason: "non_plaintext_record_shape" });
    expect(rows.get(NEW_PII_STORAGE_KEYS[0])).toBe(legacy);

    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[1],
        "not-json",
      ),
    ).rejects.toMatchObject({ reason: "invalid_plaintext_envelope" });
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[2],
      ),
    ).resolves.toBeNull();
  });

  it("keeps all pwless keys denied by generic db IPC", async () => {
    const { db, sql } = makeDatabase();
    const handlers = new Map<string, Handler>();
    registerDatabaseStorageHandlers(
      {
        handle: (channel: string, handler: Handler) =>
          handlers.set(channel, handler),
      } as never,
      { $client: db },
      () => {},
    );
    for (const key of NEW_PII_STORAGE_KEYS) {
      await expect(
        handlers.get("db:load")!(TRUSTED_EVENT, key),
      ).rejects.toThrow(/not permitted/i);
      await expect(
        handlers.get("db:save")!(TRUSTED_EVENT, key, ENVELOPE),
      ).rejects.toThrow(/not permitted/i);
      expect(() => assertNewPiiStorageKey(key)).not.toThrow();
    }
    expect(sql).toEqual([]);
  });

  it("keeps the durable exact-key erasure lock ahead of reads and writes", async () => {
    requestNewPiiErasure(profileDir, "synthetic-profile");
    const { db, rows, sql } = makeDatabase();
    const handlers = registerRoute(db, profileDir);
    expect(handlers.get(NEW_PII_CHANNELS.capability)!(TRUSTED_EVENT)).toEqual({
      available: false,
      reason: "withdrawal_pending",
    });
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
        ENVELOPE,
      ),
    ).rejects.toMatchObject({ reason: "withdrawal_pending" });
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
      ),
    ).rejects.toMatchObject({ reason: "withdrawal_pending" });
    expect(rows.size).toBe(0);
    expect(sql).toEqual([]);
  });

  it("still refuses the PII route on the Beta Electron runtime", async () => {
    process.env.VITE_BETA_CHANNEL = "true";
    const { db, sql } = makeDatabase();
    const handlers = registerRoute(db, profileDir);
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        TRUSTED_EVENT,
        NEW_PII_STORAGE_KEYS[0],
        ENVELOPE,
      ),
    ).rejects.toThrow(/Beta channel is Web-only/);
    expect(sql).toEqual([]);
  });
});
