/**
 * Beta-channel feature flag.
 *
 * Replaced at build time by Vite's `define` (see `vite.base.config.ts`):
 * `true` only when the build sets `VITE_BETA_CHANNEL=true` (beta-deploy
 * workflow), `false` in stable releases.
 *
 * Extracted into a module (rather than read inline in components) so that it
 * can be mocked deterministically in tests — `define` statically inlines the
 * value, which makes `import.meta.env` stubbing unreliable.
 */

// The Electron main-process TypeScript project deliberately excludes
// `vite/client`, but compiles shared storage contracts that import this tiny flag.
// Merge only the field used by the build so the module remains type-safe there.
declare global {
  interface ImportMetaEnv {
    readonly VITE_BETA_CHANNEL?: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const isBetaChannel: boolean =
  import.meta.env.VITE_BETA_CHANNEL === true;
