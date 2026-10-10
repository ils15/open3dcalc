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

## Beta scope

The approved plaintext synthetic-test profile is Web-Beta-only and does not apply to Electron.
For Stable/Desktop, the customer, quote, and history stores use the passwordless PII IPC route;
their physical keys are `open3dcalc_pwless_customers_v1`, `open3dcalc_pwless_quotes_v1`, and
`open3dcalc_pwless_history_v1` in the SQLite `storage` key/value table. These are the Desktop
destinations for the corresponding logical keys in the SPEC-01 fixture, not `localStorage`
rows. No Beta fixture key or Beta build flag enables the test profile in an Electron build.

That is the current runtime, not the target for the next V2 Beta. ADR-004 requires the
passwordless plaintext route to be replaced with authenticated local encryption and an
explicit migration path covering supported Desktop V1/V2 records before Desktop may accept
real operational data under the new policy. The route, migration, recovery, and deletion
gates are not yet implemented by this documentation change.
