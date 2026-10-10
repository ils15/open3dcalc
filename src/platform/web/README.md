# Web Platform

The web app is a **React SPA + PWA** built with Vite.

## Dev

```bash
npm run dev:web    # http://localhost:5173, hot-reload
```

## Build

```bash
npm run build:web  # outputs to dist-web/
```

## PWA

- Service worker via Workbox (vite-plugin-pwa)
- Offline support, installable (add to homescreen)
- Auto-updates on new release (registerType: autoUpdate)

## Deployment

Auto-deployed to GitHub Pages on push to `main`:
**https://ils15.github.io/open3dcalc/**

Manual: `npm run build:web` + upload `dist-web/` to any static host.

## Beta local user data

Web Beta supports real customer, quote, and history data in the same plaintext localStorage keys
as Stable Web. Saving does not require a password. On first hydration, valid
records from the retired `open3dcalc_beta_test_*` keys are copied/merged to the shared keys; the
retired copies are removed only after a successful write. Local browser data is accessible to
scripts running on the same origin and to anyone with access to that browser profile. Beta is
Web-only; this does not make every data-management surface release-ready. Same-origin scripts,
browser extensions, and anyone with access to the browser profile can read the data. Local
persistence does not send it to a server.

The published `v2.0.0-beta.15` was released with the earlier synthetic-test disclosure. The
current branch changes the product direction to real local data without app-level encryption;
do not treat a merged commit as a deployed release. See the repository [ADR-004](../../../docs/privacy/ADR-004-real-data-v2.md),
[SPEC-01 V2 Candidate](../../../docs/privacy/SPEC-01-v2-candidate.md), and
[SPEC-05](../../../docs/privacy/SPEC-05-v1-to-v2-migration.md) for the target and release gates.
