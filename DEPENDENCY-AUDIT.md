# Dependency audit

Audit run on 2026-07-31 with `npm audit --omit=optional` after the safe
`npm audit fix` pass: 23 residual findings (19 high, 4 moderate, no critical).

- `@electron/rebuild` was migrated from deprecated `electron-rebuild@3` to
  `@electron/rebuild@4`; this removes its vulnerable `node-gyp`/`tar` chain
  and keeps the existing `electron-rebuild` command.
- Remaining findings are transitive development/build-tool findings:
  Electron Builder's `@electron/asar`/`glob`/`minimatch` chain
  (`brace-expansion`) and Drizzle Kit's legacy `@esbuild-kit` chain (`esbuild`).
  npm offers only breaking downgrades (`electron-rebuild@2` and
  `drizzle-kit@0.18`) rather than compatible fixes; neither was applied.
- npm also reports the direct `vite-plugin-pwa` finding and its transitive
  `workbox-build` chain. `workbox-build` brings in
  `@trickfilm400/rollup-plugin-off-main-thread`, which reaches the vulnerable
  `ejs` dependency. npm reports a compatible fix is available, but does not
  identify a non-breaking version in this audit result. These packages remain
  pinned by the current lockfile and are recorded here rather than silently
  removed or force-upgraded.
- CI runs the audit explicitly with `--audit-level=critical`, so any future
  critical finding fails the gate. High/moderate residual build-only findings
  remain visible and are not hidden with `|| true`.

Revisit this exception when compatible Electron Builder or Drizzle Kit releases
remove the transitive advisories. Do not use `npm audit fix --force` blindly.
