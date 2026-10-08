/**
 * Renderer-surface purge (D1.1 S7) — SPEC-02 §3 rows 1/5/6/7.
 *
 * The former broad renderer adapters — whole-origin localStorage, IndexedDB,
 * OPFS, and Cache API + service-worker sweeps — were dead code: the bulk
 * `purgeRendererStores` entry point has been fail-closed since desktop
 * delete-all became unavailable, so no UI path ever executed them. They are
 * removed rather than retained "for isolated tests": dead broad-delete
 * primitives are an audit liability with no runtime value, and retaining them
 * is what makes a future accidental re-enable possible.
 *
 * The exact PII target plan is derived and validated in the main process
 * (`electron/erasurePolicy.ts`); the renderer cannot widen it. The entry point
 * stays fail-closed until the desktop can claim a durable, exact PII-only
 * authorization from the main process.
 */

export type Store = "localstorage" | "indexeddb" | "opfs" | "cache_api_sw";

export interface StorePurgeResult {
  store: Store;
  purged: number;
  remaining: string[];
}

/**
 * The prior bulk entry point is disabled until a durable exact-target
 * authorization can be claimed from the main process. It never deletes.
 */
export async function purgeRendererStores(
  _authorization: unknown,
): Promise<Record<Store, StorePurgeResult>> {
  void _authorization;
  throw new Error(
    "Renderer erasure is unavailable without a durable, exact PII authorization",
  );
}
