/**
 * H-4 — the surface write gate and its refusal consumer.
 *
 * A locked or incapable vault refuses a PII write at persistence and, before
 * this change, only recorded the typed refusal with no production reader. A
 * surface therefore accepted the entry into memory, showed it, and lost it on
 * reload. These specs pin the two halves of the fix:
 *
 *  1. `beginPiiSurfaceWrite`/`getPiiSurfaceWriteBlockReason` let a surface
 *     refuse a user write BEFORE it mutates the store; and
 *  2. `subscribePiiWriteRefusals`/`getLastPiiWriteRefusal` let a visible
 *     surface render that refusal the instant it happens.
 *
 * A demo session is the one deliberate exception: ephemeral by design, so it
 * must NOT block (the demo dataset writes in memory on purpose).
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

// Registering each store's persist handle is what makes it rehydratable.
import "@/shared/stores/customerStore";
import "@/shared/stores/quoteStore";
import "@/shared/stores/historyStore";

import {
  PII_STORE_KEY,
  beginPiiSurfaceWrite,
  configurePiiStoreRuntime,
  getLastPiiWriteRefusal,
  getPiiSurfaceWriteBlockReason,
  installPiiStoreRuntimeEnvironment,
  recordPiiWriteRefusal,
  resetPiiStoreHydrationForTests,
  subscribePiiWriteRefusals,
  unlockPiiStoresAndRehydrate,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import {
  resetPiiStoreGateForTests,
  setDemoSuppressedForPiiGate,
} from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "./piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const PASS = "senha-sintetica-gate-9341";

describe("H-4 — PII surface write gate", () => {
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

  it("blocks a capable-but-locked vault with profile_locked", () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();

    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBe(
      "profile_locked",
    );
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.quotes)).toBe(
      "profile_locked",
    );
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.history)).toBe(
      "profile_locked",
    );
  });

  it("blocks an environment that can never protect PII", () => {
    // Fail-closed: an unknown runtime is not a writable one.
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBe(
      "capability_unknown",
    );
  });

  it("does NOT block a demo session — it is ephemeral by design", () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
    setDemoSuppressedForPiiGate(true);

    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBeNull();
  });

  it("allows the write once the store has hydrated", async () => {
    configurePiiStoreRuntime(options());
    await unlockPiiStoresAndRehydrate(PASS, options());

    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBeNull();
  });

  it("records the refusal and notifies subscribers from beginPiiSurfaceWrite", () => {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
    const listener = vi.fn();
    const unsubscribe = subscribePiiWriteRefusals(listener);

    const reason = beginPiiSurfaceWrite(PII_STORE_KEY.customers);

    expect(reason).toBe("profile_locked");
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.customers,
      reason: "profile_locked",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("stops notifying a listener that unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePiiWriteRefusals(listener);
    unsubscribe();

    recordPiiWriteRefusal(PII_STORE_KEY.quotes, "profile_locked");

    expect(listener).not.toHaveBeenCalled();
  });

  it("clears a stale refusal once the store hydrates", async () => {
    configurePiiStoreRuntime(options());
    recordPiiWriteRefusal(PII_STORE_KEY.customers, "profile_locked");
    expect(getLastPiiWriteRefusal()).not.toBeNull();

    await unlockPiiStoresAndRehydrate(PASS, options());

    expect(getLastPiiWriteRefusal()).toBeNull();
  });

  it("has no refusal recorded before any write is attempted", () => {
    expect(getLastPiiWriteRefusal()).toBeNull();
  });
});
