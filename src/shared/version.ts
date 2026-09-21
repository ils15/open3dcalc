/**
 * Single source of truth for the app version.
 *
 * `__APP_VERSION__` is injected at build time by Vite's `define` block
 * (vite.base.config.ts), which reads the version straight from package.json.
 * Never hardcode a version literal anywhere in the UI or in export envelopes —
 * import this constant instead.
 */
export const APP_VERSION: string = __APP_VERSION__;
