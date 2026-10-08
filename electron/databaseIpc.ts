import type { IpcMain, IpcMainInvokeEvent } from "electron";

import { UnreadablePiiValueError } from "./legacyRecovery.js";
import { isValidConsentRecordValue } from "./consentRecord.js";
import {
  deleteGated,
  gateLoad,
  readStoredRow,
  resolveKeyPolicy,
  saveGated,
  type MinimalStorageDb,
} from "./persistGate.js";
import { isNewPiiNamespaceKey } from "../src/shared/lib/crypto/newPiiNamespace.js";

/**
 * Exact non-PII storage rows still used by the desktop preferences/catalog
 * bridge. This is deliberately independent of manifest classification: adding
 * a key to the manifest does not grant it a database IPC capability.
 */
export const DATABASE_IPC_SAFE_STORAGE_KEYS = [
  "open3dcalc_settings_v2",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_color_palette_v1",
  "open3dcalc_consent_v1",
  "open3dcalc_tutorial_v1",
  "open3dcalc_onboarded",
  "open3dcalc_dashboard_v1",
  "open3dcalc_sections",
  "open3dcalc_theme",
  "open3dcalc_products",
] as const;

export type DatabaseStorageOperation = "load" | "save" | "delete";

const SAFE_KEY_SET = new Set<string>(DATABASE_IPC_SAFE_STORAGE_KEYS);
const OPERATION_KEYS: Readonly<
  Record<DatabaseStorageOperation, ReadonlySet<string>>
> = {
  load: SAFE_KEY_SET,
  save: SAFE_KEY_SET,
  delete: SAFE_KEY_SET,
};

const ACCESS_DENIED = "Database key operation is not permitted";
const IMPORT_DISABLED =
  "Database import is disabled while legacy PII isolation is enforced";

/**
 * The consent row's receipt is the audit record for withdrawal (SPEC-04 §6.3):
 * it is kept, never deleted, and only ever replaced by a structurally valid
 * consent record. The generic IPC therefore validates its value and refuses to
 * delete it.
 */
const CONSENT_STORAGE_KEY = "open3dcalc_consent_v1";

export class DatabaseIpcDeniedError extends Error {
  constructor() {
    super(ACCESS_DENIED);
    this.name = "DatabaseIpcDeniedError";
  }
}

function isPermitted(
  operation: DatabaseStorageOperation,
  key: unknown,
): key is string {
  if (typeof key !== "string" || !OPERATION_KEYS[operation].has(key)) {
    return false;
  }

  // Defense in depth for the Beta12 passwordless namespace: its PII records
  // are owned by the dedicated `pii:new:*` route and MUST never be read,
  // written or deleted through the generic store — even if a future edit
  // mistakenly added one to the static allowlist above. This check runs before
  // the manifest policy so the new namespace cannot be reclassified into the
  // generic path.
  if (isNewPiiNamespaceKey(key)) return false;

  // Manifest metadata is an additional deny-only check. It cannot extend the
  // static allowlist, and unavailable/changed metadata cannot grant access.
  const policy = resolveKeyPolicy(key);
  return (
    policy.allowed &&
    policy.entry.pii === false &&
    policy.entry.platforms.includes("electron")
  );
}

function assertPermitted(
  operation: DatabaseStorageOperation,
  key: unknown,
): asserts key is string {
  if (!isPermitted(operation, key)) throw new DatabaseIpcDeniedError();
}

function allowedListKeys(): string[] {
  const keys = [...DATABASE_IPC_SAFE_STORAGE_KEYS];
  // If the manifest is missing or a key was reclassified, fail before SQLite
  // is queried. A future policy change must not widen this IPC implicitly.
  for (const key of keys) assertPermitted("load", key);
  return keys;
}

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

/** Register the only generic storage IPC operations retained by the desktop app. */
export function registerDatabaseStorageHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
): void {
  ipcMain.handle(
    "db:load",
    async (event, key: unknown): Promise<string | null> => {
      try {
        assertTrustedSender(event);
        // This closed permission check MUST remain above readStoredRow: even a
        // legacy PII value/ciphertext must not be selected before authorization.
        assertPermitted("load", key);
        const stored = readStoredRow(database.$client, key);
        if (stored === null) return null;
        const outcome = await gateLoad(key, stored);
        if (outcome.action === "unreadable") {
          throw new UnreadablePiiValueError(key, outcome.reason);
        }
        if (outcome.action === "denied") throw new DatabaseIpcDeniedError();
        return outcome.value;
      } catch (error) {
        console.error("[db:load] Error:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "db:save",
    async (event, key: unknown, value: unknown): Promise<void> => {
      try {
        assertTrustedSender(event);
        // Deny before saveGated, which may read an existing row for PII keys.
        assertPermitted("save", key);
        if (typeof value !== "string") {
          throw new Error("Value must be a string");
        }
        // The consent row carries the tamper-evident receipt. An arbitrary
        // renderer write could overwrite it, so only the exact persisted
        // consent record shape is accepted.
        if (key === CONSENT_STORAGE_KEY && !isValidConsentRecordValue(value)) {
          throw new DatabaseIpcDeniedError();
        }
        await saveGated(database.$client, key, value);
      } catch (error) {
        console.error("[db:save] Error:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("db:delete", async (event, key: unknown): Promise<void> => {
    try {
      assertTrustedSender(event);
      // deleteGated historically permits unknown keys. The narrower IPC policy
      // runs first, so neither PII nor unknown rows reach its mutation path.
      assertPermitted("delete", key);
      // The consent receipt is preserved: withdrawal annotates it and keeps it
      // as the audit record (SPEC-04 §6.3), so the generic path may not remove
      // it. Full erasure is a separate, gated flow.
      if (key === CONSENT_STORAGE_KEY) throw new DatabaseIpcDeniedError();
      deleteGated(database.$client, key);
    } catch (error) {
      console.error("[db:delete] Error:", error);
      throw error;
    }
  });

  ipcMain.handle("db:list-keys", async (event): Promise<string[]> => {
    try {
      assertTrustedSender(event);
      const allowedKeys = allowedListKeys();
      const placeholders = allowedKeys.map(() => "?").join(", ");
      const rows = database.$client
        .prepare(
          `SELECT key FROM storage WHERE key IN (${placeholders}) ORDER BY key`,
        )
        .all(...allowedKeys) as Array<{ key: string }>;

      // Defense in depth against an unexpected/mock driver response: never
      // surface a key outside the app-owned non-PII list.
      return rows.map((row) => row.key).filter((key) => SAFE_KEY_SET.has(key));
    } catch (error) {
      console.error("[db:list-keys] Error:", error);
      throw error;
    }
  });
}

/** Keep the legacy preload call explicit but incapable of reading or replacing SQLite. */
export function registerDisabledDatabaseImportHandler(
  ipcMain: Pick<IpcMain, "handle">,
  assertTrustedSender: TrustedSenderAssertion,
): void {
  ipcMain.handle("db:import", async (event): Promise<string> => {
    assertTrustedSender(event);
    throw new Error(IMPORT_DISABLED);
  });
}
