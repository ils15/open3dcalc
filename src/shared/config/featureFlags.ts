/**
 * Build-time feature flags.
 *
 * Flags are resolved here (not read ad-hoc at call sites) so there is a single
 * place to audit what is gated, and tests can mock one module. Values are
 * inlined by Vite's `define` at build time (see `vite.base.config.ts`), so a
 * flag never ships half-resolved.
 */

/**
 * D-CL5 — the 3D G-code toolpath preview (`@chestnutlabs/gcode-preview`).
 *
 * The viewer is a brand-new, independent feature (it does NOT depend on the
 * calculation-engine migration D-CL3/4). It renders straight from the
 * chestnut IR, so the toolpath UX is not blocked by that riskier work.
 *
 * Default policy — **ON for everyone**: the feature was dogfooded through the
 * beta channel (v1.13.0-beta.1..3) and validated for the stable v1.13.0
 * release, so end users now get the viewer by default. An explicit
 * `VITE_TOOLPATH_PREVIEW` env var always wins, so any build can still opt out
 * (`VITE_TOOLPATH_PREVIEW=false`) without touching code.
 *
 * When OFF, the "Preview toolpath" entry point is not rendered at all — the
 * chunk is never even downloaded (the panel is `React.lazy`), so an OFF build
 * carries zero cost.
 */
export function isToolpathPreviewEnabled(): boolean {
  // `define` replaces this with the string literal at build time. Typed as
  // `unknown` first to keep TS strict mode honest (no `any` leak).
  const flag: unknown = import.meta.env.VITE_TOOLPATH_PREVIEW;
  return flag === "true";
}
