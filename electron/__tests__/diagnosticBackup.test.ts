/**
 * @vitest-environment node
 *
 * Contract tests for the diagnostic SQLite backup (D1.1 S6) — TEST-MATRIX
 * §5 rows 5.1–5.3 (ADR-003 §2.2): dev gate closed by default, backup lands
 * locally only, redaction masks PII per the SPEC-01 manifest. Real
 * better-sqlite3, real files — no mocks for storage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDiagnosticBackup,
  DiagnosticGateError,
  DIAGNOSTIC_RETENTION_DAYS,
} from "../diagnosticBackup.js";
import { resetDiagnosticGateForTests } from "../diagnosticGate.js";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

let dir: string;
let dbPath: string;

function makeLiveDb(): void {
  const db = new Database(dbPath);
  db.exec(
    "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, customer_id TEXT)",
  );
  db.exec("CREATE TABLE IF NOT EXISTS quote_items (id TEXT PRIMARY KEY)");
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  ).run(
    "open3dcalc_customers_v1",
    JSON.stringify([{ name: MARKER }]),
    Date.now(),
  );
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  ).run("open3dcalc_settings_v2", '{"activeTab":"fdm"}', Date.now());
  db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(
    "c1",
    MARKER,
  );
  db.close();
}

beforeEach(() => {
  delete process.env.OPEN3DCALC_DIAGNOSTIC;
  resetDiagnosticGateForTests();
  dir = mkdtempSync(join(tmpdir(), "o3dc-diag-"));
  dbPath = join(dir, "live.sqlite3");
  makeLiveDb();
});

afterEach(() => {
  delete process.env.OPEN3DCALC_DIAGNOSTIC;
  resetDiagnosticGateForTests();
  rmSync(dir, { recursive: true, force: true });
});

describe("diagnostic backup (ADR-003 §2.2)", () => {
  it("§5.1: refuses without the diagnostic gate (production default)", async () => {
    await expect(
      createDiagnosticBackup({
        dbPath,
        targetPath: join(dir, "out.sqlite3"),
        redact: false,
      }),
    ).rejects.toThrow(DiagnosticGateError);
    expect(existsSync(join(dir, "out.sqlite3"))).toBe(false);
  });

  it("§5.2: with the gate, an unredacted backup lands locally with a retention sidecar", async () => {
    process.env.OPEN3DCALC_DIAGNOSTIC = "1";
    resetDiagnosticGateForTests();
    const target = join(dir, "diagnostic-backup-full.sqlite3");
    const result = await createDiagnosticBackup({
      dbPath,
      targetPath: target,
      redact: false,
    });
    expect(existsSync(target)).toBe(true);
    const bytes = readFileSync(target);
    expect(bytes.includes(Buffer.from(MARKER, "utf8"))).toBe(true);
    const meta = JSON.parse(readFileSync(result.metaPath, "utf8"));
    expect(meta.redacted).toBe(false);
    expect(meta.retentionDays).toBe(DIAGNOSTIC_RETENTION_DAYS);
    expect(meta.retentionDays).toBe(14);
  });

  it("§5.3: redacted backup masks manifest-PII storage rows and strips domain tables", async () => {
    process.env.OPEN3DCALC_DIAGNOSTIC = "1";
    resetDiagnosticGateForTests();
    const target = join(dir, "diagnostic-backup-redacted.sqlite3");
    const result = await createDiagnosticBackup({
      dbPath,
      targetPath: target,
      redact: true,
    });
    expect(result.redacted).toBe(true);
    expect(result.maskedStorageRows).toBe(1);
    expect(result.strippedDomainRows).toBe(1);

    const sqlite = new Database(target);
    const customersRow = sqlite
      .prepare("SELECT value FROM storage WHERE key = ?")
      .get("open3dcalc_customers_v1") as { value: string };
    const settingsRow = sqlite
      .prepare("SELECT value FROM storage WHERE key = ?")
      .get("open3dcalc_settings_v2") as { value: string };
    const customersCount = (
      sqlite.prepare("SELECT COUNT(*) AS c FROM customers").get() as {
        c: number;
      }
    ).c;
    sqlite.close();

    expect(customersRow.value).toBe("[REDACTED]");
    expect(settingsRow.value).toBe('{"activeTab":"fdm"}');
    expect(customersCount).toBe(0);
    // Redaction is provable: the marker is gone from the file bytes.
    expect(readFileSync(target).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
    const meta = JSON.parse(readFileSync(result.metaPath, "utf8"));
    expect(meta.redacted).toBe(true);
  });
});
