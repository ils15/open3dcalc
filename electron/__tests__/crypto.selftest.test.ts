/**
 * @vitest-environment node
 *
 * Real-Electron contract harness (D1.1 S2) — TEST-MATRIX §0 requires real
 * Electron with real `safeStorage` and real SQLite, no mocks. This test
 * compiles the electron main bundle (if needed) and spawns the REAL
 * Electron binary running electron/selftest/crypto-selftest.ts (compiled),
 * then asserts on its JSON report:
 *
 *  - Row 2.1 (safeStorage available): blob written, round-trips — executed
 *    wherever a keyring exists; otherwise the harness honestly reports the
 *    probe result and rows 2.2/2.3 execute instead.
 *  - Row 2.2 (passphrase): SPEC-03 envelope blob round-trips.
 *  - Row 2.3 (deny): write refused with no capability.
 *  - §3.1-style zero-plaintext: raw byte scan of the real SQLite file finds
 *    zero occurrences of the synthetic PII marker.
 */

import { describe, it, expect } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(here, "..");
const repoRoot = path.resolve(electronRoot, "..");
const selftestJs = path.join(
  electronRoot,
  "dist",
  "electron",
  "selftest",
  "crypto-selftest.js",
);

interface ScenarioReport {
  scenario: string;
  outcome: string;
  blobPrefix?: string;
  roundTripOk?: boolean;
  refused?: boolean;
}

interface SelftestReport {
  capability?: { mode: string; piiPersistence: string; reason: string };
  safeStorageProbe?: boolean;
  dbPath?: string;
  scenarios?: ScenarioReport[];
  plaintextHitsInDbFile?: number;
  s3?: {
    gateWriteEncrypted?: boolean;
    gateRoundTrip?: boolean;
    legacyReadable?: boolean;
    legacyFlaggedByScan?: boolean;
    unknownRefused?: boolean;
    nonPiiPassthrough?: boolean;
    scanLegacyCount?: number;
    scanEncryptedCount?: number;
  };
  error?: string;
}

function ensureElectronBuild(): void {
  if (existsSync(selftestJs)) return;
  // CI runs build:electron before tests; local runs may not have it yet.
  execFileSync("npx", ["tsc", "-p", "electron/tsconfig.json"], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

function reportFrom(stdout: string): SelftestReport | null {
  const lines = stdout
    .split("\n")
    .filter((l) => l.startsWith("__CRYPTO_SELFTEST__"));
  if (lines.length === 0) return null;
  return JSON.parse(
    lines[lines.length - 1].slice("__CRYPTO_SELFTEST__ ".length),
  ) as SelftestReport;
}

function spawnAttempt(
  command: string,
  args: string[],
  timeoutMs: number,
): { report: SelftestReport | null; stderr: string } {
  const res = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" },
  });
  return {
    report: reportFrom(res.stdout ?? ""),
    stderr: (res.stderr ?? "").slice(0, 400),
  };
}

/**
 * Spawn strategies, in order, until one produces a report:
 *  1. Direct spawn (local runs with a display / WSLg).
 *  2. Chromium ozone headless (headless CI runners — no X server needed;
 *     verified against Electron 43).
 *  3. xvfb-run, when installed (classic CI fallback).
 * Each attempt gets a short timeout — a failed strategy dies fast (the
 * "Missing X server" failure exits immediately), and the whole chain must
 * fit inside the vitest test timeout.
 */
function runSelftest(): SelftestReport {
  ensureElectronBuild();
  const require = createRequire(import.meta.url);
  const electronBinary = require("electron") as unknown as string;
  if (typeof electronBinary !== "string") {
    throw new Error("electron binary path not resolvable in node context");
  }

  const baseArgs =
    process.platform === "linux" ? [selftestJs, "--no-sandbox"] : [selftestJs];

  const attempts: Array<{ command: string; args: string[] }> = [
    { command: electronBinary, args: baseArgs },
    {
      command: electronBinary,
      args: [...baseArgs, "--ozone-platform=headless", "--disable-gpu"],
    },
  ];
  if (process.platform === "linux") {
    const probe = spawnSync("which", ["xvfb-run"], { encoding: "utf8" });
    if (probe.status === 0) {
      attempts.push({
        command: "xvfb-run",
        args: ["-a", electronBinary, ...baseArgs],
      });
    }
  }

  const failures: string[] = [];
  for (const attempt of attempts) {
    const { report, stderr } = spawnAttempt(
      attempt.command,
      attempt.args,
      45_000,
    );
    if (report) return report;
    failures.push(`${attempt.command}: ${stderr || "no report"}`);
  }
  throw new Error(
    `selftest produced no report via any strategy: ${failures.join(" | ")}`,
  );
}

describe("crypto self-test (real Electron, real SQLite)", () => {
  it("ADR-001 §2.3 capability matrix + ADR-002 gated persistence + zero new plaintext", async () => {
    const report = runSelftest();
    expect(report.error).toBeUndefined();
    expect(report.capability).toBeDefined();

    const scenarios = report.scenarios ?? [];

    if (report.capability?.mode === "safe_storage") {
      // Row 2.1 executed: safeStorage ciphertext written and round-tripped.
      const row = scenarios.find((s) => s.scenario.startsWith("2.1"));
      expect(row?.outcome).toBe("written");
      expect(row?.roundTripOk).toBe(true);
      expect(row?.blobPrefix).toBe("enc1:safeStorage:");
    } else {
      // safeStorage unavailable here: rows 2.2 and 2.3 execute instead.
      expect(report.capability?.mode).toBeDefined();
      const envelopeRow = scenarios.find((s) => s.scenario.startsWith("2.2"));
      expect(envelopeRow?.outcome).toBe("written");
      expect(envelopeRow?.roundTripOk).toBe(true);
      expect(envelopeRow?.blobPrefix).toBe("enc1:envelope:");

      const deniedRow = scenarios.find((s) => s.scenario.startsWith("2.3"));
      expect(deniedRow?.outcome).toBe("refused");
    }

    // S3 — persistence gate (ADR-002 §2.1): gated PII writes are ciphertext,
    // unknown keys are refused, non-PII passes through as plaintext.
    expect(report.s3?.gateWriteEncrypted).toBe(true);
    expect(report.s3?.gateRoundTrip).toBe(true);
    expect(report.s3?.unknownRefused).toBe(true);
    expect(report.s3?.nonPiiPassthrough).toBe(true);

    // S3 — legacy plaintext stays readable and the scanner flags it
    // (ADR-002 §2.2.1 — the quarantine state machine itself lands in S4).
    expect(report.s3?.legacyReadable).toBe(true);
    expect(report.s3?.legacyFlaggedByScan).toBe(true);
    expect(report.s3?.scanEncryptedCount ?? 0).toBeGreaterThanOrEqual(1);

    // §3.1-style byte scan: the marker appears ONLY in the deliberately
    // planted legacy row — every gated write stayed ciphertext.
    expect(report.plaintextHitsInDbFile).toBe(1);
  }, 180_000);
});
