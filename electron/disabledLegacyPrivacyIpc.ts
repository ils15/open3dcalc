import type { IpcMain } from "electron";

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
 * database capability. The renderer privacy mounts are removed in the
 * following wave; until then, rejecting is safer and more explicit than
 * returning an empty report that could be mistaken for proof that legacy PII
 * is absent.
 */
export function registerDisabledLegacyPrivacyHandlers(
  ipcMain: Pick<IpcMain, "handle">,
): void {
  for (const channel of DISABLED_LEGACY_PRIVACY_CHANNELS) {
    ipcMain.handle(channel, () => {
      throw new Error(`${channel} is disabled: legacy PII access is paused`);
    });
  }
}
