/**
 * The DISJOINT new-PII key namespace for the Desktop passwordless path
 * (Beta12 Phase3) — ADR-001 §3.4, owner decision
 * `beta12-minimum-desktop-no-recovery-code`.
 *
 * ## Why a new namespace instead of the legacy keys
 *
 * The three migrated PII keys a Beta profile already has on disk are
 * `open3dcalc_customers_v1`, `open3dcalc_quotes_v1` and
 * `open3dcalc_history_v2`. They may hold PRE-remediation shapes
 * (`enc1:safeStorage:` — raw keyring output bound to nothing, or a `v: "1.1"`
 * self-asserted envelope). The Beta12 rule is explicit and load-bearing:
 * existing Beta PII is never read, re-sealed or deleted, and there is no
 * converter.
 *
 * If the new passwordless path reused those names it would silently ALIAS the
 * old rows: a `load` would read a legacy shape, a `save` would overwrite it,
 * and a reader that failed to open the old value could not tell "this row is
 * from a build I no longer support" from "this row is mine". A disjoint
 * namespace makes that alias structurally impossible: a legacy row has a
 * legacy key, and the new route rejects every key it does not own before it
 * touches storage.
 *
 * ## Exact allowlist, not a prefix rule
 *
 * `open3dcalc_pwless_invented_v9` is refused: the route authorises a fixed set
 * of records, so "add PII here" is a deliberate code change and review, not a
 * string a caller invents. `NEW_PII_KEY_PREFIX` is documentation and a cheap
 * negative classifier; it is NOT the authoriser.
 *
 * This module is pure (no `electron`, no DOM) because it is shared: the
 * Electron main process authorises the route with it, and the Desktop renderer
 * names its store keys with it.
 */

/** The namespace prefix. Every authorised key starts with it. */
export const NEW_PII_KEY_PREFIX = "open3dcalc_pwless_";

/**
 * The exact records the passwordless route owns. One per PII domain so a
 * future split is a code change here, not a new prefix.
 */
export const NEW_PII_STORAGE_KEYS = [
  "open3dcalc_pwless_customers_v1",
  "open3dcalc_pwless_quotes_v1",
  "open3dcalc_pwless_history_v1",
] as const;

export type NewPiiStorageKey = (typeof NEW_PII_STORAGE_KEYS)[number];

const NEW_PII_KEY_SET: ReadonlySet<string> = new Set(NEW_PII_STORAGE_KEYS);

/** The three PII domains the passwordless route persists, by logical name. */
export type NewPiiDomain = "customers" | "quotes" | "history";

/**
 * Logical domain → authorised key. The renderer names a domain; only this
 * table decides the storage key, so a caller cannot invent one.
 */
export const NEW_PII_DOMAIN_KEYS: Readonly<
  Record<NewPiiDomain, NewPiiStorageKey>
> = {
  customers: "open3dcalc_pwless_customers_v1",
  quotes: "open3dcalc_pwless_quotes_v1",
  history: "open3dcalc_pwless_history_v1",
};

/**
 * True only for an exact authorised key. The authoriser for the route: an
 * unauthorised key means the caller must be refused BEFORE any read or write.
 */
export function isNewPiiStorageKey(key: unknown): key is NewPiiStorageKey {
  return typeof key === "string" && NEW_PII_KEY_SET.has(key);
}

/**
 * True for anything inside the namespace, including a not-yet-authorised name.
 *
 * Used for diagnostics and for the generic `db:*` denial, where the point is
 * "this key belongs to the new-PII route, not the generic store" — a
 * prefix-only key must still be denied there even though the route itself
 * refuses it.
 */
export function isNewPiiNamespaceKey(key: unknown): key is string {
  return typeof key === "string" && key.startsWith(NEW_PII_KEY_PREFIX);
}

/** Raised when a caller presents a key the new-PII route does not own. */
export class NewPiiKeyRefusedError extends Error {
  readonly code = "new_pii_key_refused";
  constructor() {
    super(
      "[newPiiNamespace] storage key is not an authorised new-PII key — refusing before storage",
    );
    this.name = "NewPiiKeyRefusedError";
  }
}

/** Assert an exact authorised key, or throw `NewPiiKeyRefusedError`. */
export function assertNewPiiStorageKey(
  key: unknown,
): asserts key is NewPiiStorageKey {
  if (!isNewPiiStorageKey(key)) throw new NewPiiKeyRefusedError();
}
