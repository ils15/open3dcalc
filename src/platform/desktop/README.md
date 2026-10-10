# Desktop Platform

The desktop app is an **Electron** application with SQLite persistence.

## Stack

- **UI**: React 19 (same components as web, via `src/shared/`)
- **Backend**: Electron main process (`electron/main.ts`)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (`db/`)
- **Persistence Bridge**: SQLite ↔ localStorage sync (`src/platform/desktop/overrides/`)

## Dev

```bash
npm run dev:desktop   # Vite dev (hot-reload) + Electron
```

## Build

```bash
# 1. Build the Vite renderer
npm run build:desktop   # outputs to dist/

# 2. Compile Electron main process
npm run build:electron  # compiles electron/ → electron/dist/

# 3. Package with electron-builder
npx electron-builder --win        # Windows NSIS installer
npx electron-builder --linux      # Linux AppImage
npx electron-builder --win --linux  # Both
```

## Database

- **Schema**: `db/schema/index.ts` — 11 tables defined with Drizzle ORM
- **Migrations**: `db/migrations/` — raw SQL files, run in order
- **Init**: `db/database.ts` — `initDatabase()` singleton, run once at Electron startup
- **Seed**: `db/seed.ts` — pre-populates printer (385+), material (31), and marketplace (6) catalogs
- **Run migrations**: `npm run db:migrate`

## Platform Features

- **SQLite persistence** — replaces `localStorage` for data durability
- **IPC bridge** — main/renderer communication via contextBridge (`electron/preload.ts`)
- **Storage adapter** — `src/platform/desktop/overrides/storage-adapter.ts` maps localStorage API to SQLite
- **Native file dialogs** — for STL/OBJ/3MF/G-code import
- **Auto-updates** — via electron-builder (future: electron-updater)

## Local user data

The Web Beta and Stable Web share their local customer, quote, and history keys. Desktop uses
the local PII IPC route;
their physical keys are `open3dcalc_pwless_customers_v1`, `open3dcalc_pwless_quotes_v1`, and
`open3dcalc_pwless_history_v1` in the SQLite `storage` key/value table. These are the Desktop
destinations for the corresponding logical keys in the SPEC-01 fixture, not `localStorage`
rows. Values are readable by anyone with access to the user's Desktop profile. No app password,
keyring, or encryption gate is used.

The published Beta `v2.0.0-beta.15` predates the shared-profile direction. The next candidate
is governed by ADR-004/SPEC-05: retain readable local persistence and provide an explicit,
previewed, verified migration for supported Desktop V1/V2 sources before claiming complete
real-data readiness. Migration and release gates are not implemented merely by this document
change.
