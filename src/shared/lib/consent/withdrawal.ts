/**
 * Receipt-scoped withdrawal journal (Beta12 minimum Desktop scope).
 *
 * ## Why a journal and not just an annotated receipt
 *
 * SPEC-04 §6 withdrawal must be RECEIPT-SCOPED (it targets exactly the data a
 * receipt authorized) and DURABLE BEFORE any purge: if the process dies after
 * the first destructive step, the operation has to be resumable and its
 * completion state must not depend on the renderer surviving. The annotated
 * receipt is the user's consent record; it is not a purge journal.
 *
 * This module is the pure contract. It carries NO PII and NO key material:
 * every field is an opaque identifier, a policy name, an exact target, a
 * timestamp, or a state. The disk adapter (main process) and the renderer both
 * build on these functions, so validation and the one-use nonce rule cannot
 * drift between them.
 *
 * ## Fail-closed
 *
 * `verifyWithdrawalClaim` refuses anything it cannot bind exactly: an expired
 * request, a replayed nonce, or a claim whose operation/profile/targets differ
 * from the journal's. There is no "close enough" path.
 */

export type WithdrawalState = "pending" | "incomplete" | "completed";

/** One exact target the withdrawal may touch. No prefixes, no wildcards. */
export interface WithdrawalTarget {
  surface: string;
  id: string;
}

export interface WithdrawalJournal {
  request_id: string;
  operation: "withdraw_consent";
  /** Opaque profile identifier — never a name, email or device identifier. */
  profile: string;
  /** Exact, sorted, de-duplicated targets. */
  targets: WithdrawalTarget[];
  /** Opaque receipt id the withdrawal is scoped to. */
  receipt_id: string;
  issued_at: string;
  expires_at: string;
  /** One-use nonce, presented by a trusted verification. */
  nonce: string;
  /** Set once the nonce is consumed; makes the claim one-use. */
  claimed_nonce: string | null;
  state: WithdrawalState;
  attempts: number;
}

export interface WithdrawalClaim {
  nonce: string;
  operation: "withdraw_consent";
  profile: string;
  targets: WithdrawalTarget[];
}

export type WithdrawalClaimRejection =
  "expired" | "already_claimed" | "binding_mismatch";

export type WithdrawalClaimResult =
  { ok: true } | { ok: false; reason: WithdrawalClaimRejection };

const OPERATION = "withdraw_consent";
const STATES: readonly WithdrawalState[] = [
  "pending",
  "incomplete",
  "completed",
];
const ALLOWED_KEYS = new Set([
  "request_id",
  "operation",
  "profile",
  "targets",
  "receipt_id",
  "issued_at",
  "expires_at",
  "nonce",
  "claimed_nonce",
  "state",
  "attempts",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTarget(value: unknown): value is WithdrawalTarget {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    isNonEmptyString(value.surface) &&
    isNonEmptyString(value.id)
  );
}

function targetKey(target: WithdrawalTarget): string {
  return `${target.surface}\0${target.id}`;
}

function normalizeTargets(
  targets: readonly WithdrawalTarget[],
): WithdrawalTarget[] {
  return [...targets]
    .map((target) => ({ surface: target.surface, id: target.id }))
    .sort(
      (a, b) => a.surface.localeCompare(b.surface) || a.id.localeCompare(b.id),
    );
}

function targetsMatch(
  a: readonly WithdrawalTarget[],
  b: readonly WithdrawalTarget[],
): boolean {
  const left = normalizeTargets(a);
  const right = normalizeTargets(b);
  return (
    left.length === right.length &&
    left.every((target, index) => targetKey(target) === targetKey(right[index]))
  );
}

export interface CreateWithdrawalJournalInput {
  requestId: string;
  profile: string;
  targets: readonly WithdrawalTarget[];
  receiptId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Build a pending journal. Throws on an invalid input: a malformed request
 * must never become a durable record.
 */
export function createWithdrawalJournal(
  input: CreateWithdrawalJournalInput,
): WithdrawalJournal {
  if (!isNonEmptyString(input.requestId)) {
    throw new Error("withdrawal requestId must be a non-empty string");
  }
  if (!isNonEmptyString(input.profile)) {
    throw new Error("withdrawal profile must be a non-empty string");
  }
  if (!isNonEmptyString(input.receiptId)) {
    throw new Error("withdrawal receiptId must be a non-empty string");
  }
  if (!isNonEmptyString(input.nonce)) {
    throw new Error("withdrawal nonce must be a non-empty string");
  }
  if (input.targets.length === 0 || !input.targets.every(isTarget)) {
    throw new Error("withdrawal targets must be a non-empty target list");
  }
  const normalized = [
    ...new Map(
      normalizeTargets(input.targets).map((target) => [
        targetKey(target),
        target,
      ]),
    ).values(),
  ];
  if (
    !isIsoTimestamp(input.issuedAt) ||
    !isIsoTimestamp(input.expiresAt) ||
    Date.parse(input.expiresAt) <= Date.parse(input.issuedAt)
  ) {
    throw new Error("withdrawal timestamps must be an increasing ISO interval");
  }
  return {
    request_id: input.requestId,
    operation: OPERATION,
    profile: input.profile,
    targets: normalized,
    receipt_id: input.receiptId,
    issued_at: input.issuedAt,
    expires_at: input.expiresAt,
    nonce: input.nonce,
    claimed_nonce: null,
    state: "pending",
    attempts: 0,
  };
}

/** Strict structural validation of a persisted journal. */
export function isValidWithdrawalJournal(
  value: unknown,
): value is WithdrawalJournal {
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((key) => ALLOWED_KEYS.has(key))) return false;
  if (!isNonEmptyString(value.request_id)) return false;
  if (value.operation !== OPERATION) return false;
  if (!isNonEmptyString(value.profile)) return false;
  if (!isNonEmptyString(value.receipt_id)) return false;
  if (!isNonEmptyString(value.nonce)) return false;
  if (value.claimed_nonce !== null && !isNonEmptyString(value.claimed_nonce)) {
    return false;
  }
  if (!isIsoTimestamp(value.issued_at) || !isIsoTimestamp(value.expires_at)) {
    return false;
  }
  if (Date.parse(value.expires_at) <= Date.parse(value.issued_at)) return false;
  if (!STATES.includes(value.state as WithdrawalState)) return false;
  if (!Number.isSafeInteger(value.attempts) || (value.attempts as number) < 0) {
    return false;
  }
  if (!Array.isArray(value.targets) || value.targets.length === 0) return false;
  if (!value.targets.every(isTarget)) return false;
  const keys = value.targets.map((target) => targetKey(target));
  if (new Set(keys).size !== keys.length) return false;
  return true;
}

/** True when `now` is at or after `expires_at`. */
export function isWithdrawalExpired(
  journal: WithdrawalJournal,
  now: Date,
): boolean {
  return now.getTime() >= Date.parse(journal.expires_at);
}

/**
 * Verify a trusted claim against the journal WITHOUT mutating it.
 *
 * Order matters: expiry and replay are checked before the binding comparison,
 * so a replayed claim on an expired request reports the more specific
 * `already_claimed` only when it was actually claimed.
 */
export function verifyWithdrawalClaim(
  journal: WithdrawalJournal,
  claim: WithdrawalClaim,
  now: Date,
): WithdrawalClaimResult {
  if (isWithdrawalExpired(journal, now)) {
    return { ok: false, reason: "expired" };
  }
  if (journal.claimed_nonce !== null) {
    return { ok: false, reason: "already_claimed" };
  }
  if (
    claim.operation !== journal.operation ||
    claim.profile !== journal.profile ||
    claim.nonce !== journal.nonce ||
    !targetsMatch(claim.targets, journal.targets)
  ) {
    return { ok: false, reason: "binding_mismatch" };
  }
  return { ok: true };
}

/**
 * Apply an outcome idempotently.
 *
 * `completed` is terminal: a late `incomplete` result (a retry that raced the
 * completion) can never reopen a completed withdrawal. Re-applying the current
 * state changes nothing, so a resumed pass is a no-op.
 */
export function applyWithdrawalOutcome(
  journal: WithdrawalJournal,
  outcome: "incomplete" | "completed",
): WithdrawalJournal {
  if (journal.state === "completed") return journal;
  if (journal.state === outcome) return journal;
  return { ...journal, state: outcome, attempts: journal.attempts + 1 };
}

/**
 * Whether new PII writes must be blocked while this journal exists.
 *
 * Only a verifiably COMPLETED withdrawal releases the lock. `pending` and
 * `incomplete` both block: an interrupted erasure is exactly when new PII must
 * not be written into a half-erased surface.
 */
export function withdrawalBlocksPiiWrites(journal: WithdrawalJournal): boolean {
  return journal.state !== "completed";
}
