import pkg from "electron-updater";
import type {
  ProgressInfo,
  UpdateCheckResult,
  UpdateInfo,
} from "electron-updater";
import type { BrowserWindow } from "electron";

const { autoUpdater } = pkg;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UpdateServiceStatus {
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  progress?: number;
  version?: string;
  errorMessage?: string;
}

// Accept any DB-like object with $client.prepare
type DbHandle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $client: any;
};

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let mainWindow: BrowserWindow | null = null;
let db: DbHandle | null = null;
let currentStatus: UpdateServiceStatus = { status: "idle" };
let updateCheckResult: UpdateCheckResult | null = null;

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

/**
 * Extract a human-readable release notes string from the UpdateInfo,
 * handling both string and array-of-objects formats.
 */
function extractReleaseNotes(
  releaseNotes: UpdateInfo["releaseNotes"],
): string | undefined {
  if (typeof releaseNotes === "string") {
    return releaseNotes;
  }
  if (Array.isArray(releaseNotes)) {
    const notes = releaseNotes.map((r) => r.note).filter(Boolean) as string[];
    return notes.length > 0 ? notes.join("\n") : undefined;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Event Listeners                                                    */
/* ------------------------------------------------------------------ */

function setupEventListeners(): void {
  autoUpdater.on("checking-for-update", () => {
    currentStatus = { status: "checking" };
    mainWindow?.webContents.send("update:checking", {});
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    currentStatus = { status: "available", version: info.version };
    mainWindow?.webContents.send("update:available", {
      version: info.version,
      releaseNotes: extractReleaseNotes(info.releaseNotes),
    });
  });

  autoUpdater.on("update-not-available", () => {
    currentStatus = { status: "not-available" };
    mainWindow?.webContents.send("update:not-available", {});
  });

  autoUpdater.on("download-progress", (progressInfo: ProgressInfo) => {
    currentStatus = {
      status: "downloading",
      progress: progressInfo.percent,
    };
    mainWindow?.webContents.send("update:progress", {
      percent: progressInfo.percent,
      bytesPerSecond: progressInfo.bytesPerSecond,
      total: progressInfo.total,
      transferred: progressInfo.transferred,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    currentStatus = { status: "downloaded", version: info.version };
    mainWindow?.webContents.send("update:downloaded", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (error: Error) => {
    const message = error?.message ?? String(error);
    currentStatus = { status: "error", errorMessage: message };
    mainWindow?.webContents.send("update:error", { message });
  });
}

/* ------------------------------------------------------------------ */
/*  Retry + friendly errors (Fase 1 #75)                               */
/* ------------------------------------------------------------------ */

const MAX_CHECK_ATTEMPTS = 3;
const CHECK_RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Remove tokens/credentials so logs and UI messages never leak secrets.
 */
function scrubSecrets(message: string): string {
  return message
    .replace(
      /(token|secret|password|authorization|api[_-]?key)\s*[:=]\s*\S+/gi,
      "$1=***",
    )
    .replace(/gh[pous]_[A-Za-z0-9_]+/g, "***")
    .replace(/x-access-token:[^@\s]+@/gi, "***@");
}

/**
 * Map technical failures to a friendly PT-BR message for the UI.
 */
function toFriendlyUpdateError(message: string): string {
  const clean = scrubSecrets(message);
  if (/ENOENT|channel file.*not found|latest\.ya?ml/i.test(clean)) {
    return "Arquivo de atualização não encontrado. Verifique sua conexão e tente novamente.";
  }
  if (
    /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|network|offline|getaddrinfo|internet/i.test(
      clean,
    )
  ) {
    return "Sem conexão com o servidor de atualizações. Verifique sua internet e tente novamente.";
  }
  if (/\b404\b/.test(clean)) {
    return "Informações da nova versão não encontradas no servidor. Tente novamente mais tarde.";
  }
  return "Não foi possível verificar atualizações. Tente novamente mais tarde.";
}

/* ------------------------------------------------------------------ */
/*  Skip-Version Helpers                                               */
/* ------------------------------------------------------------------ */

function getSkippedVersion(): string | null {
  try {
    if (!db?.$client) return null;
    const stmt = db.$client.prepare("SELECT value FROM storage WHERE key = ?");
    const row = stmt.get("skipped_version") as { value: string } | undefined;
    return row ? row.value : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function initUpdateService(
  window: BrowserWindow,
  database: DbHandle,
): void {
  mainWindow = window;
  db = database;
  setupEventListeners();

  // 5-second delay before first auto-check — non-blocking
  setTimeout(async () => {
    try {
      await checkForUpdates();
    } catch (err) {
      console.error("[update] Initial auto-check failed:", err);
    }
  }, 5000);
}

/**
 * Rebinds the database handle used by the update service.
 *
 * The main process must call this whenever the database is reconnected
 * (e.g. after a db:import swap or a restore). initUpdateService() retains
 * the original handle, whose better-sqlite3 client was closed by
 * closeDatabase(); without the rebind, skipVersion() would silently fail
 * and checkForUpdates() could no longer read the skipped version until the
 * app restarted.
 */
export function setDatabase(database: DbHandle): void {
  db = database;
}

export async function checkForUpdates(): Promise<{
  available: boolean;
  version?: string;
  releaseNotes?: string;
  error?: string;
}> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_CHECK_ATTEMPTS; attempt++) {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) return { available: false };
      updateCheckResult = result;

      const skippedVersion = getSkippedVersion();
      if (skippedVersion && result.updateInfo.version === skippedVersion) {
        console.log(
          `[update] Version ${skippedVersion} was skipped — ignoring.`,
        );
        return { available: false };
      }

      return {
        available:
          result.updateInfo.version !== autoUpdater.currentVersion.format(),
        version: result.updateInfo.version,
        releaseNotes: extractReleaseNotes(result.updateInfo.releaseNotes),
      };
    } catch (error: unknown) {
      lastError = error;
      if (attempt < MAX_CHECK_ATTEMPTS) {
        await sleep(CHECK_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  const raw =
    lastError instanceof Error ? lastError.message : String(lastError);
  const friendly = toFriendlyUpdateError(raw);
  console.error("[update] Check failed:", friendly);
  currentStatus = { status: "error", errorMessage: friendly };
  mainWindow?.webContents.send("update:error", { message: friendly });
  return { available: false, error: friendly };
}

export async function downloadUpdate(): Promise<void> {
  if (!updateCheckResult) {
    throw new Error(
      "No update available to download. Call checkForUpdates() first.",
    );
  }
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(true, true);
}

export function skipVersion(version: string): void {
  try {
    if (!db?.$client) {
      console.warn(
        "[update] DB not available — cannot persist skipped version",
      );
      return;
    }
    const stmt = db.$client.prepare(
      `INSERT INTO storage (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    );
    stmt.run("skipped_version", version, Date.now());
    console.log(
      `[update] Version ${version} will be skipped on future checks.`,
    );
  } catch (error) {
    console.error("[update] Failed to persist skipped version:", error);
  }
}

export function getUpdateStatus(): {
  status: string;
  progress?: number;
  version?: string;
  errorMessage?: string;
} {
  return {
    status: currentStatus.status,
    progress: currentStatus.progress,
    version: currentStatus.version,
    errorMessage: currentStatus.errorMessage,
  };
}
