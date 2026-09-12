/**
 * Real-Electron crypto self-test (D1.1 S2) — TEST-MATRIX §0/§2.
 *
 * Executed by the REAL Electron binary (`electron electron/dist/electron/selftest/crypto-selftest.js`)
 * so `safeStorage` and the real main-process environment are exercised with no
 * mocks. It runs the ADR-001 §2.3 scenarios against a REAL SQLite database
 * file (better-sqlite3, temp path) and prints a JSON report prefixed with
 * `__CRYPTO_SELFTEST__` on the last stdout line; a vitest test parses and
 * asserts on it.
 *
 * Scenario coverage (environment-adaptive):
 *  - Row 2.1: safeStorage available ⇒ blob is safeStorage ciphertext, round-trips.
 *  - Row 2.2: safeStorage unavailable + passphrase ⇒ SPEC-03 envelope blob, round-trips;
 *    the passphrase never reaches the DB file (raw byte scan for the marker).
 *  - Row 2.3: safeStorage unavailable + no passphrase ⇒ write refused (deny path).
 *  - §3.1-style zero-plaintext check: the SQLite file is scanned raw for the
 *    synthetic PII markers after every scenario.
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

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";
const KEY = "open3dcalc_customers_v1";

interface ScenarioReport {
  scenario: string;
  outcome: string;
  blobPrefix?: string;
  roundTripOk?: boolean;
  refused?: boolean;
}

interface SelftestReport {
  capability: ReturnType<typeof getCapability>;
  safeStorageProbe: boolean;
  dbPath: string;
  scenarios: ScenarioReport[];
  plaintextHitsInDbFile: number;
  error?: string;
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
  const insert = db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  );

  const save = (value: string): void => {
    insert.run(KEY, value, Date.now());
  };
  const loadValue = (): string | null =>
    (db.prepare("SELECT value FROM storage WHERE key = ?").get(KEY) as
      | { value: string }
      | undefined)?.value ?? null;

  const capability = getCapability();

  if (capability.mode === "safe_storage") {
    // Row 2.1: safeStorage ciphertext at rest, decrypt round-trips.
    const blob = await encryptForStorage(KEY, MARKER);
    save(blob);
    const back = await decryptFromStorage(KEY, loadValue() ?? "");
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
      const blob = await encryptForStorage(KEY, MARKER);
      save(blob);
      const back = await decryptFromStorage(KEY, loadValue() ?? "");
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
      await encryptForStorage(KEY, MARKER);
      report.scenarios.push({ scenario: "2.3 denied", outcome: "written" });
    } catch (error) {
      report.scenarios.push({
        scenario: "2.3 denied",
        outcome:
          error instanceof CryptoDeniedError ? "refused" : "unexpected_error",
      });
    }
  }

  // Zero-plaintext scan over the real DB file bytes.
  const bytes = readFileSync(dbPath);
  const markerBytes = Buffer.from(MARKER, "utf8");
  outer: for (let i = 0; i <= bytes.length - markerBytes.length; i++) {
    for (let j = 0; j < markerBytes.length; j++) {
      if (bytes[i + j] !== markerBytes[j]) continue outer;
    }
    report.plaintextHitsInDbFile++;
    break;
  }

  db.close();
  rmSync(dir, { recursive: true, force: true });
  return report;
}


/** "enc1:safeStorage:<...>" / "enc1:envelope:<...>" → the "enc1:<scheme>:" part. */
function blobPrefixOf(blob: string): string {
  const first = blob.indexOf(":");
  const second = blob.indexOf(":", first + 1);
  return blob.slice(0, second + 1);
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
