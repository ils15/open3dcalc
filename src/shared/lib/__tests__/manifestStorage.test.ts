import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { manifestStorage, guardedStorage } from "@/shared/lib/manifestStorage";
import {
  resetManifestForTests,
  ManifestError,
} from "@/shared/lib/manifestGate";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

// ---------------------------------------------------------------------------
// S1 wiring: the gated storage wrappers are drop-in for their raw
// counterparts on manifest-known keys, and deny unknown keys without ever
// logging values (TEST-MATRIX 3.2 — key NAMES only).
// ---------------------------------------------------------------------------

describe("guardedStorage (S1)", () => {
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(() => {
    resetManifestForTests(null);
    vi.restoreAllMocks();
    process.env.NODE_ENV = OLD_ENV;
    window.localStorage.clear();
  });

  it("passes known keys through to localStorage untouched", () => {
    guardedStorage.setItem("open3dcalc_settings_v2", '{"activeTab":"fdm"}');
    expect(window.localStorage.getItem("open3dcalc_settings_v2")).toBe(
      '{"activeTab":"fdm"}',
    );
    expect(guardedStorage.getItem("open3dcalc_settings_v2")).toBe(
      '{"activeTab":"fdm"}',
    );
    guardedStorage.removeItem("open3dcalc_settings_v2");
    expect(window.localStorage.getItem("open3dcalc_settings_v2")).toBeNull();
  });

  it("denies unknown keys with ManifestError in dev", () => {
    process.env.NODE_ENV = "development";
    expect(() => guardedStorage.setItem("open3dcalc_rogue", "x")).toThrow(
      ManifestError,
    );
    expect(() => guardedStorage.getItem("open3dcalc_rogue")).toThrow(
      ManifestError,
    );
    expect(window.localStorage.getItem("open3dcalc_rogue")).toBeNull();
  });

  it("deny-safes unknown keys in production (no crash, no write)", () => {
    process.env.NODE_ENV = "production";
    expect(() => guardedStorage.setItem("open3dcalc_rogue", "x")).not.toThrow();
    expect(window.localStorage.getItem("open3dcalc_rogue")).toBeNull();
    expect(guardedStorage.getItem("open3dcalc_rogue")).toBeNull();
  });

  it("never logs stored values — key NAMES only (TEST-MATRIX 3.2)", () => {
    const sensitiveValue = "João da Silva <joao@example.com>";
    guardedStorage.setItem("open3dcalc_customers_v1", sensitiveValue);
    const logged = vi
      .mocked(console.warn)
      .mock.calls.map((args) => String(args[0]))
      .join(" ");
    expect(logged).not.toContain("João da Silva");
    expect(logged).not.toContain("joao@example.com");
  });
});

describe("manifestStorage (S1 zustand persist wrapper)", () => {
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(() => {
    resetManifestForTests(null);
    vi.restoreAllMocks();
    process.env.NODE_ENV = OLD_ENV;
    window.localStorage.clear();
  });

  it("returns a PersistStorage that round-trips a known key", () => {
    const storage = manifestStorage();
    expect(storage).toBeDefined();
    storage!.setItem("open3dcalc_history_v2", { state: { v: 1 }, version: 1 });
    expect(storage!.getItem("open3dcalc_history_v2")).toEqual({
      state: { v: 1 },
      version: 1,
    });
    storage!.removeItem("open3dcalc_history_v2");
    expect(storage!.getItem("open3dcalc_history_v2")).toBeNull();
  });

  it("is JSON-based like the zustand default (persist wrapper shape kept)", () => {
    const storage = manifestStorage<{ a: number }>();
    storage!.setItem("open3dcalc_products", { state: { a: 1 }, version: 1 });
    expect(window.localStorage.getItem("open3dcalc_products")).toBe(
      '{"state":{"a":1},"version":1}',
    );
  });

  it("denies unknown keys with ManifestError in dev (fail-closed)", () => {
    process.env.NODE_ENV = "development";
    const storage = manifestStorage();
    expect(() =>
      storage!.setItem("open3dcalc_rogue", { state: {}, version: 1 }),
    ).toThrow(ManifestError);
  });

  it("degrades to a no-op storage when localStorage is unavailable (SSR)", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => undefined,
    });
    try {
      const storage = manifestStorage();
      expect(() =>
        storage!.setItem("open3dcalc_settings_v2", { state: {}, version: 1 }),
      ).not.toThrow();
      expect(storage!.getItem("open3dcalc_settings_v2")).toBeNull();
      expect(guardedStorage.getItem("open3dcalc_settings_v2")).toBeNull();
      expect(() =>
        guardedStorage.setItem("open3dcalc_settings_v2", "x"),
      ).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
