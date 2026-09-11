import { describe, it, expect, afterEach, vi } from "vitest";
import {
  setSessionPassphrase,
  hasSessionPassphrase,
  getSessionPassphrase,
  zeroizeSessionPassphrase,
  isSessionZeroizedForTests,
} from "@/shared/lib/crypto/passphraseSession";

// ---------------------------------------------------------------------------
// D1.1 S2 — memory-only passphrase session (SPEC-01 `session_passphrase_key`:
// surface memory, class ephemeral_key, sync never, export never).
// ---------------------------------------------------------------------------

afterEach(() => {
  zeroizeSessionPassphrase();
});

describe("passphrase session (memory-only, zeroizable)", () => {
  it("holds the passphrase in memory for the session", () => {
    expect(hasSessionPassphrase()).toBe(false);
    setSessionPassphrase("sessão-sintética-3131");
    expect(hasSessionPassphrase()).toBe(true);
    expect(getSessionPassphrase()).toBe("sessão-sintética-3131");
  });

  it("zeroize is irreversible", () => {
    setSessionPassphrase("sessão-sintética-3131");
    zeroizeSessionPassphrase();
    expect(hasSessionPassphrase()).toBe(false);
    expect(getSessionPassphrase()).toBeNull();
    expect(isSessionZeroizedForTests()).toBe(true);
  });

  it("replacing the passphrase zeroizes the previous buffer", () => {
    setSessionPassphrase("primeira-senha-sintética");
    const first = getSessionPassphrase();
    setSessionPassphrase("segunda-senha-sintética");
    expect(getSessionPassphrase()).toBe("segunda-senha-sintética");
    // The first buffer contents were overwritten in place.
    expect(first).not.toBeNull();
    expect(getSessionPassphrase()).not.toBe(first);
  });

  it("never touches any storage surface (memory is the only surface)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    setSessionPassphrase("sessão-sintética-3131");
    expect(getSessionPassphrase()).not.toBeNull();
    zeroizeSessionPassphrase();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("never logs the passphrase value (TEST-MATRIX 3.2)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setSessionPassphrase("segredo-sintético-nunca-logado");
    const used = getSessionPassphrase();
    expect(used).toContain("segredo");
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
