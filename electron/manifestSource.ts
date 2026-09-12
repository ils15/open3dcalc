/**
 * Main-process manifest source (D1.1 S3).
 *
 * Reads the SAME SPEC-01 fixture file the renderer bundles (single source
 * of truth) via fs — node16 ESM output cannot execute a static JSON import.
 * Candidates cover the dev run (repo root), the packaged app (fixture added
 * to the asar via electron-builder `files`), and the compiled self-test.
 * Fail-closed: if the fixture cannot be read, the caller denies every key.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadManifest,
  type ManifestIndex,
} from "../src/shared/lib/dataManifest.js";

let cached: ManifestIndex | null = null;

export function fixtureCandidatePaths(): string[] {
  const fixtureRelative = path.join(
    "docs",
    "privacy",
    "SPEC-01-manifest-fixture.json",
  );
  const here = path.dirname(fileURLToPath(import.meta.url));
  // electron/dist/electron/<dir>/file.js → repo root is 3 levels up.
  const compiledDir = path.resolve(here, "../../..");
  return [
    path.resolve(compiledDir, fixtureRelative),
    // Source-context runs (vitest) resolve from the working directory.
    path.join(process.cwd(), fixtureRelative),
    path.join(process.resourcesPath ?? "", fixtureRelative),
  ];
}

/** Load and cache the manifest index from disk. Throws when unreadable. */
export function loadManifestFromDisk(): ManifestIndex {
  if (cached) return cached;
  const errors: string[] = [];
  for (const candidate of fixtureCandidatePaths()) {
    try {
      const doc = JSON.parse(fs.readFileSync(candidate, "utf8"));
      cached = loadManifest(doc);
      return cached;
    } catch (error) {
      errors.push(
        `${candidate}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  // Key NAMES only — never values (there are no values here anyway).
  throw new Error(
    `[manifestSource] fixture unreadable (${errors.join(" | ")})`,
  );
}

/** Test-only: drop the cached index. */
export function resetManifestCacheForTests(): void {
  cached = null;
}
