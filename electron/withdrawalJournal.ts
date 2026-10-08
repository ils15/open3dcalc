/**
 * Durable receipt-scoped withdrawal journal (Desktop, main process).
 *
 * The journal is metadata-only and every write is ATOMIC (write-temp + fsync +
 * rename), so a crash can never leave a torn record. It is persisted BEFORE
 * any purge; a failed or unverifiable purge leaves the journal in the
 * `incomplete` state and keeps the PII lock engaged, so the operation never
 * reports a completion it cannot prove.
 *
 * This deliberately does NOT touch legacy Beta rows: the request is scoped to
 * its exact targets, and no adapter here deletes anything.
 */

import fs from "node:fs";
import path from "node:path";
import {
  applyWithdrawalOutcome,
  createWithdrawalJournal,
  isValidWithdrawalJournal,
  verifyWithdrawalClaim,
  withdrawalBlocksPiiWrites,
  type CreateWithdrawalJournalInput,
  type WithdrawalClaim,
  type WithdrawalClaimRejection,
  type WithdrawalJournal,
} from "../src/shared/lib/consent/withdrawal.js";

export class WithdrawalJournalError extends Error {
  constructor(message: string) {
    super(`[withdrawalJournal] ${message}`);
    this.name = "WithdrawalJournalError";
  }
}

export function withdrawalJournalPath(dir: string): string {
  return path.join(dir, "withdrawal-journal.json");
}

/** Load the journal, or null when none exists. Throws on invalid bytes. */
export function loadWithdrawalJournal(dir: string): WithdrawalJournal | null {
  const file = withdrawalJournalPath(dir);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isValidWithdrawalJournal(parsed)) {
      throw new Error("invalid journal");
    }
    return parsed;
  } catch {
    // Do not echo untrusted bytes. The caller preserves the file.
    throw new WithdrawalJournalError(
      "journal invalid or unreadable; preserved",
    );
  }
}

function saveWithdrawalJournal(dir: string, journal: WithdrawalJournal): void {
  fs.mkdirSync(dir, { recursive: true });
  const file = withdrawalJournalPath(dir);
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

/**
 * Persist a pending withdrawal request, or return the existing one.
 *
 * Idempotent by `request_id`. A DIFFERENT request while one is pending is
 * refused: overwriting the pending journal would lose the only durable record
 * of an operation that may already have touched a surface.
 */
export function requestWithdrawal(
  dir: string,
  input: CreateWithdrawalJournalInput,
): WithdrawalJournal {
  const existing = loadWithdrawalJournal(dir);
  if (existing) {
    if (existing.request_id === input.requestId) return existing;
    throw new WithdrawalJournalError(
      "a different withdrawal request is already pending; refusing to overwrite it",
    );
  }
  const journal = createWithdrawalJournal(input);
  saveWithdrawalJournal(dir, journal);
  return journal;
}

export type WithdrawalVerificationResult =
  | { ok: true; journal: WithdrawalJournal }
  | { ok: false; reason: WithdrawalClaimRejection };

/**
 * Verify a trusted claim and consume its one-use nonce.
 *
 * A failed verification NEVER rewrites the journal, so a replay or a
 * mis-bound claim cannot advance the operation.
 */
export function claimWithdrawalVerification(
  dir: string,
  claim: WithdrawalClaim,
  now: Date,
): WithdrawalVerificationResult {
  const journal = loadWithdrawalJournal(dir);
  if (!journal) return { ok: false, reason: "binding_mismatch" };
  const verdict = verifyWithdrawalClaim(journal, claim, now);
  if (!verdict.ok) return verdict;
  const claimed: WithdrawalJournal = {
    ...journal,
    claimed_nonce: claim.nonce,
  };
  saveWithdrawalJournal(dir, claimed);
  return { ok: true, journal: claimed };
}

/**
 * Record that a purge attempt could not be verified. Idempotent; never
 * downgrades a completed journal.
 */
export function markWithdrawalIncomplete(
  dir: string,
  requestId: string,
): WithdrawalJournal {
  const journal = loadWithdrawalJournal(dir);
  if (!journal || journal.request_id !== requestId) {
    throw new WithdrawalJournalError("withdrawal request not found");
  }
  const next = applyWithdrawalOutcome(journal, "incomplete");
  if (next !== journal) saveWithdrawalJournal(dir, next);
  return next;
}

/**
 * Record a verified completion. Terminal and idempotent by construction
 * (`applyWithdrawalOutcome`): a completed journal is never rewritten, so a
 * resumed pass cannot re-purge, cannot downgrade, and cannot advance a record
 * that a restart already settled. The lock releases only after this write is
 * durable, because `withdrawalLocksPii` reads the journal from disk.
 *
 * Called by the main process once the purge postcondition is independently
 * verified; it is the disk half of the completion the restart proof exercises.
 */
export function completeWithdrawal(
  dir: string,
  requestId: string,
): WithdrawalJournal {
  const journal = loadWithdrawalJournal(dir);
  if (!journal || journal.request_id !== requestId) {
    throw new WithdrawalJournalError("withdrawal request not found");
  }
  const next = applyWithdrawalOutcome(journal, "completed");
  if (next !== journal) saveWithdrawalJournal(dir, next);
  return next;
}

/** True while a pending/incomplete withdrawal must block new PII writes. */
export function withdrawalLocksPii(dir: string): boolean {
  const journal = loadWithdrawalJournal(dir);
  return journal !== null && withdrawalBlocksPiiWrites(journal);
}
