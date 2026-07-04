# Open3DCalc 🖨️💰

> Calculadora 3D Livre & Open-Source para precificação de impressões 3D.
> Free & open-source 3D printing cost calculator.

[![CI/CD](https://github.com/ils15/open3dcalc/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ils15/open3dcalc/actions/workflows/ci-cd.yml)
[![Self-Hosted CX33](https://img.shields.io/badge/runner-CX33-8A2BE2)](https://github.com/ils15/open3dcalc/settings/actions/runners)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-brightgreen)](https://ils15.github.io/open3dcalc/)
[![Licença](https://img.shields.io/badge/licença-MIT-blue)](LICENSE)
[![Versão](https://img.shields.io/github/v/release/ils15/open3dcalc)](https://github.com/ils15/open3dcalc/releases)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)](https://www.typescriptlang.org/)
[![Electron 42](https://img.shields.io/badge/Electron-42-47848f)](https://www.electronjs.org/)

---

## 🌐 Web App

**https://ils15.github.io/open3dcalc/** — Progressive Web App (PWA) com suporte offline, instalável como aplicativo nativo em qualquer navegador moderno.

- ✅ Offline-ready via service worker (Workbox)
- ✅ Instalável na tela inicial (add to homescreen)
- ✅ Auto-update em nova versão
- ✅ Responsivo (mobile-first)

## 📦 Desktop App

Baixe a versão desktop para Windows ou Linux na [página de releases](https://github.com/ils15/open3dcalc/releases).

| Plataforma | Formato | Arquivo |
|-----------|---------|---------|
| Windows (x64 / arm64) | NSIS Installer | `Open3DCalc-{version}-setup.exe` |
| Linux (x64 / arm64) | AppImage | `Open3DCalc-{version}.AppImage` |

> ⚠️ macOS build is configured but not actively published.

---

## 🏗️ Project Structure

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
│   │   │   ├── printers.ts      # Catálogo de 385+ impressoras
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
│               ├── storage-adapter.ts
│               └── theme-persistence.ts
├── db/                          # Database (SQLite via Drizzle ORM)
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

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 22+** (recommended: 22 LTS)
- **npm 10+**
- **Git**

### Installation

```bash
git clone https://github.com/ils15/open3dcalc.git
cd open3dcalc
npm install
```

> **Note:** `postinstall` runs `electron-rebuild` to compile native `better-sqlite3`. It may take a few seconds.

### Development

```bash
# Web — servidor com hot-reload (http://localhost:5173)
npm run dev:web

# Desktop — Vite + Electron com hot-reload
npm run dev:desktop
```

### Build / Production Build

```bash
# Web — saída em dist-web/
npm run build:web

# Desktop — saída em dist/ + compila electron/
npm run build:desktop
npm run build:electron

# Ambos de uma vez
npm run build:all
```

---

## 🧪 Testing

```bash
# Modo watch (desenvolvimento)
npm test

# Execução única (CI)
npm run test:run

# Com cobertura
npm run test:run -- --coverage
```

We use **Vitest** + **Testing Library** for unit and component tests. Minimum coverage for calculation logic: **80%**.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 6, Tailwind CSS v4 |
| **Build** | Vite 8 |
| **Desktop** | Electron 42, better-sqlite3, Drizzle ORM |
| **Web (PWA)** | vite-plugin-pwa (Workbox service worker) |
| **State Management** | Zustand 5 |
| **Testing** | Vitest 4, Testing Library (React + Jest DOM) |
| **i18n** | i18next 26, react-i18next 17 |
| **Charts** | Recharts 2 |
| **3D Preview** | Three.js + React Three Fiber + Drei |
| **PDF Export** | @react-pdf/renderer 4 |
| **Animations** | Framer Motion 12 |
| **Icons** | Lucide React |
| **Linting** | ESLint 10, TypeScript ESLint, Prettier 3 |
| **CI/CD** | GitHub Actions |
| **Commit Lint** | commitlint + husky + lint-staged |
| **Changelog** | changelogen |

---

## 🗄️ Database

- **Engine:** SQLite via `better-sqlite3` (síncrono, embarcado)
- **ORM:** Drizzle ORM — schema definido em `db/schema/index.ts`
- **Migrations:** SQL puro em `db/migrations/` (gerados via `drizzle-kit`)
- **Tables:** customers, quotes, quote_items, history_entries, filament_spools, catalog_printers, catalog_materials, catalog_marketplaces, calculator_state, app_settings, storage
- **Storage Bridge:** A camada de persistência do desktop substitui o `localStorage` da web pelo SQLite via adaptador IPC (`src/platform/desktop/overrides/storage-adapter.ts`)
- **Seed:** `db/seed.ts` povoa os catálogos de impressoras (385+), materiais (31) e marketplaces (6)

```bash
# Gerar nova migration após alterar schema
npm run db:generate

# Executar migrations pendentes
npm run db:migrate
```

> **Web:** No SQLite. All persistence is via `localStorage` (browser).

---

## 📜 Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev:web` | Start web dev server (Vite, hot-reload) |
| `npm run dev:desktop` | Start Electron + Vite dev (hot-reload) |
| `npm run dev:electron` | Compile + launch Electron main process |
| `npm run build:web` | Build web app → `dist-web/` |
| `npm run build:desktop` | Build desktop renderer → `dist/` |
| `npm run build:electron` | Compile Electron main process (TypeScript) |
| `npm run build:all` | Build both web + desktop |
| `npm run build:shared` | TypeScript check shared code (`--noEmit`) |
| `npm run preview:web` | Preview web production build locally |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI mode) |
| `npm run lint` | ESLint check across entire project |
| `npm run typecheck` | TypeScript check (`tsc --noEmit -p tsconfig.app.json`) |
| `npm run typecheck:electron` | TypeScript check for Electron main process |
| `npm run db:generate` | Generate Drizzle ORM migrations |
| `npm run db:migrate` | Run pending SQLite migrations |
| `npm run postinstall` | Rebuild native modules (electron-rebuild) |

---

## 🌍 Environment / Config

**No `.env` file is required.** All app config is persisted via:

- **Web:** `localStorage` (browser)
- **Desktop:** SQLite via `better-sqlite3` + persistence adapter

Optional environment variables:

| Variable | Purpose |
|----------|---------|
| `OPEN3DCALC_DB_PATH` | Custom path to SQLite file (tests/CLI) |

---

## 🚢 Deployment

### Web — GitHub Pages

O deploy da web é **automático** via GitHub Actions (`ci-cd.yml`) em todo push na branch `main`:

1. CI roda lint, typecheck, testes e build
2. Web build é publicado em **https://ils15.github.io/open3dcalc/**
3. O arquivo `404.html` é gerado para roteamento SPA

### Desktop — GitHub Releases

O release é **manual** via GitHub Actions (`release.yml`):

1. Dispare o workflow **Release** no GitHub
2. Escolha o bump (auto/patch/minor/major)
3. O workflow: bump version → build ambos → electron-builder (Linux) → commit/tag → cria GitHub Release com artifacts
4. Para Windows, execute `npx electron-builder --win` localmente

---

## 🤝 Contributing

Contributions are welcome! See the full guide at [CONTRIBUTING.md](CONTRIBUTING.md).

**Workflow summary:**

1. Fork the repository
2. Create a branch (`feature/`, `fix/`, `docs/`, etc.)
3. Commit following [Conventional Commits](https://www.conventionalcommits.org/)
4. Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build:all`
5. Open a Pull Request (minimum 1 approval)

---

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## ⚡ Infraestrutura

Este projeto utiliza um **self-hosted runner CX33** para execução dos pipelines de CI/CD:

- 🚀 Zero custo de execução (vs GitHub Actions hosted)
- 💤 Runner sleep quando ocioso — zero consumo
- 🔥 Acorda automaticamente nos pushes/PRs
- 🔒 Segredos e cache locais (sem egress)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Live Demo:** https://ils15.github.io/open3dcalc/
- **Repository:** https://github.com/ils15/open3dcalc
- **Issues:** https://github.com/ils15/open3dcalc/issues
- **Releases:** https://github.com/ils15/open3dcalc/releases
- **Telegram Community:** [Impressão 3D BR](https://t.me/Impressao3DBR)
