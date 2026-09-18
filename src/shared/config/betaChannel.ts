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
export const isBetaChannel: boolean =
  import.meta.env.VITE_BETA_CHANNEL === true;
