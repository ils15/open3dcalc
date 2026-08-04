/**
 * @vitest-environment node
 *
 * Regression tests for the update service database rebind (db:import
 * reconnect).
 *
 * The updater service keeps its own reference to the database. After a
 * db:import swap the main process closes the live client and reopens a new
 * one, so it must call setDatabase() with the new handle — otherwise
 * skipVersion() silently fails and checkForUpdates() can no longer read the
 * skipped version until the app restarts.
 */

import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { checkForUpdates, setDatabase, skipVersion } from "../update.js";

const { mockCheckForUpdates } = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn().mockResolvedValue(null),
}));

vi.mock("electron-updater", () => ({
  default: {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      currentVersion: { format: () => "1.0.0" },
      on: vi.fn(),
      checkForUpdates: mockCheckForUpdates,
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
    },
  },
}));

const STORAGE_SQL = `CREATE TABLE storage (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

function makeClient(): Database.Database {
  const client = new Database(":memory:");
  client.exec(STORAGE_SQL);
  return client;
}

function seedSkipped(client: Database.Database, version: string): void {
  client
    .prepare("INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)")
    .run("skipped_version", version, Date.now());
}

function readSkipped(client: Database.Database): string | null {
  const row = client
    .prepare("SELECT value FROM storage WHERE key = ?")
    .get("skipped_version") as { value: string } | undefined;
  return row ? row.value : null;
}

describe("update service database rebind", () => {
  it("setDatabase() rebinds the handle used by skipVersion()", () => {
    const clientA = makeClient();
    setDatabase({ $client: clientA });
    skipVersion("1.0.0");
    expect(readSkipped(clientA)).toBe("1.0.0");

    // Simulate db:import: the old client is closed and a fresh handle is
    // created for the swapped-in file.
    clientA.close();
    const clientB = makeClient();
    setDatabase({ $client: clientB });
    skipVersion("2.0.0");
    expect(readSkipped(clientB)).toBe("2.0.0");
  });

  it("checkForUpdates() honors skipped_version from the rebound handle", async () => {
    const client = makeClient();
    seedSkipped(client, "9.9.9");
    setDatabase({ $client: client });

    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "9.9.9" },
    });

    const result = await checkForUpdates();
    expect(result.available).toBe(false);
  });

  it("without a rebind, a closed client makes checkForUpdates() ignore skipped_version", async () => {
    const clientA = makeClient();
    seedSkipped(clientA, "9.9.9");
    setDatabase({ $client: clientA });

    // db:import closed the live client but the updater still points at it.
    clientA.close();

    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "9.9.9" },
    });

    // Without the rebind the skipped version is unreadable → update shown.
    const stale = await checkForUpdates();
    expect(stale.available).toBe(true);

    // After the rebind the same check honors the skipped version.
    const clientB = makeClient();
    seedSkipped(clientB, "9.9.9");
    setDatabase({ $client: clientB });

    const rebound = await checkForUpdates();
    expect(rebound.available).toBe(false);
  });
});
