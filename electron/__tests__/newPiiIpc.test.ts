/**
 * Phase3 (Desktop passwordless new-PII) — RED-first contracts for:
 *
 *  1. the DISJOINT new-PII key namespace (no legacy alias),
 *  2. the OS-keyring-ONLY seal/open (no passphrase fallback),
 *  3. the `pii:new:*` main-process route (encrypt-before-SQL, no legacy reads),
 *  4. the generic `db:*` IPC refusing the new namespace,
 *  5. fail-closed across backend refusal, cold restart, missing/corrupt key,
 *     locked store, tamper/AAD binding, and legacy-blob refusal.
 *
 * `electron` is mocked (safeStorage/app); every other module is real. No real
 * profile, no real PII: the value is a synthetic marker and the keyring fake is
 * a reversible XOR, which is enough to prove "the clear key is not on disk".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const hoisted = vi.hoisted(() => ({
  userDataDir: { value: "" },
  mockSafeStorage: {
    isEncryptionAvailable: vi.fn<[], boolean>(() => true),
    encryptString: vi.fn<[string], Buffer>(),
    decryptString: vi.fn<[Buffer], string>(),
    getSelectedStorageBackend: vi.fn<[], string>(() => "gnome_libsecret"),
  },
}));

vi.mock("electron", () => ({
  safeStorage: hoisted.mockSafeStorage,
  app: {
    getPath: (name: string) => {
      if (name === "userData") return hoisted.userDataDir.value;
      throw new Error(`unexpected path request: ${name}`);
    },
  },
}));

import {
  sealNewPiiValue,
  openNewPiiValue,
  isOsKeyringRecord,
  OS_KEYRING_ONLY_REASON,
  lockCryptoSession,
  adoptSessionPassphrase,
  CryptoDeniedError,
  LegacyUnboundBlobError,
  UnknownBlobError,
  runPiiCryptoSelfTest,
} from "../cryptoCapability.js";
import {
  resetProfileDataKeyForTests,
  profileDataKeyFilePath,
} from "../profileDataKey.js";
import {
  NEW_PII_STORAGE_KEYS,
  NEW_PII_KEY_PREFIX,
  isNewPiiStorageKey,
  isNewPiiNamespaceKey,
  assertNewPiiStorageKey,
  NewPiiKeyRefusedError,
} from "../../src/shared/lib/crypto/newPiiNamespace.js";
import {
  registerPasswordlessPiiHandlers,
  NEW_PII_CHANNELS,
  NewPiiRouteRefusedError,
  type NewPiiCapability,
} from "../newPiiIpc.js";
import { registerDatabaseStorageHandlers } from "../databaseIpc.js";
import {
  requestWithdrawal,
  withdrawalJournalPath,
} from "../withdrawalJournal.js";
import { requestNewPiiErasure } from "../newPiiErasure.js";
import type { MinimalStorageDb } from "../persistGate.js";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";
const CUSTOMERS = NEW_PII_STORAGE_KEYS[0];
const QUOTES = NEW_PII_STORAGE_KEYS[1];
const PROFILE_KEY_PREFIX = "enc1:profileKey:";

const XOR_MASK = 0x5a;
const sealFake = (plain: string): Buffer =>
  Buffer.from(plain, "utf8").map((b) => b ^ XOR_MASK);
const openFake = (sealed: Buffer): string =>
  Buffer.from(sealed)
    .map((b) => b ^ XOR_MASK)
    .toString("utf8");

const REAL_PLATFORM = process.platform;

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value, configurable: true });
}

/* ------------------------------------------------------------------ */
/*  Fake storage-table DB                                              */
/* ------------------------------------------------------------------ */

function makeDatabase(seed: Array<[string, string]> = []) {
  const rows = new Map<string, string>(seed);
  const calls = { prepare: [] as string[], get: 0, run: 0 };
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
        all() {
          return [...rows.keys()].sort().map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows, calls };
}

type Handler = (...args: unknown[]) => unknown;

function registerRoute(
  db: MinimalStorageDb,
  assertTrustedSender = () => {},
  withdrawalDir: string = hoisted.userDataDir.value,
) {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
  };
  registerPasswordlessPiiHandlers(
    ipcMain as never,
    { $client: db },
    assertTrustedSender,
    withdrawalDir,
  );
  return { handlers, ipcMain };
}

const trustedEvent = { senderFrame: { url: "file:///app/index.html" } };

beforeEach(() => {
  hoisted.userDataDir.value = mkdtempSync(join(tmpdir(), "o3dc-newpii-"));
  lockCryptoSession();
  resetProfileDataKeyForTests();
  vi.clearAllMocks();
  hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  hoisted.mockSafeStorage.encryptString.mockImplementation(sealFake);
  hoisted.mockSafeStorage.decryptString.mockImplementation(openFake);
  hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(
    "gnome_libsecret",
  );
});

afterEach(() => {
  lockCryptoSession();
  resetProfileDataKeyForTests();
  setPlatform(REAL_PLATFORM);
  rmSync(hoisted.userDataDir.value, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/*  1. Namespace                                                       */
/* ------------------------------------------------------------------ */

describe("the new-PII key namespace is disjoint from legacy Beta rows", () => {
  it("exposes exactly the three new keys under a dedicated prefix", () => {
    expect(NEW_PII_KEY_PREFIX).toBe("open3dcalc_pwless_");
    expect([...NEW_PII_STORAGE_KEYS]).toEqual([
      "open3dcalc_pwless_customers_v1",
      "open3dcalc_pwless_quotes_v1",
      "open3dcalc_pwless_history_v1",
    ]);
    for (const key of NEW_PII_STORAGE_KEYS) {
      expect(isNewPiiStorageKey(key)).toBe(true);
      expect(isNewPiiNamespaceKey(key)).toBe(true);
    }
  });

  it.each([
    ["legacy customers", "open3dcalc_customers_v1"],
    ["legacy quotes", "open3dcalc_quotes_v1"],
    ["legacy history", "open3dcalc_history_v2"],
    ["legacy migration marker", "open3dcalc_migration_done_v2"],
    ["domain table", "customers"],
    ["stage table", "pii_stage"],
    ["residue table", "legacy_residue"],
    ["plain storage table", "storage"],
    ["unknown", "unknown_secret_key"],
    ["empty", ""],
  ])("refuses %s", (_label, key) => {
    expect(isNewPiiStorageKey(key)).toBe(false);
    expect(isNewPiiNamespaceKey(key)).toBe(false);
    expect(() => assertNewPiiStorageKey(key)).toThrow(NewPiiKeyRefusedError);
  });

  it("refuses a prefix-only invented key while still recognising its namespace", () => {
    const invented = "open3dcalc_pwless_invented_v9";
    // In-namespace (so the generic db denial still catches it)…
    expect(isNewPiiNamespaceKey(invented)).toBe(true);
    // …but NOT authorised by the route, which is what the route enforces.
    expect(isNewPiiStorageKey(invented)).toBe(false);
    expect(() => assertNewPiiStorageKey(invented)).toThrow(
      NewPiiKeyRefusedError,
    );
  });

  it("refuses non-string keys", () => {
    for (const key of [undefined, null, 42, {}, []]) {
      expect(() => assertNewPiiStorageKey(key)).toThrow(NewPiiKeyRefusedError);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  2. OS-keyring-ONLY crypto (no passphrase fallback)                 */
/* ------------------------------------------------------------------ */

describe("sealNewPiiValue / openNewPiiValue are OS-keyring only", () => {
  it("seals an ADR-001 envelope under the profile data key", async () => {
    const blob = await sealNewPiiValue(CUSTOMERS, MARKER);
    expect(blob.startsWith(PROFILE_KEY_PREFIX)).toBe(true);
    expect(blob).not.toContain(MARKER);
    expect(await openNewPiiValue(CUSTOMERS, blob)).toBe(MARKER);
  });

  it("REFUSES the passphrase fallback even when a session passphrase exists", async () => {
    // The exact condition that makes getCapability() return "passphrase".
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    adoptSessionPassphrase("sessão-sintética-3131");

    const error = await sealNewPiiValue(CUSTOMERS, MARKER).catch(
      (e: unknown) => e as CryptoDeniedError,
    );
    expect(error).toBeInstanceOf(CryptoDeniedError);
    expect(error.reason).toBe(OS_KEYRING_ONLY_REASON);
    // No passphrase-keyed blob was produced.
    expect(hoisted.mockSafeStorage.encryptString).not.toHaveBeenCalled();
  });

  it("refuses to open a passphrase-keyed blob on the new route", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    adoptSessionPassphrase("sessão-sintética-3131");
    const passphraseBlob = `${"enc1:envelope:"}{"v":"2.0"}`;
    await expect(openNewPiiValue(CUSTOMERS, passphraseBlob)).rejects.toThrow(
      CryptoDeniedError,
    );
  });

  it("refuses a legacy unbound keyring blob by name", async () => {
    const legacy = `enc1:safeStorage:${sealFake(MARKER).toString("base64")}`;
    await expect(openNewPiiValue(CUSTOMERS, legacy)).rejects.toThrow(
      LegacyUnboundBlobError,
    );
  });

  it("refuses a plaintext value as unknown, never returning it", async () => {
    await expect(openNewPiiValue(CUSTOMERS, MARKER)).rejects.toThrow(
      UnknownBlobError,
    );
  });

  it("recognises only the OS-keyring record shape", async () => {
    expect(isOsKeyringRecord(await sealNewPiiValue(CUSTOMERS, MARKER))).toBe(
      true,
    );
    expect(isOsKeyringRecord("enc1:envelope:{}")).toBe(false);
    expect(isOsKeyringRecord("enc1:safeStorage:AAAA")).toBe(false);
    expect(isOsKeyringRecord("plain")).toBe(false);
  });

  it("a value bound to one key does not open under another", async () => {
    const blob = await sealNewPiiValue(CUSTOMERS, MARKER);
    await expect(openNewPiiValue(QUOTES, blob)).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  3. The main-process route                                          */
/* ------------------------------------------------------------------ */

describe("pii:new:* route — capability gate", () => {
  it("reports available on an approved keyring and creates the data key", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    const result = (await handlers.get(NEW_PII_CHANNELS.capability)!(
      trustedEvent,
    )) as NewPiiCapability;
    expect(result).toEqual({ available: true, backend: "gnome_libsecret" });
    expect(existsSync(profileDataKeyFilePath())).toBe(true);
  });

  it("fails closed on basic_text without minting a key", async () => {
    hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(
      "basic_text",
    );
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    const result = (await handlers.get(NEW_PII_CHANNELS.capability)!(
      trustedEvent,
    )) as NewPiiCapability;
    expect(result).toEqual({ available: false, reason: "backend_basic_text" });
    expect(existsSync(profileDataKeyFilePath())).toBe(false);
  });

  it("asserts the trusted sender before anything else", async () => {
    const deny = vi.fn(() => {
      throw new Error("Untrusted IPC sender rejected");
    });
    const { db, calls } = makeDatabase();
    const { handlers } = registerRoute(db, deny);
    await expect(
      handlers.get(NEW_PII_CHANNELS.capability)!(trustedEvent),
    ).rejects.toThrow(/Untrusted/);
    expect(calls.prepare).toEqual([]);
  });
});

describe("pii:new:save — encrypt before SQL, plaintext never reaches SQL", () => {
  it("stores only the sealed envelope for an allowlisted key", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);

    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
    ).resolves.toBeUndefined();

    const stored = rows.get(CUSTOMERS);
    expect(stored).toBeDefined();
    expect(stored).not.toContain(MARKER);
    expect(stored!.startsWith(PROFILE_KEY_PREFIX)).toBe(true);
  });

  it("round-trips through load", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBe(MARKER);
  });

  it.each([
    ["legacy customers", "open3dcalc_customers_v1"],
    ["domain table", "customers"],
    ["stage table", "pii_stage"],
    ["prefix-only key", "open3dcalc_pwless_invented_v9"],
    ["unknown", "unknown_secret_key"],
  ])("refuses %s before any SQLite access", async (_label, key) => {
    const { db, calls, rows } = makeDatabase();
    const { handlers } = registerRoute(db);
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, key, MARKER),
    ).rejects.toThrow(NewPiiKeyRefusedError);
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, key),
    ).rejects.toThrow(NewPiiKeyRefusedError);
    expect(calls.prepare).toEqual([]);
    expect(rows.size).toBe(0);
  });

  it.each(["gnome_libsecret", "kwallet", "kwallet5", "kwallet6"] as const)(
    "accepts the approved %s backend and round-trips",
    async (backend) => {
      hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(
        backend,
      );
      const { db, rows } = makeDatabase();
      const { handlers } = registerRoute(db);
      await handlers.get(NEW_PII_CHANNELS.save)!(
        trustedEvent,
        CUSTOMERS,
        MARKER,
      );
      expect(rows.get(CUSTOMERS)!.startsWith(PROFILE_KEY_PREFIX)).toBe(true);
      await expect(
        handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
      ).resolves.toBe(MARKER);
    },
  );

  it.each([
    ["unknown", "backend_unknown"],
    ["secretservice", "backend_not_allowlisted"],
  ])("refuses the %s backend before writing", async (backend, reason) => {
    hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(backend);
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);
    const error = (await handlers.get(NEW_PII_CHANNELS.save)!(
      trustedEvent,
      CUSTOMERS,
      MARKER,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error.reason).toBe(reason);
    expect(rows.size).toBe(0);
  });

  it.each<NodeJS.Platform>(["win32", "darwin"])(
    "accepts %s via OS-backed round-trip without a backend name",
    async (platform) => {
      setPlatform(platform);
      const { db, rows } = makeDatabase();
      const { handlers } = registerRoute(db);
      await handlers.get(NEW_PII_CHANNELS.save)!(
        trustedEvent,
        CUSTOMERS,
        MARKER,
      );
      expect(rows.get(CUSTOMERS)!.startsWith(PROFILE_KEY_PREFIX)).toBe(true);
      expect(
        hoisted.mockSafeStorage.getSelectedStorageBackend,
      ).not.toHaveBeenCalled();
    },
  );

  it("fails closed and writes nothing when the keyring is refused", async () => {
    hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(
      "basic_text",
    );
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);
    const error = (await handlers.get(NEW_PII_CHANNELS.save)!(
      trustedEvent,
      CUSTOMERS,
      MARKER,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error).toBeInstanceOf(NewPiiRouteRefusedError);
    expect(error.reason).toBe("backend_basic_text");
    expect(rows.size).toBe(0);
  });
});

describe("pii:new:load — decrypts only new records, never legacy", () => {
  it("returns null for an absent key", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBeNull();
  });

  it("refuses a legacy unbound blob without decrypting it", async () => {
    const legacy = `enc1:safeStorage:${sealFake(MARKER).toString("base64")}`;
    const { db } = makeDatabase([[CUSTOMERS, legacy]]);
    const { handlers } = registerRoute(db);
    const error = (await handlers.get(NEW_PII_CHANNELS.load)!(
      trustedEvent,
      CUSTOMERS,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error).toBeInstanceOf(NewPiiRouteRefusedError);
    expect(error.reason).toBe("non_new_record_shape");
    // The legacy blob was never handed to the keyring decrypt path.
    expect(hoisted.mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });

  it("refuses a passphrase-keyed row under a new key", async () => {
    const { db } = makeDatabase([[CUSTOMERS, "enc1:envelope:{}"]]);
    const { handlers } = registerRoute(db);
    const error = (await handlers.get(NEW_PII_CHANNELS.load)!(
      trustedEvent,
      CUSTOMERS,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error.reason).toBe("non_new_record_shape");
  });

  it("fails closed on a tampered envelope (AAD/GCM), returning no plaintext", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);

    const stored = rows.get(CUSTOMERS)!;
    const envelope = JSON.parse(stored.slice(PROFILE_KEY_PREFIX.length)) as {
      ct: string;
    };
    const tamperedCt = `${envelope.ct.slice(0, -4)}${envelope.ct.endsWith("A") ? "B" : "A"}`;
    rows.set(
      CUSTOMERS,
      `${PROFILE_KEY_PREFIX}${JSON.stringify({ ...envelope, ct: tamperedCt })}`,
    );

    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).rejects.toThrow(NewPiiRouteRefusedError);
  });
});

describe("pii:new:* — restart, missing and corrupt key all fail closed", () => {
  it("re-proves the gate after a cold restart and still opens the record", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);

    // Cold restart: the process loses the in-memory key and the verdict; the
    // wrapped key file and the keyring entry survive.
    lockCryptoSession();
    resetProfileDataKeyForTests();

    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBe(MARKER);
  });

  it("refuses to open after restart when the keyring no longer holds the key", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);

    lockCryptoSession();
    resetProfileDataKeyForTests();
    hoisted.mockSafeStorage.decryptString.mockImplementation(
      (sealed: Buffer) => {
        const opened = openFake(sealed);
        if (opened === "open3dcalc-keyring-probe-0000") return opened;
        throw new Error("secret not found in keyring");
      },
    );

    const error = (await handlers.get(NEW_PII_CHANNELS.load)!(
      trustedEvent,
      CUSTOMERS,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error).toBeInstanceOf(NewPiiRouteRefusedError);
    expect(error.reason).toBe("profile_data_key_unavailable");
    // No replacement key was minted over the orphan.
    expect(readFileSync(profileDataKeyFilePath()).byteLength).toBeGreaterThan(
      0,
    );
  });

  it("refuses a corrupt key file without rewriting it", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);

    lockCryptoSession();
    resetProfileDataKeyForTests();
    const path = profileDataKeyFilePath();
    const before = readFileSync(path, "utf8");
    writeFileSync(path, "{ not-json", "utf8");

    const error = (await handlers.get(NEW_PII_CHANNELS.capability)!(
      trustedEvent,
    ).catch((e: unknown) => e)) as NewPiiCapability;
    expect(error).toMatchObject({
      available: false,
      reason: "profile_data_key_unavailable",
    });
    expect(readFileSync(path, "utf8")).toBe("{ not-json");
    expect(before).not.toBe("{ not-json");
  });

  it("fails closed when the backend changes to a refused one after restart", async () => {
    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);

    lockCryptoSession();
    resetProfileDataKeyForTests();
    hoisted.mockSafeStorage.getSelectedStorageBackend.mockReturnValue(
      "basic_text",
    );

    const error = (await handlers.get(NEW_PII_CHANNELS.load)!(
      trustedEvent,
      CUSTOMERS,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;
    expect(error.reason).toBe("backend_basic_text");
  });

  it("the self-test still reports ready only on an approved backend", async () => {
    await expect(runPiiCryptoSelfTest()).resolves.toMatchObject({
      ready: true,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  4. Generic db IPC never carries the new namespace                  */
/* ------------------------------------------------------------------ */

describe("generic db IPC refuses the new-PII namespace", () => {
  it.each([...NEW_PII_STORAGE_KEYS])(
    "denies db:load/save/delete for %s before SQLite",
    async (key) => {
      const { db, calls } = makeDatabase([[key, "whatever"]]);
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
      );

      await expect(handlers.get("db:load")!(trustedEvent, key)).rejects.toThrow(
        /not permitted/i,
      );
      await expect(
        handlers.get("db:save")!(trustedEvent, key, "replacement"),
      ).rejects.toThrow(/not permitted/i);
      await expect(
        handlers.get("db:delete")!(trustedEvent, key),
      ).rejects.toThrow(/not permitted/i);

      expect(calls.prepare).toEqual([]);
    },
  );
});

/* ------------------------------------------------------------------ */
/*  5. Durable withdrawal lock (Phase4)                                */
/* ------------------------------------------------------------------ */
const WITHDRAWAL_INPUT = {
  requestId: "req-pwless-1",
  profile: "profile-synthetic",
  targets: [{ surface: "sqlite_storage_table", id: CUSTOMERS }],
  receiptId: "receipt-pwless-1",
  nonce: "nonce-pwless-1",
  issuedAt: "2026-10-07T00:00:00.000Z",
  expiresAt: "2026-10-07T01:00:00.000Z",
};

/** Persist a pending withdrawal journal in the route's own directory. */
function lockRoute(): void {
  requestWithdrawal(hoisted.userDataDir.value, WITHDRAWAL_INPUT);
}

/** Extract the stable reason code a route refusal carries. */
async function refusalReason(promise: Promise<unknown>): Promise<string> {
  const error = (await promise.catch(
    (e: unknown) => e,
  )) as NewPiiRouteRefusedError;
  return error.reason;
}

describe("pii:new:* — durable withdrawal lock is fail-closed", () => {
  it("allows capability/load/save when no withdrawal journal exists", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);

    await expect(
      handlers.get(NEW_PII_CHANNELS.capability)!(trustedEvent),
    ).resolves.toEqual({ available: true, backend: "gnome_libsecret" });
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
    ).resolves.toBeUndefined();
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBe(MARKER);
    expect(rows.has(CUSTOMERS)).toBe(true);
  });

  it("reports capability unavailable and refuses save/load while pending", async () => {
    lockRoute();
    const { db, rows, calls } = makeDatabase();
    const { handlers } = registerRoute(db);

    await expect(
      handlers.get(NEW_PII_CHANNELS.capability)!(trustedEvent),
    ).resolves.toEqual({ available: false, reason: "withdrawal_pending" });

    expect(
      await refusalReason(
        handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
      ),
    ).toBe("withdrawal_pending");
    expect(
      await refusalReason(
        handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
      ),
    ).toBe("withdrawal_pending");

    // Nothing was written, no SQL ran, and the keyring was never touched.
    expect(rows.size).toBe(0);
    expect(calls.prepare).toEqual([]);
    expect(hoisted.mockSafeStorage.encryptString).not.toHaveBeenCalled();
    expect(hoisted.mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });

  it("is idempotent: repeated refusals write nothing and never advance the journal", async () => {
    lockRoute();
    const file = withdrawalJournalPath(hoisted.userDataDir.value);
    const journalBefore = readFileSync(file, "utf8");
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);
    const save = handlers.get(NEW_PII_CHANNELS.save)!;

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await refusalReason(save(trustedEvent, CUSTOMERS, MARKER))).toBe(
        "withdrawal_pending",
      );
    }
    expect(rows.size).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(journalBefore);
  });

  it.each([...NEW_PII_STORAGE_KEYS])(
    "has no bypass via the direct route for the authorised key %s",
    async (key) => {
      lockRoute();
      const { db, rows } = makeDatabase();
      const { handlers } = registerRoute(db);

      expect(
        await refusalReason(
          handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, key, MARKER),
        ),
      ).toBe("withdrawal_pending");
      expect(
        await refusalReason(
          handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, key),
        ),
      ).toBe("withdrawal_pending");
      expect(rows.size).toBe(0);
    },
  );

  it("fails closed when the journal is corrupt or unreadable", async () => {
    writeFileSync(
      withdrawalJournalPath(hoisted.userDataDir.value),
      "{ not json",
      "utf8",
    );
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);

    await expect(
      handlers.get(NEW_PII_CHANNELS.capability)!(trustedEvent),
    ).resolves.toEqual({ available: false, reason: "withdrawal_pending" });
    expect(
      await refusalReason(
        handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
      ),
    ).toBe("withdrawal_pending");
    expect(rows.size).toBe(0);
  });

  it("releases the lock only for a completed withdrawal", async () => {
    lockRoute();
    const file = withdrawalJournalPath(hoisted.userDataDir.value);
    const journal = JSON.parse(readFileSync(file, "utf8")) as { state: string };
    writeFileSync(
      file,
      JSON.stringify({ ...journal, state: "completed" }),
      "utf8",
    );

    const { db } = makeDatabase();
    const { handlers } = registerRoute(db);
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
    ).resolves.toBeUndefined();
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBe(MARKER);
  });
});

/* ------------------------------------------------------------------ */
/*  5b. Exact new-namespace delete-all lock (Beta12 follow-up)         */
/* ------------------------------------------------------------------ */

describe("pii:new:* — a pending new-PII delete-all is fail-closed", () => {
  it("refuses capability/load/save while an exact delete-all is pending", async () => {
    requestNewPiiErasure(hoisted.userDataDir.value, "profile-synthetic");
    const { db, rows, calls } = makeDatabase();
    const { handlers } = registerRoute(db);

    await expect(
      handlers.get(NEW_PII_CHANNELS.capability)!(trustedEvent),
    ).resolves.toEqual({ available: false, reason: "withdrawal_pending" });
    expect(
      await refusalReason(
        handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER),
      ),
    ).toBe("withdrawal_pending");
    expect(
      await refusalReason(
        handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
      ),
    ).toBe("withdrawal_pending");

    expect(rows.size).toBe(0);
    expect(calls.prepare).toEqual([]);
    expect(hoisted.mockSafeStorage.encryptString).not.toHaveBeenCalled();
    expect(hoisted.mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  6. Save input validation and overwrite refusal                     */
/* ------------------------------------------------------------------ */

describe("pii:new:save — value validation and overwrite refusal", () => {
  it.each([
    ["empty string", ""],
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["object", { a: 1 }],
  ] as Array<[string, unknown]>)(
    "refuses a %s value before any SQL or keyring call",
    async (_label, value) => {
      const { db, rows, calls } = makeDatabase();
      const { handlers } = registerRoute(db);

      const error = (await handlers.get(NEW_PII_CHANNELS.save)!(
        trustedEvent,
        CUSTOMERS,
        value,
      ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;

      expect(error).toBeInstanceOf(NewPiiRouteRefusedError);
      expect(error.reason).toBe("invalid_value");
      expect(rows.size).toBe(0);
      expect(calls.prepare).toEqual([]);
      expect(hoisted.mockSafeStorage.encryptString).not.toHaveBeenCalled();
    },
  );

  it("refuses to overwrite a non-new row under an authorised key", async () => {
    const legacy = `enc1:safeStorage:${sealFake(MARKER).toString("base64")}`;
    const { db, rows } = makeDatabase([[CUSTOMERS, legacy]]);
    const { handlers } = registerRoute(db);

    const error = (await handlers.get(NEW_PII_CHANNELS.save)!(
      trustedEvent,
      CUSTOMERS,
      MARKER,
    ).catch((e: unknown) => e)) as NewPiiRouteRefusedError;

    expect(error).toBeInstanceOf(NewPiiRouteRefusedError);
    expect(error.reason).toBe("non_new_record_shape");
    // The legacy bytes are left untouched and never re-sealed.
    expect(rows.get(CUSTOMERS)).toBe(legacy);
    expect(hoisted.mockSafeStorage.encryptString).not.toHaveBeenCalled();
  });

  it("allows overwriting an existing new-route record", async () => {
    const { db, rows } = makeDatabase();
    const { handlers } = registerRoute(db);

    await handlers.get(NEW_PII_CHANNELS.save)!(trustedEvent, CUSTOMERS, MARKER);
    await expect(
      handlers.get(NEW_PII_CHANNELS.save)!(
        trustedEvent,
        CUSTOMERS,
        "replacement",
      ),
    ).resolves.toBeUndefined();

    expect(rows.get(CUSTOMERS)!.startsWith(PROFILE_KEY_PREFIX)).toBe(true);
    await expect(
      handlers.get(NEW_PII_CHANNELS.load)!(trustedEvent, CUSTOMERS),
    ).resolves.toBe("replacement");
  });
});
