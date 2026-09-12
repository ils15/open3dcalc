import { describe, it, expect } from "vitest";
import {
  resolveCryptoCapability,
  allowsPiiPersistence,
} from "@/shared/lib/crypto/capability";

// ---------------------------------------------------------------------------
// D1.1 S2 — ADR-001 §2.3 capability decision table (normative rows) +
// fail-closed behavior for failed/ambiguous probes.
// ---------------------------------------------------------------------------

describe("crypto capability decision table (ADR-001 §2.3)", () => {
  it("row 1: Electron + safeStorage available ⇒ encrypted at rest (passphrase not required)", () => {
    const d = resolveCryptoCapability({
      platform: "electron",
      safeStorageAvailable: true,
      hasPassphrase: false,
    });
    expect(d.mode).toBe("safe_storage");
    expect(d.piiPersistence).toBe("encrypted_at_rest");
  });

  it("row 2: Electron + no safeStorage + passphrase ⇒ encrypted at rest (envelope)", () => {
    const d = resolveCryptoCapability({
      platform: "electron",
      safeStorageAvailable: false,
      hasPassphrase: true,
    });
    expect(d.mode).toBe("passphrase");
    expect(d.piiPersistence).toBe("encrypted_at_rest");
  });

  it("row 3: Electron + no safeStorage + no passphrase ⇒ DENIED", () => {
    const d = resolveCryptoCapability({
      platform: "electron",
      safeStorageAvailable: false,
      hasPassphrase: false,
    });
    expect(d.mode).toBe("denied");
    expect(d.piiPersistence).toBe("denied");
    expect(d.reason).toBe("no_safe_storage_no_passphrase");
  });

  it("row 4: Web secure context + passphrase ⇒ encrypted at rest", () => {
    const d = resolveCryptoCapability({
      platform: "web",
      secureContext: true,
      hasPassphrase: true,
    });
    expect(d.mode).toBe("passphrase");
    expect(d.piiPersistence).toBe("encrypted_at_rest");
  });

  it("row 5: Web secure context + no passphrase ⇒ DENIED", () => {
    const d = resolveCryptoCapability({
      platform: "web",
      secureContext: true,
      hasPassphrase: false,
    });
    expect(d.mode).toBe("denied");
    expect(d.piiPersistence).toBe("denied");
  });

  it("row 6: Web insecure context ⇒ DENIED regardless of passphrase", () => {
    const d = resolveCryptoCapability({
      platform: "web",
      secureContext: false,
      hasPassphrase: true,
    });
    expect(d.mode).toBe("denied");
    expect(d.reason).toBe("insecure_context");
  });

  it("fail-closed: undefined/failed probes resolve to DENIED, never plaintext", () => {
    // Probe threw and the caller mapped it to undefined.
    const probeFailed = resolveCryptoCapability({
      platform: "electron",
      safeStorageAvailable: undefined,
      hasPassphrase: false,
    });
    expect(probeFailed.mode).toBe("denied");
    expect(probeFailed.reason).toBe("probe_failed");

    const webAmbiguous = resolveCryptoCapability({
      platform: "web",
      secureContext: undefined,
      hasPassphrase: true,
    });
    expect(webAmbiguous.mode).toBe("denied");

    const allows = allowsPiiPersistence(probeFailed);
    expect(allows).toBe(false);
  });
});
