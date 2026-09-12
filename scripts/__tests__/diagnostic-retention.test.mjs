/**
 * @vitest-environment node
 *
 * Contract tests for the diagnostic backup retention script (D1.1 S6) —
 * TEST-MATRIX §5 row 5.4 (ADR-003 §2.2.4, OWNERS-RUNBOOK §5): unredacted
 * backups past 14 days are flagged and disposed with an audit log.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanBackups, disposeExpired, DEFAULT_RETENTION_DAYS } from "../diagnostic-retention.mjs";

let dir;
const NOW = new Date("2026-09-12T12:00:00Z");

function writeBackup(name, { ageDays, redacted, withMeta = true }) {
  const filePath = join(dir, `${name}.sqlite3`);
  writeFileSync(filePath, Buffer.alloc(64, 1));
  const created = new Date(NOW.getTime() - ageDays * 86_400_000);
  if (withMeta) {
    writeFileSync(
      `${filePath}.meta.json`,
      JSON.stringify({
        createdAt: created.toISOString(),
        redacted,
        retentionDays: DEFAULT_RETENTION_DAYS,
      }),
    );
  } else {
    // No sidecar: fail-closed uses the file mtime.
    utimesSync(filePath, created, created);
  }
  return filePath;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "o3dc-retention-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("diagnostic backup retention (ADR-003 §2.2.4)", () => {
  it("§5.4: flags unredacted backups past the 14-day deadline", () => {
    writeBackup("diagnostic-backup-full-old", { ageDays: 20, redacted: false });
    writeBackup("diagnostic-backup-full-fresh", { ageDays: 3, redacted: false });
    writeBackup("diagnostic-backup-redacted-old", { ageDays: 40, redacted: true });
    const { backups, violations } = scanBackups(dir, NOW);
    expect(backups).toHaveLength(3);
    expect(violations.map((v) => v.file)).toEqual([
      "diagnostic-backup-full-old.sqlite3",
    ]);
  });

  it("fail-closed: a backup without a sidecar is judged by mtime, unredacted", () => {
    writeBackup("diagnostic-backup-orphan", { ageDays: 30, redacted: false, withMeta: false });
    const { violations } = scanBackups(dir, NOW);
    expect(violations).toHaveLength(1);
  });

  it("--dispose overwrites and unlinks expired unredacted files, logging metadata", () => {
    const oldPath = writeBackup("diagnostic-backup-full-old", {
      ageDays: 20,
      redacted: false,
    });
    writeBackup("diagnostic-backup-full-fresh", { ageDays: 3, redacted: false });
    const disposed = disposeExpired(dir, NOW);
    expect(disposed).toEqual(["diagnostic-backup-full-old.sqlite3"]);
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(`${oldPath}.meta.json`)).toBe(false);
    // Fresh unredacted backup untouched.
    expect(
      fs.existsSync(join(dir, "diagnostic-backup-full-fresh.sqlite3")),
    ).toBe(true);
    // Disposal log records metadata only (date, file, method).
    const log = fs.readFileSync(join(dir, "diagnostic-disposal.log"), "utf8");
    expect(log).toContain("diagnostic-backup-full-old.sqlite3");
    expect(log).toContain("method=overwrite+unlink");
  });
});
