/**
 * Diagnostic backup retention check (D1.1 S6) — ADR-003 §2.2.4,
 * OWNERS-RUNBOOK §5.
 *
 * Scans a directory of diagnostic SQLite backups (each with a
 * `<file>.meta.json` sidecar written by electron/diagnosticBackup.ts) and:
 *
 *   - CHECK mode (default): flags unredacted backups past their retention
 *     deadline (default 14 days). Exits 1 when violations exist — CI fails.
 *   - --dispose: securely destroys expired unredacted backups (overwrite
 *     with zeros, then unlink, sidecar included) and appends a metadata-only
 *     line to `diagnostic-disposal.log` next to the backups.
 *
 * Files WITHOUT a sidecar are treated as unredacted with an unknown creation
 * date — fail-closed: use the file mtime and flag if older than the default
 * retention. The disposal log records metadata only (date, file, method),
 * never PII.
 *
 * Usage: node scripts/diagnostic-retention.mjs <backups-dir> [--dispose]
 */

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_RETENTION_DAYS = 14;
const DISPOSAL_LOG = "diagnostic-disposal.log";

function listBackupFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".sqlite3") &&
        !f.includes(".staging-") &&
        fs.statSync(path.join(dir, f)).isFile(),
    )
    .map((f) => f.replace(/\.sqlite3$/, ""));
}

function statAgeDays(filePath, now) {
  const stat = fs.statSync(filePath);
  return Math.floor((now.getTime() - stat.mtimeMs) / 86_400_000);
}

/**
 * Scan `dir` and return every backup with its retention state.
 * Backups WITHOUT a sidecar are fail-closed: judged unredacted, aged by
 * file mtime. `now` is injectable for tests. Never reads backup CONTENTS
 * — metadata only.
 */
export function scanBackups(dir, now = new Date()) {
  const files = listBackupFiles(dir);
  const backups = files.map((base) => {
    const filePath = path.join(dir, `${base}.sqlite3`);
    const metaPath = `${filePath}.meta.json`;
    let meta = null;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch {
      meta = null;
    }
    const redacted = meta?.redacted === true;
    const retentionDays =
      typeof meta?.retentionDays === "number"
        ? meta.retentionDays
        : DEFAULT_RETENTION_DAYS;
    const createdAt =
      typeof meta?.createdAt === "string" ? new Date(meta.createdAt) : null;
    const ageDays =
      createdAt !== null && !Number.isNaN(createdAt.getTime())
        ? Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000)
        : statAgeDays(filePath, now);
    const expired = !redacted && ageDays > retentionDays;
    return { file: `${base}.sqlite3`, redacted, ageDays, retentionDays, expired, metaPath };
  });
  const violations = backups.filter((b) => b.expired);
  return { backups, violations };
}

function secureUnlink(filePath) {
  // Overwrite with zeros, then unlink — best-effort secure disposal
  // (srm-class tooling may be substituted by operators per the runbook).
  const stat = fs.statSync(filePath);
  const zeroBuf = Buffer.alloc(stat.size, 0);
  fs.writeFileSync(filePath, zeroBuf);
  fs.unlinkSync(filePath);
}

/**
 * Dispose expired unredacted backups (overwrite + unlink) and log the
 * disposal — metadata only (date, file, method).
 * Returns the disposed file list.
 */
export function disposeExpired(dir, now = new Date()) {
  const { violations } = scanBackups(dir, now);
  const disposed = [];
  for (const violation of violations) {
    const filePath = path.join(dir, violation.file);
    secureUnlink(filePath);
    try {
      fs.unlinkSync(violation.metaPath);
    } catch {
      /* sidecar already gone */
    }
    disposed.push(violation.file);
    fs.appendFileSync(
      path.join(dir, DISPOSAL_LOG),
      `${new Date(now).toISOString()} disposed=${violation.file} method=overwrite+unlink ageDays=${violation.ageDays}\n`,
    );
  }
  return disposed;
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--dispose");
  const dispose = process.argv.includes("--dispose");
  const dir = args[0] ?? path.join("diagnostic-backups");
  if (!fs.existsSync(dir)) {
    console.log(`[retention] no diagnostic backup directory at ${dir} — nothing to check`);
    process.exit(0);
  }
  const { backups, violations } = scanBackups(dir);
  for (const backup of backups) {
    const state = backup.expired
      ? "EXPIRED (unredacted past retention)"
      : backup.redacted
        ? "ok (redacted)"
        : "ok";
    console.log(`[retention] ${backup.file}: ${state} (ageDays=${backup.ageDays})`);
  }
  if (violations.length > 0) {
    if (dispose) {
      const disposed = disposeExpired(dir);
      console.log(
        `[retention] disposed ${disposed.length} expired unredacted backup(s); logged to ${path.join(dir, DISPOSAL_LOG)}`,
      );
      process.exit(0);
    }
    console.error(
      `[retention] ${violations.length} unredacted backup(s) past retention — dispose them (--dispose) or record an extension in the runbook log`,
    );
    process.exit(1);
  }
  console.log("[retention] no retention violations");
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  main();
}
