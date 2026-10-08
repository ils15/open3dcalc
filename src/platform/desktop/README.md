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
