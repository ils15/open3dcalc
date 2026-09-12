/**
 * Real-Electron crypto/persistence self-test (D1.1 S2 + S3) — TEST-MATRIX §0/§2/§3.
 *
 * Executed by the REAL Electron binary so `safeStorage`, the persistence
 * gate and the legacy scanner run in the real main process with no mocks,
 * against a REAL SQLite database file (better-sqlite3, temp path). Prints a
 * JSON report prefixed with `__CRYPTO_SELFTEST__` on the last stdout line;
 * a vitest test parses and asserts on it.
 *
 * Scenario coverage (environment-adaptive):
 *  - Row 2.1: safeStorage available ⇒ blob is safeStorage ciphertext, round-trips.
 *  - Row 2.2: safeStorage unavailable + passphrase ⇒ SPEC-03 envelope blob, round-trips.
 *  - Row 2.3: safeStorage unavailable + no passphrase ⇒ write refused (deny path).
 *  - S3 §2.1: gated save encrypts PII through the capability layer; gated load
 *    round-trips; unknown keys are refused; non-PII passes through as plaintext.
 *  - S3 §2.2: pre-existing (planted) plaintext PII stays readable via the gate
 *    and is FLAGGED by the legacy scanner (report carries key NAMES only).
 *  - §3.1-style byte scan: the DB file must contain the synthetic marker ONLY
 *    in the deliberately planted legacy row — every gated write stays ciphertext.
 */

import { app } from "electron";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  dbPath: string;
  scenarios: ScenarioReport[];
  plaintextHitsInDbFile: number;
  s3?: S3Report;
  s4?: S4Report;
  error?: string;
}

/** "enc1:safeStorage:<...>" / "enc1:envelope:<...>" → the "enc1:<scheme>:" part. */
function blobPrefixOf(blob: string): string {
  const first = blob.indexOf(":");
  const second = blob.indexOf(":", first + 1);
  return blob.slice(0, second + 1);
}

function countMarkerHits(bytes: Buffer): number {
  const markerBytes = Buffer.from(MARKER, "utf8");
  let hits = 0;
  outer: for (let i = 0; i <= bytes.length - markerBytes.length; i++) {
    for (let j = 0; j < markerBytes.length; j++) {
      if (bytes[i + j] !== markerBytes[j]) continue outer;
    }
    hits++;
  }
  return hits;
}

async function runSelftest(): Promise<SelftestReport> {
  const report: SelftestReport = {
    capability: getCapability(),
    safeStorageProbe: probeSafeStorage(),
    dbPath: "",
    scenarios: [],
    plaintextHitsInDbFile: 0,
  };

  const dir = mkdtempSync(join(tmpdir(), "o3dc-selftest-"));
  const dbPath = join(dir, "selftest.sqlite3");
  report.dbPath = dbPath;
  const db = new Database(dbPath);
  db.exec(
    "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  const insertRaw = db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  );

  const capability = getCapability();

  if (capability.mode === "safe_storage") {
    // Row 2.1: safeStorage ciphertext at rest, decrypt round-trips.
    const blob = await encryptForStorage(PII_KEY, MARKER);
    insertRaw.run(PII_KEY, blob, Date.now());
    const back = await decryptFromStorage(PII_KEY, readRow(db, PII_KEY) ?? "");
    report.scenarios.push({
      scenario: "2.1 safe_storage",
      outcome: "written",
      blobPrefix: blobPrefixOf(blob),
      roundTripOk: back === MARKER,
    });
  } else {
    // Row 2.2: passphrase envelope (only when a passphrase capability exists).
    adoptSessionPassphrase("sessão-sintética-de-teste-3131");
    try {
      const blob = await encryptForStorage(PII_KEY, MARKER);
      insertRaw.run(PII_KEY, blob, Date.now());
      const back = await decryptFromStorage(
        PII_KEY,
        readRow(db, PII_KEY) ?? "",
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

    // Row 2.3: deny path — lock the session, the write must be refused.
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
    // Restore a passphrase so the S3 gated-write scenarios can run.
    adoptSessionPassphrase("sessão-sintética-de-teste-3131");
  }

  // ------------------------------------------------------------------
  // S3 — persistence gate + legacy scanner (ADR-002 §2.1/§2.2)
  // ------------------------------------------------------------------
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

  // §2.2 setup: plant pre-D1.1 plaintext PII exactly as legacy users have
  // (a JSON array of records, the shape the stores persist).
  const LEGACY_PLAINTEXT = JSON.stringify([{ name: MARKER }]);
  insertRaw.run(LEGACY_KEY, LEGACY_PLAINTEXT, Date.now() - 1000);

  // §2.1: gated write of a PII key goes through the capability layer.
  await saveGated(db, PII_KEY, MARKER);
  const storedCustomer = readRow(db, PII_KEY) ?? "";
  s3.gateWriteEncrypted = storedCustomer.startsWith("enc1:");

  // §2.1: gated load round-trips the ciphertext back to plaintext.
  s3.gateRoundTrip = (await loadGated(db, PII_KEY)) === MARKER;

  // §2.2: legacy plaintext PII stays readable through the gate...
  s3.legacyReadable = (await loadGated(db, LEGACY_KEY)) === LEGACY_PLAINTEXT;
  const legacyOutcome = await gateLoad(
    LEGACY_KEY,
    readRow(db, LEGACY_KEY) ?? "",
  );
  s3.legacyReadable =
    s3.legacyReadable && legacyOutcome.action === "legacy_plaintext";

  // §2.1: unknown keys are refused (fail-closed), never written.
  try {
    await saveGated(db, UNKNOWN_KEY, MARKER);
    s3.unknownRefused = false;
  } catch (error) {
    s3.unknownRefused =
      error instanceof CryptoDeniedError && readRow(db, UNKNOWN_KEY) === null;
  }

  // §2.1: non-PII keys pass through as plaintext (manifest allows it).
  await saveGated(db, NON_PII_KEY, '{"synthetic":true}');
  s3.nonPiiPassthrough = readRow(db, NON_PII_KEY) === '{"synthetic":true}';

  // §2.3: the scanner flags legacy plaintext and counts encrypted rows.
  const rows = db.prepare("SELECT key, value FROM storage").all() as Array<{
    key: string;
    value: string;
  }>;
  const scan = buildScanReport(rows, {
    customers: 0,
    quotes: 0,
    quote_items: 0,
  });
  s3.scanLegacyCount = scan.legacyCount;
  s3.scanEncryptedCount = scan.encryptedCount;
  s3.legacyFlaggedByScan = scan.entries.some(
    (e) => e.key === LEGACY_KEY && e.status === "legacy_plaintext",
  );
  report.s3 = s3;

  // ------------------------------------------------------------------
  // S4 — quarantine state + migrate/eliminate flows (ADR-002 §2.2)
  // ------------------------------------------------------------------
  const s4: S4Report = {
    quarantinedDetected: false,
    quarantinedWriteRefused: false,
    legacyMigrated: false,
    migrationVerified: false,
    legacyEliminated: false,
    quarantineCleared: false,
  };

  // §2.2: the quarantined key shows in the report...
  let qReport = buildQuarantineReport(db);
  s4.quarantinedDetected =
    qReport.quarantinedKeys.includes(LEGACY_KEY) &&
    (qReport.entries.find((e) => e.key === LEGACY_KEY)?.recordCount ?? 0) >= 1;

  // §2.2.1: gated writes over the quarantined key are refused (read-only).
  try {
    await saveGated(db, LEGACY_KEY, '{"n":9}');
    s4.quarantinedWriteRefused = false;
  } catch (error) {
    s4.quarantinedWriteRefused =
      error instanceof CryptoDeniedError &&
      error.message.includes("quarantined_read_only");
  }

  // §2.2.3 MIGRATE: encrypt, verify, plaintext destroyed.
  const migrated = await migrateKey(db, LEGACY_KEY);
  s4.legacyMigrated = migrated.migrated && migrated.verified;
  s4.migrationVerified = readRow(db, LEGACY_KEY)?.startsWith("enc1:") === true;
  const afterMigration = await gateLoad(
    LEGACY_KEY,
    readRow(db, LEGACY_KEY) ?? "",
  );
  s4.migrationVerified =
    s4.migrationVerified && afterMigration.action === "decrypted";

  // §2.2.3 ELIMINATE: plant another legacy key, then eliminate it.
  const HISTORY_KEY = "open3dcalc_history_v2";
  insertRaw.run(HISTORY_KEY, MARKER, Date.now());
  qReport = buildQuarantineReport(db);
  const historyQuarantined = qReport.quarantinedKeys.includes(HISTORY_KEY);
  try {
    await saveGated(db, HISTORY_KEY, "{}");
    s4.quarantinedWriteRefused = false;
  } catch (error) {
    s4.quarantinedWriteRefused =
      s4.quarantinedWriteRefused &&
      error instanceof CryptoDeniedError &&
      error.message.includes("quarantined_read_only");
  }
  const eliminated = eliminateKey(db, HISTORY_KEY);
  s4.legacyEliminated =
    eliminated.eliminated &&
    historyQuarantined &&
    readRow(db, HISTORY_KEY) === null;

  // §2.2.5: after both explicit exits, quarantine is empty — never
  // auto-resolved, only by the user actions above.
  qReport = buildQuarantineReport(db);
  s4.quarantineCleared = qReport.quarantinedKeys.length === 0;
  report.s4 = s4;

  // §3.1-style byte scan: after migrate (plaintext destroyed) and eliminate
  // (rows deleted), the synthetic marker must have ZERO hits in the file.
  report.plaintextHitsInDbFile = countMarkerHits(readFileSync(dbPath));

  db.close();
  rmSync(dir, { recursive: true, force: true });
  return report;
}

function readRow(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row ? row.value : null;
}

app.whenReady().then(async () => {
  try {
    const report = await runSelftest();
    console.log(`__CRYPTO_SELFTEST__ ${JSON.stringify(report)}`);
    app.exit(0);
  } catch (error) {
    console.log(
      `__CRYPTO_SELFTEST__ ${JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      } satisfies Partial<SelftestReport>)}`,
    );
    app.exit(1);
  }
});
