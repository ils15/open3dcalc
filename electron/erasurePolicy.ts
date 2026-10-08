/**
 * Exact, manifest-derived Electron PII target inventory for delete-all.
 *
 * This deliberately does not infer targets from prefixes, physical files, or
 * whole browser stores. If a declared Electron PII surface cannot be mapped
 * to a PII-only target, the delete-all control stays unavailable.
 */

import type {
  ManifestEntry,
  ManifestIndex,
} from "../src/shared/lib/dataManifest.js";
import { PII_ERASURE_TABLES } from "./piiDomainTables.js";
import { loadManifestFromDisk } from "./manifestSource.js";

export type DesktopPiiTargetSurface =
  "localStorage" | "sqlite_domain_tables" | "sqlite_storage_table";

export interface DesktopPiiTarget {
  surface: DesktopPiiTargetSurface;
  id: string;
}

export interface DesktopErasurePolicy {
  available: boolean;
  blockerCodes: string[];
  targets: DesktopPiiTarget[];
}

const PII_ERASURE = "erase_on_delete_all";
const TARGET_SURFACES = new Set<DesktopPiiTargetSurface>([
  "localStorage",
  "sqlite_domain_tables",
  "sqlite_storage_table",
]);

/**
 * The ONLY mappings a manifest-declared `sqlite_storage_table` PII entry may
 * use to authorize deletion.
 *
 * A `sqlite_storage_table` entry names a whole key/value table, so its rows are
 * not PII by construction — only the rows mirroring a declared PII key are.
 * Deriving the target set implicitly from "there is some storage entry" is the
 * defect this map closes: a second, undeclared `sqlite_storage_table` PII entry
 * would be silently omitted from the target plan, and the saga would commit a
 * "complete" erase that never touched it. Registering a mapping here is a
 * privacy-contract change, not a refactor: the entry must expand to exact,
 * enumerable targets.
 */
type SqliteStoragePiiMapping =
  | { kind: "mirror_of_localStorage_pii" }
  | { kind: "exact_row_ids"; ids: readonly string[] };

const SQLITE_STORAGE_PII_MAPPINGS: ReadonlyMap<
  string,
  SqliteStoragePiiMapping
> = new Map<string, SqliteStoragePiiMapping>([
  // The `storage` table mirrors renderer localStorage: its PII rows are
  // exactly the row ids of the manifest's Electron localStorage PII keys.
  ["storage", { kind: "mirror_of_localStorage_pii" }],
]);

function isElectronPii(entry: ManifestEntry): boolean {
  return (
    entry.platforms.includes("electron") &&
    entry.pii &&
    entry.erasure === PII_ERASURE
  );
}

function targetOrder(a: DesktopPiiTarget, b: DesktopPiiTarget): number {
  return a.surface.localeCompare(b.surface) || a.id.localeCompare(b.id);
}

/**
 * Derive the exact, manifest-only Electron PII target inventory. Pure over an
 * already-validated index so a synthetic manifest can prove the fail-closed
 * rules without touching the shipped fixture.
 */
export function deriveDesktopErasurePolicy(
  manifest: ManifestIndex,
): DesktopErasurePolicy {
  const entries = [...manifest.values()];
  const piiEntries = entries.filter(isElectronPii);
  const blockerCodes = new Set<string>();
  const targets: DesktopPiiTarget[] = [];
  const localStoragePiiKeys = piiEntries
    .filter((entry) => entry.surface === "localStorage")
    .map((entry) => entry.key);

  for (const entry of piiEntries) {
    if (!TARGET_SURFACES.has(entry.surface as DesktopPiiTargetSurface)) {
      blockerCodes.add("unsupported_pii_surface");
      continue;
    }
    if (entry.surface === "localStorage") {
      targets.push({ surface: "localStorage", id: entry.key });
    } else if (entry.surface === "sqlite_domain_tables") {
      targets.push({ surface: "sqlite_domain_tables", id: entry.key });
    }
  }

  // `sqlite_storage_table` PII is authorized ONLY through an explicit mapping.
  // Any declared entry with no mapping is a blocker: it can never be silently
  // dropped from the plan, and it can never widen a plan either.
  const storageEntries = piiEntries.filter(
    (entry) => entry.surface === "sqlite_storage_table",
  );
  let hasStorageMirror = false;
  for (const entry of storageEntries) {
    const mapping = SQLITE_STORAGE_PII_MAPPINGS.get(entry.key);
    if (!mapping) {
      blockerCodes.add("unmapped_pii_target");
      continue;
    }
    if (mapping.kind === "mirror_of_localStorage_pii") {
      hasStorageMirror = true;
      for (const key of localStoragePiiKeys) {
        targets.push({ surface: "sqlite_storage_table", id: key });
      }
    } else {
      for (const id of mapping.ids) {
        targets.push({ surface: "sqlite_storage_table", id });
      }
    }
  }
  if (localStoragePiiKeys.length > 0 && !hasStorageMirror) {
    blockerCodes.add("manifest_code_mismatch");
  }

  const declaredTables = piiEntries
    .filter((entry) => entry.surface === "sqlite_domain_tables")
    .map((entry) => entry.key)
    .sort();
  const implementedTables = [...PII_ERASURE_TABLES].sort();
  if (
    declaredTables.length !== implementedTables.length ||
    declaredTables.some((table, index) => table !== implementedTables[index])
  ) {
    blockerCodes.add("manifest_code_mismatch");
  }

  targets.sort(targetOrder);
  return {
    available: blockerCodes.size === 0,
    blockerCodes: [...blockerCodes].sort(),
    targets,
  };
}

/** Return the exact identifiers the manifest classifies as Electron PII. */
export function getDesktopErasurePolicy(): DesktopErasurePolicy {
  return deriveDesktopErasurePolicy(loadManifestFromDisk());
}

/** Accept only the complete, exact, manifest-derived PII target plan. */
export function validateDesktopPiiTargetPlan(
  candidate: unknown,
  expected: readonly DesktopPiiTarget[] = getDesktopErasurePolicy().targets,
): candidate is DesktopPiiTarget[] {
  if (!Array.isArray(candidate)) return false;
  const normalized: DesktopPiiTarget[] = [];
  for (const item of candidate) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      Object.keys(item).length !== 2 ||
      typeof (item as Record<string, unknown>).surface !== "string" ||
      !TARGET_SURFACES.has(
        (item as Record<string, unknown>).surface as DesktopPiiTargetSurface,
      ) ||
      typeof (item as Record<string, unknown>).id !== "string" ||
      (item as Record<string, unknown>).id === ""
    ) {
      return false;
    }
    normalized.push({
      surface: (item as DesktopPiiTarget).surface,
      id: (item as DesktopPiiTarget).id,
    });
  }
  if (
    new Set(normalized.map(({ surface, id }) => `${surface}\0${id}`)).size !==
    normalized.length
  ) {
    return false;
  }
  const actual = normalized.sort(targetOrder);
  const approved = [...expected].sort(targetOrder);
  return (
    actual.length === approved.length &&
    actual.every(
      (target, index) =>
        target.surface === approved[index].surface &&
        target.id === approved[index].id,
    )
  );
}

/**
 * Fail closed until both exact-scope deletion and its durable one-use protocol
 * are implemented. A future manifest change alone must never re-enable purge.
 */
export function assertDesktopErasureUnavailable(): never {
  throw new Error(
    "Desktop delete-all is unavailable: exact PII-only targets cannot be verified",
  );
}
