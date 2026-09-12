/**
 * Disk-backed journal adapter (D1.1 S7) — SPEC-02 §4, desktop.
 *
 * The journal is metadata-only (saga id, states, timestamps, key NAMES —
 * never user content) and every write is ATOMIC: write-temp + fsync +
 * rename (SPEC-03 §9 mechanics), so a crash can never leave a torn journal.
 */

import fs from "node:fs";
import path from "node:path";
import type { SagaJournal } from "./types.js";
import type { JournalAdapter } from "./ports.js";

export class JournalError extends Error {
  constructor(message: string) {
    super(`[erasureJournal] ${message}`);
    this.name = "JournalError";
  }
}

export function journalPath(dir: string): string {
  return path.join(dir, "erasure-journal.json");
}

/** Desktop journal adapter: one atomic JSON file under userData. */
export function diskJournalAdapter(dir: string): JournalAdapter {
  const file = journalPath(dir);
  return {
    exists(): boolean {
      return fs.existsSync(file);
    },
    load(): SagaJournal | null {
      if (!fs.existsSync(file)) return null;
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as SagaJournal;
        if (
          typeof parsed.saga_id !== "string" ||
          typeof parsed.state !== "string"
        ) {
          throw new Error("malformed journal");
        }
        return parsed;
      } catch (error) {
        throw new JournalError(
          `journal unreadable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    save(journal: SagaJournal): void {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file}.tmp-${process.pid}`;
      const fd = fs.openSync(tmp, "w");
      try {
        fs.writeFileSync(fd, JSON.stringify(journal, null, 2), "utf8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, file);
    },
    destroy(): void {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    },
  };
}
