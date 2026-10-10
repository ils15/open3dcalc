/**
 * Durable, PII-free journal contract for the EXACT new-namespace delete-all
 * (Beta12 follow-up) — the pure half of `electron/newPiiErasure.ts`.
 *
 * ## Why a second journal and not the consent-withdrawal one
 *
 * `src/shared/lib/consent/withdrawal.ts` is RECEIPT-SCOPED: it carries a
 * `receipt_id` and its operation is the literal `withdraw_consent`. Delete-all
 * is a different request with a different authorisation — no receipt, a fixed
 * exact target set — so reusing that journal would either force a synthetic
 * receipt onto a delete-all or widen the withdrawal contract. Both are worse
 * than one small, dedicated contract.
 *
 * This module carries NO PII and NO key material: every field is an opaque
 * identifier, an exact target, a timestamp, or a state. It is pure (no
 * `electron`, no DOM) so the main process, a future renderer confirmation, and
 * standalone test drivers all build on the same validation.
 *
 * ## Fail-closed
 *
 * The plan is the EXACT three new-namespace rows — no prefixes, no wildcards,
 * no legacy key, no domain table. `isExactNewPiiErasurePlan` refuses anything
 * else, and `verifyNewPiiErasureClaim` refuses an expired request, a replayed
 * nonce, or a claim whose operation/profile/targets differ from the journal's.
 * There is no "close enough" path.
 */

import { NEW_PII_STORAGE_KEYS, isNewPiiStorageKey } from "./newPiiNamespace.js";

/** The only operation this journal authorises. */
export const NEW_PII_ERASURE_OPERATION = "delete_all_new_pii" as const;

export type NewPiiErasureState = "pending" | "incomplete" | "completed";

/** The exact storage surface the new-namespace rows live on. */
export const NEW_PII_ERASURE_SURFACE = "sqlite_storage_table" as const;

/** One exact target the delete-all may touch. No prefixes, no wildcards. */
export interface NewPiiErasureTarget {
  surface: string;
  id: string;
}

/**
 * The exact, ordered target plan: one row per authorised new-PII key, on the
 * one storage surface the route writes to.
 */
export function newPiiErasureTargets(): NewPiiErasureTarget[] {
  return NEW_PII_STORAGE_KEYS.map((id) => ({
    surface: NEW_PII_ERASURE_SURFACE,
    id,
  }));
}

/**
 * The authorised key a target names, or `null` when it names anything else.
 *
 * A legacy key, a domain table, a prefix-only invented name and a foreign
 * surface all resolve to `null` — which is what makes a mixed/legacy plan fail
 * closed rather than being silently dropped from the purge.
 */
export function newPiiErasureKeyForTarget(
  target: NewPiiErasureTarget,
): string | null {
  return target.surface === NEW_PII_ERASURE_SURFACE &&
    isNewPiiStorageKey(target.id)
    ? target.id
    : null;
}

/**
 * True only for the COMPLETE exact plan: all three authorised keys, on the
 * exact surface, with no duplicate and no extra.
 */
export function isExactNewPiiErasurePlan(
  targets: readonly NewPiiErasureTarget[],
): boolean {
  if (!Array.isArray(targets)) return false;
  if (targets.length !== NEW_PII_STORAGE_KEYS.length) return false;
  const keys = new Set<string>();
  for (const target of targets) {
    const key = newPiiErasureKeyForTarget(target);
    if (key === null) return false;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return NEW_PII_STORAGE_KEYS.every((key) => keys.has(key));
}

export interface NewPiiErasureJournal {
  request_id: string;
  operation: typeof NEW_PII_ERASURE_OPERATION;
  /** Opaque profile identifier — never a name, email or device identifier. */
  profile: string;
  /** Exact, sorted, de-duplicated targets. */
  targets: NewPiiErasureTarget[];
  issued_at: string;
  expires_at: string;
  /** One-use nonce, presented by a trusted verification. */
  nonce: string;
  /** Set once the nonce is consumed; makes the claim one-use. */
  claimed_nonce: string | null;
  state: NewPiiErasureState;
  attempts: number;
  /** Set when the erase reaches `completed`; makes the retry receipt stable. */
  completed_at: string | null;
}

export interface NewPiiErasureClaim {
  nonce: string;
  operation: typeof NEW_PII_ERASURE_OPERATION;
  profile: string;
  targets: NewPiiErasureTarget[];
}

export type NewPiiErasureClaimRejection =
  "expired" | "already_claimed" | "binding_mismatch";

export type NewPiiErasureClaimResult =
  { ok: true } | { ok: false; reason: NewPiiErasureClaimRejection };

const STATES: readonly NewPiiErasureState[] = [
  "pending",
  "incomplete",
  "completed",
];
const ALLOWED_KEYS = new Set([
  "request_id",
  "operation",
  "profile",
  "targets",
  "issued_at",
  "expires_at",
  "nonce",
  "claimed_nonce",
  "state",
  "attempts",
  "completed_at",
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

function isTarget(value: unknown): value is NewPiiErasureTarget {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    isNonEmptyString(value.surface) &&
    isNonEmptyString(value.id)
  );
}

function targetKey(target: NewPiiErasureTarget): string {
  return `${target.surface}\0${target.id}`;
}

function normalizeTargets(
  targets: readonly NewPiiErasureTarget[],
): NewPiiErasureTarget[] {
  return [...targets]
    .map((target) => ({ surface: target.surface, id: target.id }))
    .sort(
      (a, b) => a.surface.localeCompare(b.surface) || a.id.localeCompare(b.id),
    );
}

function targetsMatch(
  a: readonly NewPiiErasureTarget[],
  b: readonly NewPiiErasureTarget[],
): boolean {
  const left = normalizeTargets(a);
  const right = normalizeTargets(b);
  return (
    left.length === right.length &&
    left.every((target, index) => targetKey(target) === targetKey(right[index]))
  );
}

export interface CreateNewPiiErasureJournalInput {
  requestId: string;
  profile: string;
  targets: readonly NewPiiErasureTarget[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Build a pending journal. Throws on an invalid input or a plan that is not the
 * exact three-key set: a malformed request must never become a durable record.
 */
export function createNewPiiErasureJournal(
  input: CreateNewPiiErasureJournalInput,
): NewPiiErasureJournal {
  if (!isNonEmptyString(input.requestId)) {
    throw new Error("new-PII erasure requestId must be a non-empty string");
  }
  if (!isNonEmptyString(input.profile)) {
    throw new Error("new-PII erasure profile must be a non-empty string");
  }
  if (!isNonEmptyString(input.nonce)) {
    throw new Error("new-PII erasure nonce must be a non-empty string");
  }
  if (!Array.isArray(input.targets) || !input.targets.every(isTarget)) {
    throw new Error("new-PII erasure targets must be a non-empty target list");
  }
  if (!isExactNewPiiErasurePlan(input.targets)) {
    throw new Error(
      "new-PII erasure targets must be exactly the authorised new-PII keys",
    );
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
    throw new Error(
      "new-PII erasure timestamps must be an increasing ISO interval",
    );
  }
  return {
    request_id: input.requestId,
    operation: NEW_PII_ERASURE_OPERATION,
    profile: input.profile,
    targets: normalized,
    issued_at: input.issuedAt,
    expires_at: input.expiresAt,
    nonce: input.nonce,
    claimed_nonce: null,
    state: "pending",
    attempts: 0,
    completed_at: null,
  };
}

/** Strict structural validation of a persisted journal. */
export function isValidNewPiiErasureJournal(
  value: unknown,
): value is NewPiiErasureJournal {
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((key) => ALLOWED_KEYS.has(key))) return false;
  if (!isNonEmptyString(value.request_id)) return false;
  if (value.operation !== NEW_PII_ERASURE_OPERATION) return false;
  if (!isNonEmptyString(value.profile)) return false;
  if (!isNonEmptyString(value.nonce)) return false;
  if (value.claimed_nonce !== null && !isNonEmptyString(value.claimed_nonce)) {
    return false;
  }
  if (!isIsoTimestamp(value.issued_at) || !isIsoTimestamp(value.expires_at)) {
    return false;
  }
  if (Date.parse(value.expires_at) <= Date.parse(value.issued_at)) return false;
  if (!STATES.includes(value.state as NewPiiErasureState)) return false;
  if (!Number.isSafeInteger(value.attempts) || (value.attempts as number) < 0) {
    return false;
  }
  if (value.completed_at !== null && !isIsoTimestamp(value.completed_at)) {
    return false;
  }
  if (!Array.isArray(value.targets) || value.targets.length === 0) return false;
  if (!value.targets.every(isTarget)) return false;
  const keys = value.targets.map((target) => targetKey(target));
  if (new Set(keys).size !== keys.length) return false;
  return true;
}

/** True when `now` is at or after `expires_at`. */
export function isNewPiiErasureExpired(
  journal: NewPiiErasureJournal,
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
export function verifyNewPiiErasureClaim(
  journal: NewPiiErasureJournal,
  claim: NewPiiErasureClaim,
  now: Date,
): NewPiiErasureClaimResult {
  if (isNewPiiErasureExpired(journal, now)) {
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
 * Apply an outcome idempotently. `completed` is terminal: a late `incomplete`
 * result (a retry that raced the completion) can never reopen it.
 */
export function applyNewPiiErasureOutcome(
  journal: NewPiiErasureJournal,
  outcome: "incomplete" | "completed",
  completedAt?: string,
): NewPiiErasureJournal {
  if (journal.state === "completed") return journal;
  if (journal.state === outcome) return journal;
  return {
    ...journal,
    state: outcome,
    attempts: journal.attempts + 1,
    completed_at:
      outcome === "completed"
        ? (completedAt ?? journal.completed_at)
        : journal.completed_at,
  };
}

/**
 * Whether new PII writes must be blocked while this journal exists. Only a
 * verifiably COMPLETED journal releases the lock; `pending` and `incomplete`
 * both block.
 */
export function newPiiErasureBlocksPiiWrites(
  journal: NewPiiErasureJournal,
): boolean {
  return journal.state !== "completed";
}
