# Arquitetura e stack

Organização do código, banco de dados, variáveis de ambiente e scripts do projeto.

## Stack técnica

| Layer                | Technology                                   |
| -------------------- | -------------------------------------------- |
| **Frontend**         | React 19, TypeScript 6, Tailwind CSS v4      |
| **Build**            | Vite 8                                       |
| **Desktop**          | Electron 42, better-sqlite3, Drizzle ORM     |
| **Web (PWA)**        | vite-plugin-pwa (Workbox service worker)     |
| **State Management** | Zustand 5                                    |
| **Testing**          | Vitest 4, Testing Library (React + Jest DOM) |
| **i18n**             | i18next 26, react-i18next 17                 |
| **Charts**           | Recharts 2                                   |
| **3D Preview**       | Three.js + React Three Fiber + Drei          |
| **PDF Export**       | @react-pdf/renderer 4                        |
| **Animations**       | Framer Motion 12                             |
| **Icons**            | Lucide React                                 |
| **Linting**          | ESLint 10, TypeScript ESLint, Prettier 3     |
| **CI/CD**            | GitHub Actions                               |
| **Commit Lint**      | commitlint + husky + lint-staged             |
| **Changelog**        | changelogen                                  |
## Estrutura do projeto

```
open3dcalc/
├── src/
│   ├── shared/                  # Código compartilhado web + desktop
│   │   ├── components/          # Componentes React reutilizáveis
│   │   │   ├── Calculator/      # Calculadoras FDM e Resina
│   │   │   ├── Dashboard/       # KPIs, gráficos, projeções
│   │   │   ├── Catalog/         # Catálogo de impressoras, materiais
│   │   │   ├── StlPreview/      # Preview 3D (Three.js)
│   │   │   ├── Changelog/       # Changelog viewer
│   │   │   ├── Header/          # Navigation, theme toggle
│   │   │   └── ui/              # UI atoms (Button, Modal, Input, Table, etc.)
│   │   ├── stores/              # Zustand stores (estado global)
│   │   │   ├── calculatorStore.ts
│   │   │   ├── catalogStore.ts
│   │   │   ├── customerStore.ts
│   │   │   ├── historyStore.ts
│   │   │   ├── quoteStore.ts
│   │   │   ├── filamentInventory.ts
│   │   │   └── ...
│   │   ├── lib/                 # Lógica de negócio
│   │   │   ├── calculator.ts    # Núcleo do cálculo de custos
│   │   │   ├── stlParser.ts     # Parsing STL/OBJ/3MF
│   │   │   ├── gcodeParser.ts   # Parsing G-code
│   │   │   ├── pdfExport.tsx    # Export PDF via @react-pdf/renderer
│   │   │   ├── csvExport.ts     # Export CSV
│   │   │   ├── currency.ts      # Conversão monetária
│   │   │   ├── printers.ts      # Catálogo de 103 impressoras
│   │   │   ├── materials.ts     # 31 materiais pré-cadastrados
│   │   │   └── marketplace.ts   # Taxas de marketplaces
│   │   ├── hooks/               # Custom hooks (useCurrency, useTheme, etc.)
│   │   ├── types/               # Tipos TypeScript compartilhados
│   │   ├── i18n/                # Traduções (pt-BR, en-US)
│   │   └── test/                # Test utilities & setup
│   └── platform/
│       ├── web/                 # Código específico da PWA
│       │   ├── main.tsx         # Entry point React (web)
│       │   └── App.tsx          # Root component (web)
│       └── desktop/             # Código específico do Electron
│           ├── main.tsx         # Entry point React (desktop)
│           ├── App.tsx          # Root component (desktop)
│           └── overrides/       # Brides SQLite ↔ localStorage
│               ├── db-bridge.ts
│               ├── persistence-bridge.ts
│               └── storage-adapter.ts
├── docs/                          # Documentação
│   └── wiki/                      # Artigos da aba Wiki (markdown, pt-BR + en-US)
│       └── README.md              # Contrato de autoria da Wiki (subset, schema)
├── db/                            # Database (SQLite via Drizzle ORM)
│   ├── schema/                  # Schema definitions (Drizzle ORM)
│   │   ├── index.ts             # 10 tabelas (customers, quotes, history, etc.)
│   │   └── relations.ts         # Relacionamentos entre tabelas
│   ├── migrations/              # Migrations SQL (0000_initial, 0001_add_theme)
│   ├── database.ts              # initDatabase() — singleton Drizzle instance
│   ├── seed.ts                  # Seed data (impressoras, materiais, marketplaces)
│   └── migrate.ts               # Migration runner
├── electron/                    # Electron main process (TypeScript)
│   ├── main.ts                  # Main process: window, IPC, DB init
│   └── preload.ts               # Preload script (contextBridge)
├── web/                         # Código legado (histórico git preservado)
├── desktop/                     # Código legado desktop (histórico git preservado)
├── index.web.html               # HTML entry point — web build
├── index.desktop.html           # HTML entry point — desktop build
├── vite.base.config.ts          # Config Vite base (compartilhada)
├── vite.web.config.ts           # Config Vite — web
├── vite.desktop.config.ts       # Config Vite — desktop
├── vitest.config.ts             # Config Vitest
└── tsconfig.base.json           # TypeScript base config
```
## Banco de dados

- **Engine:** SQLite via `better-sqlite3` (síncrono, embarcado)
- **ORM:** Drizzle ORM — schema definido em `db/schema/index.ts`
- **Migrations:** SQL puro em `db/migrations/` (gerados via `drizzle-kit`)
- **Tables:** customers, quotes, quote_items, history_entries, filament_spools, catalog_printers, catalog_materials, catalog_marketplaces, calculator_state, app_settings, storage
- **Storage Bridge:** A camada de persistência do desktop substitui o `localStorage` da web pelo SQLite via adaptador IPC (`src/platform/desktop/overrides/storage-adapter.ts`)
- **Seed:** `db/seed.ts` povoa os catálogos de impressoras (103), materiais (31) e marketplaces (6)
- **Campos técnicos opcionais (W10a):** impressoras podem trazer `technology` (`fdm`/`resin`), `buildVolumeMm`, `nozzleDiameterMm`, `maxSpeedMmS` e `websiteUrl` (página oficial — aberta só pelo usuário; o app faz **zero** chamadas de rede); marketplaces podem trazer `logo` (arte SVG original, não logos registrados). Os dados **econômicos** (`value` em R$, `power`, `usefulLife`, `maintenancePerHour`) continuam sendo do app e não foram importados — detalhes em [`docs/CREDITS.md`](CREDITS.md)

```bash
# Gerar nova migration após alterar schema
npm run db:generate

# Executar migrations pendentes
npm run db:migrate
```

> **Web:** No SQLite. All persistence is via `localStorage` (browser).
## Ambiente e configuração

**No `.env` file is required.** All app config is persisted via:

- **Web:** `localStorage` (browser)
- **Desktop:** SQLite via `better-sqlite3` + persistence adapter

Optional environment variables:

| Variable                | Values           | Purpose                                | Default                                                        |
| ----------------------- | ---------------- | -------------------------------------- | -------------------------------------------------------------- |
| `OPEN3DCALC_DB_PATH`    | path string      | Custom path to SQLite file (tests/CLI) | —                                                              |
| `VITE_TOOLPATH_PREVIEW` | `true` / `false` | Enable the 3D G-code toolpath preview  | `true` (validated in the beta channel; set `false` to disable) |
| `VITE_BETA_CHANNEL`     | `true` / `false` | Selo visual de beta no app web         | `false`                                                        |
## Referência de scripts

| Script                                     | Description                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev:web`                          | Start web dev server (Vite, hot-reload)                                      |
| `npm run dev:desktop`                      | Start Electron + Vite dev (hot-reload)                                       |
| `npm run dev:electron`                     | Compile + launch Electron main process                                       |
| `npm run build:web`                        | Build web app → `dist-web/`                                                  |
| `npm run build:desktop`                    | Build desktop renderer → `dist/`                                             |
| `npm run build:electron`                   | Compile Electron main process (TypeScript)                                   |
| `npm run build:all`                        | Build both web + desktop                                                     |
| `npm run build:shared`                     | TypeScript check shared code (`--noEmit`)                                    |
| `npm run preview:web`                      | Preview web production build locally                                         |
| `npm test`                                 | Run tests in watch mode                                                      |
| `npm run test:run`                         | Run tests once (CI mode)                                                     |
| `npm run test:browser`                     | Run `*.browser.test.ts` / `*.browser.test.tsx` in real Chromium (Playwright) |
| `npm run test:studio-layout-ux:playwright` | Check Bento mobile overflow and fixed-dock clearance in Chromium             |
| `npm run lint`                             | ESLint check across entire project                                           |
| `npm run typecheck`                        | TypeScript check (`tsc --noEmit -p tsconfig.app.json`)                       |
| `npm run typecheck:electron`               | TypeScript check for Electron main process                                   |
| `npm run db:generate`                      | Generate Drizzle ORM migrations                                              |
| `npm run db:migrate`                       | Run pending SQLite migrations                                                |
| `node scripts/push-gate.mjs`               | Pre-push test gate in baseline mode ("não piorou"); `--write` regenerates    |
| `npm run postinstall`                      | Rebuild native modules (electron-rebuild)                                    |
