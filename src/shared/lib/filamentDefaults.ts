/**
 * Single-source physical filament constants (W1 — never hard-code 1.75/1.24
 * elsewhere; import from here).
 *
 * Deliberately a LEAF module (no imports): it is consumed by both
 * `gcodeTotals` and `printTimeEstimator`, and the former imports the latter —
 * declaring the constants here keeps that relationship acyclic while
 * preserving a single source of truth. `gcodeTotals` re-exports them so
 * existing import paths (`gcodeParser`, store defaults) keep working.
 */

/** Filament diameter in mm (1.75 is the de facto FDM standard). */
export const DEFAULT_FILAMENT_DIAMETER_MM = 1.75;

/**
 * PLA density in g/cm³ — matches the PLA entry of `filamentProfiles.ts`.
 * Callers that know the material resolve the density via
 * `resolveFilamentDensity` and pass it through.
 */
export const DEFAULT_FILAMENT_DENSITY_GCM3 = 1.24;
