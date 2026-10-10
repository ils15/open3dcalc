/**
 * The latch for classes of stored data that exist but could not be read.
 *
 * ## Why this is its own module
 *
 * The signal has to be readable by the component that renders it, and that
 * component is mounted by the same module tree that runs the bridge. Putting
 * the latch in the bridge meant the component imported the bridge to read it —
 * and the bridge is exactly the module a test mocks when it is testing the
 * entry point's rejection path. So every such test's mock became incomplete by
 * a dependency nobody asked for, and three of them went red on a
 * `No "getUnavailableClasses" export is defined on the … mock`.
 *
 * The dependency direction is the fix, and it is the only one: a leaf module
 * that imports nothing from the bridge or `electron`, which BOTH
 * the bridge (writer) and the component (reader) depend on. Neither knows about
 * the other, so a mock of either is still complete. This module has no imports
 * at all, by design — see the header of each function for what that rules out.
 */

/** One key the app could not open, with a safe diagnostic code. */
export interface UnavailableEntry {
  key: string;
  reason: string;
}

/**
 * The last reported set, latched.
 *
 * NECESSARY, not belt-and-braces: the bridge raises this during
 * `initPersistenceBridge()`, which the desktop entry awaits BEFORE it renders
 * anything. The signal therefore fires with no subscriber mounted, and a
 * listener alone would subscribe to an event that has already happened. The
 * latch is how the signal survives the gap between "raised" and "listened".
 */
let latched: UnavailableEntry[] = [];

/** Called by the bridge, after it has isolated the unreadable keys. */
export function latchUnavailableClasses(entries: UnavailableEntry[]): void {
  latched = entries;
}

/** Read by the banner on mount. Returns the current set, possibly empty. */
export function getUnavailableClasses(): readonly UnavailableEntry[] {
  return latched;
}

/**
 * Test-only: forget the latch.
 *
 * Module state that outlives a test is a cross-test leak, and this latch is
 * exactly that — a profile with an unreadable key in one spec would otherwise
 * put a banner on screen in the next.
 */
export function resetUnavailableClassesForTests(): void {
  latched = [];
}
