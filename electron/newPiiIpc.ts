/**
 * The Desktop passwordless new-PII IPC route (Beta12 Phase3) — main-only.
 *
 * ## What this route is, and what it is deliberately not
 *
 * It is the ONLY way NEW Desktop PII is persisted without an app passphrase.
 * A value is sealed with the ADR-001 envelope under the OS-keyring-wrapped
 * profile data key (see `cryptoCapability.sealNewPiiValue`) and only then
 * written to the `storage` table; a read opens only a record this route wrote.
 *
 * It is NOT the generic store. `db:load`/`db:save` keep their exact non-PII
 * allowlist and refuse this namespace (`newPiiNamespace`), so a renderer that
 * reaches for the wrong channel gets a refusal instead of a PII write.
 *
 * ## The disjointness guarantees, enforced here
 *
 *  1. **Exact keys only.** `assertNewPiiStorageKey` runs before any SQL. A
 *     legacy key (`open3dcalc_customers_v1`), a domain table name
 *     (`customers`, `pii_stage`, `legacy_residue`) and an invented
 *     prefix-only name are all refused with `NewPiiKeyRefusedError` and no
 *     `prepare` is ever issued.
 *  2. **No legacy read.** A row that exists under an authorised key but is not
 *     an OS-keyring record (`enc1:safeStorage:`, `enc1:envelope:`, plaintext)
 *     is refused by shape BEFORE the keyring decrypt path — so a legacy blob
 *     can never be opened or re-sealed on this route.
 *  3. **Encrypt before SQL.** On save the plaintext is sealed first; only the
 *     `enc1:profileKey:` envelope reaches `writeStoredRow`. A denied gate
 *     throws before the write, so nothing plaintext is ever stored.
 *  4. **No legacy/domain/pii_stage surface.** Every statement this module
 *     issues targets the `storage` table only, and only via the parameterised
 *     helpers in `persistGate`. `pii_stage`, the domain tables and
 *     `legacy_residue` are never referenced.
 *
 * ## Fail-closed on every path
 *
 * The gate is re-checked on every save/open (not only at startup), because
 * `sealNewPiiValue`/`openNewPiiValue` consult the capability each time and the
 * self-test re-runs after a lock. `pii:new:capability` reports the gate verdict
 * so the renderer can decide whether to offer the passwordless path at all.
 *
 * A durable withdrawal lock is layered on top and checked FIRST: while a
 * pending/incomplete withdrawal journal exists (or cannot be read), every
 * channel refuses with `withdrawal_pending` before any key check or SQL. The
 * lock is read from `withdrawalJournal` each call — the route holds no cached
 * copy, so a withdrawal that starts mid-session takes effect immediately.
 *
 * ## Errors survive the IPC boundary
 *
 * `ipcRenderer.invoke` flattens a thrown error to a string and drops structured
 * fields, so `NewPiiRouteRefusedError` interpolates its reason code into the
 * message (the one channel that survives) exactly as `UnreadablePiiValueError`
 * does. The reason is always a compile-time constant; no PII value is ever put
 * in a message (§3.2).
 */

import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CryptoDeniedError,
  getOsKeyringDecision,
  isOsKeyringRecord,
  LegacyUnboundBlobError,
  openNewPiiValue,
  runPiiCryptoSelfTest,
  sealNewPiiValue,
  UnknownBlobError,
} from "./cryptoCapability.js";
import {
  assertNewPiiStorageKey,
  NewPiiKeyRefusedError,
} from "../src/shared/lib/crypto/newPiiNamespace.js";
import {
  readStoredRow,
  writeStoredRow,
  type MinimalStorageDb,
} from "./persistGate.js";
import { withdrawalLocksPii } from "./withdrawalJournal.js";
import { newPiiErasureLocksPii } from "./newPiiErasure.js";

/** The exact channels this route owns. */
export const NEW_PII_CHANNELS = {
  capability: "pii:new:capability",
  load: "pii:new:load",
  save: "pii:new:save",
} as const;

/**
 * The stable reason this route reports while a withdrawal is pending or
 * incomplete. It matches the shared `PiiStoreDenialReason` vocabulary so the
 * renderer sees one word for the same condition on every surface.
 */
export const WITHDRAWAL_PENDING_REASON = "withdrawal_pending";

/**
 * True while a durable, non-completed withdrawal OR new-PII delete-all journal
 * exists for this profile directory, i.e. new PII must not be written into a
 * surface that is mid-erasure.
 *
 * Fail-closed: an unreadable/corrupt journal cannot PROVE the operation
 * completed, so it is treated as locked. This reuses the single journal helpers
 * (`withdrawalLocksPii`, `newPiiErasureLocksPii`); the route owns no second copy
 * of the lock state.
 */
function withdrawalLocked(dir: string): boolean {
  try {
    return withdrawalLocksPii(dir) || newPiiErasureLocksPii(dir);
  } catch {
    return true;
  }
}

/** The renderer-facing gate verdict. Metadata only — never a value or a key. */
export type NewPiiCapability =
  { available: true; backend: string } | { available: false; reason: string };

/** Raised for anything this route refuses. `reason` is a compile-time code. */
export class NewPiiRouteRefusedError extends Error {
  readonly code = "new_pii_route_refused";
  readonly reason: string;
  constructor(reason: string) {
    // The reason is IN the message on purpose: it is the only part of a thrown
    // error that survives `ipcRenderer.invoke` flattening.
    super(`[newPii] refused (${reason})`);
    this.name = "NewPiiRouteRefusedError";
    this.reason = reason;
  }
}

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

/** Map any lower-layer refusal onto this route's stable reason vocabulary. */
function routeReason(error: unknown): string {
  if (error instanceof CryptoDeniedError) return error.reason;
  if (error instanceof LegacyUnboundBlobError) return error.reason;
  if (error instanceof UnknownBlobError) return "unknown_blob";
  if (error instanceof NewPiiKeyRefusedError) return error.code;
  const reason = (error as { reason?: unknown } | null)?.reason;
  return typeof reason === "string" && reason.length > 0
    ? reason
    : "unreadable";
}

function refuse(error: unknown): never {
  throw new NewPiiRouteRefusedError(routeReason(error));
}

/**
 * Register the passwordless new-PII route on the main process.
 *
 * `assertTrustedSender` must be the same app-frame assertion the rest of the
 * IPC surface uses; it runs before every key check and before any SQL.
 *
 * `withdrawalDir` is the profile directory holding the durable withdrawal
 * journal. The durable lock is re-checked on every capability/load/save (not
 * only at startup): while a pending or incomplete withdrawal exists, the route
 * refuses with `withdrawal_pending` before any key check or SQL. It is a
 * required argument on purpose — a cutover build cannot register the route
 * without wiring the lock, so there is no fail-open default.
 */
export function registerPasswordlessPiiHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
  withdrawalDir: string,
): void {
  ipcMain.handle(
    NEW_PII_CHANNELS.capability,
    async (event): Promise<NewPiiCapability> => {
      assertTrustedSender(event);
      // A pending withdrawal outranks the keyring verdict: report the route
      // unavailable rather than offering a path that every write would refuse.
      if (withdrawalLocked(withdrawalDir)) {
        return { available: false, reason: WITHDRAWAL_PENDING_REASON };
      }
      const gate = getOsKeyringDecision();
      if (!gate.available) return { available: false, reason: gate.reason };
      const verdict = await runPiiCryptoSelfTest();
      return verdict.ready
        ? { available: true, backend: verdict.backend }
        : { available: false, reason: verdict.reason };
    },
  );

  ipcMain.handle(
    NEW_PII_CHANNELS.load,
    async (event, key: unknown): Promise<string | null> => {
      assertTrustedSender(event);
      // Fail-closed before any key check or SQL: a half-erased surface must
      // never be read back as the user's data.
      if (withdrawalLocked(withdrawalDir)) {
        throw new NewPiiRouteRefusedError(WITHDRAWAL_PENDING_REASON);
      }
      // Exact-key authorisation BEFORE any read: a legacy or foreign key never
      // reaches SQLite through this route.
      assertNewPiiStorageKey(key);

      const stored = readStoredRow(database.$client, key);
      if (stored === null) return null;
      if (!isOsKeyringRecord(stored)) {
        // A non-new record under an authorised key. Refuse by shape: opening
        // it would alias a legacy value, and reporting it as absent would let
        // a later save overwrite bytes this route did not write.
        throw new NewPiiRouteRefusedError("non_new_record_shape");
      }
      try {
        return await openNewPiiValue(key, stored);
      } catch (error) {
        refuse(error);
      }
    },
  );

  ipcMain.handle(
    NEW_PII_CHANNELS.save,
    async (event, key: unknown, value: unknown): Promise<void> => {
      assertTrustedSender(event);
      // Fail-closed before any key check, read or seal: no new PII is written
      // into a surface that is mid-erasure.
      if (withdrawalLocked(withdrawalDir)) {
        throw new NewPiiRouteRefusedError(WITHDRAWAL_PENDING_REASON);
      }
      assertNewPiiStorageKey(key);
      if (typeof value !== "string" || value.length === 0) {
        throw new NewPiiRouteRefusedError("invalid_value");
      }
      // Never overwrite a non-new row even under an authorised key.
      const current = readStoredRow(database.$client, key);
      if (current !== null && !isOsKeyringRecord(current)) {
        throw new NewPiiRouteRefusedError("non_new_record_shape");
      }

      let blob: string;
      try {
        // Encrypt FIRST. A denied gate throws here, before any write.
        blob = await sealNewPiiValue(key, value);
      } catch (error) {
        refuse(error);
      }
      // Only the sealed envelope reaches SQL.
      writeStoredRow(database.$client, key, blob);
    },
  );
}
