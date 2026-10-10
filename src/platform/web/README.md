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
Web-only; this does not make export, backup, or every data-management surface release-ready.
