/**
 * Memory-only passphrase session (D1.1 S2) — ADR-001 §2.1/§2.2, SPEC-01 key
 * `session_passphrase_key` (surface `memory`, class `ephemeral_key`).
 *
 * The session passphrase exists ONLY in process memory:
 *  - never written to disk, SQLite, localStorage, IndexedDB, or logs;
 *  - never synchronized (SPEC-01: sync: never, export: never);
 *  - zeroized on lock/exit — the stored char codes are overwritten in place.
 *
 * JS strings are immutable, so absolute zeroization is impossible once a
 * string exists; therefore the passphrase is kept as a mutable char-code
 * array and callers receive copies. This is best-effort zeroization within
 * the platform's limits — the hard guarantee is that nothing is persisted.
 */

let chars: number[] | null = null;

function copyToCharArray(source: string): number[] {
  const out: number[] = new Array(source.length);
  for (let i = 0; i < source.length; i++) out[i] = source.charCodeAt(i);
  return out;
}

/** Store a session passphrase (replaces any previous one, zeroizing it). */
export function setSessionPassphrase(passphrase: string): void {
  if (chars !== null) chars.fill(0);
  chars = copyToCharArray(passphrase);
}

/** True only while a passphrase is held in memory. */
export function hasSessionPassphrase(): boolean {
  return chars !== null && chars.length > 0;
}

/**
 * Return the session passphrase, or null. Callers MUST NOT retain or log
 * the returned string (tests assert logs stay passphrase-free).
 */
export function getSessionPassphrase(): string | null {
  if (chars === null) return null;
  return String.fromCharCode(...chars);
}

/** Zeroize the session passphrase (lock/exit). Irreversible. */
export function zeroizeSessionPassphrase(): void {
  if (chars !== null) {
    chars.fill(0);
    chars = null;
  }
}

/** Test-only: assert the internal buffer is really gone. */
export function isSessionZeroizedForTests(): boolean {
  return chars === null;
}
