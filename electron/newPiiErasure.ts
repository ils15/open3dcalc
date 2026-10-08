/**
 * Exact new-namespace delete-all (Beta12 follow-up) — main process only.
 *
 * ## What this is, and what it deliberately is NOT
 *
 * It erases EXACTLY the three passwordless new-PII storage rows
 * (`open3dcalc_pwless_customers_v1|quotes_v1|history_v1`). It is NOT the legacy
 * delete-all: legacy Beta rows, the domain tables, `pii_stage`, `legacy_residue`
 * and mixed backups stay unavailable (`erasurePolicy`), and this module never
 * names them.
 *
 * ## The durable, one-use protocol
 *
 * `request` persists a PII-free journal BEFORE any purge and issues a one-use,
 * expiring nonce bound to the operation, the profile and the exact three
 * targets. `claim` consumes that nonce and returns the exact plan. `start`
 * re-verifies, snapshots only the three rows, purges ONLY those three via the
 * exact `newPiiStore` helpers, rescans in the TRUSTED process to prove zero rows
 * remain, then removes the snapshot and records completion. A renderer report is
 * never consulted.
 *
 * ## Fail-closed
 *
 * Any unknown, mixed or legacy target in the persisted plan refuses BEFORE the
 * purge and keeps the lock. An unreadable journal is treated as a lock. A purge
 * that cannot be verified (rows remain, snapshot cleanup failed) is recorded
 * `incomplete`, the lock stays engaged and a retry is idempotent. Completion is
 * only ever written after the trusted rescan proves the rows are gone.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
  applyNewPiiErasureOutcome,
  createNewPiiErasureJournal,
  isExactNewPiiErasurePlan,
  isNewPiiErasureExpired,
  isValidNewPiiErasureJournal,
  NEW_PII_ERASURE_OPERATION,
  newPiiErasureBlocksPiiWrites,
  newPiiErasureKeyForTarget,
  newPiiErasureTargets,
  verifyNewPiiErasureClaim,
  type NewPiiErasureClaim,
  type NewPiiErasureJournal,
  type NewPiiErasureTarget,
} from "../src/shared/lib/crypto/newPiiErasureJournal.js";
import type { NewPiiStorageKey } from "../src/shared/lib/crypto/newPiiNamespace.js";
import type { MinimalStorageDb } from "./storageRows.js";
import {
  deleteNewPiiRow,
  remainingNewPiiRows,
  snapshotNewPiiRows,
} from "./newPiiStore.js";
import {
  betaElectronPiiRefusal,
  isBetaElectronRuntime,
} from "./betaRuntime.js";

/** The default lifetime of an issued nonce. */
export const NEW_PII_ERASURE_TTL_MS = 10 * 60 * 1000;

export function newPiiErasureJournalPath(dir: string): string {
  return path.join(dir, "new-pii-erasure-journal.json");
}

export function newPiiErasureSnapshotPath(dir: string): string {
  return path.join(dir, "new-pii-erasure-snapshot.json");
}

/** Raised for anything this operation refuses. `reason` is a compile-time code. */
export class NewPiiErasureRefusedError extends Error {
  readonly code = "new_pii_erasure_refused";
  readonly reason: string;
  constructor(reason: string) {
    super(`[newPiiErasure] refused (${reason})`);
    this.name = "NewPiiErasureRefusedError";
    this.reason = reason;
  }
}

/** Load the journal, or null when none exists. Throws on invalid bytes. */
export function loadNewPiiErasureJournal(
  dir: string,
): NewPiiErasureJournal | null {
  const file = newPiiErasureJournalPath(dir);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isValidNewPiiErasureJournal(parsed))
      throw new Error("invalid journal");
    return parsed;
  } catch {
    // Do not echo untrusted bytes. The caller preserves the file.
    throw new NewPiiErasureRefusedError("journal_invalid");
  }
}

function saveNewPiiErasureJournal(
  dir: string,
  journal: NewPiiErasureJournal,
): void {
  fs.mkdirSync(dir, { recursive: true });
  const file = newPiiErasureJournalPath(dir);
  const tmp = `${file}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, JSON.stringify(journal, null, 2), "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

export interface NewPiiErasureAuthorization {
  token: string;
  expiresAt: string;
  targets: NewPiiErasureTarget[];
}

/**
 * Persist a pending request and return its one-use nonce.
 *
 * Idempotent while a request is live (pending or incomplete) and unexpired: the
 * same profile gets the SAME nonce and the durable file is not rewritten. A
 * completed journal is replaced — the previous erase is terminal and the user
 * may erase again after writing new data.
 *
 * An EXPIRED live request is RENEWED rather than returned verbatim: its nonce
 * can never be claimed again (`verifyNewPiiErasureClaim` refuses it as
 * `expired`), so handing it back would deadlock the caller on a token that
 * always refuses. Renewal keeps the same durable request (and its snapshot
 * binding) but issues a FRESH one-use nonce and a FRESH expiry interval, which
 * also invalidates the superseded nonce.
 */
export function requestNewPiiErasure(
  dir: string,
  profile: string,
  now: Date = new Date(),
): NewPiiErasureAuthorization {
  const existing = loadNewPiiErasureJournal(dir);
  if (existing && existing.state !== "completed") {
    if (existing.profile !== profile) {
      throw new NewPiiErasureRefusedError("request_in_progress");
    }
    if (isNewPiiErasureExpired(existing, now)) {
      const issuedAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + NEW_PII_ERASURE_TTL_MS,
      ).toISOString();
      const renewed: NewPiiErasureJournal = {
        ...existing,
        nonce: randomUUID(),
        issued_at: issuedAt,
        expires_at: expiresAt,
        // The prior nonce is dead; a fresh claim must start from null.
        claimed_nonce: null,
      };
      saveNewPiiErasureJournal(dir, renewed);
      return {
        token: renewed.nonce,
        expiresAt,
        targets: renewed.targets,
      };
    }
    return {
      token: existing.nonce,
      expiresAt: existing.expires_at,
      targets: existing.targets,
    };
  }
  const targets = newPiiErasureTargets();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + NEW_PII_ERASURE_TTL_MS,
  ).toISOString();
  const journal = createNewPiiErasureJournal({
    requestId: randomUUID(),
    profile,
    targets,
    nonce: randomUUID(),
    issuedAt,
    expiresAt,
  });
  saveNewPiiErasureJournal(dir, journal);
  return { token: journal.nonce, expiresAt, targets: journal.targets };
}

/**
 * Verify and consume a one-use nonce, returning the exact plan.
 *
 * A failed verification NEVER rewrites the journal, so a replay or a mis-bound
 * claim cannot advance the operation.
 */
export function claimNewPiiErasure(
  dir: string,
  token: unknown,
  now: Date = new Date(),
): { targets: NewPiiErasureTarget[] } {
  const journal = loadNewPiiErasureJournal(dir);
  if (!journal) throw new NewPiiErasureRefusedError("no_request");
  if (typeof token !== "string" || token.length === 0) {
    throw new NewPiiErasureRefusedError("binding_mismatch");
  }
  const claim: NewPiiErasureClaim = {
    nonce: token,
    operation: NEW_PII_ERASURE_OPERATION,
    profile: journal.profile,
    targets: journal.targets,
  };
  const verdict = verifyNewPiiErasureClaim(journal, claim, now);
  if (!verdict.ok) throw new NewPiiErasureRefusedError(verdict.reason);
  saveNewPiiErasureJournal(dir, { ...journal, claimed_nonce: token });
  return { targets: journal.targets };
}

export interface NewPiiErasureReceipt {
  request_id: string;
  completed_at: string;
  purged: string[];
}

/**
 * Run (or resume) the exact delete-all.
 *
 * The nonce is verified/consumed here when it was not already claimed, so a
 * crash between `claim` and `start` resumes with the same token. The snapshot
 * is written ONCE and retained until a verified terminal state; a retry after an
 * incomplete purge keeps the original snapshot rather than overwriting it with
 * already-deleted (null) rows.
 */
export function runNewPiiErasure(
  dir: string,
  db: MinimalStorageDb,
  token: unknown,
  now: Date = new Date(),
): NewPiiErasureReceipt {
  const journal = loadNewPiiErasureJournal(dir);
  if (!journal) throw new NewPiiErasureRefusedError("no_request");
  if (typeof token !== "string" || token.length === 0) {
    throw new NewPiiErasureRefusedError("binding_mismatch");
  }

  // Idempotent terminal state: a completed erase never re-purges.
  if (journal.state === "completed") {
    return {
      request_id: journal.request_id,
      completed_at: journal.completed_at ?? journal.expires_at,
      purged: [],
    };
  }

  // Verify/consume the nonce unless a prior claim already consumed THIS token.
  if (journal.claimed_nonce === null) {
    const claim: NewPiiErasureClaim = {
      nonce: token,
      operation: NEW_PII_ERASURE_OPERATION,
      profile: journal.profile,
      targets: journal.targets,
    };
    const verdict = verifyNewPiiErasureClaim(journal, claim, now);
    if (!verdict.ok) throw new NewPiiErasureRefusedError(verdict.reason);
    journal.claimed_nonce = token;
    saveNewPiiErasureJournal(dir, journal);
  } else if (journal.claimed_nonce !== token) {
    throw new NewPiiErasureRefusedError("binding_mismatch");
  }

  // Fail closed on any plan that is not the exact three-key set. A tampered or
  // corrupt journal must never widen or drop a target; the lock stays engaged.
  if (!isExactNewPiiErasurePlan(journal.targets)) {
    markIncomplete(dir, journal);
    throw new NewPiiErasureRefusedError("plan_refused");
  }

  // Snapshot ONLY the three new rows, once, retained until terminal.
  writeSnapshotOnce(dir, journal, db);

  for (const target of journal.targets) {
    const key = newPiiErasureKeyForTarget(target) as NewPiiStorageKey | null;
    // `isExactNewPiiErasurePlan` above proved this is non-null; the guard keeps
    // the invariant local instead of trusting it.
    if (key === null) {
      markIncomplete(dir, journal);
      throw new NewPiiErasureRefusedError("plan_refused");
    }
    deleteNewPiiRow(db, key);
  }

  // Trusted-process postcondition: not a renderer report.
  const remaining = remainingNewPiiRows(db);
  if (remaining.length > 0) {
    markIncomplete(dir, journal);
    throw new NewPiiErasureRefusedError("purge_unverified");
  }

  // Verified snapshot cleanup is part of the terminal transition.
  if (!removeSnapshot(dir)) {
    markIncomplete(dir, journal);
    throw new NewPiiErasureRefusedError("snapshot_cleanup_failed");
  }

  const completed = applyNewPiiErasureOutcome(
    journal,
    "completed",
    now.toISOString(),
  );
  saveNewPiiErasureJournal(dir, completed);
  return {
    request_id: completed.request_id,
    completed_at: completed.completed_at ?? now.toISOString(),
    purged: journal.targets.map((target) => target.id),
  };
}

interface SnapshotPayload {
  request_id: string;
  taken_at: string;
  rows: Record<string, string | null>;
}

function writeSnapshotOnce(
  dir: string,
  journal: NewPiiErasureJournal,
  db: MinimalStorageDb,
): void {
  const file = newPiiErasureSnapshotPath(dir);
  // Retain the original snapshot across a retry: overwriting it with the
  // already-purged (null) rows would destroy the only rollback copy.
  if (fs.existsSync(file)) return;
  const payload: SnapshotPayload = {
    request_id: journal.request_id,
    taken_at: new Date().toISOString(),
    // These rows are plaintext PII envelopes; the rollback snapshot is sensitive.
    rows: snapshotNewPiiRows(db),
  };
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2), "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** Remove the snapshot and confirm it is gone. */
function removeSnapshot(dir: string): boolean {
  const file = newPiiErasureSnapshotPath(dir);
  try {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  } catch {
    return false;
  }
  return !fs.existsSync(file);
}

function markIncomplete(dir: string, journal: NewPiiErasureJournal): void {
  const next = applyNewPiiErasureOutcome(journal, "incomplete");
  if (next !== journal) saveNewPiiErasureJournal(dir, next);
}

/**
 * True while a pending/incomplete new-PII erase must block new PII writes.
 * Fail-closed: an unreadable/corrupt journal cannot PROVE completion.
 */
export function newPiiErasureLocksPii(dir: string): boolean {
  try {
    const journal = loadNewPiiErasureJournal(dir);
    return journal !== null && newPiiErasureBlocksPiiWrites(journal);
  } catch {
    return true;
  }
}

export interface NewPiiErasureStatus {
  active: boolean;
  available: boolean;
  blockerCodes: string[];
  state?: string;
  targets: NewPiiErasureTarget[];
}

/** Metadata-only status for the privacy screen. Never a value. */
export function newPiiErasureStatus(dir: string): NewPiiErasureStatus {
  let journal: NewPiiErasureJournal | null;
  try {
    journal = loadNewPiiErasureJournal(dir);
  } catch {
    return {
      active: true,
      available: false,
      blockerCodes: ["journal_invalid"],
      state: "invalid",
      targets: [],
    };
  }
  if (!journal) {
    return {
      active: false,
      available: true,
      blockerCodes: [],
      targets: newPiiErasureTargets(),
    };
  }
  const planOk = isExactNewPiiErasurePlan(journal.targets);
  const terminal = journal.state === "completed";
  return {
    active: !terminal,
    available: planOk,
    blockerCodes: planOk ? [] : ["plan_refused"],
    state: journal.state,
    targets: journal.targets,
  };
}

/* ------------------------------------------------------------------ */
/*  IPC registration (main process)                                    */
/* ------------------------------------------------------------------ */

/** The exact channels this operation owns. */
export const NEW_PII_ERASURE_CHANNELS = {
  authorize: "erasure:new-pii:authorize",
  claim: "erasure:new-pii:claim",
  start: "erasure:new-pii:start",
  status: "erasure:new-pii:status",
} as const;

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

/**
 * Register the exact new-namespace delete-all route.
 *
 * `profile` is an OPAQUE identifier for the profile directory; it is bound into
 * the nonce and persisted in the journal, but it is never a name, an email or a
 * device identifier. `assertTrustedSender` runs before any filesystem or SQL
 * access, so an untrusted frame cannot issue or consume a nonce.
 */
export function registerNewPiiErasureHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
  profileDir: string,
  profile: string,
): void {
  ipcMain.handle(NEW_PII_ERASURE_CHANNELS.authorize, (event) => {
    // Beta is Web-only: refuse before the sender check, the journal read and
    // any nonce minting. Per call, never cached.
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(NEW_PII_ERASURE_CHANNELS.authorize);
    }
    assertTrustedSender(event);
    return requestNewPiiErasure(profileDir, profile);
  });

  ipcMain.handle(NEW_PII_ERASURE_CHANNELS.claim, (event, token: unknown) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(NEW_PII_ERASURE_CHANNELS.claim);
    }
    assertTrustedSender(event);
    return claimNewPiiErasure(profileDir, token);
  });

  ipcMain.handle(NEW_PII_ERASURE_CHANNELS.start, (event, token: unknown) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(NEW_PII_ERASURE_CHANNELS.start);
    }
    assertTrustedSender(event);
    return runNewPiiErasure(profileDir, database.$client, token);
  });

  ipcMain.handle(NEW_PII_ERASURE_CHANNELS.status, (event) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(NEW_PII_ERASURE_CHANNELS.status);
    }
    assertTrustedSender(event);
    return newPiiErasureStatus(profileDir);
  });
}
