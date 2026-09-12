/**
 * Shipped SPEC-01 manifest (D1.1 S1/S3).
 *
 * Splits the fixture loading away from the pure validation module so the
 * Electron main process can consume the pure half (`dataManifest.ts`)
 * without pulling an ESM JSON import (which node16 output cannot execute).
 * The renderer keeps using this module (bundler-inlined fixture); the main
 * process reads the SAME fixture file via fs (single source of truth).
 */

import manifestFixture from "../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  getPolicyVersion,
  loadManifest,
  type ManifestDocument,
  type ManifestIndex,
} from "./dataManifest";

/** The shipped SPEC-01 fixture as a validated runtime index. */
export function loadShippedManifest(): ManifestIndex {
  return loadManifest(manifestFixture as ManifestDocument);
}

/** Policy version of the shipped fixture. */
export function getShippedPolicyVersion(): string {
  return getPolicyVersion(manifestFixture as ManifestDocument);
}

/** The raw shipped fixture document (renderer/bundler context only). */
export const shippedManifestDocument = manifestFixture as ManifestDocument;
