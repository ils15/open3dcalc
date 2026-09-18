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

| Plataforma            | Formato        | Arquivo                          |
| --------------------- | -------------- | -------------------------------- |
| Windows (x64 / arm64) | NSIS Installer | `Open3DCalc-{version}-setup.exe` |
| Linux (x64 / arm64)   | AppImage       | `Open3DCalc-{version}.AppImage`  |

> ⚠️ macOS build is configured but not actively published.

---

## 🔒 Privacidade e seus dados

O Open3DCalc é **local-first**: seus dados vivem no seu dispositivo e nada é enviado a servidores. A partir da v1.12, a política de privacidade (LGPD) é executada pelo próprio aplicativo:

- **Aba 🔒 Privacidade** — um só lugar para ver e agir sobre seus dados:
  - **Quarentena de dados legados**: dados antigos gravados em texto puro ficam legíveis, porém bloqueados para novas gravações, até você escolher **migrar** (criptografar e verificar) ou **eliminar**;
  - **Consentimento**: um recibo à prova de adulteração, vinculado à versão exata da política que você aceitou — flags de tutorial/onboarding nunca substituem consentimento, e a retirada apaga os dados coletados sob ela;
  - **Apagar todos os meus dados**: apagamento completo e verificável em todas as superfícies (banco, arquivos, caches, backups internos), com journal recuperável, snapshot criptografado de reversão (7 dias) e recibo listando as cópias externas que o app não alcança (ex.: exports salvos fora do app).
- **Exportação sempre criptografada**: o pacote de sincronização/exportação (`.open3dcalc`) sai criptografado com AES-256-GCM a partir de uma senha sua — sem senha, não há export. Pacotes legados antigos continuam importáveis.
- **Backup bruto deixou de ser recurso de usuário**: a cópia bruta do banco SQLite agora é um artefato de diagnóstico interno, bloqueado por padrão (gate de desenvolvimento), com modo de redação de dados pessoais e retenção máxima de 14 dias. Para levar seus dados a outra máquina, use o pacote de exportação criptografado.

> Detalhes técnicos: `docs/privacy/` (SPEC-01 manifest de dados, ADR-001 capacidade criptográfica, ADR-002 quarentena, ADR-003 export vs backup, SPEC-02 saga de apagamento, SPEC-03 envelope de exportação, SPEC-04 recibo de consentimento).

---

## 🎯 Estimativa de precisão

O motor de estimativa agora vai além do volume da malha — ele considera a configuração real da sua impressão e do seu filamento para calcular tempo, peso e custo.

- **Perfil de fatiamento configurável** (modo avançado): altura de camada, diâmetro do bico, velocidade e demais parâmetros de fatiamento agora alimentam a estimativa de tempo e material.
- **Calibração de filamento** (modo avançado): porcentagem de purge, diâmetro do filamento e velocidade volumétrica máxima (MVS) — com override para filamentos high-flow. A correspondência de perfis de filamento é _case-insensitive_.
- **Fator geométrico:** peças pequenas ou com muitos detalhes recebem um ajuste no tempo estimado (limitado a ±30%), pois exigem mais movimentos por unidade de volume.
- **Transparência total:** o painel **"premissas usadas"** mostra exatamente quais valores o estimador consumiu — sem caixa-preta.
- **Geometria via G-code:** quando o slicer não fornece metadata, as dimensões são extraídas dos movimentos do G-code; o perfil de fatiamento é auto-preenchido a partir do G-code **sem sobrescrever** sua customização.
- **Validação de malha:** aviso **não-bloqueante** quando a malha pode estar subestimando o volume (winding inconsistente, bordas abertas, geometria não-manifold ou triângulos degenerados). Malhas com mais de 1 milhão de triângulos usam validação parcial para não travar a interface.

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

## 📂 Supported File Formats

O preview 3D (`StlPreview`) aceita arrastar/soltar ou selecionar via explorador de arquivos:

| Formato | Extensão               | Notas                                                                                                                                                                                                                                                                                                         |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STL     | `.stl`                 | binário e ASCII                                                                                                                                                                                                                                                                                               |
| OBJ     | `.obj`                 | Wavefront                                                                                                                                                                                                                                                                                                     |
| 3MF     | `.3mf`                 | XML 3D Manufacturing                                                                                                                                                                                                                                                                                          |
| GCODE   | `.gcode`, `.gco`, `.g` | Cura (`;TIME:` em segundos) + PrusaSlicer/OrcaSlicer (`; estimated printing time = 1h 23m 45s`, suporta `d/h/m/s` combinados) — se o header de tempo não existir o arquivo ainda abre (tempo = `—`) e exibe dimensões/peso estimados pelo total de extrusão `E`, incluindo resets `G92` e modo relativo `M83` |

> **Troubleshooting GCODE (issue #32):** se o tempo aparecer como `—`, seu slicer não incluiu header de tempo ou usa formato não reconhecido — o arquivo continua sendo aceito (sem gate silencioso). Após carregar um GCODE a drop zone permanece visível e o botão 🗑️ (`stl.clear`) limpa o estado para novo upload sem dead-end.

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

| Script                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `npm run dev:web`            | Start web dev server (Vite, hot-reload)                |
| `npm run dev:desktop`        | Start Electron + Vite dev (hot-reload)                 |
| `npm run dev:electron`       | Compile + launch Electron main process                 |
| `npm run build:web`          | Build web app → `dist-web/`                            |
| `npm run build:desktop`      | Build desktop renderer → `dist/`                       |
| `npm run build:electron`     | Compile Electron main process (TypeScript)             |
| `npm run build:all`          | Build both web + desktop                               |
| `npm run build:shared`       | TypeScript check shared code (`--noEmit`)              |
| `npm run preview:web`        | Preview web production build locally                   |
| `npm test`                   | Run tests in watch mode                                |
| `npm run test:run`           | Run tests once (CI mode)                               |
| `npm run lint`               | ESLint check across entire project                     |
| `npm run typecheck`          | TypeScript check (`tsc --noEmit -p tsconfig.app.json`) |
| `npm run typecheck:electron` | TypeScript check for Electron main process             |
| `npm run db:generate`        | Generate Drizzle ORM migrations                        |
| `npm run db:migrate`         | Run pending SQLite migrations                          |
| `npm run postinstall`        | Rebuild native modules (electron-rebuild)              |

---

## 🌍 Environment / Config

**No `.env` file is required.** All app config is persisted via:

- **Web:** `localStorage` (browser)
- **Desktop:** SQLite via `better-sqlite3` + persistence adapter

Optional environment variables:

| Variable                | Values           | Purpose                                                  | Default                    |
| ----------------------- | ---------------- | -------------------------------------------------------- | -------------------------- |
| `OPEN3DCALC_DB_PATH`    | path string      | Custom path to SQLite file (tests/CLI)                   | —                          |
| `VITE_TOOLPATH_PREVIEW` | `true` / `false` | Enable the 3D G-code toolpath preview (dev ON, prod OFF) | dev: `true`, prod: `false` |
| `VITE_BETA_CHANNEL`     | `true` / `false` | Selo visual de beta no app web                           | `false`                    |

---

## 🚢 Deployment

### Web — GitHub Pages

O deploy da web é **automático** via GitHub Actions (`ci-cd.yml`) a cada **tag estável** imutável (`vX.Y.Z`):

1. CI roda lint, typecheck, testes e build na tag
2. O web build é publicado na **branch `gh-pages`** (raiz) via `peaceiris/actions-gh-pages`
3. Os arquivos `404.html` e `index.html` são gerados para roteamento SPA

> A branch `gh-pages` é **branch-based** (não artifact-based) justamente para que o canal beta possa viver no subpath `/beta/` sem clobberar a raiz estável. Veja a mudança da fonte do Pages em [Canal Beta](#canal-beta-web) abaixo.

### Canal Beta (web)

O canal beta publica builds **web-only** (Electron nunca é buildado) num subpath isolado do GitHub Pages, permitindo validar mudanças antes de promover a estável.

> 🐕 **Dogfood:** a beta liga o **preview 3D do G-code** (D-CL5/D-CL6) via `VITE_TOOLPATH_PREVIEW=true` — a raiz estável mantém a feature **desligada** até ela amadurecer (padrão dev ON / prod OFF; veja a tabela de env vars acima).

> 🧪 **Exemplos embutidos:** a beta traz o **3DBenchy** ([CreativeTools](https://www.3dbenchy.com/), domínio público / CC0 — livre pra redistribuir) na drop zone do visualizador. Dois botões baixam o exemplo sob demanda, sem precisar do seu próprio arquivo: **Benchy (STL)** dispara o pipeline de malha (volume + peso) e **Benchy (G-code)** dispara o preview de toolpath com o slider de camadas. Os binários vivem em `public/samples/` e a URL é resolvida relativa ao deploy (funciona na raiz e no subpath `/beta/`).

|           | Estável                               | Beta                                       |
| --------- | ------------------------------------- | ------------------------------------------ |
| URL       | `https://ils15.github.io/open3dcalc/` | `https://ils15.github.io/open3dcalc/beta/` |
| Versão    | `vX.Y.Z`                              | `vX.Y.Z-beta.N`                            |
| Origem    | tag estáável (`ci-cd.yml`)            | tag beta (`beta-deploy.yml`)               |
| Build     | web + desktop                         | **web-only**                               |
| Changelog | `CHANGELOG.md` + GitHub Release       | somente no corpo da GitHub Release         |

**Cortando uma beta**

1. Vá em _Actions → Beta channel → Run workflow_
2. O workflow (`beta.yml`):
   - Calcula a próxima versão (_auto_: próximo minor da versão atual; ou a base informada no input)
   - Bumpa `package.json`, faz commit e cria a **tag anotada imutável** `vX.Y.Z-beta.N`
   - Empurra commit + tag com o PAT `BETA_RELEASE_TOKEN`
3. A tag dispara o `beta-deploy.yml`, que:
   - Builda a web com `VITE_BETA_CHANNEL=true` (selo visual de beta)
   - Publica em `gh-pages/beta/` sem tocar na raiz estáável (`keep_files: true`)
   - Cria (ou atualiza) a GitHub Release **prerelease** `Beta vX.Y.Z-beta.N`

As tags beta são **imutáveis**: nunca reescreva ou delete uma tag já publicada — corte uma nova beta (`beta.N+1`) caso precise ajustar algo. O `beta-deploy.yml` é idempotente, então re-executá-lo na mesma tag apenas refresca a release.

O changelog do beta existe **somente no corpo da GitHub Release** — `CHANGELOG.md` e o changelog in-app nunca carregam betas, pois o parser de `scripts/sync-changelog.mjs` colidiria em chaves como `1.13.0` vs `1.13.0-beta.1`.

**Promover beta → estável**: o fluxo normal de release (`release.yml`) consolida **todos** os commits desde a última tag estável, então o changelog da release estável já inclui todo o período das betas. Veja [RELEASE.md](RELEASE.md).

> 🔑 **`BETA_RELEASE_TOKEN` (obrigatório)**
>
> O GitHub **suprime** novas execuções de workflow causadas pelo `GITHUB_TOKEN` (anti-recursão). A tag beta **precisa** ser empurrada por um **Personal Access Token (classic)** com escopo `contents: write`; caso contrário a tag é criada, mas o `beta-deploy.yml` nunca dispara.
>
> Como configurar:
>
> 1. _Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token_
> 2. Escopo: **`repo`** (ou no mínimo `contents: write`); o selo `workflow` **não** é necessário
> 3. _Settings → Secrets and variables → Actions → New repository secret_ → nome `BETA_RELEASE_TOKEN`, valor = token
>
> Tanto `beta.yml` quanto `beta-deploy.yml` fazem **fail-fast** logo no início se o secret estiver vazio, explicando o problema no log.

**Mudança da fonte do Pages (cutover, uma vez)**

Como o beta vive em `gh-pages/beta/` e a raiz de `gh-pages` é a estável, a fonte do GitHub Pages precisa mudar de _GitHub Actions_ para a **branch `gh-pages`**:

1. Rode uma vez _Actions → **Seed gh-pages (one-off)** → Run workflow_ com o input `ref` apontando para `main` (ou a tag estável mais recente) — isso popula a raiz sem apagar `/beta/`
2. _Settings → Pages → Build and deployment → Source: **Deploy from a branch**_
3. Branch: **`gh-pages`** / pasta **`/ (root)`** → Save
4. **Delete o arquivo `.github/workflows/seed-gh-pages.yml`** — ele existe apenas para o cutover

### Desktop — GitHub Releases

O release é um processo de **duas fases** (preparação + publicação), detalhado em [RELEASE.md](RELEASE.md).

**Preparação** (GitHub Actions):

1. Em _Actions → Release preparation → Run workflow_, selecione `main` e o bump desejado
2. O workflow cria `release/vX.Y.Z`, atualiza versão com _changelogen 0.6.2_, sincroniza o changelog in-app, roda lint/typecheck/testes/build e abre um PR para `main`
3. Revise e faça o merge do PR

**Publicação** (tag local):

```bash
git fetch origin main && git switch main && git pull --ff-only origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

O workflow _Release publication_ valida a tag, cria a GitHub Release com nome `Open3DCalc vX.Y.Z` e anexa os artefatos Windows/Linux. A branch `release/vX.Y.Z` é removida após confirmação.

### Notas de release automáticas

As notas de cada GitHub Release usam um **formato canônico** renderizado por `scripts/release-notes.mjs` (`renderPublication()`) e validado por um gate _fail-closed_ antes da publicação:

```bash
npm run release:notes:validate -- --file release-notes.md --tag vX.Y.Z
```

O workflow _Release publication_ gera o corpo com `--notes-file` (em vez de `--generate-notes`) e só publica se o validador aprovar. As seções emoji têm ordem fixa: 🚀 Features, 🐛 Fixes, 🧹 Chores, 📦 Dependencies, 🤖 CI/CD e ❤️ Contributors (além de 📚 Documentation, 🔒 Security e ⚠️ Breaking Changes quando houver conteúdo).

O backfill de releases antigas é idempotente e reversível por snapshot local (`release-notes-snapshots/`):

```bash
node scripts/backfill-release-notes.mjs --dry-run --all
node scripts/backfill-release-notes.mjs --apply --all
node scripts/backfill-release-notes.mjs --restore vX.Y.Z
```

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
