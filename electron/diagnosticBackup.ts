/**
 * Diagnostic SQLite backup (D1.1 S6) — ADR-003 §2.2.
 *
 * The raw SQLite copy is an engineering/diagnostic artifact, never a user
 * feature:
 *
 *  1. Gated: refuses to run without the diagnostic gate (§2.2.1).
 *  2. Redaction: optional redaction mode masks storage rows whose key is
 *     `pii: true` in the SPEC-01 manifest and strips the PII domain tables
 *     (customers/quotes/quote_items) before the file lands (§2.2.2).
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
}

const REQUIRE = createRequire(import.meta.url);

/** better-sqlite3 resolved lazily so the module is importable in unit tests. */
function getSqlite(): typeof import("better-sqlite3") {
  return REQUIRE("better-sqlite3") as typeof import("better-sqlite3");
}

const PII_DOMAIN_TABLES = ["customers", "quotes", "quote_items"] as const;

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
  let manifest: ReturnType<typeof loadManifestFromDisk> | undefined;
  try {
    try {
      manifest = loadManifestFromDisk();
    } catch {
      // Fail-closed: without the manifest nothing can be proven non-PII —
      // redact every storage row and strip every domain table.
      maskedStorageRows = sqlite
        .prepare("UPDATE storage SET value = '[REDACTED]'")
        .run().changes;
      for (const table of PII_DOMAIN_TABLES) {
        strippedDomainRows += sqlite
          .prepare(`DELETE FROM ${table}`)
          .run().changes;
      }
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
      for (const table of PII_DOMAIN_TABLES) {
        strippedDomainRows += sqlite
          .prepare(`DELETE FROM ${table}`)
          .run().changes;
      }
    }
    // Compact so masked content is not retained in free pages.
    sqlite.exec("VACUUM");
  } finally {
    sqlite.close();
  }

  await fsp.rename(stagingPath, targetPath);
  const metaPath = writeMeta(targetPath, { redacted: true });
  console.log(
    `[diagnosticBackup] redacted backup written: ${path.basename(targetPath)} ` +
      `(maskedStorageRows=${maskedStorageRows}, strippedDomainRows=${strippedDomainRows})`,
  );
  return {
    targetPath,
    metaPath,
    redacted: true,
    maskedStorageRows,
    strippedDomainRows,
  };
}

function writeMeta(targetPath: string, meta: { redacted: boolean }): string {
  const metaPath = `${targetPath}.meta.json`;
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        redacted: meta.redacted,
        retentionDays: DIAGNOSTIC_RETENTION_DAYS,
      },
      null,
      2,
    ),
  );
  return metaPath;
}
