/** Beta is a Web-only channel; Electron must expose no PII privacy surface. */
export function isBetaElectronRuntime(
  environment: { VITE_BETA_CHANNEL?: string } = process.env,
): boolean {
  return environment.VITE_BETA_CHANNEL === "true";
}

/**
 * Stable refusal text for every Electron PII channel on Beta.
 *
 * Kept as a constant (not interpolated per call site) so the preload bridge,
 * the main-process handlers and the tests assert the same sentence, and so no
 * call site can accidentally leak a key name, value or backend detail into the
 * refusal.
 */
export const BETA_ELECTRON_PII_REFUSAL =
  "Beta channel is Web-only; Electron PII IPC is disabled";

/**
 * Fail-closed refusal for one PII channel on Beta.
 *
 * The channel name is metadata (never a value), and it is included so the
 * renderer can report WHICH call was refused without a second lookup.
 */
export function betaElectronPiiRefusal(channel: string): Error {
  return new Error(
    `[beta] ${channel} is unavailable: ${BETA_ELECTRON_PII_REFUSAL}`,
  );
}

/**
 * Generic-storage keys withheld from the Electron `db:*` IPC on Beta.
 *
 * Beta consent lives on the Web channel, so the desktop consent row must not
 * be readable or writable through Electron while Beta is active. Wired by
 * `main.ts` into the `excludedKeys` option of `registerDatabaseStorageHandlers`
 * — the closed allowlist itself is unchanged on Stable.
 */
export const BETA_EXCLUDED_STORAGE_KEYS = ["open3dcalc_consent_v1"] as const;
