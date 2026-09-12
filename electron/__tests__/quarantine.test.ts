/**
 * @vitest-environment node
 *
 * Unit tests for the legacy plaintext quarantine (D1.1 S4 — ADR-002 §2.2).
 * The `electron` module is mocked to drive the capability rows; the real
 * end-to-end flows are covered by crypto.selftest.test.ts (real Electron,
 * real SQLite file, no mocks).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  mockSafeStorage: {
    isEncryptionAvailable: vi.fn<[], boolean>(() => true),
    encryptString: vi.fn<[], Buffer>(),
    decryptString: vi.fn<[], string>(),
  },
}));

vi.mock("electron", () => ({ safeStorage: hoisted.mockSafeStorage }));

import {
  buildQuarantineReport,
  migrateKey,
  eliminateKey,
  readStoredRow,
} from "../quarantine.js";
import { saveGated } from "../persistGate.js";
import {
  setSessionPassphrase,
  zeroizeSessionPassphrase,
} from "../../src/shared/lib/crypto/passphraseSession.js";

const PII_KEY = "open3dcalc_customers_v1";
const LEGACY_KEY = "open3dcalc_quotes_v1";
const NON_PII_KEY = "open3dcalc_settings_v2";
const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

function makeDb(initial: Array<[string, string]> = []) {
  const rows = new Map<string, string>(initial);
  const db = {
    prepare(sql: string) {
      return {
        get(...params: unknown[]) {
          if (sql.startsWith("SELECT value")) {
            const key = params[0] as string;
            return rows.has(key) ? { value: rows.get(key) } : undefined;
          }
          if (sql.startsWith("SELECT key, value")) {
            throw new Error("use .all()");
          }
          return undefined;
        },
        run(...params: unknown[]) {
          if (sql.startsWith("INSERT INTO storage")) {
            rows.set(params[0] as string, params[1] as string);
          } else if (sql.startsWith("DELETE FROM storage")) {
            rows.delete(params[0] as string);
          }
          return undefined;
        },
      };
    },
    all() {
      return Array.from(rows, ([key, value]) => ({ key, value }));
    },
    rows,
  };
  return db;
}

// The quarantine report reads all rows via `prepare(...).all()`; adapt the
// MinimalStorageDb shape used by the real better-sqlite3 client.
function withAll(db: ReturnType<typeof makeDb>) {
  return {
    prepare(sql: string) {
      const inner = db.prepare(sql);
      return {
        get: inner.get,
        run: inner.run,
        all: () => db.all(),
      };
    },
  };
}

beforeEach(() => {
  zeroizeSessionPassphrase();
  vi.clearAllMocks();
  hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  hoisted.mockSafeStorage.encryptString.mockImplementation((s: string) =>
    Buffer.from(`safe:${s}`, "utf8"),
  );
  hoisted.mockSafeStorage.decryptString.mockImplementation((b: Buffer) =>
    Buffer.from(b).toString("utf8").slice(5),
  );
});

describe("buildQuarantineReport (state derived from the scan)", () => {
  it("flags legacy plaintext PII as quarantined with record counts", () => {
    const db = makeDb([
      [LEGACY_KEY, `[{"name":"${MARKER}"}]`],
      [PII_KEY, "enc1:envelope:{...}"],
      [NON_PII_KEY, "{}"],
    ]);
    const report = buildQuarantineReport(withAll(db));
    expect(report.quarantinedKeys).toEqual([LEGACY_KEY]);
    const legacy = report.entries.find((e) => e.key === LEGACY_KEY);
    expect(legacy?.status).toBe("quarantined");
    expect(legacy?.recordCount).toBe(1);
    expect(report.entries.find((e) => e.key === PII_KEY)?.status).toBe(
      "encrypted",
    );
    expect(report.entries.find((e) => e.key === NON_PII_KEY)?.status).toBe(
      "non_pii",
    );
  });
});

describe("read-only quarantine (ADR-002 §2.2.1)", () => {
  it("refuses gated writes over a quarantined key and keeps the row", async () => {
    const original = `[{"name":"${MARKER}"}]`;
    const db = makeDb([[LEGACY_KEY, original]]);
    await expect(saveGated(withAll(db), LEGACY_KEY, "{}")).rejects.toThrow(
      /quarantined_read_only/,
    );
    expect(readStoredRow(withAll(db), LEGACY_KEY)).toBe(original);
  });

  it("does not refuse writes over already-encrypted or non-PII keys", async () => {
    const db = makeDb([
      [PII_KEY, "enc1:envelope:{...}"],
      [NON_PII_KEY, "{}"],
    ]);
    await expect(
      saveGated(withAll(db), PII_KEY, '{"n":1}'),
    ).resolves.toBeUndefined();
    await expect(
      saveGated(withAll(db), NON_PII_KEY, '{"n":2}'),
    ).resolves.toBeUndefined();
  });
});

describe("migrateKey (ADR-002 §2.2.3 — verify then destroy)", () => {
  it("encrypts, verifies the round-trip and destroys the plaintext", async () => {
    setSessionPassphrase("sessão-sintética-3131");
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    const db = makeDb([[LEGACY_KEY, MARKER]]);
    const result = await migrateKey(withAll(db), LEGACY_KEY);
    expect(result).toEqual({ key: LEGACY_KEY, migrated: true, verified: true });
    const stored = readStoredRow(withAll(db), LEGACY_KEY) ?? "";
    expect(stored.startsWith("enc1:")).toBe(true);
    expect(stored).not.toContain(MARKER);
    // Post-migration: writes over the encrypted key are allowed again.
    await expect(
      saveGated(withAll(db), LEGACY_KEY, '{"n":2}'),
    ).resolves.toBeUndefined();
  });

  it("refuses migration without a capability (deny-path ⇒ eliminate only)", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    const db = makeDb([[LEGACY_KEY, MARKER]]);
    await expect(migrateKey(withAll(db), LEGACY_KEY)).rejects.toThrow(
      /no_capability/,
    );
    expect(readStoredRow(withAll(db), LEGACY_KEY)).toBe(MARKER);
  });

  it("is a no-op for already-encrypted keys and refuses unknown/non-PII", async () => {
    setSessionPassphrase("sessão-sintética-3131");
    const db = makeDb([
      [PII_KEY, "enc1:envelope:{...}"],
      [NON_PII_KEY, "{}"],
    ]);
    expect(await migrateKey(withAll(db), PII_KEY)).toMatchObject({
      migrated: false,
      alreadyEncrypted: true,
    });
    await expect(migrateKey(withAll(db), "open3dcalc_rogue")).rejects.toThrow(
      /unknown_key/,
    );
    await expect(migrateKey(withAll(db), NON_PII_KEY)).rejects.toThrow(
      /not_pii/,
    );
  });
});

describe("eliminateKey (ADR-002 §2.2.3)", () => {
  it("deletes the quarantined row and verifies absence", () => {
    setSessionPassphrase("sessão-sintética-3131");
    const db = makeDb([[LEGACY_KEY, MARKER]]);
    expect(eliminateKey(withAll(db), LEGACY_KEY)).toEqual({
      key: LEGACY_KEY,
      eliminated: true,
    });
    expect(readStoredRow(withAll(db), LEGACY_KEY)).toBeNull();
  });

  it("refuses unknown and non-PII keys", () => {
    const db = makeDb([[NON_PII_KEY, "{}"]]);
    expect(() => eliminateKey(withAll(db), "open3dcalc_rogue")).toThrow(
      /unknown_key/,
    );
    expect(() => eliminateKey(withAll(db), NON_PII_KEY)).toThrow(/not_pii/);
  });
});
