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

### 🧭 Navegação

Todas as superfícies dão acesso às **12 abas** — Calculadora, Dashboard, Calc. Infill, Filamentos, Cadastros, Histórico, Novidades, Orçamentos, Clientes, Produtos, Privacidade e Wiki — sem que nenhuma fique escondida atrás de um menu:

| Tela                   | Navegação                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📱 Mobile (< 768px)    | Barra inferior **scrollável** com todas as abas, mais uma engrenagem de **Configurações** fixa no final que abre um sheet dedicado somente a configurações (Tutorial, Moeda, Idioma e GitHub). |
| 📲 Tablet (768–1024px) | Sidebar compacta, somente ícones.                                                                                                                                                              |
| 🖥️ Desktop (≥ 1024px)  | Sidebar completa com rótulos.                                                                                                                                                                  |

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

## ✨ Recursos de cálculo

Para além da estimativa de volume, o Open3DCalc calcula o custo real do seu dia a dia de impressão:

| Recurso                             | O que faz                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧵 **Restante do carretel**         | Cada carretel do inventário mostra o peso **líquido** restante (bruto menos a tara) e a **metragem** estimada, além de um indicador que diz se o carretel cobre a peça ativa. A tara é auto-preenchida por um banco de marcas embutido; você pode digitar a sua e, limpando o campo, a tara da marca volta a valer.                                               |
| 💧 **Resina lavável em água**       | Resinas `water_washable` são lavadas com água corrente — sem álcool isopropílico. Ao escolher uma, o meio de lavagem muda automaticamente para água e o custo de IPA da lavagem vai a **zero** no cálculo. O meio continua ajustável à mão no bloco "Lavagem e Cura".                                                                                             |
| 📊 **Comparador de materiais**      | No painel de resultados, uma tabela colapsável mostra quanto a peça atual custaria em **cada material FDM do catálogo**, ordenável por custo — antes de comprar, você vê qual filamento sai mais barato. Resina não é comparável com FDM (processos diferentes) e a própria tabela explica o porquê.                                                              |
| 🖨️ **Custo de máquina do catálogo** | Ao selecionar uma impressora do catálogo, os custos de máquina da aba ativa são auto-preenchidos (valor, vida útil e manutenção). Como o catálogo guarda a manutenção em **R$/hora**, o app faz a conversão obrigatória para **R$/mês** a partir das suas horas de uso mensais. A derivação ocorre só na seleção — ajustar as horas mensais depois não recalcula. |

---

## 🎓 Onboarding, tours e Wiki

O app se explica sozinho — ninguém precisa ler um manual externo para começar:

| Superfície        | O que é                                                                                                                                                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚀 **Onboarding** | Primeiros passos dentro do app: flags persistentes (LocalStorage) garantem que o tutorial só se oferece uma vez por sessão/usuário, e flags de tutorial **nunca** substituem o consentimento de privacidade.                                                                                                                |
| 🧪 **Modo demo**  | Dados de demonstração para explorar a calculadora sem cadastrar nada; exports são bloqueados no modo demo (o selo e o toast avisam).                                                                                                                                                                                        |
| 🎯 **Tours**      | 6 tours interativos com spotlight: Calculadora básica, Preview 3D do upload, Inventário de bobinas, KPIs do dashboard, Orçamentos & Clientes e Nível avançado — todos bilíngues, disparados pelo botão de tutorial ou pelo guia. O tour de nível avançado empresta o nível avançado da calculadora e o **devolve** ao sair. |
| 📖 **Wiki**       | Documentação dentro do app (aba Wiki): artigos em markdown compilados em **build time** — zero parser no client, zero dependência de runtime, sanitizados via `rehype-sanitize`. Veja [`docs/wiki/README.md`](docs/wiki/README.md) para o contrato de autoria (subset, frontmatter, paridade pt-BR/en-US).                  |
| 🗂️ **Guia**       | Drawer com um card por superfície do app (tabs e seções da calculadora), cada um com descrição e atalho para o tour correspondente, quando existe.                                                                                                                                                                          |

---

## 🎨 Paleta de cores

O inventário de bobinas tem uma paleta de cores própria, dividida em uma parte
padrão (embutida no app) e uma parte personalizada (persistida por usuário):

| Superfície                     | O que faz                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🎨 **Paleta padrão**           | **33 cores** agrupadas visualmente em **Neutras** (9), **Sólidas** (18) e **Escuras** (6) — a fonte única da verdade é o array `STD_COLORS` em `FilamentInventory.tsx`; o lookup nome → hex (`COLOR_HEX`) é derivado dele, então não há hex duplicado em lugar nenhum.                                                                    |
| 👤 **Paleta custom**           | Store Zustand dedicado (`src/shared/stores/colorPalette.ts`) persistido via `guardedStorage` na key `open3dcalc_color_palette_v1`, registrada no [SPEC-01](docs/privacy/SPEC-01-manifest-fixture.json) e em `LOCALSTORAGE_KEYS` (`persistence-bridge.ts`) — o gate descarta silenciosamente escritas de keys não registradas em produção. |
| 🧩 **Seletor de swatches**     | O primitivo `Select` ganhou `color?: string` no `SelectOption` e mostra um swatch (bolinha de cor) tanto no trigger quanto em cada opção; o seletor de cor do formulário de filamento mescla padrão + custom, separadas por grupo ("Padrão" / "Minhas cores").                                                                            |
| ➕ **Adicionar cor própria**   | Linha no próprio formulário: nome + picker de hex nativo (mantido como escape). O nome é normalizado e **deduplica case-insensitive** contra a paleta existente; se a cor já existe, ela é apenas selecionada.                                                                                                                            |
| 🪣 **Modal "Paleta de Cores"** | Mostra a paleta padrão (33 swatches) e, abaixo, o grid "Minhas cores" com uma lixeira por cor (`removeColor`) — a remoção atualiza o store e reflete no seletor na hora.                                                                                                                                                                  |
| 🔍 **`resolveHex`**            | Resolve o hex de qualquer nome de cor: primeiro **match exato**, depois **match por inclusão com a key mais longa vencendo** — então "Azul Marinho" resolve como `#1e3a8a` e não mais como "azul". Dados antigos e digitados à mão continuam resolvendo.                                                                                  |

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
│               ├── storage-adapter.ts
│               └── theme-persistence.ts
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

---

## 🧩 UI Primitives: Select

O componente `Select` (`src/shared/components/ui/Select/Select.tsx`) é o dropdown padrão do app, usado em **15 pontos de uso em 8 arquivos** (CatalogTab, FilamentInventory, InfillCalculator, MaterialSection, PrintSection, SalesSection, FailureSection, HistoryTab). É construído sobre [`@floating-ui/react`](https://floating-ui.com/) (a mesma biblioteca do `Tooltip`) para posicionamento robusto do menu:

| Problema | Solução                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colisão  | `useFloating` + `offset(6)` + `flip()` + `shift({ padding: 8 })` + `autoUpdate` — o menu nunca sai da viewport e abre para cima quando não cabe embaixo                                                                                                                                                                                                                                                                                                                                                         |
| Clipping | O menu é sempre renderizado num `FloatingPortal`, escapando de containers com `overflow` (ex.: o modal `overflow-y-auto` do FilamentInventory)                                                                                                                                                                                                                                                                                                                                                                  |
| Altura   | Middleware `size()` aplica `max-height` dinâmico (cap 420px) e iguala a largura ao trigger                                                                                                                                                                                                                                                                                                                                                                                                                      |
| z-index  | Token `--z-dropdown: 60` da escala única em `src/styles/tokens.css` — acima da bottom nav mobile, abaixo do Tooltip. Ordem da escala: `--z-app-chrome: 20` < `--z-viewer: 30` < `--z-passive: 40` < `--z-shell-chrome: 45` < `z-50` (Tailwind, o **scrim**: um backdrop `fixed inset-0` com fundo escurecido **junto com o painel que ele responde** — ou um diálogo centrado, ou uma bottom sheet de mobile) < `--z-tour: 55` / `--z-tour-card: 56` < `--z-dropdown: 60` < `--z-panel: 70` < `--z-tooltip: 80` |
| Mobile   | Abaixo de 640px o menu vira **bottom sheet**: `position: fixed; bottom: 0`, `max-h-[60dvh]` com scroll interno (hook `useMobileSheet`, reativo a resize/giro)                                                                                                                                                                                                                                                                                                                                                   |

Seletores com imagens (impressoras, marketplaces) agora renderizam **thumbnails**: um `<img loading="lazy" decoding="async">` com _fallback_ automático — se a imagem falha (404/rede), o componente `OptionThumb` exibe um monograma derivado do label, então nenhuma opção fica sem identificação visual. Imagem e monograma são `aria-hidden` (decorativos): o nome acessável da opção continua sendo apenas o label, limpo para leitores de tela. A arte de _fallback_ dos impressores (`fallback-fdm.svg`/`fallback-resin.svg`) e as logos de marketplace são **originais** deste projeto — a atribuição CC-BY-4.0 dos dados técnicos adaptados do _swordlab/open-3d-printer-database_ está em [`docs/CREDITS.md`](docs/CREDITS.md).

> **Nota:** a prop `portal` foi **descontinuada** — o menu agora é sempre portado, então a prop é aceita por compatibilidade da API pública, mas é um _no-op_. Nenhum call site passava `portal`; a API do componente é estável e os 15 pontos de uso acima se beneficiam das correções sem nenhuma mudança de código.

> **Nota (escala de camadas):** a escala está documentada em `src/styles/tokens.css` e se consome como `style={{ zIndex: "var(--z-…)" }}` — o mesmo mecanismo do `Select`, que mantém o valor resolvível (e portanto testável) em vez de inferível de um literal. Ela é ordenada pelo que a superfície **possui**, não pelo tamanho, porque isso é que decide se uma superfície pode cobrir outra. O **invariante** completo, em três regras: **(1)** nada passivo pode ficar acima da saída — uma superfície passiva não tem scrim, não prende foco, não é dona de tecla nenhuma e se descarta sozinha, então é informação e não interrupção, e jamais pode ocultar ou interceptar um controle, muito menos o único controle que encerra o Focus Mode; **(2)** uma superfície **dona** da tela _pode_ ficar acima da saída, e nesse caso ela é dona também do caminho de volta — enquanto ela está aberta a saída cede (via `escapeIsOwnedByOverlay`), e o jeito visível de sair é o **Escape** (ou um clique no scrim), que devolve a saída imediatamente: uma tecla, uma camada; **(3)** uma única superfície **inerte** pode passar de tudo, o tooltip. Pela regra 2 o "sempre" **não** foi estreitado: a saída nunca é destruída nem fica presa, e o pior caso é um Escape de distância, só enquanto uma superfície que ela própria consome com esse Escape estiver aberta (e como entrar no modo força `activeTab: "calculator"`, os modais de outras abas sequer existem nesse estado). Daí a divisão: `--z-passive` (toasts, popovers sem scrim, listboxes limitados, a `PrivacyBanner`) fica **abaixo** de `--z-shell-chrome`; o tier `z-50` passa a significar apenas o scrim — o backdrop `fixed inset-0` com fundo escurecido **junto com o painel que ele responde** (diálogo centrado ou bottom sheet de mobile; o painel divide a banda do próprio backdrop porque precisa ficar acima dele, e os dois são uma camada dona só) — antes ele também admitia os passivos, e era essa sobreposição que enterrava a saída (no `sm+` o toast e a saída compartilham a mesma âncora `sm:top-4 sm:right-4`). Um teste conta **cada ocorrência** de `z-50` na árvore e exige que ela seja um backdrop ou o painel que responde um, com a lista de arquivos derivada em vez de mantida à mão: foi essa contagem que mostrou as duas bottom sheets (`Header.tsx` e `MobileSettingsSheet.tsx`) no tier do scrim, e é ela que impede um `z-50` novo de entrar sem ser contado. A derivação e a classificação foram **extraídas para funções testáveis por fixture** depois que uma mutação provou que, inline, nenhuma das duas estreitezas teria qualquer teste provando que mordem: (a) a busca por arquivo usava `/class(?:Name)?=[^\n]*\bz-50\b/`, que exige `z-50` na **mesma linha** do `className` — um class string quebrado em várias linhas escondia uma camada da auditoria — e agora varre o **texto do arquivo** em busca do token, com **comentários removidos** antes (cinco arquivos deste repositório discutem `z-50` em prosa justamente para explicar por que **não** estão nele, e uma varredura crua os listaria como não auditados). O strip de comentário preserva `https://` via `[^:]`, senão ele truncaria a linha do `href` do `ConsentModal`/`PrivacyPolicy`. (b) O painel de bottom sheet era reconhecido por `rounded-t-2xl`, um proxy **cosmético** que deixava passar qualquer caixa flutuante arredondada em cima e arquivada no tier do scrim; agora o padrão exige `bottom-0`, que é o token que faz o painel ser uma _sheet_ de fato — as duas folhas reais são `fixed bottom-0 left-0 right-0 z-50 … rounded-t-2xl`. E o pareamento passou de "existe um backdrop neste arquivo" (que dois painéis e um scrim satisfazem) para **`panels <= backdrops`**, que é o pareamento que a regra realmente afirma: cada painel responde um backdrop. `--z-viewer` (overlay fullscreen e viewer de toolpath do `StlPreview`, ambos antes em `z-[100]`) fica abaixo do tier passivo para que um aviso nunca se perca atrás de um overlay de tela cheia, e `--z-app-chrome` é a bottom nav das duas plataformas — que tinham drifado para `z-50` e `z-40` do mesmo componente. `--z-dropdown` é onde vivem os menus (`Select`, `MoreMenu`, menu de moeda, `TutorialLauncher`), `--z-panel` o tier de painéis (`GuideDrawer`, `ManageVisibilityButton` — ainda em `z-[70]`/`z-[71]`), e `--z-tour`/`--z-tour-card` o scrim e o card do tour guiado (ex-`z-[55]`/56): o tutorial tem scrim, clique para dispensar e consome o Escape (`finishTutorial`), então é uma superfície dona pela regra 2 e **tem** lugar acima da saída — é por isso que a regra 2 existe, e o teste dirige o tutorial real para provar que ele termina com o mesmo Escape. Única exceção inerte: `--z-tooltip` fica no topo porque um anotador precisa passar por cima de qualquer camada onde o seu trigger possa estar — **e isso é uma regra do primitivo, não um fato sobre os call sites atuais**: o `InputGroup` só renderiza o tooltip quando recebe a prop `tooltip`, e hoje nenhum `tooltip=` está dentro de um modal, painel ou menu, então essa faixa é headroom, fixada por teste e não por um uso existente. E para ficar registrado: um toast aberto enquanto há um modal com scrim agora é desenhado **atrás** dele (consequência da regra 1) — os pixels se perdem, o anúncio não, porque o container do toast é `aria-live="polite"` e nenhum modal da árvore aplica `inert`/`aria-hidden` nos irmãos.

---

## 🎨 Cadeia de contraste: tokens de preenchimento e o Toast

O app mede contraste com a matemática WCAG 2.1 em `src/shared/__tests__/helpers/contrast.ts`, usada pelos testes: `tokens.test.ts` (nível de token), `accentBackgroundContrast.test.ts` (call sites, que varre as class strings do `Toast.tsx`) e `Toast.test.tsx` (que **renderiza** o componente real e mede as classes resultantes do DOM). O `Toast` em si não importa esse helper — é o que os testes medem, não o componente. A regra que organiza a família toda:

> **Um token de fundo e a tinta que fica sobre ele são escolhidos como um par, e nenhum dos dois muda com o tema.**

### O defeito

O `Toast` pintava `bg-[var(--color-danger)]/90`, `bg-[var(--color-success)]/90` e `bg-[var(--color-accent)]/90` com `text-[var(--color-text-primary)]`. Isso é a **mesma falha estrutural** que `--danger-fill` / `--warning-fill` já existiam para remover: um token de **primeira plana** (foreground) usado como **fundo**, emparelhado com uma tinta que **vira near-white no `.dark`**. O par que funciona num tema quebra no outro, e nenhuma tinta única corrige os dois.

| variante  | light (antes) | dark (antes) | light (depois) | dark (depois) |
| --------- | ------------- | ------------ | -------------- | ------------- |
| `error`   | 3.10:1        | **2.07:1**   | 4.77:1         | 4.77:1        |
| `success` | 3.84:1        | **2.10:1**   | 5.36:1         | 5.36:1        |
| `info`    | 3.38:1        | 3.18:1       | 6.29:1         | 6.29:1        |

Os seis pares reprovavam WCAG 1.4.3. Em dark, o toast de erro era um pílula rosa-claro com texto quase branco — não um contraste insuficiente, era um toast ilegível.

### A decisão: tinta pareada + preenchimento sólido

Três opções foram avaliadas:

| opção                            | veredito          | por quê                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baixar o alpha (`/90` → `/60`)   | **rejeitada**     | o alpha **não é a causa**, é o amplificador. Diminuí-lo move a cor efetiva _mais_ para perto do que está atrás — e o toast é `fixed` sobre conteúdo arbitrário, então o par deixa de ser decidível a partir da class string. Não há como provar que ficou correto. |
| Tinta pareada sobre fundo sólido | **escolhida**     | o fundo sólido dispensa totalmente a hipótese de backdrop, e cada variante leva a sua tinta que não vira — exatamente como `--accent-fill-fg` e `--danger-fill-fg`.                                                                                                |
| Fundo semântico novo             | **desnecessária** | `--accent-fill` e `--danger-fill` já eram o padrão certo; faltava o terceiro membro da família.                                                                                                                                                                    |

O **sólido** também importa mecanicamente: `isSolidBg` mede apenas fundos sólidos, então um `/90` deixaria o toast no ponto cego documentado do guard. Tokenizar levou o toast para dentro do alcance da guarda principal.

### Tokens

`--positive-fill: #007a55` e `--positive-fill-fg: #ffffff` (Tailwind v4 `emerald-700`), declarados **em `:root` e em `.dark` com valores idênticos** — é a redundância proposital que faz uma edição de um tema só virar falha de teste. `white` sobre `#007a55` dá 5.36:1, e o preenchimento segura 5.01:1 contra o canvas claro e 3.66:1 contra o escuro, então o corpo do toast continua visível como contorno (WCAG 1.4.11).

Sem `-hover` de propósito, ao contrário dos outros dois: aqueles respondem a um **botão**. Um toast é `role="region"`, não tem interação de ponteiro e se descarta sozinho — um token de hover ficaria sem consumidor, que foi exatamente como `--accent-fill` foi declarado e não usado.

O `accentBackgroundContrast.test.ts` lê as class strings reais do `Toast.tsx` em vez de repetir numa tabela, mede cada variante sobre as 5 superfícies em ambos os temas, e exige que a tinta **não vire** entre eles — a asserção que sobrevive a uma refatoração que mude as cores.

### O botão de fechar e o indicador de foco

A correção do texto deixou duas coisas sem medir, e as duas reprovavam. Um botão de fechar é um **controle**, e o indicador visual de um controle é um caso de **contraste não textual** — WCAG 1.4.11 pede 3:1, não os 4,5:1 do texto. O texto da mensagem passar em 1.4.3 não dizia nada sobre o botão.

| o que estava                                          | medido                                | agora                                    | barra (1.4.11) |
| ----------------------------------------------------- | ------------------------------------- | ---------------------------------------- | -------------- |
| glifo do fechar a `opacity-70` sobre o fill de danger | **2,75:1**                            | `opacity-90` → **4,01:1** (hover 4,77:1) | 3:1            |
| anel de foco `ring-[var(--color-accent)]/50`          | **1,00:1** no fill de info (light)    | anel opaco de duas tonalidades           | 3:1            |
| o mesmo anel com `opacity-90` no **botão**            | **4,01:1** em vez de 4,77:1 no danger | opacidade movida para o **glifo**        | 3:1            |

O anel antigo media **1,00:1** porque em light `--color-accent` e `--color-accent-fill` são o mesmo valor (`#4f46e5`): o anel a 50% compunha exatamente o próprio fill._some e `focus-visible:outline-none` desligava o contorno do navegador que teria servido de reserva — foco chegava e nada era desenhado.

A opacidade fica **só no glifo** (`<X>`), nunca no botão: `opacity` no elemento compõe junto o `box-shadow` do anel, que é como o anel é pintado, e o indicador saía 4,01:1 em vez dos 4,77:1 que o token entrega. O glifo mantém os seus 4,01:1 em descanso e 4,77:1 no hover, e a hierarquia dele contra a mensagem não muda. Duas regressões garantem que isso não decai: uma falha se qualquer `opacity` voltar ao botão ou a até quatro ancestrais, outra falha se o glifo parar de estar desênfatizado — assim "mover" não vira "apagar".

A troca é por **duas tonalidades**, porque uma cor não dá conta disso: o anel claro senta no fill saturado e passa de 4,77:1 a 6,29:1 em todas as variantes, e o offset escuro é a única parte que encontra uma superfície de página, passando de 17:1 a 20:1 contra as claras. Os tokens são `--focus-ring-light` e `--focus-ring-dark`, declarados em `:root` e em `.dark` com valores idênticos — um anel de foco que troca de tema é um anel que some em um deles. Nenhum dos dois é uma cor de foco geral: o claro é 1,00:1 sobre `--surface-raised` e o escuro é 1,00:1 sobre o canvas escuro, e é por isso que o componente escolhe o par pelo próprio fundo.

`Toast.test.tsx` **renderiza** o componente e mede as classes que o DOM realmente tem. Isso importa: `expect(button.className).toContain("ring-white")` passaria para uma classe que nunca renderiza, num tamanho que não desenha nada, ou com um alpha que cancela o fill. O teste afirma as razões reais.

### O piso da população adiada, medido em _sites_

O guard conta uma população que ele **mede mas não fiscaliza**: as washes translúcidas e os fundos de paleta do Tailwind. Essa população é pinada como piso de regressão — e o piso é expresso em **sites**, nunca em arquivos.

A contagem por **arquivo** é a unidade errada porque **não enxerga um site mudando de forma**: migrar `bg-[var(--color-accent)]/20 text-[var(--color-accent)]` para um pareamento quebrado _diferente_ deixa a contagem de arquivos intacta, e o piso reporta verde sobre uma população tão quebrada quanto antes.

Quatro chaves já foram tentadas e três foram reprovadas, com razão — e são elas que explicam por que um **site** hoje é o elemento:

| chave                         | o que não enxerga                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| contagem de arquivos          | um site corrigido e um site que mudou de forma dão o mesmo número                                                    |
| conjunto **global** de formas | um site que migra de uma forma já permitida para **outra** forma já permitida: contagem igual, conjunto igual, verde |
| `arquivo#declaração#ordinal`  | a **substituição na mesma declaração**: dois elementos trocam de pareamento e todo ordinal continua no lugar         |
| forma (ou hash da forma)      | dois sites da mesma forma são indiscerníveis — a mesma falha com passos a mais                                       |

**A identidade de um site é o elemento JSX que o possui**, resolvida por um esquema híbrido:

1. **Um atributo estático que o elemento já tem** — `SpoolThumb` já carrega `data-testid="spool-thumb"`, e ele é reutilizado. Não acrescentar nada é melhor do que acrescentar algo, e um `data-testid` existente já promete que o elemento é endereçável isoladamente.
2. **Um comentário source-only ao lado do elemento** — `{/* contrast-site: <id> */}` quando o elemento está entre irmãos, e `/* contrast-site: <id> */` quando ele é a primeira coisa dentro de uma expressão parenthesada (`return (`, `{x ? (`, `{x && (`). Lá as chaves seriam um **literal de objeto** numa expressão, não um comentário, e o arquivo não compilaria. A forma é **derivada** da linha acima do elemento, e não assumida — foi essa derivação que pegou três sites que a lista manual dava como forma JSX.

O `data-testid` dinâmico do `ChangelogPage` (``data-testid={`latest-badge-${entry.version}`}``) **não** é identidade: um valor por render nomeia um source site só quando acerta. E `aria-label` nunca é consultado — em 20 destes sites ele é localizado, o que tornaria a chave uma string de tradução.

**Nenhum atributo de runtime é adicionado.** Os dois formatos de comentário são source-only: o formato JSX não renderiza nó nenhum, e o formato simples nem sequer é uma expressão JSX.

O censo reporta, por site, a **identidade do elemento** e as **formas** que ele tem hoje, e o pin é `identidade -> formas[]`. São **duas** formas por site em quatro elementos, que emparelham `bg-emerald-600` e o seu `hover:bg-emerald-500` com a mesma tinta. Identidade e forma são separadas de propósito: a identidade sobrevive a reformatação, deslocamento de linha e reordenação, porque nada disso move um comentário preso ao seu elemento; a forma é justamente o que o pin guarda como **valor** e o que pode mudar.

**A posse de uma identidade é exclusiva, e é posicional.** Um marcador — ou um `data-testid` estático — nomeia **exatamente um** elemento, e um marcador nomeia **apenas o próximo elemento JSX real**, lido através do `>` que fecha a tag de abertura, sendo consumido uma única vez. Se esse elemento não tiver pareamento adiado, o marcador fica **órfão** e um elemento posterior **não** pode herdá-lo.

Isso fecha um vazamento real. A versão anterior escolhia o marcador mais próximo _antes_ de um literal de classe, o que não é a mesma coisa: um marcador cujo elemento não tinha pareamento adiado entregava sua identidade ao elemento seguinte, de modo que um sítio podia acabar nomeado por um comentário que estava acima de um irmão. O vínculo agora é calculado adiante e não é herdável.

Três condições reprovam, e **nenhuma delas é visível comparando totais** — com dois elementos de mesma forma, contagens e multiconjuntos são idênticos ao caso saudável, o que é exatamente por que a verificação é sobre posse e não sobre somas:

| condição             | o que significa                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| órfão                | o marcador não nomeia **nenhum** elemento — sobrou de um elemento apagado, ou nada segue ao comentário. Um elemento que existe mas **não tem** pareamento adiado **não** é órfão: é o que um sítio corrigido parece |
| identidade duplicada | uma identidade alcançada por dois elementos, por marcador ou por atributo                                                                                                                                           |
| marcador ambíguo     | dois marcadores reivindicando o mesmo elemento, que então não tem nome inequívoco                                                                                                                                   |

**Nenhuma contagem é asserida, e isso é deliberado.** Nenhuma asserção deste ficheiro conta a população de sítios. Saíram as contagens **exatas** (22 elementos proprietários, 26 pareamentos, 21 marcadores) e saíram também os **pisos** que as versionais anteriores usavam como garantia de que a varredura não ficou em silêncio: `pairings.length > 20`, `shapes.size > 10`, `census.failing.length <= 15`, `palette.failing.length <= 11` e `census.failing.length > 0`. Todos eles punem o trabalho que a guarda existe para fiscalizar — `failing > 0` reprovaria no dia em que o último sítio fosse corrigido, e `pairings.length > 20` reprovaria quando a população passasse de 21. O inventário medido em `b252319` — 22 elementos proprietários, 26 pareamentos de forma, 21 comentários de fonte em 14 arquivos de produto, 0 sem identidade, 0 falha de posse, 4 elementos com duas formas, 1 elemento resolvido pelo `data-testid` reutilizado — fica como **retrato datado**: não é limiar, não é gate, e nenhum teste o compara. São os mesmos números de `26cc674`, que não tocou fonte de produto; foram re-derivados em `b252319` em vez de transportados.

**Evidência dos seis gates, e o que ela não diz.** Árvore exata cujos seis gates valem: `b252319a34d74cfbaa954fdda9f0348d7adbffac` — rodados nela, com saída 0 nos seis: `test:run` (**236 arquivos / 3291 testes**), `test:run --coverage` (**82,97% statements, 77,01% branches, 78,58% functions, 84,04% lines**), `typecheck`, `typecheck:electron`, `lint` e `build:all`. A commit de documentação que traz estas figuras **segue** `b252319` e **não** foi ele próprio uma execução dos seis gates. Sobre a cobertura, o que se afirma é o que a tabela mostra: a tabela tem 262 ficheiros e **70 estão abaixo de 80% de linhas**, 12 deles a **0%** — `db-bridge.ts`, `storageAdapter.ts`, `RechartsLazy.tsx`, `useCurrency.ts`, `csvExport.ts`, `quoteApi.ts` entre outros. Uma afirmação anterior de que nenhum ficheiro estava abaixo de 80% **estava errada** e foi removida. Isto **não** é uma falha de gate: a configuração do Vitest **não tem bloco `thresholds` por ficheiro**, logo nada é imposto automaticamente, e os seis gates passaram com saída 0. O que os agregados significam para a política de cobertura do projeto é interpretação que fica para o **gate final da Themis**, não uma conclusão deste ficheiro. Revisão e merge pendentes; nada liberado. Este trabalho é só o stage do Toast: o **#221 continua aberto, fora deste PR**, e fica enfileirado para depois deste stage, na ordem de um PR por vez.

**O que substitui a contagem, e o que fica comoaranteia.** A direção vem do **pin por sítio**: identidade -> formas, validado só sobre o fonte atual. E a garantia de que a varredura não está muda passou de um número para **fixtures dirigidas pelo scanner de produção** — fonte que o teste possui, passada por `scanWashesInSource` e `scanPaletteInSource`, exigindo que encontre os pareamentos que foi escrito para achar e que reporte zero numa fonte sem nenhum. Duas medições reais sobrevivem, ambas escolhidas por serem monotónicas no sentido certo: `unresolved` tem de ser **0** em ambas as famílias, porque o censo falha fechado e um par indecifrável tem de aparecer em vez de passar por limpo; e a metade **passing** tem de ser **não vazia**, porque só cresce à medida que sítios são corrigidos e portanto castiga uma varredura quebrada sem castigar uma correção. A asserção sobre a árvore real é de integridade e passa hoje: a varredura resolve, todo sítio atual bate com o seu pino, e não há identidade ambígua, órfã, duplicada nem reaproveitada.

**O pin é de uma direção só.** Um sítio corrigido deixa entrada obsoleta e **não** gera falha, porque corrigir um sítio nunca pode reprovar a suíte — só baixar a contagem. A asserção que exige o contrário, que toda forma pinada ainda apareça em algum lugar da árvore, é removida de propósito: ela falharia exatamente quando a política estaria funcionando, porque resolver o último dono de uma forma tira a forma da população, e isso é progresso. O que é verificado é a direção oposta — todo sítio **atual** existe, tem exatamente uma identidade e casa com o **seu próprio** valor pinado; identidade nova ou forma alterada reprova. A validação é de **uma direção só, sobre o fonte atual**: todo sítio que está a falhar tem identidade pinada única e a sua própria forma; identidade nova, forma alterada, ambiguidade, identidade em falta e par não resolvido reprovam. Um sítio resolvido deixa entrada obsoleta e não gera falha. É o **pin por sítio** que substitui a contagem, e é mais forte: ele nomeia o sítio, enquanto um total apenas notaria que alguma coisa mudou sem dizer o quê.

A regressão do sítio resolvido corre pelo **caminho integrado de produção**, `validateRealTree`, que varre todos os componentes, resolve a identidade de cada pareamento, recolhe as falhas de posse e compara cada sítio atual com o seu pino. A versão anterior filtrava a resposta do censo e chamava `siteFaults` — o que, por construção, não vê uma falha de identidade, e portanto não falharia quando um sítio corrigido fosse acusado de órfão. Três testes o dirigem, substituindo o fonte de um ficheiro e deixando o resto da árvore real: um sítio corrigido de facto passa com a entrada obsoleta intacta; um sítio novo com identidade inédita reprova por `unpinned`; uma forma que mudou no sítio real reprova por `changedForm`. O sítio escolhido é `price-hero-margin-label`, wash cujo dono único é ele próprio — a wash de acento tem cinco donos e passaria pelo motivo errado.

**A identidade é estável, e o custo é real.** Sobrevive a deslocamento de linha, edições acima do site, reformatação, reordenação e mudança de forma. O custo assumido é de **volume**: 21 comentários source-only em 14 arquivos de produto, em arquivos que não têm relação com acessibilidade. A alternativa era uma anotação estável dentro do fonte, que seria mais forte e exigiria ainda mais churn; e ancorar em linha, ordinal ou forma foi reprovado porque não vê a substituição. O outro custo é o de manutenção: um site corrigido deixa entrada obsoleta no pin, porque a política é deliberadamente **de uma direção só** — corrigir um site nunca pode reprovar a suíte.

**O censo falha fechado.** Um pareamento que ele não consegue decidir — um passo de paleta fora do mapa do Tailwind, uma tinta com token não declarado — vai para `unresolved` e **não** conta como site em nenhuma direção. A alternativa é o defeito corrigido aqui: um site descartado é invisível para **qualquer** verificação que conte sítios, e `worst` deixado em `Infinity` classificava um pareamento não medido como **aprovado** — uma medição ilegível registrada como limpa, e a ausência dela lida como progresso.

**A regressão passa pelo scanner de produção, e está commitada.** As provas anteriores passavam identificadores fabricados direto para a comparação, e nunca exercitavam o parsing; uma delas chegou a afirmar prova por mutação sem que os testes correspondentes tivessem entrado no commit. As de agora dirigem `scanWashesInSource` e as funções reais de identidade sobre fonte malformada, e afirmam sobre as falhas que o código produziu:

- um marcador antes de um elemento pareado e depois um **segundo** elemento pareado: o primeiro consome o marcador e o segundo é reprovado como **sem identidade** — sem herança;
- marcador antes de um elemento que **já não tem** pareamento adiado, seguido de um elemento pareado: **não** é órfão, e o par posterior continua sem identidade, de modo que o pino o acusa como sítio novo e não pinado — faulta correta para um sítio corrigido;
- dois marcadores num elemento só: **marcador ambíguo**;
- id de marcador duplicado em dois elementos, e `data-testid` estático duplicado: **identidade duplicada**;
- marcador sem nenhum elemento depois: **órfão**;
- a troca A/B na mesma declaração, com multiconjunto e contagem do arquivo idênticos e os dois sítios nomeados. Anteriormente isso reprovava por uma contagem de formas por família; já não há contagem nenhuma, e ele reprova pelo pin, nomeando os dois sítios.

Não há teste de mutação commitado neste repositório, e nenhuma das afirmações acima é um teste de mutação. O que existe são **regressões de comportamento** que passam pelo scanner de produção e afirmam sobre as falhas que o código de produção produziu, mais **duas mutações manuais feitas durante este trabalho** e revertidas em seguida: (1) **repor a regra de órfão antiga**, a que marca como órfão um elemento que existe mas já não tem pareamento adiado — o teste do sítio corrigido passou a reprovar, nomeando `price-hero-margin-label [orphanMarker]`, que é exatamente o defeito, e o teste antigo basado em `siteFaults` sobre linhas filtradas à mão **não** reprovou, como se previa; (2) **neutralizar `siteFaults`** — dez testes reprovaram, incluindo os três integrados. Ambas são reconferíveis reaplicando a alteração; a garantia de que os restantes casos reprovam sob as respetivas mutações vem de os testes afirmarem sobre a falha produced, não sobre um número.

Duas correções de parsing vieram junto: o `stripComments` passou a preservar **tamanho**, não só quebras de linha — o branch de `//` apagava texto, então um offset no fonte removido não era um offset no original, e a resolução de identidade encontrava elementos centenas de linhas longe; e a tag proprietária é lida até o `>` correspondente, com-awareness de string e de chave, para que `onClick={() => …}` não trunque a varredura.

**O censo falha fechado.** Um pareamento que ele não consegue decidir — um passo de paleta fora do mapa do Tailwind, uma tinta com token não declarado — vai para `unresolved` e **não** conta como site em nenhuma direção. A alternativa é o defeito corrigido aqui: um site descartado é invisível para **qualquer** verificação que conte sítios, e `worst` deixado em `Infinity` classificava um pareamento não medido como **aprovado** — uma medição ilegível registrada como limpa, e a ausência dela lida como progresso.

Os números citados antes no cabeçalho do arquivo estavam **errados por ~2,5x**, e errados na direção que faz um piso parecer _menos_ trabalho do que existe:

| família         | citado (antigo)  | real (commit base)                 | medido em `b252319`                   |
| --------------- | ---------------- | ---------------------------------- | ------------------------------------- |
| washes          | 48 / 13 arquivos | 18 sites / 10 formas / 11 arquivos | **15 sites / 8 formas / 10 arquivos** |
| paleta Tailwind | 27 / 8 arquivos  | 11 sites / 4 formas / 7 arquivos   | **11 sites / 4 formas / 7 arquivos**  |

A coluna da direita deixou de ser um alvo de teste. As contagens de sítios e de formas foram **retiradas** — eram pisos, e um piso reprova o progresso — e o que substitui cada uma é o **pin por sítio** descrito acima. A tabela fica como registo do que foi medido e quando; nenhum teste compara estes números.

A queda de 18 para 15 é o toast: as três variantes `/90` saíram da população ao virarem preenchimentos sólidos. Além disso, o regex antigo casava **só o token accent**, então nunca contou as washes de status — `--color-danger/90` e `--color-success/90` eram invisíveis para ele, e eram os **dois piores pares do app**. Um piso que não cobre a população da qual é piso é decoração.

A lista de formas é uma **allowlist de uma direção só**: uma forma nova, não listada, reprova; uma forma listada que deixou de ocorrer **não** reprova, porque a regra deste arquivo é que corrigir um site nunca pode reprovar a suíte. **O custo disso é real e vale nomear: um site migrado deixa uma linha obsoleta aqui.** Foi aceito em vez de resolvido com uma asserção bidirecional porque a alternativa pune exatamente o comportamento que a guarda existe para encourenciar — e uma guarda que grita lobo acaba desativada. A contagem de sites **não** está pinada ao lado da lista, e é essa a forma final do compromisso: o pin por sítio dá a direção sem dar o número.

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
- **Seed:** `db/seed.ts` povoa os catálogos de impressoras (103), materiais (31) e marketplaces (6)
- **Campos técnicos opcionais (W10a):** impressoras podem trazer `technology` (`fdm`/`resin`), `buildVolumeMm`, `nozzleDiameterMm`, `maxSpeedMmS` e `websiteUrl` (página oficial — aberta só pelo usuário; o app faz **zero** chamadas de rede); marketplaces podem trazer `logo` (arte SVG original, não logos registrados). Os dados **econômicos** (`value` em R$, `power`, `usefulLife`, `maintenancePerHour`) continuam sendo do app e não foram importados — detalhes em [`docs/CREDITS.md`](docs/CREDITS.md)

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

| Variable                | Values           | Purpose                                | Default                                                        |
| ----------------------- | ---------------- | -------------------------------------- | -------------------------------------------------------------- |
| `OPEN3DCALC_DB_PATH`    | path string      | Custom path to SQLite file (tests/CLI) | —                                                              |
| `VITE_TOOLPATH_PREVIEW` | `true` / `false` | Enable the 3D G-code toolpath preview  | `true` (validated in the beta channel; set `false` to disable) |
| `VITE_BETA_CHANNEL`     | `true` / `false` | Selo visual de beta no app web         | `false`                                                        |

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

> 🐕 **Dogfood:** o **preview 3D do G-code** (D-CL5/D-CL6) foi dogfoodado no canal beta (`v1.13.0-beta.1..3`, 3 betas / 1933 testes / paridade do oráculo legado validada) e aprovado para a release estável — agora está **ligado por padrão em todos os builds** (`VITE_TOOLPATH_PREVIEW=false` ainda desliga; veja a tabela de env vars acima). O canal beta segue como o canal de dogfood das próximas novidades.

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

**Mudança da fonte do Pages (cutover, já concluído)**

Como o beta vive em `gh-pages/beta/` e a raiz de `gh-pages` é a estável, a fonte do GitHub Pages foi mudada de _GitHub Actions_ para a **branch `gh-pages`**: _Settings → Pages → Build and deployment → Source: **Deploy from a branch** → branch **`gh-pages`** / pasta **`/ (root)`_**.

> ✅ **One-off concluído:** o workflow `.github/workflows/seed-gh-pages.yml` populou a raiz de `gh-pages` com um build estável durante o cutover (sem apagar `/beta/`, run `35358169749`) e foi **removido** na sequência — existia apenas para esse cutover pontual. Hoje a raiz é mantida pelo `ci-cd.yml` (build-web) a cada tag estável.

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
