/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const manifestState = vi.hoisted(() => ({ unavailable: false }));

vi.mock("../manifestSource.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../manifestSource.js")>();
  return {
    ...actual,
    loadManifestFromDisk: (): ReturnType<
      typeof actual.loadManifestFromDisk
    > => {
      if (manifestState.unavailable) {
        throw new Error("synthetic manifest unavailable");
      }
      return actual.loadManifestFromDisk();
    },
  };
});

import {
  registerDatabaseStorageHandlers,
  registerDisabledDatabaseImportHandler,
} from "../databaseIpc.js";
import { isNewPiiNamespaceKey } from "../../src/shared/lib/crypto/newPiiNamespace.js";
import type { MinimalStorageDb } from "../persistGate.js";

type Handler = (...args: unknown[]) => unknown;

function makeDatabase() {
  const rows = new Map<string, string>([
    ["open3dcalc_settings_v2", '{"units":"metric"}'],
    ["open3dcalc_catalog_v1", '{"catalog":"sentinel"}'],
    ["open3dcalc_products", '{"products":"sentinel"}'],
    ["open3dcalc_consent_v1", '{"consent":"sentinel"}'],
    ["open3dcalc_customers_v1", '{"customers":"PII sentinel"}'],
    ["open3dcalc_migration_done_v2", '{"history":"PII sentinel"}'],
    ["unknown_secret_key", "unknown sentinel"],
  ]);
  const calls = {
    get: 0,
    run: 0,
    all: 0,
    allArgs: [] as unknown[][],
    prepare: [] as string[],
  };
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      calls.prepare.push(sql);
      return {
        get(...params: unknown[]) {
          calls.get++;
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          calls.run++;
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (sql.includes("DELETE FROM storage")) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all(...params: unknown[]) {
          calls.all++;
          calls.allArgs.push(params);
          // Deliberately model an unexpectedly broad SQLite response. The IPC
          // layer must still filter its result to the exact safe-key allowlist.
          void params;
          return [...rows.keys()].sort().map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows, calls };
}

function register(
  db: MinimalStorageDb,
  options?: { excludedKeys: readonly string[] },
) {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
  };
  registerDatabaseStorageHandlers(
    ipcMain as never,
    { $client: db },
    () => {},
    options,
  );
  return { handlers, ipcMain };
}

const trustedEvent = { senderFrame: { url: "file:///app/index.html" } };

beforeEach(() => {
  manifestState.unavailable = false;
});

describe("closed Electron database IPC policy", () => {
  it("can keep Beta non-PII storage while excluding consent state", async () => {
    const { db, calls } = makeDatabase();
    const { handlers } = register(db, {
      excludedKeys: ["open3dcalc_consent_v1"],
    });

    await expect(
      handlers.get("db:load")?.(trustedEvent, "open3dcalc_consent_v1"),
    ).rejects.toThrow(/not permitted/);
    expect(calls.get).toBe(0);
    await expect(
      handlers.get("db:list-keys")?.(trustedEvent),
    ).resolves.not.toContain("open3dcalc_consent_v1");
    expect(calls.allArgs.at(-1)).not.toContain("open3dcalc_consent_v1");
  });

  it("fails closed before SQLite when manifest classification is unavailable", async () => {
    const { db, calls } = makeDatabase();
    const { handlers } = register(db);
    manifestState.unavailable = true;

    await expect(
      handlers.get("db:load")!(trustedEvent, "open3dcalc_settings_v2"),
    ).rejects.toThrow(/not permitted/i);
    await expect(
      handlers.get("db:save")!(
        trustedEvent,
        "open3dcalc_settings_v2",
        "replacement",
      ),
    ).rejects.toThrow(/not permitted/i);
    await expect(
      handlers.get("db:delete")!(trustedEvent, "open3dcalc_settings_v2"),
    ).rejects.toThrow(/not permitted/i);
    await expect(handlers.get("db:list-keys")!(trustedEvent)).rejects.toThrow(
      /not permitted/i,
    );

    expect(calls).toMatchObject({ get: 0, run: 0, all: 0, prepare: [] });
  });

  it.each([
    "open3dcalc_customers_v1",
    "open3dcalc_migration_done_v2",
    "unknown_secret_key",
  ])(
    "denies load/save/delete for %s before any SQLite operation",
    async (key) => {
      const { db, calls } = makeDatabase();
      const { handlers } = register(db);

      await expect(handlers.get("db:load")!(trustedEvent, key)).rejects.toThrow(
        /not permitted/i,
      );
      await expect(
        handlers.get("db:save")!(trustedEvent, key, "replacement"),
      ).rejects.toThrow(/not permitted/i);
      await expect(
        handlers.get("db:delete")!(trustedEvent, key),
      ).rejects.toThrow(/not permitted/i);

      expect(calls).toMatchObject({ get: 0, run: 0, all: 0, prepare: [] });
    },
  );

  it("keeps all safe sentinel rows unchanged after denied operations", async () => {
    const { db, rows, calls } = makeDatabase();
    const { handlers } = register(db);
    const before = new Map(rows);

    for (const key of ["open3dcalc_customers_v1", "unknown_secret_key"]) {
      for (const operation of ["db:load", "db:save", "db:delete"]) {
        const handler = handlers.get(operation)!;
        const args =
          operation === "db:save"
            ? [trustedEvent, key, "x"]
            : [trustedEvent, key];
        await expect(handler(...args)).rejects.toThrow(/not permitted/i);
      }
    }

    expect([...rows]).toEqual([...before]);
    expect(calls).toMatchObject({ get: 0, run: 0, all: 0, prepare: [] });
  });

  it.each([
    "open3dcalc_settings_v2",
    "open3dcalc_catalog_v1",
    "open3dcalc_products",
  ])(
    "preserves exact allowlisted %s load/save/delete behavior",
    async (key) => {
      const { db, rows } = makeDatabase();
      const { handlers } = register(db);
      const load = handlers.get("db:load")!;
      const save = handlers.get("db:save")!;
      const remove = handlers.get("db:delete")!;

      await expect(load(trustedEvent, key)).resolves.toBe(rows.get(key));
      await expect(
        save(trustedEvent, key, "updated sentinel"),
      ).resolves.toBeUndefined();
      expect(rows.get(key)).toBe("updated sentinel");
      await expect(remove(trustedEvent, key)).resolves.toBeUndefined();
      expect(rows.has(key)).toBe(false);
    },
  );

  it("keeps consent to its one fixed non-PII row", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = register(db);
    const replacement = JSON.stringify({
      state: { consentGiven: false, withdrawnReceipts: [] },
      version: 1,
    });

    await expect(
      handlers.get("db:load")!(trustedEvent, "open3dcalc_consent_v1"),
    ).resolves.toBe('{"consent":"sentinel"}');
    await expect(
      handlers.get("db:save")!(
        trustedEvent,
        "open3dcalc_consent_v1",
        replacement,
      ),
    ).resolves.toBeUndefined();
    expect(rows.get("open3dcalc_consent_v1")).toBe(replacement);
  });

  it("rejects an arbitrary write to the consent row before SQLite", async () => {
    const { db, rows, calls } = makeDatabase();
    const { handlers } = register(db);
    const before = rows.get("open3dcalc_consent_v1");

    await expect(
      handlers.get("db:save")!(
        trustedEvent,
        "open3dcalc_consent_v1",
        "arbitrary blob with PII",
      ),
    ).rejects.toThrow(/not permitted/i);

    expect(rows.get("open3dcalc_consent_v1")).toBe(before);
    expect(calls.prepare).toEqual([]);
  });

  it("accepts a structurally valid consent record write", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = register(db);
    const valid = JSON.stringify({
      state: { consentGiven: false, withdrawnReceipts: [] },
      version: 1,
    });

    await expect(
      handlers.get("db:save")!(trustedEvent, "open3dcalc_consent_v1", valid),
    ).resolves.toBeUndefined();
    expect(rows.get("open3dcalc_consent_v1")).toBe(valid);
  });

  it("preserves the consent receipt against generic deletion", async () => {
    const { db, rows, calls } = makeDatabase();
    const { handlers } = register(db);

    await expect(
      handlers.get("db:delete")!(trustedEvent, "open3dcalc_consent_v1"),
    ).rejects.toThrow(/not permitted/i);

    expect(rows.has("open3dcalc_consent_v1")).toBe(true);
    expect(calls.run).toBe(0);
  });

  it("filters key listing without exposing PII or unknown key inventory", async () => {
    const { db, calls } = makeDatabase();
    const { handlers } = register(db);

    await expect(handlers.get("db:list-keys")!(trustedEvent)).resolves.toEqual([
      "open3dcalc_catalog_v1",
      "open3dcalc_consent_v1",
      "open3dcalc_products",
      "open3dcalc_settings_v2",
    ]);
    expect(calls.all).toBe(1);
    expect(calls.prepare[0]).toMatch(/WHERE\s+key\s+IN\s*\(/i);
    expect(calls.prepare[0]).not.toMatch(
      /SELECT\s+key\s+FROM\s+storage\s+ORDER\s+BY/i,
    );
    expect(calls.allArgs[0]).toEqual([
      "open3dcalc_settings_v2",
      "open3dcalc_catalog_v1",
      "open3dcalc_filaments",
      "open3dcalc_color_palette_v1",
      "open3dcalc_consent_v1",
      "open3dcalc_tutorial_v1",
      "open3dcalc_onboarded",
      "open3dcalc_dashboard_v1",
      "open3dcalc_sections",
      "open3dcalc_theme",
      "open3dcalc_products",
    ]);
  });

  it("fails closed for database import before any database or file capability is needed", async () => {
    const handlers = new Map<string, Handler>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: Handler) =>
        handlers.set(channel, handler),
      ),
    };
    const assertTrustedSender = vi.fn();
    registerDisabledDatabaseImportHandler(
      ipcMain as never,
      assertTrustedSender,
    );

    await expect(handlers.get("db:import")!(trustedEvent)).rejects.toThrow(
      /disabled.*legacy PII/i,
    );
    expect(assertTrustedSender).toHaveBeenCalledOnce();
  });
});

describe("generic database IPC denies the passwordless new-PII namespace", () => {
  const NEW_PII_NAMESPACE_KEYS = [
    "open3dcalc_pwless_customers_v1",
    "open3dcalc_pwless_quotes_v1",
    "open3dcalc_pwless_history_v1",
    "open3dcalc_pwless_invented_v9",
  ];

  it("classifies even an invented prefix-only key as in-namespace (deny-first)", () => {
    // These belong to the `pii:new:*` route, never the generic store.
    expect(isNewPiiNamespaceKey("open3dcalc_pwless_invented_v9")).toBe(true);
    expect(isNewPiiNamespaceKey("open3dcalc_pwless_customers_v1")).toBe(true);
    // A legacy key is a different namespace and is denied elsewhere.
    expect(isNewPiiNamespaceKey("open3dcalc_customers_v1")).toBe(false);
  });

  it.each(NEW_PII_NAMESPACE_KEYS)(
    "denies load/save/delete for %s before any SQLite operation",
    async (key) => {
      const { db, rows, calls } = makeDatabase();
      rows.set(key, "PII sentinel that must never be served");
      const { handlers } = register(db);

      await expect(handlers.get("db:load")!(trustedEvent, key)).rejects.toThrow(
        /not permitted/i,
      );
      await expect(
        handlers.get("db:save")!(trustedEvent, key, "replacement"),
      ).rejects.toThrow(/not permitted/i);
      await expect(
        handlers.get("db:delete")!(trustedEvent, key),
      ).rejects.toThrow(/not permitted/i);

      expect(rows.get(key)).toBe("PII sentinel that must never be served");
      expect(calls).toMatchObject({ get: 0, run: 0, all: 0, prepare: [] });
    },
  );

  it("never lists a new-PII namespace row in db:list-keys", async () => {
    const { db, rows, calls } = makeDatabase();
    rows.set("open3dcalc_pwless_invented_v9", "PII sentinel");
    rows.set("open3dcalc_pwless_customers_v1", "PII sentinel");
    const { handlers } = register(db);

    const listed = (await handlers.get("db:list-keys")!(
      trustedEvent,
    )) as string[];
    expect(listed).not.toContain("open3dcalc_pwless_invented_v9");
    expect(listed).not.toContain("open3dcalc_pwless_customers_v1");
    expect(listed.every((key) => !key.startsWith("open3dcalc_pwless_"))).toBe(
      true,
    );
    expect(calls.all).toBe(1);
  });
});
