/**
 * SPEC-01 data manifest loader (D1.1 S1).
 *
 * Single source of truth for storage-key policy: each key maps to its
 * surface, platforms, class, pii flag, and the independent persistence /
 * sync / export / erasure / retention policies.
 *
 * Cross-cutting constraints enforced here (TEST-MATRIX §1):
 *  - plaintext_allowed is valid ONLY for pii:false keys (1.2)
 *  - legal_basis not_personal_data is valid ONLY for pii:false keys (1.3)
 *  - onboarding_flag: pii:false, sync:never, export:never (1.4)
 *  - consent_record: pii:false, sync:never, export:never,
 *    erasure:erase_on_delete_all (1.5)
 *  - snapshot: never plaintext, never synced/exported (1.6)
 *  - ephemeral_key: memory_only, never synced/exported (1.7)
 *  - diagnostic: never user_export (1.8)
 *  - unknown enum values, missing/extra fields, empty platforms (1.9–1.10)
 *  - duplicate keys (1.11, uniqueness enforced by the loader)
 *
 * No real PII is ever handled here — keys are metadata only.
 *
 * NOTE: the shipped fixture loading lives in `shippedManifest.ts` so the
 * pure half of this module stays importable by the Electron main process
 * (node16 ESM output cannot execute a static JSON import).
 */

/* ------------------------------------------------------------------ */
/*  Normative vocabularies (mirror SPEC-01 schema $defs)               */
/* ------------------------------------------------------------------ */

export const SURFACES = [
  "localStorage",
  "sqlite_storage_table",
  "sqlite_domain_tables",
  "indexeddb",
  "opfs",
  "cache_api",
  "appdata_files",
  "logs",
  "temp_staging",
  "snapshots",
  "memory",
] as const;
export type Surface = (typeof SURFACES)[number];

export const PLATFORMS = ["electron", "web", "pwa"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PERSISTENCE_MODES = [
  "none",
  "memory_only",
  "encrypted_at_rest",
  "plaintext_allowed",
] as const;
export type PersistenceMode = (typeof PERSISTENCE_MODES)[number];

export const SYNC_MODES = ["never", "opt_in"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

export const EXPORT_MODES = [
  "never",
  "user_export",
  "diagnostic_only",
] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

export const ERASURE_MODES = [
  "erase_on_delete_all",
  "retain_anonymized",
] as const;
export type ErasureMode = (typeof ERASURE_MODES)[number];

export const DATA_CLASSES = [
  "user_content",
  "user_preference",
  "ui_state",
  "onboarding_flag",
  "consent_record",
  "cache",
  "derived_analytics",
  "diagnostic",
  "snapshot",
  "ephemeral_key",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const LEGAL_BASES = [
  "consent",
  "legitimate_interest",
  "contract_performance",
  "not_personal_data",
] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

export const RETENTION_POLICIES = [
  "user_controlled",
  "session_only",
  "fixed",
] as const;
export type RetentionPolicy = (typeof RETENTION_POLICIES)[number];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ManifestRetention {
  policy: RetentionPolicy;
  max_days: number;
}

export interface ManifestEntry {
  key: string;
  surface: Surface;
  platforms: Platform[];
  class: DataClass;
  pii: boolean;
  persistence: PersistenceMode;
  sync: SyncMode;
  export: ExportMode;
  erasure: ErasureMode;
  retention: ManifestRetention;
  purpose: string;
  legal_basis: LegalBasis;
  owner: string;
  version: string;
}

export interface ManifestDocument {
  manifest_version: string;
  policy_version: string;
  keys: ManifestEntry[];
}

/** Lookup index: key → entry (single source of truth at runtime). */
export type ManifestIndex = ReadonlyMap<string, ManifestEntry>;

export class ManifestError extends Error {
  constructor(message: string) {
    super(`[dataManifest] ${message}`);
    this.name = "ManifestError";
  }
}

/* ------------------------------------------------------------------ */
/*  Validation (SPEC-01 §keys, TEST-MATRIX 1.2–1.11)                   */
/* ------------------------------------------------------------------ */

const REQUIRED_FIELDS: (keyof ManifestEntry)[] = [
  "key",
  "surface",
  "platforms",
  "class",
  "pii",
  "persistence",
  "sync",
  "export",
  "erasure",
  "retention",
  "purpose",
  "legal_basis",
  "owner",
  "version",
];

const VERSION_PATTERN = /^\d+\.\d+$/;

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return (
    typeof value === "string" && (allowed as readonly string[]).includes(value)
  );
}

function fieldError(key: string, detail: string): ManifestError {
  return new ManifestError(`invalid entry "${key}": ${detail}`);
}

/**
 * Validate a single manifest entry against SPEC-01.
 * Throws ManifestError on the first violation found.
 */
export function validateManifestEntry(
  entry: unknown,
): asserts entry is ManifestEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new ManifestError("entry must be an object");
  }
  const record = entry as Record<string, unknown>;
  const label =
    typeof record.key === "string" && record.key ? record.key : "<missing key>";

  for (const field of REQUIRED_FIELDS) {
    if (!(field in record))
      throw fieldError(label, `missing required field "${field}"`);
  }
  for (const field of Object.keys(record)) {
    if (!REQUIRED_FIELDS.includes(field as keyof ManifestEntry)) {
      throw fieldError(label, `unknown field "${field}"`);
    }
  }

  if (typeof record.key !== "string" || record.key.length === 0) {
    throw fieldError(label, "key must be a non-empty string");
  }
  if (!isOneOf(record.surface, SURFACES)) {
    throw fieldError(label, `unknown surface "${String(record.surface)}"`);
  }
  if (
    !Array.isArray(record.platforms) ||
    record.platforms.length === 0 ||
    !record.platforms.every((p) => isOneOf(p, PLATFORMS)) ||
    new Set(record.platforms).size !== record.platforms.length
  ) {
    throw fieldError(
      label,
      "platforms must be a non-empty array of unique platforms",
    );
  }
  if (!isOneOf(record.class, DATA_CLASSES)) {
    throw fieldError(label, `unknown class "${String(record.class)}"`);
  }
  if (typeof record.pii !== "boolean")
    throw fieldError(label, "pii must be a boolean");
  if (!isOneOf(record.persistence, PERSISTENCE_MODES)) {
    throw fieldError(
      label,
      `unknown persistence "${String(record.persistence)}"`,
    );
  }
  if (!isOneOf(record.sync, SYNC_MODES)) {
    throw fieldError(label, `unknown sync "${String(record.sync)}"`);
  }
  if (!isOneOf(record.export, EXPORT_MODES)) {
    throw fieldError(label, `unknown export "${String(record.export)}"`);
  }
  if (!isOneOf(record.erasure, ERASURE_MODES)) {
    throw fieldError(label, `unknown erasure "${String(record.erasure)}"`);
  }

  const retention = record.retention as ManifestRetention | null;
  if (
    typeof retention !== "object" ||
    retention === null ||
    !isOneOf(retention.policy, RETENTION_POLICIES) ||
    !Number.isInteger(retention.max_days) ||
    retention.max_days < 0 ||
    Object.keys(retention).length !== 2
  ) {
    throw fieldError(label, "retention must be { policy, max_days>=0 }");
  }

  if (typeof record.purpose !== "string" || record.purpose.length === 0) {
    throw fieldError(label, "purpose must be a non-empty string");
  }
  if (!isOneOf(record.legal_basis, LEGAL_BASES)) {
    throw fieldError(
      label,
      `unknown legal_basis "${String(record.legal_basis)}"`,
    );
  }
  if (typeof record.owner !== "string" || record.owner.length === 0) {
    throw fieldError(label, "owner must be a non-empty string");
  }
  if (
    typeof record.version !== "string" ||
    !VERSION_PATTERN.test(record.version)
  ) {
    throw fieldError(label, 'version must match "N.M"');
  }

  const typed = record as unknown as ManifestEntry;

  // TEST-MATRIX 1.2: plaintext PII is never valid.
  if (typed.persistence === "plaintext_allowed" && typed.pii) {
    throw fieldError(
      label,
      "plaintext_allowed is valid only for pii:false keys",
    );
  }
  // TEST-MATRIX 1.3.
  if (typed.legal_basis === "not_personal_data" && typed.pii) {
    throw fieldError(
      label,
      "not_personal_data is valid only for pii:false keys",
    );
  }
  // TEST-MATRIX 1.4.
  if (typed.class === "onboarding_flag") {
    if (typed.pii)
      throw fieldError(label, "onboarding_flag must have pii:false");
    if (typed.sync !== "never")
      throw fieldError(label, "onboarding_flag must have sync:never");
    if (typed.export !== "never") {
      throw fieldError(label, "onboarding_flag must have export:never");
    }
  }
  // TEST-MATRIX 1.5.
  if (typed.class === "consent_record") {
    if (typed.pii)
      throw fieldError(label, "consent_record must have pii:false");
    if (typed.sync !== "never")
      throw fieldError(label, "consent_record must have sync:never");
    if (typed.export !== "never") {
      throw fieldError(label, "consent_record must have export:never");
    }
    if (typed.erasure !== "erase_on_delete_all") {
      throw fieldError(
        label,
        "consent_record must have erasure:erase_on_delete_all",
      );
    }
  }
  // TEST-MATRIX 1.6.
  if (typed.class === "snapshot") {
    if (typed.persistence === "plaintext_allowed") {
      throw fieldError(label, "snapshot must never be plaintext_allowed");
    }
    if (typed.sync !== "never")
      throw fieldError(label, "snapshot must have sync:never");
    if (typed.export !== "never")
      throw fieldError(label, "snapshot must have export:never");
  }
  // TEST-MATRIX 1.7.
  if (typed.class === "ephemeral_key") {
    if (typed.persistence !== "memory_only") {
      throw fieldError(
        label,
        "ephemeral_key must have persistence:memory_only",
      );
    }
    if (typed.sync !== "never")
      throw fieldError(label, "ephemeral_key must have sync:never");
    if (typed.export !== "never")
      throw fieldError(label, "ephemeral_key must have export:never");
  }
  // TEST-MATRIX 1.8.
  if (typed.class === "diagnostic" && typed.export === "user_export") {
    throw fieldError(label, "diagnostic must never use export:user_export");
  }
}

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

/**
 * Load and validate a manifest document into an index.
 * TEST-MATRIX 1.11: duplicate keys are rejected (fail-closed).
 */
export function loadManifest(doc: unknown): ManifestIndex {
  if (typeof doc !== "object" || doc === null) {
    throw new ManifestError("manifest document must be an object");
  }
  const record = doc as Record<string, unknown>;
  if (
    typeof record.manifest_version !== "string" ||
    !VERSION_PATTERN.test(record.manifest_version)
  ) {
    throw new ManifestError('manifest_version must match "N.M"');
  }
  if (
    typeof record.policy_version !== "string" ||
    !VERSION_PATTERN.test(record.policy_version)
  ) {
    throw new ManifestError('policy_version must match "N.M"');
  }
  const extra = Object.keys(record).filter(
    (k) => !["manifest_version", "policy_version", "keys"].includes(k),
  );
  if (extra.length > 0) {
    throw new ManifestError(`unknown top-level field(s): ${extra.join(", ")}`);
  }
  if (!Array.isArray(record.keys) || record.keys.length === 0) {
    throw new ManifestError("keys must be a non-empty array");
  }

  const index = new Map<string, ManifestEntry>();
  for (const raw of record.keys) {
    validateManifestEntry(raw);
    const entry = raw as ManifestEntry;
    if (index.has(entry.key)) {
      throw new ManifestError(`duplicate key "${entry.key}"`);
    }
    index.set(entry.key, entry);
  }
  return index;
}

/** Document-level policy version (binds SPEC-04 receipts). */
export function getPolicyVersion(doc: unknown): string {
  if (typeof doc !== "object" || doc === null) {
    throw new ManifestError("manifest document must be an object");
  }
  const version = (doc as Record<string, unknown>).policy_version;
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new ManifestError('policy_version must match "N.M"');
  }
  return version;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/** SPEC-01 default-deny: unknown keys are simply absent from the index. */
export function isKnownKey(manifest: ManifestIndex, key: string): boolean {
  return manifest.has(key);
}

export function getEntry(
  manifest: ManifestIndex,
  key: string,
): ManifestEntry | undefined {
  return manifest.get(key);
}

/**
 * Enumerate orphan keys: storage keys observed in code that have no
 * manifest entry. Orphans are candidates for manifest registration —
 * they are NOT auto-allowed (default-deny still applies).
 */
export function findOrphanKeys(
  manifest: ManifestIndex,
  observedKeys: string[],
): string[] {
  return observedKeys.filter((key) => !manifest.has(key));
}
