/**
 * @vitest-environment node
 *
 * Unit tests for db/database.ts initialization failure handling.
 *
 * A candidate file can pass validateDatabaseFile() (it only checks that the
 * required table NAMES exist) yet still fail initDatabase() because a table
 * has the wrong columns. initDatabase() must close the SQLite connection it
 * opened in that case — a leaked handle keeps the DB file locked on
 * Windows/macOS, which would make the db:import backup restore silently
 * fail and leave the broken imported file in place.
 *
 * better-sqlite3 is mocked so the failure is forced deterministically right
 * after the connection is opened (the pragma call throws), and so instance
 * open/close counts can be asserted.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
// Import the TypeScript source explicitly: a stale compiled db/database.js
// artifact sits next to it and would otherwise shadow the current code.
import { initDatabase, closeDatabase } from "../database.ts";

const { MockDatabase } = vi.hoisted(() => {
  class MockDatabase {
    static openCount = 0;
    static closeCount = 0;
    constructor(_path?: string) {
      MockDatabase.openCount += 1;
    }
    pragma(): void {
      // Simulate a post-open failure (e.g. a migration failing because a
      // table has the wrong columns).
      throw new Error("simulated initialization failure");
    }
    close(): void {
      MockDatabase.closeCount += 1;
    }
    exec(): void {
      // no-op — never reached because pragma() throws
    }
    prepare(): unknown {
      return { run: () => {}, get: () => undefined, all: () => [] };
    }
  }
  return { MockDatabase };
});

vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
}));

describe("initDatabase() failure cleanup", () => {
  afterEach(() => {
    closeDatabase();
    MockDatabase.openCount = 0;
    MockDatabase.closeCount = 0;
  });

  it("closes the connection it opened when initialization fails", () => {
    expect(() => initDatabase("/tmp/irrelevant.db")).toThrow(
      /simulated initialization failure/,
    );
    expect(MockDatabase.openCount).toBe(1);
    expect(MockDatabase.closeCount).toBe(1);
  });

  it("does not leak a connection across repeated failed attempts", () => {
    expect(() => initDatabase("/tmp/irrelevant.db")).toThrow();
    expect(() => initDatabase("/tmp/irrelevant.db")).toThrow();
    // Every attempt opened and closed exactly one connection.
    expect(MockDatabase.openCount).toBe(2);
    expect(MockDatabase.closeCount).toBe(2);
  });
});
