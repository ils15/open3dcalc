/**
 * Main-process crypto capability layer (D1.1 S2) — ADR-001 §2.1.
 *
 * Decision flow per write/read of PII:
 *  1. `safeStorage` available ⇒ encrypt/decrypt with the OS-backed key.
 *     Blob format: "enc1:safeStorage:<base64>".
 *  2. Otherwise, session passphrase held in memory ⇒ SPEC-03-parameter
 *     envelope (see shared crypto/envelope). Blob format:
 *     "enc1:envelope:<json envelope>".
 *  3. Neither ⇒ CryptoDeniedError: PII persistence is DENIED (fail-closed);
 *     the app degrades to memory-only for PII, non-PII unaffected.
 *
 * Zero plaintext path: there is no flag, config, or code path here that
 * writes PII unencrypted. The rollback flag below follows OWNERS-RUNBOOK
 * §7: flipping it off disables NEW encrypted writes only — the decrypt
 * path stays enabled so data written encrypted remains readable.
 */

import { safeStorage } from "electron";
import {
  resolveCryptoCapability,
  type CapabilityDecision,
} from "../src/shared/lib/crypto/capability.js";
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
} from "../src/shared/lib/crypto/envelope.js";
import {
  setSessionPassphrase,
  hasSessionPassphrase,
  getSessionPassphrase,
  zeroizeSessionPassphrase,
} from "../src/shared/lib/crypto/passphraseSession.js";

/**
 * Rollback flag (OWNERS-RUNBOOK §7, S2 row): when false, NEW encrypted
 * writes are refused (callers fall back to the pre-S2 behavior) while the
 * decrypt path stays enabled — encrypted data never becomes unreadable.
 * There is intentionally no "write-plaintext" mode.
 */
export const CRYPTO_WRITE_PATH_ENABLED = true;

const SAFE_STORAGE_PREFIX = "enc1:safeStorage:";
const ENVELOPE_PREFIX = "enc1:envelope:";

export class CryptoDeniedError extends Error {
  readonly code = "crypto_denied";
  constructor(reason: string) {
    super(`[cryptoCapability] PII persistence denied (${reason})`);
    this.name = "CryptoDeniedError";
  }
}

export class UnknownBlobError extends Error {
  readonly code = "legacy_or_unknown_blob";
  constructor() {
    super("[cryptoCapability] value is not an S2-encrypted blob");
    this.name = "UnknownBlobError";
  }
}

/**
 * Probe safeStorage. Fail-closed: an exception or unexpected shape resolves
 * to false (ADR-001 §2.3 — ambiguous state resolves to DENIED).
 */
export function probeSafeStorage(): boolean {
  try {
    return safeStorage.isEncryptionAvailable() === true;
  } catch {
    return false;
  }
}

export function getCapability(): CapabilityDecision {
  return resolveCryptoCapability({
    platform: "electron",
    safeStorageAvailable: probeSafeStorage(),
    hasPassphrase: hasSessionPassphrase(),
  });
}

/**
 * Store the session passphrase in MAIN-process memory only (SPEC-01
 * `session_passphrase_key`: surface memory, sync never, export never).
 * The renderer that sent it keeps no copy beyond the IPC call.
 */
export function adoptSessionPassphrase(passphrase: string): void {
  setSessionPassphrase(passphrase);
}

/** Lock: zeroize the session passphrase. Irreversible. */
export function lockCryptoSession(): void {
  zeroizeSessionPassphrase();
}

/**
 * Encrypt a PII value for at-rest persistence. Throws CryptoDeniedError
 * when the capability table resolves to DENIED (ADR-001 §2.1 deny path).
 */
export async function encryptForStorage(
  key: string,
  plaintext: string,
): Promise<string> {
  if (!CRYPTO_WRITE_PATH_ENABLED) {
    throw new CryptoDeniedError("write_path_disabled");
  }
  const capability = getCapability();
  if (capability.mode === "safe_storage") {
    return (
      SAFE_STORAGE_PREFIX +
      safeStorage.encryptString(plaintext).toString("base64")
    );
  }
  if (capability.mode === "passphrase") {
    const passphrase = getSessionPassphrase();
    if (passphrase === null) throw new CryptoDeniedError(capability.reason);
    const envelope = await encryptWithPassphrase(plaintext, passphrase, {
      purpose: "at-rest",
      key,
    });
    return ENVELOPE_PREFIX + envelope;
  }
  throw new CryptoDeniedError(capability.reason);
}

/**
 * Decrypt a value produced by `encryptForStorage`. Unknown formats (e.g.
 * legacy plaintext written before S2) raise UnknownBlobError — legacy data
 * enters the ADR-002 quarantine regime, it is never silently re-read or
 * re-encrypted here (S4 wires the quarantine flows).
 */
export async function decryptFromStorage(
  _key: string,
  blob: string,
): Promise<string> {
  if (blob.startsWith(SAFE_STORAGE_PREFIX)) {
    const restored = safeStorage.decryptString(
      Buffer.from(blob.slice(SAFE_STORAGE_PREFIX.length), "base64"),
    );
    return restored;
  }
  if (blob.startsWith(ENVELOPE_PREFIX)) {
    const passphrase = getSessionPassphrase();
    if (passphrase === null) throw new CryptoDeniedError("locked");
    return decryptWithPassphrase(
      blob.slice(ENVELOPE_PREFIX.length),
      passphrase,
    );
  }
  throw new UnknownBlobError();
}
