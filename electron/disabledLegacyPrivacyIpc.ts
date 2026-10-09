import type { IpcMain } from "electron";
import {
  BETA_ELECTRON_PII_REFUSAL,
  isBetaElectronRuntime,
} from "./betaRuntime.js";

/** Legacy-PII endpoints retained briefly for preload type compatibility. */
export const DISABLED_LEGACY_PRIVACY_CHANNELS = [
  "privacy:scan-report",
  "privacy:quarantine-report",
  "privacy:legacy-rows",
  "privacy:migrate-key",
  "privacy:eliminate-key",
  "privacy:recovery-report",
  "privacy:recover-key",
] as const;

/**
 * Reject obsolete inspection/recovery/migration IPC without acquiring a
 * database capability. Rejecting is safer and more explicit than returning an
 * empty report that could be mistaken for proof that legacy PII is absent.
 *
 * On Beta the refusal names the Beta channel instead: the Web-only Beta must
 * not present even a Stable-worded legacy-PII surface. Both branches refuse —
 * the Beta check only changes the sentence, never the outcome.
 */
export function registerDisabledLegacyPrivacyHandlers(
  ipcMain: Pick<IpcMain, "handle">,
): void {
  for (const channel of DISABLED_LEGACY_PRIVACY_CHANNELS) {
    ipcMain.handle(channel, () => {
      if (isBetaElectronRuntime()) {
        throw new Error(
          `[beta] ${channel} is unavailable: ${BETA_ELECTRON_PII_REFUSAL}`,
        );
      }
      throw new Error(`${channel} is disabled: legacy PII access is paused`);
    });
  }
}
