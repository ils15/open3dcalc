/**
 * Desktop DB bridge over `window.electronAPI.db`.
 *
 * The bridge is the only JSON-serialising wrapper around the closed generic
 * store IPC. It must fail closed without the preload bridge, never invent a
 * raw-query escape hatch, and keep its exact load/save/delete/listKeys shape.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { dbBridge } from "../db-bridge";

type DbApi = {
  load: (key: string) => Promise<string | null>;
  save: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  listKeys: () => Promise<string[]>;
};

function install(db: Partial<DbApi>): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = { db };
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  vi.restoreAllMocks();
});

describe("dbBridge", () => {
  it("exposes no raw query escape hatch", () => {
    expect("query" in dbBridge).toBe(false);
    expect(Object.keys(dbBridge).sort()).toEqual([
      "delete",
      "listKeys",
      "load",
      "save",
    ]);
  });

  it("fails closed when the electron db bridge is absent", async () => {
    await expect(dbBridge.load("k")).rejects.toThrow(/not available/);
    await expect(dbBridge.save("k", 1)).rejects.toThrow(/not available/);
    await expect(dbBridge.delete("k")).rejects.toThrow(/not available/);
    await expect(dbBridge.listKeys()).rejects.toThrow(/not available/);
  });

  it("parses a stored JSON value", async () => {
    const load = vi.fn(async () => JSON.stringify({ a: 1 }));
    install({ load });

    await expect(dbBridge.load("k")).resolves.toEqual({ a: 1 });
    expect(load).toHaveBeenCalledWith("k");
  });

  it("returns null for an absent key and the raw string for non-JSON bytes", async () => {
    install({ load: vi.fn(async () => null) });
    await expect(dbBridge.load("k")).resolves.toBeNull();

    install({ load: vi.fn(async () => "not-json") });
    await expect(dbBridge.load("k")).resolves.toBe("not-json");
  });

  it("serialises the value on save", async () => {
    const save = vi.fn(async () => undefined);
    install({ save });

    await dbBridge.save("k", { a: 1 });
    expect(save).toHaveBeenCalledWith("k", JSON.stringify({ a: 1 }));
  });

  it("deletes and lists keys through the same bridge", async () => {
    const remove = vi.fn(async () => undefined);
    const listKeys = vi.fn(async () => ["a", "b"]);
    install({ delete: remove, listKeys });

    await expect(dbBridge.delete("a")).resolves.toBeUndefined();
    await expect(dbBridge.listKeys()).resolves.toEqual(["a", "b"]);
    expect(remove).toHaveBeenCalledWith("a");
  });
});
