/**
 * Diagnostic gate (D1.1 S6) — ADR-003 §2.2.1.
 *
 * The raw SQLite `db:export` is reclassified as an engineering/diagnostic
 * backup and is NOT a user feature: the handler refuses to run unless an
 * explicit diagnostic gate is present:
 *
 *  - `--diagnostic` CLI switch, or
 *  - `OPEN3DCALC_DIAGNOSTIC=1` environment variable.
 *
 * Fail-closed by default: production builds and un-flagged dev runs refuse.
 * There is no UI entry point (the renderer never calls this).
 */

let cached: boolean | null = null;

export function isDiagnosticGateEnabled(): boolean {
  if (cached !== null) return cached;
  cached =
    process.argv.includes("--diagnostic") ||
    process.env.OPEN3DCALC_DIAGNOSTIC === "1";
  return cached;
}

/** Test-only: drop the cached gate decision. */
export function resetDiagnosticGateForTests(): void {
  cached = null;
}
