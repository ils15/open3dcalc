import { create } from "zustand";

// ── Types ──────────────────────────────────────────────────────────

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error"
  | "not-available";

export interface UpdaterState {
  status: UpdateStatus;
  version: string | null;
  releaseNotes: string | null;
  progress: number; // 0–100
  downloadSpeed: number; // bytes per second
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string | null;
  skippedVersion: string | null;
  /**
   * The update cannot be installed in place (unsigned macOS build): the
   * download action opens the release page instead.
   */
  manual: boolean;
}

export interface UpdaterActions {
  /** Check for updates via electronAPI.updater.check() */
  checkForUpdates: () => Promise<void>;

  /** Start downloading the update (or open the release page when manual) */
  startDownload: () => Promise<void>;

  /** Install the downloaded update */
  installUpdate: () => Promise<void>;

  /** Skip this version */
  skipVersion: () => Promise<void>;

  /** Dismiss the notification and return to idle */
  dismiss: () => void;

  /** Reset error state back to idle */
  clearError: () => void;
}

export type UpdaterStore = UpdaterState & UpdaterActions;

// ── Helpers ────────────────────────────────────────────────────────

function getUpdater(): ElectronUpdaterApi | null {
  return window.electronAPI?.updater ?? null;
}

/** Return a no-op unsubscribe function when electronAPI is unavailable. */
function noopUnsubscribe(): () => void {
  return () => {
    /* noop */
  };
}

// ── Store ──────────────────────────────────────────────────────────

export const useUpdaterStore = create<UpdaterStore>()((set, get) => ({
  // ── State ──
  status: "idle",
  version: null,
  releaseNotes: null,
  progress: 0,
  downloadSpeed: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  errorMessage: null,
  skippedVersion: null,
  manual: false,

  // ── Actions ──

  checkForUpdates: async () => {
    const updater = getUpdater();
    if (!updater) {
      set({ status: "not-available", version: null, errorMessage: null });
      return;
    }

    set({ status: "checking", errorMessage: null });

    // Wire up real-time event listeners
    const unsubscribes: (() => void)[] = [];

    const unsubChecking = updater.onChecking
      ? updater.onChecking(() => {
          set({ status: "checking" });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubChecking);

    const unsubAvailable = updater.onAvailable
      ? updater.onAvailable((data) => {
          set({
            status: "available",
            version: data.version,
            releaseNotes: data.releaseNotes ?? null,
            manual: data.manual === true,
          });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubAvailable);

    const unsubNotAvailable = updater.onNotAvailable
      ? updater.onNotAvailable(() => {
          set({
            status: "not-available",
            version: null,
            releaseNotes: null,
          });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubNotAvailable);

    const unsubError = updater.onError
      ? updater.onError((data) => {
          set({
            status: "error",
            errorMessage: data.message,
          });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubError);

    const unsubProgress = updater.onProgress
      ? updater.onProgress((data) => {
          set({
            status: "downloading",
            progress: data.percent,
            downloadSpeed: data.bytesPerSecond,
            downloadedBytes: data.transferred,
            totalBytes: data.total,
          });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubProgress);

    const unsubDownloaded = updater.onDownloaded
      ? updater.onDownloaded((data) => {
          set({
            status: "downloaded",
            version: data.version,
            progress: 100,
          });
        })
      : noopUnsubscribe();
    unsubscribes.push(unsubDownloaded);

    // Start the check
    try {
      const result = await updater.check();

      // If no event was fired yet, handle the result directly
      const currentStatus = get().status;
      if (currentStatus === "checking") {
        if (result.available && result.version) {
          set({
            status: "available",
            version: result.version,
            releaseNotes: result.releaseNotes ?? null,
            manual: result.manual === true,
          });
        } else {
          set({ status: "not-available" });
        }
      }

      // Clean up listeners after a successful check cycle
      // (leave progress/downloaded for subsequent download phase)
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubError();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to check for updates";
      set({ status: "error", errorMessage: message });
      // Clean up on error
      unsubscribes.forEach((fn) => fn());
    }
  },

  startDownload: async () => {
    const updater = getUpdater();
    if (!updater) return;

    // Manual update: the main process opens the release page in the
    // browser. There is no progress to track, so close the banner.
    if (get().manual) {
      try {
        await updater.download();
        get().dismiss();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to open release page";
        set({ status: "error", errorMessage: message });
      }
      return;
    }

    // version from state is used implicitly
    set({
      status: "downloading",
      progress: 0,
      downloadSpeed: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: null,
    });

    try {
      await updater.download();
      // The onProgress and onDownloaded events will update state
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download update";
      set({ status: "error", errorMessage: message });
    }
  },

  installUpdate: async () => {
    const updater = getUpdater();
    if (!updater) return;

    try {
      await updater.install();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to install update";
      set({ status: "error", errorMessage: message });
    }
  },

  skipVersion: async () => {
    const { version } = get();
    const updater = getUpdater();
    if (!updater || !version) {
      set({ status: "idle", skippedVersion: version });
      return;
    }

    try {
      await updater.skip(version);
    } catch {
      // Even if skip API fails, dismiss the banner
    }
    set({ status: "idle", skippedVersion: version });
  },

  dismiss: () => {
    set({
      status: "idle",
      version: null,
      releaseNotes: null,
      progress: 0,
      downloadSpeed: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: null,
    });
  },

  clearError: () => {
    set({ status: "idle", errorMessage: null });
  },
}));
