/**
 * @vitest-environment node
 *
 * Safe Electron storage IPC tests. The fake database is synthetic and records
 * every attempted SQLite operation; no profile or on-disk database is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const manifestState = vi.hoisted(() => ({ unloadable: false }));

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
    getSelectedStorageBackend: () => "basic_text",
  },
  app: { getPath: () => "/tmp/open3dcalc-synthetic-profile" },
}));

vi.mock("../manifestSource.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../manifestSource.js")>();
  return {
    ...actual,
    loadManifestFromDisk: (): ReturnType<
      typeof actual.loadManifestFromDisk
    > => {
      if (manifestState.unloadable) {
        throw new Error("synthetic manifest unavailable");
      }
      return actual.loadManifestFromDisk();
    },
  };
});

import {
  CONSENT_STORAGE_KEY,
  createDatabaseIpcHandlers,
  SAFE_NON_PII_STORAGE_KEYS,
  type DatabaseIpcDependencies,
  type MinimalStorageDb,
} from "../databaseIpc.js";

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

interface Harness {
  handlers: Record<string, Handler>;
  getDb: ReturnType<typeof vi.fn<() => MinimalStorageDb>>;
  calls: string[];
  rows: Map<string, string>;
}

function makeHarness(listedKeys: string[] = []): Harness {
  const calls: string[] = [];
  const rows = new Map<string, string>();
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      calls.push(sql);
      return {
        get(...params: unknown[]) {
          const key = params[0] as string;
          const value = rows.get(key);
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          const [key, value] = params as [string, string?];
          if (sql.startsWith("INSERT")) rows.set(key, value ?? "");
          if (sql.startsWith("DELETE")) rows.delete(key);
          return undefined;
        },
        all() {
          return listedKeys.map((key) => ({ key }));
        },
      };
    },
  };
  const getDb = vi.fn(() => db);
  const dependencies: DatabaseIpcDependencies<unknown> = {
    getDb,
    assertTrustedSender: () => undefined,
  };
  return {
    handlers: createDatabaseIpcHandlers(dependencies),
    getDb,
    calls,
    rows,
  };
}

const EVENT = {};
const PII_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
  "open3dcalc_migration_done_v2",
];
const UNKNOWN_KEY = "open3dcalc_not_in_manifest";
const SAFE_KEY = "open3dcalc_settings_v2";

function validConsentValue(): string {
  const receipt = {
    receipt_id: "01234567-89ab-cdef-0123-456789abcdef",
    receipt_version: "1.0",
    policy_version: "1.0",
    policy_hash: `sha256:${"a".repeat(64)}`,
    granted_at: "2026-10-07T00:00:00.000Z",
    scope: ["customers", "quotes", "history", "dashboard"],
    legal_basis: "consent",
    purposes: ["issue_quotes", "cross_device_sync"],
    withdrawn_at: null,
  };
  return JSON.stringify({
    state: {
      privacyBannerDismissed: true,
      consentGiven: true,
      consentDate: 1_791_338_400_000,
      receipt,
      receiptDigest: `sha256:${"b".repeat(64)}`,
      withdrawnReceipts: [],
      migrationConsentGiven: false,
      migrationConsentDate: null,
      migrationReceipt: null,
      migrationReceiptDigest: null,
      withdrawnMigrationReceipts: [],
    },
    version: 1,
  });
}

describe("safe database IPC allowlists", () => {
  let harness: Harness;

  beforeEach(() => {
    manifestState.unloadable = false;
    harness = makeHarness();
  });

  afterEach(() => {
    manifestState.unloadable = false;
  });

  it.each(PII_KEYS)(
    "denies PII key %s before SQLite on load/save/delete",
    async (key) => {
      await expect(harness.handlers["db:load"](EVENT, key)).rejects.toThrow();
      await expect(
        harness.handlers["db:save"](EVENT, key, "synthetic value"),
      ).rejects.toThrow();
      await expect(harness.handlers["db:delete"](EVENT, key)).rejects.toThrow();

      expect(harness.getDb).not.toHaveBeenCalled();
      expect(harness.calls).toEqual([]);
    },
  );

  it("denies unknown keys before SQLite on load/save/delete", async () => {
    await expect(
      harness.handlers["db:load"](EVENT, UNKNOWN_KEY),
    ).rejects.toThrow();
    await expect(
      harness.handlers["db:save"](EVENT, UNKNOWN_KEY, "synthetic value"),
    ).rejects.toThrow();
    await expect(
      harness.handlers["db:delete"](EVENT, UNKNOWN_KEY),
    ).rejects.toThrow();

    expect(harness.getDb).not.toHaveBeenCalled();
    expect(harness.calls).toEqual([]);
  });

  it("denies otherwise-safe keys before SQLite if classification is unavailable", async () => {
    manifestState.unloadable = true;

    await expect(
      harness.handlers["db:load"](EVENT, SAFE_KEY),
    ).rejects.toThrow();
    await expect(
      harness.handlers["db:save"](EVENT, SAFE_KEY, "synthetic value"),
    ).rejects.toThrow();
    await expect(
      harness.handlers["db:delete"](EVENT, SAFE_KEY),
    ).rejects.toThrow();

    expect(harness.getDb).not.toHaveBeenCalled();
    expect(harness.calls).toEqual([]);
  });

  it("continues exact non-PII settings and catalog operations", async () => {
    const { handlers, rows } = harness;
    for (const key of [SAFE_KEY, "open3dcalc_catalog_v1"]) {
      await handlers["db:save"](EVENT, key, `value:${key}`);
      expect(await handlers["db:load"](EVENT, key)).toBe(`value:${key}`);
      await handlers["db:delete"](EVENT, key);
      expect(rows.has(key)).toBe(false);
    }
    expect(harness.calls).toHaveLength(6);
  });

  it("keeps consent on its exact row and rejects extra fields that could carry PII", async () => {
    expect(SAFE_NON_PII_STORAGE_KEYS).not.toContain(CONSENT_STORAGE_KEY);
    const value = validConsentValue();
    await harness.handlers["db:save"](EVENT, CONSENT_STORAGE_KEY, value);
    expect(await harness.handlers["db:load"](EVENT, CONSENT_STORAGE_KEY)).toBe(
      value,
    );

    const withExtraField = JSON.parse(value) as {
      state: Record<string, unknown>;
      version: number;
    };
    withExtraField.state.customerName = "synthetic PII";
    await expect(
      harness.handlers["db:save"](
        EVENT,
        CONSENT_STORAGE_KEY,
        JSON.stringify(withExtraField),
      ),
    ).rejects.toThrow();
    await expect(
      harness.handlers["db:load"](EVENT, `${CONSENT_STORAGE_KEY}_other`),
    ).rejects.toThrow();

    expect(harness.calls).toHaveLength(2);
  });

  it("filters key listing to exact allowlisted keys only", async () => {
    harness = makeHarness([
      SAFE_KEY,
      "open3dcalc_catalog_v1",
      CONSENT_STORAGE_KEY,
      ...PII_KEYS,
      UNKNOWN_KEY,
      "open3dcalc_settings_v2_extra",
    ]);

    const keys = (await harness.handlers["db:list-keys"](EVENT)) as string[];
    expect(keys).toEqual([
      "open3dcalc_catalog_v1",
      CONSENT_STORAGE_KEY,
      SAFE_KEY,
    ]);
    expect(
      keys.every(
        (key) =>
          key === CONSENT_STORAGE_KEY ||
          SAFE_NON_PII_STORAGE_KEYS.some((allowed) => allowed === key),
      ),
    ).toBe(true);
  });

  it("disables database import and legacy scan/recovery IPC before DB access", async () => {
    for (const channel of [
      "db:import",
      "privacy:scan-report",
      "privacy:quarantine-report",
      "privacy:migrate-key",
      "privacy:eliminate-key",
      "privacy:legacy-rows",
      "privacy:recovery-report",
      "privacy:recover-key",
    ]) {
      await expect(harness.handlers[channel](EVENT)).rejects.toThrow(
        /disabled/i,
      );
    }
    expect(harness.getDb).not.toHaveBeenCalled();
    expect(harness.calls).toEqual([]);
  });
});
