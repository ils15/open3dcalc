/**
 * Main-process IPC for the exact Desktop plaintext PII namespaces.
 *
 * Only the three `open3dcalc_pwless_*` storage keys are owned here. The rows
 * contain the Zustand persistence envelope as plaintext; legacy keys and any
 * non-envelope rows are never read or overwritten. The generic `db:*` IPC has
 * a separate non-PII allowlist and continues to refuse this namespace.
 */

import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
  assertNewPiiStorageKey,
  NewPiiKeyRefusedError,
} from "../src/shared/lib/crypto/newPiiNamespace.js";
import {
  readStoredRow,
  writeStoredRow,
  type MinimalStorageDb,
} from "./storageRows.js";
import { withdrawalLocksPii } from "./withdrawalJournal.js";
import { newPiiErasureLocksPii } from "./newPiiErasure.js";
import {
  betaElectronPiiRefusal,
  isBetaElectronRuntime,
} from "./betaRuntime.js";

/** The exact channels this route owns. */
export const NEW_PII_CHANNELS = {
  capability: "pii:new:capability",
  load: "pii:new:load",
  save: "pii:new:save",
} as const;

export const WITHDRAWAL_PENDING_REASON = "withdrawal_pending";

export type NewPiiCapability =
  | { available: true; backend: "plaintext" }
  | { available: false; reason: string };

/** Raised for anything this route refuses. `reason` is a compile-time code. */
export class NewPiiRouteRefusedError extends Error {
  readonly code = "new_pii_route_refused";
  readonly reason: string;

  constructor(reason: string) {
    super(`[newPii] refused (${reason})`);
    this.name = "NewPiiRouteRefusedError";
    this.reason = reason;
  }
}

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

/** Treat unreadable journals as active locks so an interrupted erasure cannot be bypassed. */
function withdrawalLocked(dir: string): boolean {
  try {
    return withdrawalLocksPii(dir) || newPiiErasureLocksPii(dir);
  } catch {
    return true;
  }
}

/** Validate the serialized Zustand persistence envelope before it reaches or leaves SQLite. */
function isPlaintextEnvelope(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      "state" in parsed &&
      typeof parsed.state === "object" &&
      parsed.state !== null &&
      !Array.isArray(parsed.state) &&
      "version" in parsed &&
      typeof parsed.version === "number"
    );
  } catch {
    return false;
  }
}

/** Register trusted, exact-key plaintext storage with durable erasure locks. */
export function registerPasswordlessPiiHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
  withdrawalDir: string,
): void {
  ipcMain.handle(NEW_PII_CHANNELS.capability, (event): NewPiiCapability => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(NEW_PII_CHANNELS.capability);
    }
    assertTrustedSender(event);
    if (withdrawalLocked(withdrawalDir)) {
      return { available: false, reason: WITHDRAWAL_PENDING_REASON };
    }
    return { available: true, backend: "plaintext" };
  });

  ipcMain.handle(
    NEW_PII_CHANNELS.load,
    async (event, key: unknown): Promise<string | null> => {
      if (isBetaElectronRuntime()) {
        throw betaElectronPiiRefusal(NEW_PII_CHANNELS.load);
      }
      assertTrustedSender(event);
      if (withdrawalLocked(withdrawalDir)) {
        throw new NewPiiRouteRefusedError(WITHDRAWAL_PENDING_REASON);
      }
      // Exact-key authorization must precede every SQL operation.
      try {
        assertNewPiiStorageKey(key);
      } catch (error) {
        if (error instanceof NewPiiKeyRefusedError) {
          throw new NewPiiRouteRefusedError("new_pii_key_refused");
        }
        throw error;
      }

      const stored = readStoredRow(database.$client, key);
      if (stored === null) return null;
      if (!isPlaintextEnvelope(stored)) {
        throw new NewPiiRouteRefusedError("non_plaintext_record_shape");
      }
      return stored;
    },
  );

  ipcMain.handle(
    NEW_PII_CHANNELS.save,
    async (event, key: unknown, value: unknown): Promise<void> => {
      if (isBetaElectronRuntime()) {
        throw betaElectronPiiRefusal(NEW_PII_CHANNELS.save);
      }
      assertTrustedSender(event);
      if (withdrawalLocked(withdrawalDir)) {
        throw new NewPiiRouteRefusedError(WITHDRAWAL_PENDING_REASON);
      }
      try {
        assertNewPiiStorageKey(key);
      } catch (error) {
        if (error instanceof NewPiiKeyRefusedError) {
          throw new NewPiiRouteRefusedError("new_pii_key_refused");
        }
        throw error;
      }
      if (!isPlaintextEnvelope(value)) {
        throw new NewPiiRouteRefusedError("invalid_plaintext_envelope");
      }

      // Do not clobber a legacy, encrypted, or malformed row under an exact key.
      const current = readStoredRow(database.$client, key);
      if (current !== null && !isPlaintextEnvelope(current)) {
        throw new NewPiiRouteRefusedError("non_plaintext_record_shape");
      }
      writeStoredRow(database.$client, key, value);
    },
  );
}
