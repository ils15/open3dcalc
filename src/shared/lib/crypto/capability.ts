/**
 * Crypto capability decision engine (D1.1 S2) — ADR-001 §2.3.
 *
 * Pure, platform-agnostic implementation of the normative decision table.
 * Fail-closed: a missing/failed/ambiguous probe resolves to DENIED — never
 * to a plaintext path. The runtime probes are injected by each platform:
 *
 *  - Electron: `safeStorage.isEncryptionAvailable()` (main process).
 *  - Web/PWA: `window.isSecureContext` + Web Crypto availability.
 *
 * "hasPassphrase" means the user entered one in the CURRENT session and it
 * is held in memory (there is no "remember passphrase" feature — that would
 * be persistence, ADR-001 §2.3 note).
 */

export type CryptoPlatform = "electron" | "web";

export type CapabilityMode = "safe_storage" | "passphrase" | "denied";

/** Machine-readable reason codes (never user-facing text; no PII). */
export type CapabilityReason =
  | "safe_storage_available"
  | "passphrase_session"
  | "insecure_context"
  | "no_safe_storage_no_passphrase"
  | "probe_failed";

export interface CapabilityDecision {
  mode: CapabilityMode;
  /** Only allowed outcomes per ADR-001 §2.3. */
  piiPersistence: "encrypted_at_rest" | "denied";
  reason: CapabilityReason;
}

export interface CapabilityProbe {
  platform: CryptoPlatform;
  /** Electron: result of safeStorage.isEncryptionAvailable() (main only). */
  safeStorageAvailable?: boolean | undefined;
  /** Web: window.isSecureContext (undefined ⇒ fail-closed). */
  secureContext?: boolean | undefined;
  /** True only when a session passphrase is currently held in memory. */
  hasPassphrase: boolean;
}

/**
 * Resolve the ADR-001 §2.3 decision table. Any probe failure must be mapped
 * by the caller to `undefined`/`false` before calling this — and any input
 * combination outside the table resolves to `denied` here.
 */
export function resolveCryptoCapability(
  probe: CapabilityProbe,
): CapabilityDecision {
  if (probe.platform === "electron") {
    if (probe.safeStorageAvailable === true) {
      return {
        mode: "safe_storage",
        piiPersistence: "encrypted_at_rest",
        reason: "safe_storage_available",
      };
    }
    if (probe.hasPassphrase) {
      return {
        mode: "passphrase",
        piiPersistence: "encrypted_at_rest",
        reason: "passphrase_session",
      };
    }
    return {
      mode: "denied",
      piiPersistence: "denied",
      reason:
        probe.safeStorageAvailable === false
          ? "no_safe_storage_no_passphrase"
          : "probe_failed",
    };
  }

  // Web / PWA row(s)
  if (probe.secureContext === true && probe.hasPassphrase) {
    return {
      mode: "passphrase",
      piiPersistence: "encrypted_at_rest",
      reason: "passphrase_session",
    };
  }
  return {
    mode: "denied",
    piiPersistence: "denied",
    reason:
      probe.secureContext === false ? "insecure_context" : "probe_failed",
  };
}

/** True when the decision allows PII to be persisted (encrypted only). */
export function allowsPiiPersistence(d: CapabilityDecision): boolean {
  return d.piiPersistence === "encrypted_at_rest";
}
