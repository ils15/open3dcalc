/**
 * Closed Electron SQLite storage IPC surface.
 *
 * PII, unknown, and unclassifiable keys are refused before the database handle
 * is requested. The consent receipt is a separate exact-key route with a
 * value-free schema; it is not part of the generic non-PII allowlist.
 */
import { resolveKeyPolicy, type MinimalStorageDb } from "./persistGate.js";

export const CONSENT_STORAGE_KEY = "open3dcalc_consent_v1";

/** User-facing non-PII settings and catalog keys supported by desktop IPC. */
export const SAFE_NON_PII_STORAGE_KEYS = [
  "i18nextLng",
  "open3dcalc_settings_v2",
  "open3dcalc_sections",
  "open3dcalc_theme",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_color_palette_v1",
  "open3dcalc_products",
  "open3dcalc_dashboard_v1",
  "open3dcalc_dashboard_goal",
  "open3dcalc_layout_v1",
  "open3dcalc_share_prefs_v1",
  "open3dcalc_marketplace_comparison_v1",
  "open3dcalc_nav_v1",
  "open3dcalc_tutorial_v1",
  "open3dcalc_quickstart_dismissed",
  "open3dcalc_onboarded",
  "open3dcalc_model_comparison",
] as const;

const SAFE_NON_PII_OPERATION_ALLOWLIST: Record<
  StorageOperation,
  ReadonlySet<string>
> = {
  load: new Set(SAFE_NON_PII_STORAGE_KEYS),
  save: new Set(SAFE_NON_PII_STORAGE_KEYS),
  delete: new Set(SAFE_NON_PII_STORAGE_KEYS),
};
const CONSENT_OPERATION_ALLOWLIST = new Set<StorageOperation>([
  "load",
  "save",
  "delete",
]);
const LISTABLE_KEY_SET = new Set<string>([
  ...SAFE_NON_PII_STORAGE_KEYS,
  CONSENT_STORAGE_KEY,
]);

const DISABLED_IPC_CHANNELS = [
  "db:import",
  "privacy:scan-report",
  "privacy:quarantine-report",
  "privacy:migrate-key",
  "privacy:eliminate-key",
  "privacy:legacy-rows",
  "privacy:recovery-report",
  "privacy:recover-key",
] as const;

type StorageOperation = "load" | "save" | "delete";

export interface DatabaseIpcDependencies<Event> {
  /** Called only after key and policy checks have passed. */
  getDb: () => MinimalStorageDb;
  assertTrustedSender: (event: Event) => void;
}

type DatabaseIpcHandler<Event> = (
  event: Event,
  ...args: unknown[]
) => Promise<unknown>;

export type DatabaseIpcHandlers<Event> = Record<
  string,
  DatabaseIpcHandler<Event>
>;

const CONSENT_STATE_FIELDS = [
  "privacyBannerDismissed",
  "consentGiven",
  "consentDate",
  "receipt",
  "receiptDigest",
  "withdrawnReceipts",
  "migrationConsentGiven",
  "migrationConsentDate",
  "migrationReceipt",
  "migrationReceiptDigest",
  "withdrawnMigrationReceipts",
] as const;

const CONSENT_RECEIPT_FIELDS = [
  "receipt_id",
  "receipt_version",
  "policy_version",
  "policy_hash",
  "granted_at",
  "scope",
  "legal_basis",
  "purposes",
  "withdrawn_at",
] as const;

const CONSENT_GRANT_SHAPES = [
  {
    scope: ["customers", "quotes", "history", "dashboard"],
    purposes: ["issue_quotes", "cross_device_sync"],
  },
  { scope: ["history"], purposes: ["legacy_history_migration"] },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    actual.every((key) => expected.includes(key))
  );
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function sameStringList(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function isConsentReceipt(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, CONSENT_RECEIPT_FIELDS)) {
    return false;
  }
  if (
    typeof value.receipt_id !== "string" ||
    !/^[a-f0-9-]{32,36}$/i.test(value.receipt_id) ||
    value.receipt_version !== "1.0" ||
    typeof value.policy_version !== "string" ||
    !/^\d+\.\d+$/.test(value.policy_version) ||
    !isDigest(value.policy_hash) ||
    !isIsoDate(value.granted_at) ||
    value.legal_basis !== "consent" ||
    !(value.withdrawn_at === null || isIsoDate(value.withdrawn_at))
  ) {
    return false;
  }
  return CONSENT_GRANT_SHAPES.some(
    ({ scope, purposes }) =>
      sameStringList(value.scope, scope) &&
      sameStringList(value.purposes, purposes),
  );
}

/**
 * Only the exact Zustand consent record is accepted. In particular, extra
 * fields are rejected so this row cannot become a generic PII write channel.
 */
export function isFixedConsentRow(value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return false;
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ["state", "version"])) {
    return false;
  }
  if (parsed.version !== 1 || !isRecord(parsed.state)) return false;

  const state = parsed.state;
  if (!hasExactKeys(state, CONSENT_STATE_FIELDS)) return false;
  if (
    typeof state.privacyBannerDismissed !== "boolean" ||
    typeof state.consentGiven !== "boolean" ||
    !(
      state.consentDate === null ||
      (typeof state.consentDate === "number" &&
        Number.isFinite(state.consentDate))
    ) ||
    !(state.receipt === null || isConsentReceipt(state.receipt)) ||
    !(state.receiptDigest === null || isDigest(state.receiptDigest)) ||
    !Array.isArray(state.withdrawnReceipts) ||
    !state.withdrawnReceipts.every(isConsentReceipt) ||
    typeof state.migrationConsentGiven !== "boolean" ||
    !(
      state.migrationConsentDate === null ||
      (typeof state.migrationConsentDate === "number" &&
        Number.isFinite(state.migrationConsentDate))
    ) ||
    !(
      state.migrationReceipt === null ||
      isConsentReceipt(state.migrationReceipt)
    ) ||
    !(
      state.migrationReceiptDigest === null ||
      isDigest(state.migrationReceiptDigest)
    ) ||
    !Array.isArray(state.withdrawnMigrationReceipts) ||
    !state.withdrawnMigrationReceipts.every(isConsentReceipt)
  ) {
    return false;
  }
  return true;
}

function assertStorageKeyAllowed(
  key: unknown,
  operation: StorageOperation,
): asserts key is string {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Database key must be a non-empty string");
  }

  const explicitlyAllowed =
    SAFE_NON_PII_OPERATION_ALLOWLIST[operation].has(key) ||
    (key === CONSENT_STORAGE_KEY && CONSENT_OPERATION_ALLOWLIST.has(operation));
  if (!explicitlyAllowed) {
    throw new Error(
      `Database ${operation} key denied by the safe IPC allowlist`,
    );
  }

  const policy = resolveKeyPolicy(key);
  if (!policy.allowed || policy.entry.pii !== false) {
    throw new Error(`Database ${operation} key is not classifiable as non-PII`);
  }
}

function readStoredValue(db: MinimalStorageDb, key: string): string | null {
  const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row?.value ?? null;
}

function writeStoredValue(
  db: MinimalStorageDb,
  key: string,
  value: string,
): void {
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, value, Date.now());
}

function deleteStoredValue(db: MinimalStorageDb, key: string): void {
  db.prepare("DELETE FROM storage WHERE key = ?").run(key);
}

/** Build the handlers used by main and tests with the same fail-closed path. */
export function createDatabaseIpcHandlers<Event>(
  dependencies: DatabaseIpcDependencies<Event>,
): DatabaseIpcHandlers<Event> {
  const { assertTrustedSender, getDb } = dependencies;
  const handlers: DatabaseIpcHandlers<Event> = {
    "db:load": async (event, key): Promise<string | null> => {
      assertTrustedSender(event);
      assertStorageKeyAllowed(key, "load");
      const value = readStoredValue(getDb(), key);
      if (
        key === CONSENT_STORAGE_KEY &&
        value !== null &&
        !isFixedConsentRow(value)
      ) {
        throw new Error(
          "Stored consent row is not in the fixed supported format",
        );
      }
      return value;
    },
    "db:save": async (event, key, value): Promise<void> => {
      assertTrustedSender(event);
      assertStorageKeyAllowed(key, "save");
      if (typeof value !== "string") {
        throw new Error("Database value must be a string");
      }
      if (key === CONSENT_STORAGE_KEY && !isFixedConsentRow(value)) {
        throw new Error("Consent row must match the fixed supported format");
      }
      writeStoredValue(getDb(), key, value);
    },
    "db:delete": async (event, key): Promise<void> => {
      assertTrustedSender(event);
      assertStorageKeyAllowed(key, "delete");
      deleteStoredValue(getDb(), key);
    },
    "db:list-keys": async (event): Promise<string[]> => {
      assertTrustedSender(event);
      const rows = getDb()
        .prepare("SELECT key FROM storage ORDER BY key")
        .all() as Array<{ key?: unknown }>;
      return Array.from(
        new Set(
          rows
            .map((row) => row.key)
            .filter((key): key is string => typeof key === "string")
            .filter((key) => LISTABLE_KEY_SET.has(key)),
        ),
      ).sort();
    },
  };

  for (const channel of DISABLED_IPC_CHANNELS) {
    handlers[channel] = async (event): Promise<never> => {
      assertTrustedSender(event);
      throw new Error(`IPC channel ${channel} is disabled in the safe profile`);
    };
  }

  return handlers;
}
