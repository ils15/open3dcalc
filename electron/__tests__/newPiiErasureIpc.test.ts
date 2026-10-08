/** @vitest-environment node */

/**
 * Invocation-level wiring for the new-namespace erasure and withdrawal-purge
 * IPC routes. These are the main-process entry points the privacy screen calls;
 * the unit suites drive the pure modules, and this suite drives the registered
 * handlers exactly as `main.ts` does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  NEW_PII_ERASURE_CHANNELS,
  registerNewPiiErasureHandlers,
} from "../newPiiErasure.js";
import {
  registerWithdrawalPurgeHandlers,
  WITHDRAWAL_PURGE_CHANNELS,
} from "../withdrawalPurge.js";
import type { MinimalStorageDb } from "../persistGate.js";
import { NEW_PII_STORAGE_KEYS } from "../../src/shared/lib/crypto/newPiiNamespace.js";
import { loadWithdrawalJournal } from "../withdrawalJournal.js";

const [CUSTOMERS, QUOTES, HISTORY] = NEW_PII_STORAGE_KEYS;
const SEALED = 'enc1:profileKey:{"v":"2.0"}';
const PROFILE = "desktop-local-profile";
const TRUSTED = { senderFrame: { url: "file:///app/index.html" } };

let dir: string;

function makeDatabase(seed: Array<[string, string]> = []) {
  const rows = new Map<string, string>(seed);
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (sql.includes("DELETE FROM storage")) {
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
  return { db, rows };
}

type Handler = (...args: unknown[]) => unknown;

function register(
  db: MinimalStorageDb,
  assertTrustedSender: (event: unknown) => void = () => {},
) {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
  };
  registerNewPiiErasureHandlers(
    ipcMain as never,
    { $client: db },
    assertTrustedSender as never,
    dir,
    PROFILE,
  );
  registerWithdrawalPurgeHandlers(
    ipcMain as never,
    { $client: db },
    assertTrustedSender as never,
    dir,
    PROFILE,
  );
  return { handlers };
}

const seeded = (): Array<[string, string]> => [
  [CUSTOMERS, SEALED],
  [QUOTES, SEALED],
  [HISTORY, SEALED],
  ["open3dcalc_customers_v1", "legacy"],
];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-newpii-erase-ipc-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("erasure:new-pii:* IPC route", () => {
  it("registers the four exact channels", () => {
    const { handlers } = register(makeDatabase().db);
    expect([...handlers.keys()]).toEqual(
      expect.arrayContaining([
        NEW_PII_ERASURE_CHANNELS.authorize,
        NEW_PII_ERASURE_CHANNELS.claim,
        NEW_PII_ERASURE_CHANNELS.start,
        NEW_PII_ERASURE_CHANNELS.status,
        WITHDRAWAL_PURGE_CHANNELS.request,
        WITHDRAWAL_PURGE_CHANNELS.purge,
      ]),
    );
  });

  it("asserts the trusted sender before any filesystem access", () => {
    const deny = () => {
      throw new Error("Untrusted IPC sender rejected");
    };
    const { handlers } = register(makeDatabase().db, deny);
    expect(() =>
      handlers.get(NEW_PII_ERASURE_CHANNELS.authorize)!(TRUSTED),
    ).toThrow(/Untrusted/);
    expect(fs.existsSync(path.join(dir, "new-pii-erasure-journal.json"))).toBe(
      false,
    );
  });

  it("runs the whole authorize → claim → start flow and purges exactly the three rows", () => {
    const { db, rows } = makeDatabase(seeded());
    const { handlers } = register(db);

    const authorization = handlers.get(NEW_PII_ERASURE_CHANNELS.authorize)!(
      TRUSTED,
    ) as { token: string };
    expect(typeof authorization.token).toBe("string");

    const plan = handlers.get(NEW_PII_ERASURE_CHANNELS.claim)!(
      TRUSTED,
      authorization.token,
    ) as { targets: Array<{ surface: string; id: string }> };
    expect(plan.targets.map((t) => t.id)).toEqual(
      expect.arrayContaining([CUSTOMERS, QUOTES, HISTORY]),
    );

    const receipt = handlers.get(NEW_PII_ERASURE_CHANNELS.start)!(
      TRUSTED,
      authorization.token,
    ) as { purged: string[] };
    expect(receipt.purged).toHaveLength(3);
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy");

    const status = handlers.get(NEW_PII_ERASURE_CHANNELS.status)!(TRUSTED) as {
      active: boolean;
      available: boolean;
    };
    expect(status).toMatchObject({ active: false, available: true });
  });
});

describe("withdrawal:* IPC route", () => {
  it("binds only the scoped new-PII targets and completes the purge", () => {
    const { db, rows } = makeDatabase(seeded());
    const { handlers } = register(db);

    const request = handlers.get(WITHDRAWAL_PURGE_CHANNELS.request)!(TRUSTED, {
      receiptId: "receipt-1",
      scope: ["customers", "history"],
    }) as { token: string; targets: Array<{ id: string }> };
    expect(request.targets.map((t) => t.id)).toEqual([CUSTOMERS, HISTORY]);

    const result = handlers.get(WITHDRAWAL_PURGE_CHANNELS.purge)!(
      TRUSTED,
      request.token,
    ) as { ok: boolean; purged: string[] };
    expect(result.ok).toBe(true);
    expect(result.purged).toEqual(expect.arrayContaining([CUSTOMERS, HISTORY]));
    // The quotes row was out of scope and is untouched.
    expect(rows.get(QUOTES)).toBe(SEALED);
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy");
  });

  it("refuses a scope with no new-PII targets", () => {
    const { handlers } = register(makeDatabase().db);
    expect(() =>
      handlers.get(WITHDRAWAL_PURGE_CHANNELS.request)!(TRUSTED, {
        receiptId: "receipt-1",
        scope: ["dashboard"],
      }),
    ).toThrow(/no new-PII targets/i);
  });

  it("issues a fresh receipt-scoped journal after a completed withdrawal and purges the new rows", () => {
    const { db, rows } = makeDatabase(seeded());
    const { handlers } = register(db);

    // First withdrawal completes and purges its scope.
    const first = handlers.get(WITHDRAWAL_PURGE_CHANNELS.request)!(TRUSTED, {
      receiptId: "receipt-1",
      scope: ["customers", "quotes", "history"],
    }) as { token: string };
    const firstPurge = handlers.get(WITHDRAWAL_PURGE_CHANNELS.purge)!(
      TRUSTED,
      first.token,
    ) as { ok: boolean; purged: string[] };
    expect(firstPurge.ok).toBe(true);
    expect(loadWithdrawalJournal(dir)?.state).toBe("completed");

    // New data lands under the same exact keys after completion.
    rows.set(CUSTOMERS, SEALED);
    rows.set(HISTORY, SEALED);

    // A NEW receipt/scope after completion must NOT reuse the settled journal
    // verbatim: that would return a stale token and report a false
    // `{ ok: true, purged: [] }` while the new rows remain.
    const second = handlers.get(WITHDRAWAL_PURGE_CHANNELS.request)!(TRUSTED, {
      receiptId: "receipt-2",
      scope: ["customers", "history"],
    }) as { token: string; targets: Array<{ id: string }> };
    expect(second.token).not.toBe(first.token);
    expect(second.targets.map((t) => t.id)).toEqual([CUSTOMERS, HISTORY]);

    const secondPurge = handlers.get(WITHDRAWAL_PURGE_CHANNELS.purge)!(
      TRUSTED,
      second.token,
    ) as { ok: boolean; purged: string[] };
    expect(secondPurge).not.toEqual({ ok: true, purged: [] });
    expect(secondPurge.ok).toBe(true);
    expect(secondPurge.purged).toEqual(
      expect.arrayContaining([CUSTOMERS, HISTORY]),
    );
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.has(HISTORY)).toBe(false);
  });

  it("asserts the trusted sender before any filesystem access", () => {
    const deny = () => {
      throw new Error("Untrusted IPC sender rejected");
    };
    const { handlers } = register(makeDatabase().db, deny);
    expect(() =>
      handlers.get(WITHDRAWAL_PURGE_CHANNELS.request)!(TRUSTED, {
        receiptId: "receipt-1",
        scope: ["customers"],
      }),
    ).toThrow(/Untrusted/);
    expect(fs.existsSync(path.join(dir, "withdrawal-journal.json"))).toBe(
      false,
    );
  });
});
