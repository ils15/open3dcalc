/**
 * Real-Electron crypto/persistence self-test (D1.1 S2 + S3) — TEST-MATRIX §0/§2/§3.
 *
 * Adapted for PostgreSQL: uses async postgres.js instead of better-sqlite3.
 * The byte-scan verification (§3.1) is removed as PG is not file-based.
 *
 * Executed by the REAL Electron binary so `safeStorage`, the persistence
 * gate and the legacy scanner run in the real main process with no mocks,
 * against a REAL PostgreSQL database. Prints a JSON report prefixed with
 * `__CRYPTO_SELFTEST__` on the last stdout line; a vitest test parses it.
 */
import { app } from "electron";
import postgres from "postgres";
import {
  probeSafeStorage,
  adoptSessionPassphrase,
  lockCryptoSession,
  encryptForStorage,
  decryptFromStorage,
  getCapability,
  CryptoDeniedError,
} from "../cryptoCapability.js";
import { saveGated, loadGated, gateLoad } from "../persistGate.js";
import { buildScanReport } from "../legacyScan.js";
import {
  buildQuarantineReport,
  migrateKey,
  eliminateKey,
} from "../quarantine.js";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";
const PII_KEY = "open3dcalc_customers_v1";
const LEGACY_KEY = "open3dcalc_quotes_v1";
const NON_PII_KEY = "open3dcalc_settings_v2";
const UNKNOWN_KEY = "open3dcalc_not_in_manifest";

interface ScenarioReport {
  scenario: string;
  outcome: string;
  blobPrefix?: string;
  roundTripOk?: boolean;
  refused?: boolean;
}

interface S3Report {
  gateWriteEncrypted: boolean;
  gateRoundTrip: boolean;
  legacyReadable: boolean;
  legacyFlaggedByScan: boolean;
  unknownRefused: boolean;
  nonPiiPassthrough: boolean;
  scanLegacyCount: number;
  scanEncryptedCount: number;
}

interface S4Report {
  quarantinedDetected: boolean;
  quarantinedWriteRefused: boolean;
  legacyMigrated: boolean;
  migrationVerified: boolean;
  legacyEliminated: boolean;
  quarantineCleared: boolean;
}

interface SelftestReport {
  capability: ReturnType<typeof getCapability>;
  safeStorageProbe: boolean;
  dbUrl: string;
  scenarios: ScenarioReport[];
  s3?: S3Report;
  s4?: S4Report;
  error?: string;
}

function blobPrefixOf(blob: string): string {
  const first = blob.indexOf(":");
  const second = blob.indexOf(":", first + 1);
  return blob.slice(0, second + 1);
}

async function readRow(
  sql: postgres.Sql,
  key: string,
): Promise<string | null> {
  const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : null;
}

async function runSelftest(): Promise<SelftestReport> {
  const report: SelftestReport = {
    capability: getCapability(),
    safeStorageProbe: probeSafeStorage(),
    dbUrl:
      process.env["DATABASE_URL"] ??
      "postgresql://localhost:5432/open3dcalc",
    scenarios: [],
  };

  const sql = postgres(report.dbUrl);

  try {
    // Setup: ensure storage table exists and is clean for this test run
    await sql`CREATE TABLE IF NOT EXISTS storage (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`DELETE FROM storage WHERE key IN (${PII_KEY}, ${LEGACY_KEY}, ${NON_PII_KEY}, ${UNKNOWN_KEY}, 'open3dcalc_history_v2')`;

    const capability = getCapability();

    if (capability.mode === "safe_storage") {
      const blob = await encryptForStorage(PII_KEY, MARKER);
      await sql`INSERT INTO storage (key, value, updated_at) VALUES (${PII_KEY}, ${blob}, ${Date.now()})`;
      const back = await decryptFromStorage(
        PII_KEY,
        (await readRow(sql, PII_KEY)) ?? "",
      );
      report.scenarios.push({
        scenario: "2.1 safe_storage",
        outcome: "written",
        blobPrefix: blobPrefixOf(blob),
        roundTripOk: back === MARKER,
      });
    } else {
      adoptSessionPassphrase("sessão-sintética-de-teste-3131");
      try {
        const blob = await encryptForStorage(PII_KEY, MARKER);
        await sql`INSERT INTO storage (key, value, updated_at) VALUES (${PII_KEY}, ${blob}, ${Date.now()})`;
        const back = await decryptFromStorage(
          PII_KEY,
          (await readRow(sql, PII_KEY)) ?? "",
        );
        report.scenarios.push({
          scenario: "2.2 passphrase_envelope",
          outcome: "written",
          blobPrefix: blobPrefixOf(blob),
          roundTripOk: back === MARKER,
        });
      } catch {
        report.scenarios.push({
          scenario: "2.2 passphrase_envelope",
          outcome: "error",
        });
      }

      lockCryptoSession();
      try {
        await encryptForStorage(PII_KEY, MARKER);
        report.scenarios.push({ scenario: "2.3 denied", outcome: "written" });
      } catch (error) {
        report.scenarios.push({
          scenario: "2.3 denied",
          outcome:
            error instanceof CryptoDeniedError ? "refused" : "unexpected_error",
        });
      }
      adoptSessionPassphrase("sessão-sintética-de-teste-3131");
    }

    // S3 — persistence gate + legacy scanner
    const s3: S3Report = {
      gateWriteEncrypted: false,
      gateRoundTrip: false,
      legacyReadable: false,
      legacyFlaggedByScan: false,
      unknownRefused: false,
      nonPiiPassthrough: false,
      scanLegacyCount: 0,
      scanEncryptedCount: 0,
    };

    const LEGACY_PLAINTEXT = JSON.stringify([{ name: MARKER }]);
    await sql`INSERT INTO storage (key, value, updated_at) VALUES (${LEGACY_KEY}, ${LEGACY_PLAINTEXT}, ${Date.now() - 1000})`;

    await saveGated(sql, PII_KEY, MARKER);
    const storedCustomer = (await readRow(sql, PII_KEY)) ?? "";
    s3.gateWriteEncrypted = storedCustomer.startsWith("enc1:");

    s3.gateRoundTrip = (await loadGated(sql, PII_KEY)) === MARKER;

    s3.legacyReadable = (await loadGated(sql, LEGACY_KEY)) === LEGACY_PLAINTEXT;
    const legacyOutcome = await gateLoad(
      LEGACY_KEY,
      (await readRow(sql, LEGACY_KEY)) ?? "",
    );
    s3.legacyReadable =
      s3.legacyReadable && legacyOutcome.action === "legacy_plaintext";

    try {
      await saveGated(sql, UNKNOWN_KEY, MARKER);
      s3.unknownRefused = false;
    } catch (error) {
      s3.unknownRefused =
        error instanceof CryptoDeniedError &&
        (await readRow(sql, UNKNOWN_KEY)) === null;
    }

    await saveGated(sql, NON_PII_KEY, '{"synthetic":true}');
    s3.nonPiiPassthrough =
      (await readRow(sql, NON_PII_KEY)) === '{"synthetic":true}';

    const rows = (await sql`SELECT key, value FROM storage`) as Array<{
      key: string;
      value: string;
    }>;
    const scan = buildScanReport(rows, {
      customers: 0,
      quotes: 0,
      quote_items: 0,
      history_entries: 0,
      pii_stage: 0,
      legacy_residue: 0,
    });
    s3.scanLegacyCount = scan.legacyCount;
    s3.scanEncryptedCount = scan.encryptedCount;
    s3.legacyFlaggedByScan = scan.entries.some(
      (e) => e.key === LEGACY_KEY && e.status === "legacy_plaintext",
    );
    report.s3 = s3;

    // S4 — quarantine state + migrate/eliminate flows
    const s4: S4Report = {
      quarantinedDetected: false,
      quarantinedWriteRefused: false,
      legacyMigrated: false,
      migrationVerified: false,
      legacyEliminated: false,
      quarantineCleared: false,
    };

    let qReport = await buildQuarantineReport(sql);
    s4.quarantinedDetected =
      qReport.quarantinedKeys.includes(LEGACY_KEY) &&
      (qReport.entries.find((e) => e.key === LEGACY_KEY)?.recordCount ?? 0) >=
        1;

    try {
      await saveGated(sql, LEGACY_KEY, '{"n":9}');
      s4.quarantinedWriteRefused = false;
    } catch (error) {
      s4.quarantinedWriteRefused =
        error instanceof CryptoDeniedError &&
        error.message.includes("quarantined_read_only");
    }

    const migrated = await migrateKey(sql, LEGACY_KEY);
    s4.legacyMigrated = migrated.migrated && migrated.verified;
    s4.migrationVerified =
      (await readRow(sql, LEGACY_KEY))?.startsWith("enc1:") === true;
    const afterMigration = await gateLoad(
      LEGACY_KEY,
      (await readRow(sql, LEGACY_KEY)) ?? "",
    );
    s4.migrationVerified =
      s4.migrationVerified && afterMigration.action === "decrypted";

    const HISTORY_KEY = "open3dcalc_history_v2";
    await sql`INSERT INTO storage (key, value, updated_at) VALUES (${HISTORY_KEY}, ${MARKER}, ${Date.now()})`;
    qReport = await buildQuarantineReport(sql);
    const historyQuarantined = qReport.quarantinedKeys.includes(HISTORY_KEY);
    try {
      await saveGated(sql, HISTORY_KEY, "{}");
      s4.quarantinedWriteRefused = false;
    } catch (error) {
      s4.quarantinedWriteRefused =
        s4.quarantinedWriteRefused &&
        error instanceof CryptoDeniedError &&
        error.message.includes("quarantined_read_only");
    }
    const eliminated = await eliminateKey(sql, HISTORY_KEY);
    s4.legacyEliminated =
      eliminated.eliminated &&
      historyQuarantined &&
      (await readRow(sql, HISTORY_KEY)) === null;

    qReport = await buildQuarantineReport(sql);
    s4.quarantineCleared = qReport.quarantinedKeys.length === 0;
    report.s4 = s4;
  } finally {
    // Cleanup test data
    try {
      await sql`DELETE FROM storage WHERE key IN (${PII_KEY}, ${LEGACY_KEY}, ${NON_PII_KEY}, ${UNKNOWN_KEY}, 'open3dcalc_history_v2')`;
    } catch {
      // Non-fatal
    }
    await sql.end();
  }

  return report;
}

app.whenReady().then(async () => {
  try {
    const report = await runSelftest();
    console.log(`__CRYPTO_SELFTEST__ ${JSON.stringify(report)}`);
    app.exit(0);
  } catch (error) {
    console.log(
      `__CRYPTO_SELFTEST__ ${JSON.stringify({
        error:
          error instanceof Error ? error.message : String(error),
      } satisfies Partial<SelftestReport>)}`,
    );
    app.exit(1);
  }
});