/**
 * Main-process crypto capability layer (D1.1 S2, remediated in Beta5 Wave 2) —
 * ADR-001 §2.1, §3.1–§3.4.
 *
 * Decision flow per write/read of PII:
 *  1. The OS keyring passes the §3.4 gate AND the §3.6 self-test ⇒ the value is
 *     sealed with the ADR-001 application envelope under the safeStorage-wrapped
 *     PROFILE DATA KEY. Blob format: "enc1:profileKey:<json envelope>".
 *  2. Otherwise, session passphrase held in memory ⇒ the same envelope under a
 *     PBKDF2-derived key. Blob format: "enc1:envelope:<json envelope>".
 *  3. Neither ⇒ CryptoDeniedError: PII persistence is DENIED (fail-closed);
 *     the app degrades to memory-only for PII, non-PII unaffected.
 *
 * ## Why the `safeStorage` branch has an envelope in front of it now
 *
 * It used to call `safeStorage.encryptString` AS the cipher, which means the
 * sealed value was bound to nothing: `safeStorage` accepts no associated data,
 * so a ciphertext moved from one storage row to another decrypted cleanly and
 * nothing about it recorded where it had been. The primary path therefore had
 * strictly less protection than the passphrase fallback, which has had an AAD
 * all along.
 *
 * Now a random 256-bit PROFILE DATA KEY is generated per profile, sealed by
 * the OS keyring (only the sealed form is persisted — see
 * `profileDataKey.ts`), and held in main-process memory. The record is sealed
 * with the application envelope under that data key, so the AAD contract of
 * §3.1 actually binds: key, purpose, `schemaVersion` and
 * `envelopeFormatVersion` are each authenticated, independently.
 *
 * ## Why there is a self-test before any of it
 *
 * "The keyring said yes" is a claim, not a proof. Before any PII is sealed or
 * opened, this layer round-trips a fixed sentinel through the real keyring and
 * a value through the real envelope, AND verifies the negative control — that
 * the same envelope opened under a different expectation is REFUSED. A
 * keyring that answers "available" while handing back something else, or an
 * AAD that is not actually enforced, is caught once, with a reason, instead of
 * on the first read of a customer's name.
 *
 * ## The gate is not only `isEncryptionAvailable()`
 *
 * On Linux that probe returns `true` for the `basic_text` backend, which is
 * fixed-key obfuscation and not encryption. The gate is `probeOsKeyring`
 * (`osKeyring.ts`): on Linux an allowlist of real backend names, on
 * Windows/macOS OS-backed availability plus a round-trip, and nothing at all on
 * a platform with no documented gate.
 *
 * ## Sync APIs only, deliberately
 *
 * `encryptStringAsync`/`decryptStringAsync` are not used, and there is no
 * rotation flow. `decryptStringAsync` returns `{result, shouldReEncrypt}` and
 * its documentation says to call it again when re-encryption is requested — but
 * it returns no replacement ciphertext, so there is no documented way for this
 * app to persist a rewrapped blob. Building one would mean inventing an
 * operation, so the async path stays unavailable until Electron documents it.
 *
 * ## Zero plaintext path
 *
 * There is no flag, config, or code path here that writes PII unencrypted. The
 * rollback flag below follows OWNERS-RUNBOOK §7: flipping it off disables NEW
 * encrypted writes only — the decrypt path stays enabled so data written
 * encrypted remains readable.
 */

import { safeStorage } from "electron";
import {
  resolveCryptoCapability,
  type CapabilityDecision,
} from "../src/shared/lib/crypto/capability.js";
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
  AT_REST_PURPOSE,
  CURRENT_ENVELOPE_FORMAT_VERSION,
  EnvelopeRejectedError,
  type EnvelopeExpectation,
} from "../src/shared/lib/crypto/envelope.js";
import {
  setSessionPassphrase,
  hasSessionPassphrase,
  getSessionPassphrase,
  zeroizeSessionPassphrase,
} from "../src/shared/lib/crypto/passphraseSession.js";
import {
  probeOsKeyring,
  osKeyringRoundTrip,
  OS_KEYRING_PROBE_SENTINEL,
  type OsKeyringDecision,
} from "./osKeyring.js";
import {
  ensureProfileDataKey,
  hasProfileDataKey,
  profileDataKeyBase64,
  zeroizeProfileDataKey,
  ProfileDataKeyError,
} from "./profileDataKey.js";

/**
 * Rollback flag (OWNERS-RUNBOOK §7, S2 row): when false, NEW encrypted
 * writes are refused (callers fall back to the pre-S2 behavior) while the
 * decrypt path stays enabled — encrypted data never becomes unreadable.
 * There is intentionally no "write-plaintext" mode.
 */
export const CRYPTO_WRITE_PATH_ENABLED = true;

/**
 * Sealed under the profile data key. The blob is an ADR-001 §3.1 envelope, so
 * the `enc1:` prefix still marks it encrypted for the legacy scanner, the
 * quarantine report and the persistence gate, while the second segment names
 * the key it was sealed under.
 */
const PROFILE_KEY_PREFIX = "enc1:profileKey:";

/** Sealed under a PBKDF2-derived key from the session passphrase. */
const ENVELOPE_PREFIX = "enc1:envelope:";

/**
 * The pre-remediation shape: a raw `safeStorage.encryptString` blob, with no AAD
 * and therefore no binding to anything. Kept only so the reader can recognise
 * it and refuse it by name — see `LegacyUnboundBlobError`.
 */
const LEGACY_UNBOUND_PREFIX = "enc1:safeStorage:";

/**
 * The key name the self-test seals under. Deliberately not a manifest key: it
 * can never be confused with a real record, and the negative control below
 * proves the AAD binds by opening the same envelope under a DIFFERENT name.
 */
const SELF_TEST_KEY = "open3dcalc_crypto_selftest_v1";
const SELF_TEST_MOVED_KEY = "open3dcalc_crypto_selftest_moved_v1";

/**
 * `schemaVersion` (S) of the at-rest AAD.
 *
 * The trusted source for S is the per-key `version` in the shipped SPEC-01
 * manifest (`dataManifest.ManifestEntry`). The main process cannot reach that
 * fixture yet — it is loaded over `fs` rather than an ESM JSON import, which is
 * why this layer deliberately does not import the manifest — so the agreed
 * value is pinned here.
 *
 * It is a constant, not a lookup, and that is a KNOWN SHORTCOMING: a constant
 * is only as trusted as the review that pins it. When the manifest becomes
 * reachable from this layer, this MUST become a per-key lookup, or a manifest
 * version bump will silently re-label every existing envelope's `S` and strand
 * it. Tracked as ADR-001 §3.3 `TODO(hermes)`.
 */
const PII_SCHEMA_VERSION = 1;

/**
 * Test-only override of the AAD expectation.
 *
 * `S`, `F` and `P` are compile-time constants here, so without a seam the
 * "a value moved to a different purpose/schema/envelope version is refused"
 * property could only be asserted against the shared module — i.e. against
 * somebody else's code — and never through the composition this layer
 * actually performs. One seam covers all three axes; production sets it to
 * `null` and it is `null` from the moment the module is loaded.
 */
let expectationOverride: Partial<EnvelopeExpectation> | null = null;

/**
 * The caller-trusted AAD expectation for one storage key (ADR-001 §3.2).
 *
 * Built from `key` — the argument the CALLER passed, not anything read back
 * out of the ciphertext. The reader treats the envelope's own copy of these
 * four values as unauthenticated metadata and compares it to this.
 */
function expectationFor(key: string): EnvelopeExpectation {
  return {
    key,
    purpose: AT_REST_PURPOSE,
    schemaVersion: PII_SCHEMA_VERSION,
    envelopeFormatVersion: CURRENT_ENVELOPE_FORMAT_VERSION,
    ...expectationOverride,
  };
}

/** Test-only. Pass `null` to restore the pinned constants. */
export function overrideExpectationForTests(
  override: Partial<EnvelopeExpectation> | null,
): void {
  expectationOverride = override;
}

export class CryptoDeniedError extends Error {
  readonly code = "crypto_denied";
  /**
   * WHY this write was denied, as a code — `write_path_disabled`,
   * `no_capability`, `quarantined_read_only`, `locked`, `unknown_key`, …
   *
   * Carried as a field, not only interpolated into the message. The reason is
   * the only thing that distinguishes a rollback flag from a locked session
   * from a quarantined key, and a consumer that has to `parse` the message to
   * recover it cannot render it, branch on it, or assert on it — which is how
   * the startup failure surface ended up showing every denial as the bare
   * class name `CryptoDeniedError`.
   *
   * A CODE, never a value: these strings are all compile-time constants at the
   * `new CryptoDeniedError(...)` sites, so nothing derived from a PII value
   * reaches this field and it is safe to render (§3.2 — logs carry key NAMES,
   * never values).
   */
  readonly reason: string;
  constructor(reason: string) {
    super(`[cryptoCapability] PII persistence denied (${reason})`);
    this.name = "CryptoDeniedError";
    this.reason = reason;
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
 * A blob in the pre-remediation `enc1:safeStorage:<base64>` shape: a raw
 * `safeStorage.encryptString` output, carrying no AAD and therefore bound to
 * nothing.
 *
 * A DISTINCT type on purpose, and the reason is the ADR-002 routing:
 *
 *  - raising `UnknownBlobError` would route it into the `legacy_plaintext`
 *    branch of the persistence gate, which hands the stored string back to the
 *    caller as the value — i.e. the customer's raw ciphertext rendered as if it
 *    were their name;
 *  - raising `CryptoDeniedError` would report it as `locked`, which is a
 *    different problem with a different fix and a different user-facing
 *    explanation.
 *
 * So it is refused, by name, and the caller can tell an operator that this
 * value predates the AAD binding. Recovering one is the ADR-001 §3.6
 * obligation (copy, re-encrypt, verify, then remove) and is **not implemented
 * here** — nothing in this module migrates.
 */
export class LegacyUnboundBlobError extends Error {
  readonly code = "legacy_unbound_encryption";
  readonly reason = "legacy_unbound_encryption";
  constructor() {
    super(
      "[cryptoCapability] value is a pre-AAD keyring blob; it is not bound to any key, purpose or version and is refused rather than reinterpreted",
    );
    this.name = "LegacyUnboundBlobError";
  }
}

/**
 * The raw `safeStorage` availability probe, kept for the capability report.
 *
 * IT IS NOT THE GATE, and the reason is Linux's `basic_text` backend:
 * `isEncryptionAvailable()` returns `true` for it, and `basic_text` is a
 * fixed obfuscation key with no OS credential store behind it. Use
 * `getOsKeyringDecision()` for anything that decides. Fail-closed: an
 * exception resolves to false (ADR-001 §2.3 — ambiguous state resolves to
 * DENIED).
 */
export function probeSafeStorage(): boolean {
  try {
    return safeStorage.isEncryptionAvailable() === true;
  } catch {
    return false;
  }
}

/** The OS-keyring gate of ADR-001 §3.4, for the report and the readiness gate. */
export function getOsKeyringDecision(): OsKeyringDecision {
  return probeOsKeyring();
}

/**
 * The capability table of §2.3, with `safeStorage` REPLACED by the §3.4 gate.
 *
 * `getCapability` is synchronous and therefore cannot run the self-test; it
 * reports whether the OS keyring is usable, not whether the profile data key
 * is established. The full readiness answer — key included — is
 * `runPiiCryptoSelfTest`, which is async and is what the seal/open paths
 * require.
 */
export function getCapability(): CapabilityDecision {
  return resolveCryptoCapability({
    platform: "electron",
    safeStorageAvailable: probeOsKeyring().available,
    hasPassphrase: hasSessionPassphrase(),
  });
}

/**
 * The verdict of the pre-hydration self-test for this process. `null` until it
 * has run — and the seal/open paths run it themselves, so a caller that
 * forgets still cannot write or read an unverified record.
 */
let selfTestReady: boolean | null = null;

export type PiiCryptoSelfTestResult =
  | {
      ready: true;
      /** Which keyring answered. Metadata, never a value. */
      backend: string;
      roundTrip: true;
      /** The negative control passed: a moved expectation is REFUSED. */
      aadBindingEnforced: true;
    }
  | {
      ready: false;
      /** A code from `OsKeyringRefusal` or the self-test's own set below. */
      reason: string;
    };

/**
 * Refusals produced by the self-test itself rather than by the backend gate.
 * `profile_data_key_unavailable` deliberately does not name the underlying
 * fault: the wrapped key being corrupt, unwrappable or of the wrong length are
 * the same operator problem (this profile's key cannot be recovered) and the
 * specific one is on the `ProfileDataKeyError` that is logged, not returned.
 */
export type PiiCryptoSelfTestRefusal =
  | "write_path_disabled"
  | "profile_data_key_unavailable"
  | "self_test_round_trip_failed"
  | "self_test_binding_not_enforced";

/**
 * Prove, before any PII is sealed or opened, that this machine can do the job.
 *
 * Three claims, in order, and the order matters because each one is cheaper and
 * more fundamental than the next:
 *
 *  1. **The backend is real.** The §3.4 gate, which is a backend-name allowlist
 *     on Linux and OS-backed availability plus a round-trip elsewhere. A
 *     `basic_text` keyring fails here, before a data key exists — so a machine
 *     that cannot protect PII does not get a key file written to it.
 *  2. **The key unwraps and the envelope round-trips.** Seal a fixed non-PII
 *     sentinel under the profile data key and open it again. This is the only
 *     place a keyring that answers "available" and then hands back something
 *     else gets caught.
 *  3. **The AAD actually binds.** The negative control: open that same envelope
 *     under a DIFFERENT key name and require a refusal. A composition that
 *     sealed without an AAD — the exact defect this layer was remediated for —
 *     would pass steps 1 and 2 and is caught here.
 *
 * Never throws: it returns a verdict, because "cannot protect PII" is an
 * expected state that callers branch on, not an exception. Key NAMES and reason
 * codes only; no value and no key material is returned or logged.
 */
export async function runPiiCryptoSelfTest(): Promise<PiiCryptoSelfTestResult> {
  if (!CRYPTO_WRITE_PATH_ENABLED) {
    selfTestReady = false;
    return { ready: false, reason: "write_path_disabled" };
  }

  const gate = probeOsKeyring();
  if (!gate.available) {
    selfTestReady = false;
    return { ready: false, reason: gate.reason };
  }
  // The gate round-trips only where there is no backend name to check
  // (Windows/macOS). Here it runs on every platform, because a fresh profile's
  // first use of the keyring WRAPS the data key without ever reading it back: a
  // keyring that can write but not read would create a profile whose every
  // subsequent run fails, and the only place to catch that is before the first
  // record is sealed.
  if (!osKeyringRoundTrip()) {
    selfTestReady = false;
    return { ready: false, reason: "os_round_trip_failed" };
  }

  try {
    ensureProfileDataKey();
  } catch (error) {
    selfTestReady = false;
    console.warn(
      `[cryptoCapability] self-test cannot establish the profile data key ` +
        `(${
          error instanceof ProfileDataKeyError ? error.reason : "unknown"
        }) — PII is UNAVAILABLE, existing records stay sealed`,
    );
    return { ready: false, reason: "profile_data_key_unavailable" };
  }

  try {
    const sentinel = OS_KEYRING_PROBE_SENTINEL;
    const dataKey = profileDataKeyBase64();
    const sealed = await encryptWithPassphrase(
      sentinel,
      dataKey,
      expectationFor(SELF_TEST_KEY),
    );
    const reopened = await decryptWithPassphrase(
      sealed,
      dataKey,
      expectationFor(SELF_TEST_KEY),
    );
    if (reopened !== sentinel) {
      selfTestReady = false;
      return { ready: false, reason: "self_test_round_trip_failed" };
    }
    try {
      await decryptWithPassphrase(
        sealed,
        dataKey,
        expectationFor(SELF_TEST_MOVED_KEY),
      );
      // It opened. The AAD is not being enforced, which is the one failure
      // mode that would make every other claim here worthless.
      selfTestReady = false;
      return { ready: false, reason: "self_test_binding_not_enforced" };
    } catch (error) {
      if (!(error instanceof EnvelopeRejectedError)) throw error;
    }
  } catch {
    selfTestReady = false;
    return { ready: false, reason: "self_test_round_trip_failed" };
  }

  selfTestReady = true;
  return {
    ready: true,
    backend: gate.backend,
    roundTrip: true,
    aadBindingEnforced: true,
  };
}

/**
 * The choke point every PII seal and open goes through.
 *
 * The self-test is run HERE, not merely at startup, so the guarantee "nothing
 * is sealed or opened before the machine has proved it can" is a property of
 * the code rather than a thing every caller has to remember. Startup callers
 * (the main-process readiness gate) should still call
 * `runPiiCryptoSelfTest()` to surface a refusal before the UI is up, but a
 * caller that forgets gets the same refusal, later, instead of an unverified
 * write.
 *
 * The result is cached until `lockCryptoSession`, because the checks are
 * per-process, not per-value.
 *
 * The cache is only believed while the thing it proved is still resident. A
 * bare `selfTestReady === true` is a stale-claim hazard: the verdict and the
 * key are two pieces of state, and any path that drops the key without
 * clearing the verdict — a future teardown, a second lock entry point, a test
 * harness — leaves a self-test result asserting a key that is no longer in
 * memory. Then the seal path walks straight past the gate and fails deeper
 * down on a missing key, which is both the wrong error class and no longer
 * this layer's refusal. Requiring both halves makes the guarantee hold by
 * construction instead of by convention.
 */
async function requirePiiReady(): Promise<void> {
  if (selfTestReady === true && hasProfileDataKey()) return;
  const verdict = await runPiiCryptoSelfTest();
  if (!verdict.ready) throw new CryptoDeniedError(verdict.reason);
}

/**
 * The clear data key for a seal/open, as a `CryptoDeniedError` if it is gone.
 *
 * `profileDataKeyBase64` fails closed with a `ProfileDataKeyError`, which is
 * right for its own module and wrong here: every consumer of these two
 * functions branches on `CryptoDeniedError` and its `reason` code, so a
 * refusal that arrives as a different error class is a refusal nobody can
 * render or assert on.
 */
function requireProfileDataKey(): string {
  try {
    return profileDataKeyBase64();
  } catch (error) {
    throw new CryptoDeniedError(
      error instanceof ProfileDataKeyError
        ? "profile_data_key_unavailable"
        : "no_capability",
    );
  }
}

/**
 * Store the session passphrase in MAIN-process memory only (SPEC-01
 * `session_passphrase_key`: surface memory, sync never, export never).
 * The renderer that sent it keeps no copy beyond the IPC call.
 */
export function adoptSessionPassphrase(passphrase: string): void {
  setSessionPassphrase(passphrase);
}

/**
 * Lock: zeroize the session passphrase AND drop the profile data key and the
 * self-test verdict. Irreversible for all three; the wrapped key on disk is
 * untouched, so the next use re-proves the machine rather than assuming it.
 */
export function lockCryptoSession(): void {
  zeroizeSessionPassphrase();
  zeroizeProfileDataKey();
  selfTestReady = null;
}

/**
 * Refusals that mean "the OS keyring was found and REJECTED", as opposed to
 * "there is no OS keyring here at all".
 *
 * This distinction is the whole reason the deny path consults the gate. The
 * §2.3 table has one row for "no keyring and no passphrase", so a machine on
 * libsecret's `basic_text` fallback and a machine with no keyring at all both
 * resolve to the same code — and only one of them has a fix the user can
 * perform. The gate's codes for the rejected cases name the fix ("this backend
 * is not encryption"), so they win.
 */
const KEYRING_DIAGNOSES = new Set<string>([
  "backend_basic_text",
  "backend_unknown",
  "backend_not_allowlisted",
  "backend_probe_failed",
  "backend_probe_missing",
  "os_round_trip_failed",
  "unsupported_platform",
]);

/**
 * The reason a DENIED capability is reported as.
 *
 * The §2.3 table is a three-row decision table, so
 * `no_safe_storage_no_passphrase` is what it returns for every keyring failure
 * alike. That is correct as a table row and useless as an operator message:
 * "this machine is on the plaintext fallback — install libsecret or kwallet"
 * and "nothing here will encrypt PII" are different problems with different
 * fixes, and collapsing them leaves the user to guess.
 *
 * So the keyring gate is consulted on the deny path, and its code wins ONLY for
 * the rejections it can name a fix for. `encryption_unavailable` deliberately
 * does NOT win: it is the same fact as the table's row minus the passphrase
 * clause, so the table's own code is both the broader truth and the code
 * pre-Wave-2 consumers already branch on.
 */
function denialReason(capability: CapabilityDecision): string {
  const gate = probeOsKeyring();
  if (!gate.available && KEYRING_DIAGNOSES.has(gate.reason)) {
    return gate.reason;
  }
  return capability.reason;
}

/**
 * Encrypt a PII value for at-rest persistence. Throws CryptoDeniedError when
 * the capability table resolves to DENIED (ADR-001 §2.1 deny path) or when the
 * OS keyring fails the §3.4 gate / the self-test.
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
    await requirePiiReady();
    const envelope = await encryptWithPassphrase(
      plaintext,
      requireProfileDataKey(),
      expectationFor(key),
    );
    return PROFILE_KEY_PREFIX + envelope;
  }
  if (capability.mode === "passphrase") {
    const passphrase = getSessionPassphrase();
    if (passphrase === null) throw new CryptoDeniedError(capability.reason);
    const envelope = await encryptWithPassphrase(
      plaintext,
      passphrase,
      expectationFor(key),
    );
    return ENVELOPE_PREFIX + envelope;
  }
  throw new CryptoDeniedError(denialReason(capability));
}

/**
 * Decrypt a value produced by `encryptForStorage`. Unknown formats (e.g.
 * legacy plaintext written before S2) raise UnknownBlobError — legacy data
 * enters the ADR-002 quarantine regime, it is never silently re-read or
 * re-encrypted here (S4 wires the quarantine flows).
 *
 * `key` is LOAD-BEARING. It becomes the `K` component of the AAD, so a blob
 * written under one storage key cannot be read back under another; the
 * argument was previously accepted and discarded (`_key`), which meant the
 * passphrase envelope was decryptable from any call site. That is now true of
 * the primary path as well: `enc1:profileKey:` blobs are envelopes, not raw
 * keyring output, so the same argument binds them.
 *
 * A pre-remediation `enc1:safeStorage:` blob raises
 * `LegacyUnboundBlobError` instead of being decrypted: it carries no AAD, so
 * reading it would re-admit exactly the unbound branch this layer no longer
 * has, and the bytes it holds are still on disk for the ADR-001 §3.6
 * recovery flow that is still tracked, not implemented.
 */
export async function decryptFromStorage(
  key: string,
  blob: string,
): Promise<string> {
  if (blob.startsWith(LEGACY_UNBOUND_PREFIX)) {
    // A pre-AAD keyring blob. The IPC layer turns this into a per-key refusal
    // (`UnreadablePiiValueError`) so one such row cannot reject a whole
    // profile's hydration, and ADR-001 §3.6 recovery is the only thing that may
    // read it — through `legacyRecovery.readLegacyValue`, never through here.
    throw new LegacyUnboundBlobError();
  }
  if (blob.startsWith(PROFILE_KEY_PREFIX)) {
    await requirePiiReady();
    return decryptWithPassphrase(
      blob.slice(PROFILE_KEY_PREFIX.length),
      requireProfileDataKey(),
      expectationFor(key),
    );
  }
  if (blob.startsWith(ENVELOPE_PREFIX)) {
    const passphrase = getSessionPassphrase();
    if (passphrase === null) throw new CryptoDeniedError("locked");
    return decryptWithPassphrase(
      blob.slice(ENVELOPE_PREFIX.length),
      passphrase,
      expectationFor(key),
    );
  }
  throw new UnknownBlobError();
}

/* ------------------------------------------------------------------ */
/*  OS-keyring-ONLY entry points (Beta12 Phase3 passwordless Desktop)  */
/* ------------------------------------------------------------------ */

/**
 * The refusal code for "this route will ONLY use the OS keyring".
 *
 * The general `encryptForStorage`/`decryptFromStorage` pair falls back to a
 * session-passphrase envelope when the keyring is unavailable. The passwordless
 * Desktop route deliberately MUST NOT: a record written under a passphrase the
 * user never chose would be indistinguishable from an OS-protected one on the
 * next read, and the whole point of this route is "no app passphrase, OS-managed
 * key only". So the fallback is refused by name.
 */
export const OS_KEYRING_ONLY_REASON = "os_keyring_required";

/**
 * The gate for the OS-only route: `safe_storage` mode or nothing.
 *
 * `getCapability()` returns `safe_storage` only when the §3.4 keyring gate
 * passes (Linux backend allowlist / Windows-macOS round-trip), so a `basic_text`
 * or unknown backend resolves to `denied` and a machine with a session
 * passphrase but no keyring resolves to `passphrase` — both refused. The
 * specific gate code wins where the capability table has one, so the operator
 * message names the fix instead of the generic table row.
 */
function requireOsKeyringCapability(): void {
  const capability = getCapability();
  if (capability.mode === "safe_storage") return;
  throw new CryptoDeniedError(
    capability.mode === "passphrase"
      ? OS_KEYRING_ONLY_REASON
      : denialReason(capability),
  );
}

/**
 * True when a blob is a record this route wrote: an ADR-001 envelope sealed
 * under the OS-keyring-wrapped profile data key. The ONLY shape the new-PII
 * read path will open; a legacy `enc1:safeStorage:` blob, a passphrase
 * `enc1:envelope:` blob and plaintext are all NOT this shape and are refused
 * before any decrypt.
 */
export function isOsKeyringRecord(blob: string): boolean {
  return typeof blob === "string" && blob.startsWith(PROFILE_KEY_PREFIX);
}

/**
 * Seal a NEW PII value for the passwordless Desktop route.
 *
 * Same envelope and AAD binding as the primary path, same wrapped profile data
 * key, same self-test — but with the passphrase fallback REMOVED. Throws
 * `CryptoDeniedError`:
 *  - `write_path_disabled` when the rollback flag is off;
 *  - `os_keyring_required` when only a session passphrase is available;
 *  - the §3.4 gate code (e.g. `backend_basic_text`) or the self-test code
 *    (`profile_data_key_unavailable`, `os_round_trip_failed`, …) otherwise.
 *
 * Never writes plaintext, never mints a key on a machine that cannot protect
 * PII, and never falls back to the passphrase path.
 */
export async function sealNewPiiValue(
  key: string,
  plaintext: string,
): Promise<string> {
  if (!CRYPTO_WRITE_PATH_ENABLED) {
    throw new CryptoDeniedError("write_path_disabled");
  }
  requireOsKeyringCapability();
  await requirePiiReady();
  const envelope = await encryptWithPassphrase(
    plaintext,
    requireProfileDataKey(),
    expectationFor(key),
  );
  return PROFILE_KEY_PREFIX + envelope;
}

/**
 * Open a value written by `sealNewPiiValue`.
 *
 * Only an `enc1:profileKey:` record is accepted. Anything else is refused by
 * class — legacy unbound keyring output, a passphrase envelope, or unknown
 * bytes — so this path can never alias a legacy Beta row or open a value the
 * route did not write. The OS gate is re-checked on EVERY open (not only at
 * startup), so a keyring that changed underneath the process fails closed.
 */
export async function openNewPiiValue(
  key: string,
  blob: string,
): Promise<string> {
  if (!blob.startsWith(PROFILE_KEY_PREFIX)) {
    if (blob.startsWith(LEGACY_UNBOUND_PREFIX)) {
      throw new LegacyUnboundBlobError();
    }
    if (blob.startsWith(ENVELOPE_PREFIX)) {
      // A passphrase-keyed value: this route has no passphrase to offer.
      throw new CryptoDeniedError(OS_KEYRING_ONLY_REASON);
    }
    throw new UnknownBlobError();
  }
  requireOsKeyringCapability();
  await requirePiiReady();
  return decryptWithPassphrase(
    blob.slice(PROFILE_KEY_PREFIX.length),
    requireProfileDataKey(),
    expectationFor(key),
  );
}
