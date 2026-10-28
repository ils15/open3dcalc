---
title: Data & Privacy
order: 25
---

# Data & Privacy

Everything you register and save in Open3DCalc lives **on your device** — in
the browser profile (web) or the app's local database (desktop). Nothing is
sent to servers. The **Privacy** screen documents this and doubles as your
data control panel.

## What stays local

- Saved calculations, customers, quotes, products, catalog and stock live in
  readable local keys — with no additional app-side encryption. Anyone with
  access to your profile can read them; anyone without, sees nothing.
- No data leaves the device: there is no login, cloud sync or telemetry.

## Take your data with you

On the **Privacy** screen, the **"Take your data with you"** section exports a
**readable** JSON file with everything (history, customers, quotes, catalog,
stock, products, theme) plus an integrity **checksum**. Import accepts that
file in two modes:

- **Merge** — adds records to what already exists, keeping both;
- **Replace** — wipes the current data before importing (asks for
  confirmation).

This is your backup: export regularly and keep the file safe.

## Import data from the test profile (Beta)

If you used the Beta channel in this browser, your test data (customers,
quotes and history) lives in a separate profile. The **"Import data from the
test profile"** section brings those records into this stable profile with one
tap: per-type preview, ids preserved, duplicates skipped, and the test source
**always preserved** — importing does not wipe the Beta.

## Demo mode

**Demo mode** loads a sample workshop ("Estúdio Maria Print") on top of your
data, with a permanent on-screen banner and the **[DEMO]** badge in the tab
title. On exit, your real data is restored byte-for-byte — the demo never
writes to it.

## Deleting

Deletion is scoped and always confirmed: you delete what you chose (customers,
history, everything) and receive a report of what was removed.
