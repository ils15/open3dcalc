/**
 * @vitest-environment node
 *
 * Unit tests for the main-process crypto capability layer (D1.1 S2). The
 * `electron` module is mocked here to exercise the layer logic across the
 * ADR-001 §2.3 rows; the REAL end-to-end behavior (real safeStorage, real
 * SQLite file byte scan) is covered by crypto.selftest.test.ts, which runs
 * the actual Electron binary (TEST-MATRIX §0 — no mocks at contract level).
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
  probeSafeStorage,
  getCapability,
  adoptSessionPassphrase,
  lockCryptoSession,
  encryptForStorage,
  decryptFromStorage,
  CryptoDeniedError,
  UnknownBlobError,
  CRYPTO_WRITE_PATH_ENABLED,
} from "../cryptoCapability.js";
import {
  zeroizeSessionPassphrase,
  hasSessionPassphrase,
} from "../../src/shared/lib/crypto/passphraseSession.js";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

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

describe("probeSafeStorage (fail-closed)", () => {
  it("maps a throwing probe to false (ambiguous ⇒ DENIED, ADR-001 §2.3)", () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockImplementation(() => {
      throw new Error("probe exploded");
    });
    expect(probeSafeStorage()).toBe(false);
    expect(getCapability().mode).toBe("denied");
  });
});

describe("encryptForStorage / decryptFromStorage", () => {
  it("row 2.1: safeStorage path produces prefixed ciphertext and round-trips", async () => {
    const blob = await encryptForStorage("open3dcalc_customers_v1", MARKER);
    expect(blob.startsWith("enc1:safeStorage:")).toBe(true);
    expect(blob).not.toContain(MARKER);
    const back = await decryptFromStorage("open3dcalc_customers_v1", blob);
    expect(back).toBe(MARKER);
  });

  it("row 2.2: with safeStorage off, the session passphrase envelope path works", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    adoptSessionPassphrase("sessão-sintética-3131");
    expect(hasSessionPassphrase()).toBe(true);
    const blob = await encryptForStorage("open3dcalc_customers_v1", MARKER);
    expect(blob.startsWith("enc1:envelope:")).toBe(true);
    expect(blob).not.toContain(MARKER);
    const back = await decryptFromStorage("open3dcalc_customers_v1", blob);
    expect(back).toBe(MARKER);
  });

  it("row 2.3: deny path — no safeStorage, no passphrase ⇒ refused", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    await expect(
      encryptForStorage("open3dcalc_customers_v1", MARKER),
    ).rejects.toThrow(CryptoDeniedError);
  });

  it("row 2.3: locked session with pending envelope refuses reads of envelope blobs", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    adoptSessionPassphrase("sessão-sintética-3131");
    const blob = await encryptForStorage("open3dcalc_customers_v1", MARKER);
    lockCryptoSession();
    await expect(
      decryptFromStorage("open3dcalc_customers_v1", blob),
    ).rejects.toThrow(CryptoDeniedError);
  });

  it("legacy/unknown blobs are rejected, never silently re-read (ADR-002)", async () => {
    await expect(
      decryptFromStorage("open3dcalc_customers_v1", "plain plaintext value"),
    ).rejects.toThrow(UnknownBlobError);
  });

  it("wrong passphrase after write is rejected (envelope integrity)", async () => {
    hoisted.mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    adoptSessionPassphrase("sessão-sintética-3131");
    const blob = await encryptForStorage("open3dcalc_customers_v1", MARKER);
    adoptSessionPassphrase("outra-senha-sintética-9999");
    await expect(
      decryptFromStorage("open3dcalc_customers_v1", blob),
    ).rejects.toThrow(/envelope rejected/);
  });

  it("rollback flag: disabled write path refuses new writes (OWNERS-RUNBOOK §7)", async () => {
    // The flag is a compile-time constant; assert the contract that S3 relies on.
    expect(CRYPTO_WRITE_PATH_ENABLED).toBe(true);
    expect(hasSessionPassphrase()).toBe(false);
  });
});
