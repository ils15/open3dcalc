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

## Approved Beta test-only profile (Waves 1–3 implemented on this branch)

The approved strip-down is Web-Beta-only and permits plaintext localStorage for exactly
three synthetic test-data keys: `open3dcalc_beta_test_customers_v1`,
`open3dcalc_beta_test_quotes_v1`, and `open3dcalc_beta_test_history_v1`. Never enter real
customer, quote, or history information. The Beta profile has no consent/password gate,
vault, migration, erasure/reset, import/export, sync, or backup; use a disposable browser
profile and clear it outside the app. Stable keys stay isolated even though Stable and Beta
share an origin (same-origin isolation is verified by the Wave 3 browser suite). Waves 1–3
are implemented and tested on this branch; Stable and Desktop contracts are unchanged.
Desktop is not a Beta target.

This documents the released Beta behavior only. The product direction for the next candidate
has since changed: real data, encrypted local persistence, and an explicit V1→V2 migration are
required. That work is not shipped yet; do not enter real data in the current Beta. See the
repository [ADR-004](../../../docs/privacy/ADR-004-real-data-v2.md) and
[SPEC-01 V2 Candidate](../../../docs/privacy/SPEC-01-v2-candidate.md)/
[SPEC-05](../../../docs/privacy/SPEC-05-v1-to-v2-migration.md) for the approved target and
release gates.
