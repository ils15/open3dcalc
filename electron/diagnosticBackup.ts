/**
 * Diagnostic SQLite backup (D1.1 S6) — ADR-003 §2.2.
 *
 * The raw SQLite copy is an engineering/diagnostic artifact, never a user
 * feature:
 *
 *  1. Gated: refuses to run without the diagnostic gate (§2.2.1).
 *  2. Redaction: optional redaction mode masks storage rows whose key is
 *     `pii: true` in the SPEC-01 manifest and strips the PII tables
 *     (customers/quotes/quote_items/history_entries plus the `pii_stage`
 *     preimage table — see `piiDomainTables.ts` → `PII_ERASURE_TABLES`) before
 *     the file lands (§2.2.2). A strip that could not be performed is reported
 *     in `stripFailures` / the sidecar rather than counted as success.
 *  3. Local only: the output path is operator-chosen; nothing in this
 *     module performs any network I/O (§2.2.3).
 *  4. Retention: every backup writes a `<target>.meta.json` sidecar
 *     (createdAt, redacted, retentionDays) consumed by the retention
 *     script — unredacted backups expire after 14 days (§2.2.4).
 *
 * Metadata only in logs: file names and row counts, never stored values.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { isKnownKey, getEntry } from "../src/shared/lib/dataManifest.js";
import { loadManifestFromDisk } from "./manifestSource.js";
import { isDiagnosticGateEnabled } from "./diagnosticGate.js";
import { PII_ERASURE_TABLES } from "./piiDomainTables.js";

export const DIAGNOSTIC_RETENTION_DAYS = 14;

export class DiagnosticGateError extends Error {
  readonly code = "diagnostic_gate_closed";
  constructor() {
    super("[diagnosticBackup] refused: diagnostic gate is closed");
    this.name = "DiagnosticGateError";
  }
}

export interface DiagnosticBackupOptions {
  dbPath: string;
  targetPath: string;
  /** Mask/strip PII rows per the SPEC-01 manifest before writing (§2.2.2). */
  redact: boolean;
  /** Checkpoint the live DB's WAL before copying (caller-provided). */
  checkpoint?: () => void;
}

export interface DiagnosticBackupResult {
  targetPath: string;
  metaPath: string;
  redacted: boolean;
  maskedStorageRows: number;
  strippedDomainRows: number;
  /**
   * Tables the redaction pass could NOT strip, by name.
   *
   * Non-empty means the artifact is PARTIALLY redacted while the sidecar still
   * records `redacted: true` — the mode that ran, not a claim that nothing
   * survived. An operator reading the sidecar must be able to tell the
   * difference between "fully redacted" and "redacted, except these tables".
   */
  stripFailures: string[];
}

const REQUIRE = createRequire(import.meta.url);

/** better-sqlite3 resolved lazily so the module is importable in unit tests. */
function getSqlite(): typeof import("better-sqlite3") {
  return REQUIRE("better-sqlite3") as typeof import("better-sqlite3");
}

/**
 * Does this table exist in the database being redacted?
 *
 * A `sqlite_master` probe, run BEFORE the `DELETE`, so that "this profile
 * predates the table" — an ordinary, expected state for every table added after
 * a user installed the app — is not recorded as a strip failure. Without it the
 * two cases collapse into one field, and a field that cries wolf on every
 * older-profile backup is a field nobody reads.
 *
 * A probe that itself throws (locked database, corrupt page) is a real failure
 * and is reported as one: it means the schema could not be read at all, so
 * nothing about this table can be claimed.
 */
function tableExists(
  sqlite: { prepare(sql: string): { get(...params: unknown[]): unknown } },
  table: string,
): boolean {
  return (
    sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) !== undefined
  );
}

/**
 * DELETE every row of a PII table.
 *
 * Two outcomes are distinguished, because they mean opposite things:
 *
 *  - the table is ABSENT — nothing to strip, and NOT a failure. The backup must
 *    still be produced (redaction is best-effort per table, never fatal: a fatal
 *    redaction would mean no backup at all), and an older profile legitimately
 *    lacks tables this build knows about.
 *  - the table EXISTS and the `DELETE` still fails — a genuine refusal, and the
 *    reason is named: a locked database, a read-only file, a corrupt page, a
 *    trigger that aborts the statement, or a schema this build does not
 *    understand. The old catch reported every one of those as "table absent"
 *    and returned 0, which counted as success: the artifact was written, the
 *    sidecar said `redacted: true`, and the rows were still in it. A refusal is
 *    now returned to the caller as a named failure (`stripFailures`, and
 *    `strip_failures` in the sidecar) so a partial redaction is visible instead
 *    of silently reported as a clean one.
 *
 * Only the table NAME is ever logged (§3.2 — names, never values).
 */
function stripDomainTable(
  sqlite: {
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): unknown;
    };
  },
  table: string,
): { stripped: number; failed: boolean } {
  let exists: boolean;
  try {
    exists = tableExists(sqlite, table);
  } catch (error) {
    console.warn(
      `[diagnosticBackup] could not read the schema to check ${table}: ` +
        `${error instanceof Error ? error.message : String(error)} — the ` +
        "backup may retain those rows",
    );
    return { stripped: 0, failed: true };
  }
  if (!exists) return { stripped: 0, failed: false };
  try {
    return {
      stripped: (
        sqlite.prepare(`DELETE FROM ${table}`).run() as { changes: number }
      ).changes,
      failed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[diagnosticBackup] could not strip ${table}: ${message} — the backup ` +
        "will retain those rows",
    );
    return { stripped: 0, failed: true };
  }
}

/**
 * Produce the diagnostic backup. Refuses without the diagnostic gate.
 * Returns the written paths and (when redacting) how much was masked.
 */
export async function createDiagnosticBackup(
  options: DiagnosticBackupOptions,
): Promise<DiagnosticBackupResult> {
  if (!isDiagnosticGateEnabled()) {
    throw new DiagnosticGateError();
  }

  const { dbPath, targetPath, redact, checkpoint } = options;
  if (!redact) {
    // §2.2.3: straight copy — the artifact is PII-bearing and falls under
    // the 14-day retention rule enforced by the retention script.
    checkpoint?.();
    await fsp.copyFile(dbPath, targetPath);
    const metaPath = writeMeta(targetPath, { redacted: false });
    return {
      targetPath,
      metaPath,
      redacted: false,
      maskedStorageRows: 0,
      strippedDomainRows: 0,
      stripFailures: [],
    };
  }

  // §2.2.2 redaction: stage a copy, mask PII per the manifest, then move.
  const stagingPath = `${targetPath}.staging-${process.pid}`;
  checkpoint?.();
  await fsp.copyFile(dbPath, stagingPath);

  const Database = getSqlite();
  const sqlite = new Database(stagingPath);
  let maskedStorageRows = 0;
  let strippedDomainRows = 0;
  const stripFailures: string[] = [];
  let manifest: ReturnType<typeof loadManifestFromDisk> | undefined;
  try {
    // Both the manifest-less and the manifest-driven paths strip the SAME list
    // (`PII_ERASURE_TABLES`: the PII domain tables plus retained historical
    // preimage tables that may contain temporary user-data copies).
    // A table this profile predates is skipped silently; a table whose DELETE is
    // refused is named in `stripFailures` and in the sidecar.
    const stripAll = (): void => {
      for (const table of PII_ERASURE_TABLES) {
        const { stripped, failed } = stripDomainTable(sqlite, table);
        strippedDomainRows += stripped;
        if (failed) stripFailures.push(table);
      }
    };
    try {
      manifest = loadManifestFromDisk();
    } catch {
      // Fail-closed: without the manifest nothing can be proven non-PII —
      // redact every storage row and strip every PII table.
      maskedStorageRows = sqlite
        .prepare("UPDATE storage SET value = '[REDACTED]'")
        .run().changes;
      stripAll();
    }
    if (manifest) {
      const rows = sqlite
        .prepare("SELECT key, value FROM storage")
        .all() as Array<{ key: string; value: string }>;
      const mask = sqlite.prepare(
        "UPDATE storage SET value = '[REDACTED]' WHERE key = ?",
      );
      for (const row of rows) {
        if (isKnownKey(manifest, row.key)) {
          const entry = getEntry(manifest, row.key);
          if (entry?.pii) {
            mask.run(row.key);
            maskedStorageRows++;
          }
        } else {
          // Unknown key: default-deny — treat as PII and mask it.
          mask.run(row.key);
          maskedStorageRows++;
        }
      }
      stripAll();
    }
    // Compact so masked content is not retained in free pages.
    sqlite.exec("VACUUM");
  } finally {
    sqlite.close();
  }

  await fsp.rename(stagingPath, targetPath);
  const metaPath = writeMeta(targetPath, { redacted: true, stripFailures });
  console.log(
    `[diagnosticBackup] redacted backup written: ${path.basename(targetPath)} ` +
      `(maskedStorageRows=${maskedStorageRows}, strippedDomainRows=${strippedDomainRows}` +
      (stripFailures.length > 0
        ? `, STRIP FAILURES=${stripFailures.join(",")}`
        : "") +
      ")",
  );
  return {
    targetPath,
    metaPath,
    redacted: true,
    maskedStorageRows,
    strippedDomainRows,
    stripFailures,
  };
}

function writeMeta(
  targetPath: string,
  meta: { redacted: boolean; stripFailures?: string[] },
): string {
  const metaPath = `${targetPath}.meta.json`;
  const stripFailures = meta.stripFailures ?? [];
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        redacted: meta.redacted,
        retentionDays: DIAGNOSTIC_RETENTION_DAYS,
        // Empty for a fully redacted artifact; non-empty means the file below
        // still holds the named tables' rows, so the retention/audit path can
        // tell a clean redaction from a partial one.
        strip_failures: stripFailures,
      },
      null,
      2,
    ),
  );
  return metaPath;
}
