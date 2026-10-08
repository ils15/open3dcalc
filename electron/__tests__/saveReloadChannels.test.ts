import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NEW_PII_CHANNELS,
  registerPasswordlessPiiHandlers,
} from "../newPiiIpc.js";
import type { MinimalStorageDb } from "../persistGate.js";
import { NEW_PII_STORAGE_KEYS } from "../../src/shared/lib/crypto/newPiiNamespace.js";

type Handler = (...args: unknown[]) => unknown;

function createDesktopDatabase(): {
  rows: Map<string, string>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
} {
  const rows = new Map<string, string>();
  const handlers = new Map<string, Handler>();
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      return {
        get(...params: unknown[]): unknown {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]): unknown {
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          }
          if (sql.includes("DELETE FROM storage")) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all(): unknown[] {
          return [...rows.keys()].map((key) => ({ key }));
        },
      };
    },
  };
  const profileDir = mkdtempSync(join(tmpdir(), "o3dc-save-reload-"));
  registerPasswordlessPiiHandlers(
    {
      handle: (channel: string, handler: Handler) => {
        handlers.set(channel, handler);
      },
    } as never,
    { $client: db },
    () => {},
    profileDir,
  );
  return {
    rows,
    async invoke(channel, ...args) {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler registered for ${channel}`);
      return handler(
        { senderFrame: { url: "file:///app/index.html" } },
        ...args,
      );
    },
    dispose() {
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}

describe("saveReloadChannels", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(NEW_PII_STORAGE_KEYS)(
    "saves and reloads plaintext envelope bytes through the exact-key route (%s)",
    async (key) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const desktop = createDesktopDatabase();
      const value = JSON.stringify({
        state: {
          records: [
            {
              id: "synthetic-record-01",
              label: "Synthetic Example",
            },
          ],
        },
        version: 1,
      });

      await desktop.invoke(NEW_PII_CHANNELS.save, key, value);
      expect(desktop.rows.get(key)).toBe(value);
      await expect(desktop.invoke(NEW_PII_CHANNELS.load, key)).resolves.toBe(
        value,
      );
      desktop.dispose();
    },
  );
});
