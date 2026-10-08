import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  manifestStorage,
  guardedStorage,
  guardedSyncStorage,
  stablePiiPersistStorage,
} from "@/shared/lib/manifestStorage";
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

  it("persists approved Stable PII without logging stored values", () => {
    const sensitiveValue = "João da Silva <joao@example.com>";
    guardedStorage.setItem("open3dcalc_customers_v1", sensitiveValue);
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toBe(
      sensitiveValue,
    );
    const logged = vi
      .mocked(console.warn)
      .mock.calls.map((args) => String(args[0]))
      .join(" ");
    expect(logged).not.toContain("João da Silva");
    expect(logged).not.toContain("joao@example.com");
  });
});

// ---------------------------------------------------------------------------
// HIGH-1: the sync path must never write a manifest-declared PII key to
// localStorage as plaintext. `guardedSyncStorage` composes the allowlist with
// the `pii:true` predicate and refuses at that choke point.
// ---------------------------------------------------------------------------

describe("guardedSyncStorage (HIGH-1 plaintext-PII write guard)", () => {
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

  it.each([
    "open3dcalc_history_v2",
    "open3dcalc_customers_v1",
    "open3dcalc_quotes_v1",
  ])("refuses a plaintext PII write for %s in dev", (key) => {
    process.env.NODE_ENV = "development";
    expect(() => guardedSyncStorage.setItem(key, '{"state":{}}')).toThrow(
      ManifestError,
    );
    expect(window.localStorage.getItem(key)).toBeNull();
    // Key NAMES only — never the value (TEST-MATRIX 3.2).
    const logged = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(logged).toContain(key);
    expect(logged).not.toContain('{"state":{}}');
  });

  it("deny-safes a plaintext PII write in production (no crash, no write)", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      guardedSyncStorage.setItem("open3dcalc_customers_v1", '{"state":{}}'),
    ).not.toThrow();
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toBeNull();
  });

  it("delegates a non-PII key to guardedStorage unchanged", () => {
    guardedSyncStorage.setItem("open3dcalc_theme", "dark");
    expect(window.localStorage.getItem("open3dcalc_theme")).toBe("dark");
    expect(guardedSyncStorage.getItem("open3dcalc_theme")).toBe("dark");
    guardedSyncStorage.removeItem("open3dcalc_theme");
    expect(window.localStorage.getItem("open3dcalc_theme")).toBeNull();
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
    storage!.setItem("open3dcalc_settings_v2", { state: { v: 1 }, version: 1 });
    expect(storage!.getItem("open3dcalc_settings_v2")).toEqual({
      state: { v: 1 },
      version: 1,
    });
    storage!.removeItem("open3dcalc_settings_v2");
    expect(storage!.getItem("open3dcalc_settings_v2")).toBeNull();
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

// ---------------------------------------------------------------------------
// Stable Web plaintext persistence is restricted to the exact policy-approved
// keys. Sync remains separately denied above.
// ---------------------------------------------------------------------------

describe("Stable Web plaintext PII persistence", () => {
  const OLD_ENV = process.env.NODE_ENV;
  const OLD_UA = navigator.userAgent;

  beforeEach(() => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.clear();
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    resetManifestForTests(null);
    vi.restoreAllMocks();
    process.env.NODE_ENV = OLD_ENV;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: OLD_UA,
    });
    window.localStorage.clear();
  });

  function setUserAgent(value: string): void {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value,
    });
  }

  it.each([
    "open3dcalc_customers_v1",
    "open3dcalc_quotes_v1",
    "open3dcalc_history_v2",
  ])("persists the approved Stable key %s", (key) => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    guardedStorage.setItem(key, '{"state":{"name":"synthetic"}}');

    expect(window.localStorage.getItem(key)).toBe(
      '{"state":{"name":"synthetic"}}',
    );
  });

  it("persists a declared PII key through manifestStorage", () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    const storage = manifestStorage();

    storage!.setItem("open3dcalc_history_v2", { state: { v: 1 }, version: 1 });

    expect(window.localStorage.getItem("open3dcalc_history_v2")).toBe(
      '{"state":{"v":1},"version":1}',
    );
    expect(storage!.getItem("open3dcalc_history_v2")).toEqual({
      state: { v: 1 },
      version: 1,
    });
  });

  it("does not overwrite a corrupt persisted state after failed hydration", () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    const key = "open3dcalc_customers_v1";
    const corrupt = "{not-json";
    window.localStorage.setItem(key, corrupt);
    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(key);

    expect(() => storage.getItem(key)).toThrow();
    expect(() =>
      storage.setItem(key, {
        state: { customers: [] },
        version: 1,
      }),
    ).toThrow();
    expect(window.localStorage.getItem(key)).toBe(corrupt);
  });

  it("does not overwrite persisted bytes with an unsupported store version", () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    const key = "open3dcalc_customers_v1";
    const unsupported = JSON.stringify({
      state: { customers: [] },
      version: 9,
    });
    window.localStorage.setItem(key, unsupported);
    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(key);

    expect(() => storage.getItem(key)).toThrow(/failed to hydrate/);
    expect(() =>
      storage.setItem(key, { state: { customers: [] }, version: 1 }),
    ).toThrow(/before readable hydration/);
    expect(window.localStorage.getItem(key)).toBe(unsupported);
  });

  it("reports unavailable localStorage and refuses to claim a save", () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("storage unavailable", "SecurityError");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = stablePiiPersistStorage<{ customers: unknown[] }>(
      "open3dcalc_customers_v1",
    );

    try {
      expect(() => storage.getItem("open3dcalc_customers_v1")).toThrow(
        /failed to hydrate/,
      );
      expect(() =>
        storage.setItem("open3dcalc_customers_v1", {
          state: { customers: [] },
          version: 1,
        }),
      ).toThrow(/before readable hydration/);
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      }
      vi.restoreAllMocks();
    }
  });

  it.each([
    ["open3dcalc_customers_v1", "customers", 1],
    ["open3dcalc_quotes_v1", "quotes", 1],
    ["open3dcalc_history_v2", "entries", 2],
  ] as const)("round-trips the approved store %s", (key, field, version) => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    const storage = stablePiiPersistStorage<Record<string, unknown[]>>(key);
    expect(storage.getItem(key)).toBeNull();
    storage.setItem(key, {
      state: { [field]: [] },
      version,
    });
    expect(window.localStorage.getItem(key)).toBe(
      JSON.stringify({ state: { [field]: [] }, version }),
    );
  });

  it("still persists a non-PII key on the web target", () => {
    setUserAgent("Mozilla/5.0 (compatible; web)");
    guardedStorage.setItem("open3dcalc_settings_v2", '{"activeTab":"fdm"}');
    expect(window.localStorage.getItem("open3dcalc_settings_v2")).toBe(
      '{"activeTab":"fdm"}',
    );
  });

  it("does not treat an Electron renderer as the web target", () => {
    setUserAgent("Mozilla/5.0 Electron/40.0");
    // Desktop PII is gated elsewhere; the web-specific plaintext refusal must
    // not change desktop behavior in this slice.
    guardedStorage.setItem("open3dcalc_settings_v2", '{"activeTab":"fdm"}');
    expect(window.localStorage.getItem("open3dcalc_settings_v2")).toBe(
      '{"activeTab":"fdm"}',
    );
  });
});
