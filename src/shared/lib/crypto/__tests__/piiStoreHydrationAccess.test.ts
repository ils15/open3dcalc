/**
 * T3.3 — the access state the locked shell renders from, and the startup wake
 * that rehydrates an ALREADY-unlocked vault.
 *
 * The three migrated PII stores hydrate explicitly, after unlock, through
 * `rehydratePiiStores()`. Nothing in production called it, so an app whose
 * vault was unlocked still showed empty customers/quotes/history. These specs
 * pin the two missing pieces:
 *
 *  1. a single derived access state (`hydrated | locked | unavailable`) the UI
 *     can render — never a store read, so a locked vault cannot be mistaken for
 *     an empty one; and
 *  2. `rehydratePiiStoresIfUnlocked()`, the startup wake that calls
 *     `rehydratePiiStores()` when (and only when) every vault key is held.
 *
 * Real Web Crypto and the real gate; synthetic fixtures only (TEST-MATRIX §0).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});

// Side-effect imports: registering each store's persist handle is what makes it
// rehydratable. Without them `rehydratePiiStores()` reports `unregistered`.
import "@/shared/stores/customerStore";
import "@/shared/stores/quoteStore";
import "@/shared/stores/historyStore";

import {
  PII_STORE_KEYS,
  configurePiiStoreRuntime,
  getPiiStoreAccessState,
  getPiiStoreRuntimeOptions,
  hasExistingPiiProfile,
  installPiiStoreRuntimeEnvironment,
  rehydratePiiStoresIfUnlocked,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  createPiiStore,
  isPiiStoreUnlocked,
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import { resetPiiStoreGateForTests } from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const PASS = "senha-sintetica-acesso-4242";

describe("T3.3 — PII vault access state", () => {
  let idb: ReturnType<typeof createFakeIndexedDb>;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  it("reports unavailable when no environment was ever installed", () => {
    // Fail-closed: an unknown runtime is not a capable one.
    expect(getPiiStoreAccessState()).toEqual({
      status: "unavailable",
      reason: "capability_unknown",
    });
  });

  it("reports locked for a capable environment with no held key", () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();

    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });
  });

  it("reports unavailable — with the capability reason — when Web Crypto is missing", () => {
    configurePiiStoreRuntime({
      indexedDb: idb.factory,
      environment: { ...PII_STORE_ENVIRONMENT, webCryptoAvailable: false },
    });
    installPiiStoreRuntimeEnvironment();

    expect(getPiiStoreAccessState()).toEqual({
      status: "unavailable",
      reason: "web_crypto_unavailable",
    });
  });

  it("reports hydrated once every store has rehydrated after unlock", async () => {
    configurePiiStoreRuntime(options());
    await unlockPiiStoresAndRehydrate(PASS, options());

    expect(getPiiStoreAccessState()).toEqual({ status: "hydrated" });
  });

  it("tracks the held key per store", async () => {
    configurePiiStoreRuntime(options());
    expect(PII_STORE_KEYS.every((key) => isPiiStoreUnlocked(key))).toBe(false);

    await unlockPiiStoresAndRehydrate(PASS, options());

    expect(PII_STORE_KEYS.every((key) => isPiiStoreUnlocked(key))).toBe(true);
  });

  it("does not wake a locked vault", async () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();

    expect(await rehydratePiiStoresIfUnlocked()).toBeNull();
    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });
  });

  it("rehydrates a vault whose keys are already held, with no unlock step", async () => {
    configurePiiStoreRuntime(options());
    await unlockPiiStoresAndRehydrate(PASS, options());

    // A fresh renderer process: the keys are held, hydration is forgotten.
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });

    const outcomes = await rehydratePiiStoresIfUnlocked();

    expect(outcomes?.map((outcome) => outcome.status)).toEqual([
      "hydrated",
      "hydrated",
      "hydrated",
    ]);
    expect(getPiiStoreAccessState()).toEqual({ status: "hydrated" });
  });

  it("exposes the configured runtime so the UI can reuse the injected vault", () => {
    configurePiiStoreRuntime(options());

    expect(getPiiStoreRuntimeOptions().indexedDb).toBe(idb.factory);
  });
});

/**
 * MEDIUM-1 — the locked shell must tell a NEW profile (create a passphrase)
 * from an EXISTING one (unlock it). Presence is metadata and must be readable
 * while the vault is locked, or a new profile would be offered an unlock form
 * that can never fail and an existing one a "create" form that would overwrite.
 */
describe("MEDIUM-1 — create-vs-unlock profile presence", () => {
  let idb: ReturnType<typeof createFakeIndexedDb>;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  it("reports no existing profile for a fresh vault", async () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();

    expect(await hasExistingPiiProfile()).toBe(false);
  });

  it("reports an existing profile from a sealed record, while locked", async () => {
    configurePiiStoreRuntime(options());
    await unlockPiiStoresAndRehydrate(PASS, options());
    await createPiiStore(PII_STORE_KEYS[0], options()).write(
      JSON.stringify({ state: { customers: [] }, version: 1 }),
    );

    // A fresh renderer: no held key, no hydration — only the record remains.
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    configurePiiStoreRuntime(options());

    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });
    expect(await hasExistingPiiProfile()).toBe(true);
  });

  it("reports no profile when the environment can never hold one", async () => {
    configurePiiStoreRuntime({
      indexedDb: idb.factory,
      environment: { ...PII_STORE_ENVIRONMENT, webCryptoAvailable: false },
    });

    expect(await hasExistingPiiProfile()).toBe(false);
  });
});
