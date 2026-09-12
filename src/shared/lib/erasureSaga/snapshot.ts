/**
 * Disk-backed encrypted snapshot store (D1.1 S7) — SPEC-02 §5, desktop.
 *
 * Snapshots are always ENCRYPTED (ADR-001 capability), TTL'd (7 days) and
 * destroyed with overwrite-then-unlink. Rollback outside the window is
 * impossible by construction (missing/expired snapshot or unavailable key).
 */

import fs from "node:fs";
import path from "node:path";
import { SNAPSHOT_TTL_DAYS } from "./types.js";
import type { SnapshotStore } from "./ports.js";

export interface SnapshotMeta {
  saga_id: string;
  created_at: string;
  ttl_days: number;
  key_source: "safeStorage" | "passphrase";
}

export function snapshotDir(sagaDir: string): string {
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
    async write(sagaId, payload, capability): Promise<void> {
      fs.mkdirSync(sdir, { recursive: true });
      const ciphertext = await capability.encrypt(
        new TextEncoder().encode(payload),
      );
      fs.writeFileSync(snapshotFile(sagaDir, sagaId), Buffer.from(ciphertext));
      const meta: SnapshotMeta = {
        saga_id: sagaId,
        created_at: new Date().toISOString(),
        ttl_days: SNAPSHOT_TTL_DAYS,
        key_source: capability.keySource,
      };
      fs.writeFileSync(
        metaFile(sagaDir, sagaId),
        JSON.stringify(meta, null, 2),
      );
    },
    async canRollback(sagaId, capability, now) {
      if (!fs.existsSync(metaFile(sagaDir, sagaId))) {
        return { possible: false, reason: "snapshot_missing" };
      }
      const meta = JSON.parse(
        fs.readFileSync(metaFile(sagaDir, sagaId), "utf8"),
      ) as SnapshotMeta;
      if (ageDays(meta.created_at, now) > meta.ttl_days) {
        return { possible: false, reason: "snapshot_expired" };
      }
      if (!(await capability.canDecrypt())) {
        return { possible: false, reason: "key_unavailable" };
      }
      return { possible: true };
    },
    async restore(sagaId, capability) {
      const ciphertext = new Uint8Array(
        fs.readFileSync(snapshotFile(sagaDir, sagaId)),
      );
      return new TextDecoder().decode(await capability.decrypt(ciphertext));
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
