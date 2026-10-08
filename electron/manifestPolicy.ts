import {
  type ManifestEntry,
  type ManifestIndex,
  getEntry,
  isKnownKey,
} from "../src/shared/lib/dataManifest.js";
import { loadManifestFromDisk } from "./manifestSource.js";

export type PolicyRefusalReason = "unknown_key" | "manifest_unavailable";

export type KeyPolicy =
  | { allowed: true; entry: ManifestEntry }
  | { allowed: false; reason: PolicyRefusalReason };

/** Manifest policy for a key, failing closed when the manifest cannot be read. */
export function resolveKeyPolicy(key: string): KeyPolicy {
  let manifest: ManifestIndex;
  try {
    manifest = loadManifestFromDisk();
  } catch {
    return { allowed: false, reason: "manifest_unavailable" };
  }
  if (!isKnownKey(manifest, key)) {
    return { allowed: false, reason: "unknown_key" };
  }
  return { allowed: true, entry: getEntry(manifest, key)! };
}
