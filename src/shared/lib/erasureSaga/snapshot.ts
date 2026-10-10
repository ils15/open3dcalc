/**
 * Disk-backed local snapshot store (D1.1 S7) — SPEC-02 §5, desktop.
 *
 * Snapshots contain readable local data, are TTL'd (7 days), and are destroyed
 * with overwrite-then-unlink. They are temporary rollback data, not a backup.
 */

import fs from "node:fs";
import path from "node:path";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { SNAPSHOT_TTL_DAYS } from "./types.js";
import type { SnapshotStore } from "./ports.js";

export interface SnapshotMeta {
  saga_id: string;
  created_at: string;
  ttl_days: number;
}

export function snapshotDir(sagaDir: string): string {
  if (isBetaChannel) {
    throw new Error("Snapshots are unavailable in Beta");
  }
  return path.join(sagaDir, "erasure-snapshots");
}

function snapshotFile(dir: string, sagaId: string): string {
  return path.join(snapshotDir(dir), `snapshot-${sagaId}.bin`);
}

function metaFile(dir: string, sagaId: string): string {
  return path.join(snapshotDir(dir), `snapshot-${sagaId}.meta.json`);
}

function ageDays(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

/** Desktop snapshot store over the userData filesystem. */
export function diskSnapshotStore(sagaDir: string): SnapshotStore {
  if (isBetaChannel) {
    throw new Error("Snapshots are unavailable in Beta");
  }
  const sdir = snapshotDir(sagaDir);
  function destroyOne(sagaId: string): void {
    const file = snapshotFile(sagaDir, sagaId);
    if (fs.existsSync(file)) {
      const zero = Buffer.alloc(fs.statSync(file).size, 0);
      fs.writeFileSync(file, zero);
      fs.rmSync(file, { force: true });
    }
    fs.rmSync(metaFile(sagaDir, sagaId), { force: true });
  }
  return {
    async write(sagaId, payload): Promise<void> {
      fs.mkdirSync(sdir, { recursive: true });
      fs.writeFileSync(snapshotFile(sagaDir, sagaId), payload, "utf8");
      const meta: SnapshotMeta = {
        saga_id: sagaId,
        created_at: new Date().toISOString(),
        ttl_days: SNAPSHOT_TTL_DAYS,
      };
      fs.writeFileSync(
        metaFile(sagaDir, sagaId),
        JSON.stringify(meta, null, 2),
      );
    },
    async canRollback(sagaId, now) {
      if (!fs.existsSync(metaFile(sagaDir, sagaId))) {
        return { possible: false, reason: "snapshot_missing" };
      }
      const meta = JSON.parse(
        fs.readFileSync(metaFile(sagaDir, sagaId), "utf8"),
      ) as SnapshotMeta;
      if (ageDays(meta.created_at, now) > meta.ttl_days) {
        return { possible: false, reason: "snapshot_expired" };
      }
      return { possible: true };
    },
    async restore(sagaId) {
      return fs.readFileSync(snapshotFile(sagaDir, sagaId), "utf8");
    },
    destroy(sagaId) {
      destroyOne(sagaId);
    },
    destroyAll() {
      if (fs.existsSync(sdir))
        fs.rmSync(sdir, { recursive: true, force: true });
    },
    sweepExpired(now) {
      const destroyed: string[] = [];
      if (!fs.existsSync(sdir)) return destroyed;
      for (const file of fs.readdirSync(sdir)) {
        if (!file.endsWith(".meta.json")) continue;
        const sagaId = file
          .replace(/^snapshot-/, "")
          .replace(/\.meta\.json$/, "");
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(sdir, file), "utf8"),
          ) as SnapshotMeta;
          if (ageDays(meta.created_at, now) > meta.ttl_days) {
            destroyOne(sagaId);
            destroyed.push(sagaId);
          }
        } catch {
          destroyOne(sagaId);
          destroyed.push(sagaId);
        }
      }
      return destroyed;
    },
  };
}
