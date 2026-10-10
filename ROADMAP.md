# 🗺️ Open3DCalc — Roadmap

> **Date:** 09/10/2026 (documento original: 18/09/2026)
> **Purpose:** Priority guide for the evolution of Open3DCalc.
> **Flow:** Every feature follows → branch → PR → review → merge (`BRANCH-POLICY.md`)

## Product Principles (Non-negotiable)

- Open3D Calc is permanently free: there will be no monetization, paid plans, subscriptions, checkout, or billing.
- Local-first architecture and data minimization are the default.
- LGPD and privacy-by-design are continuous, mandatory requirements for every change and every phase.
- Telemetry is only allowed with explicit opt-in consent.
- Consent, tutorial, onboarding, and migration flags must never be synchronized.
- Users must be able to export and delete their data.
- Privacy documentation and a privacy review are required before every release.

## Estado dos canais publicados — verificado em 09/10/2026

- **Estável:** `v1.14.0`.
- **Beta web:** `v2.0.0-beta.15` (pré-release; canal web-only).
- **Versão no `main`:** `2.0.0-beta.15`; isso não promove `main` a estável nem autoriza uma publicação estável.

### Auditoria da beta.13 — snapshot histórico de 08/10/2026

As observações abaixo registram a auditoria daquela publicação e não devem ser tratadas como verificação da beta.15. A tag `v2.0.0-beta.13` apontava para `d08a4eafcc5fc20d03867a08bd417fae390f6b10`; naquele snapshot, `/beta/index.web.html` referenciava `assets/index.web-BFz5JDpp.js`. Merge de código, por si só, não comprova que a interface esteja montada ou publicada na web.

- PRs #248–#264 estão na beta.11, exceto #254 (fechado sem merge). #264 corrigiu a saída web após a falha da beta.10 e antes da publicação da beta.11.
- A web beta monta `StudioLayout`, com sidebar de dez módulos; isso não corresponde aos cinco destinos definidos em 7o.2.
- `ProfitAnalyticsModule` e `MaterialEfficiencyHeatmap` existem no source, mas não na shell web ativa: o primeiro está no Dashboard compartilhado e o segundo não tem mount de produção encontrado. Não afirmar UI pública entregue.
- Mini-Dash usa números/alertas demonstrativos. O Copilot usa respostas locais fixas, apesar do rótulo “Copilot IA”; não é IA funcional e `v2-no-ai` continua vigente.
- Os gates PII/export existentes não completam a checklist transversal LGPD das linhas 76–98.
- Em 7q, IA, frota fora desta fase e vínculo cliente já têm decisão; continuam abertas a unidade de `usefulLife` e a formalização da decisão sobre `Example`. Coverage da beta.11 não foi medida.

## Approved Beta test-only strip-down (merged; Beta web published)

The owner approved D1–D12 for a Web-Beta-only profile intended for synthetic test data. This
entry records the approved Beta profile and distinguishes it from the Stable/Desktop policy.
The Stable manifest now
uses policy 1.9, which supersedes the former policy 1.8 plaintext restriction for its exact
three-key scope; prior receipt bytes and encrypted-entry versions remain unchanged. Desktop
follows the Stable policy 1.9 contract and is not part of the Web-Beta profile.

- The Beta app uses only the three exact `open3dcalc_beta_test_*_v1` localStorage keys in
  plaintext. Synthetic-only is an intended-use restriction: the app does not validate record
  contents, so real customer, quote, and history data must not be entered.
- Namespace isolation is app-mediated, not a same-origin security boundary. Same-origin scripts,
  browser extensions, and DevTools can access browser storage.
- Beta must not access Stable/legacy keys, migrate or sweep namespaces, open the vault/IndexedDB,
  Cache API, SQLite, snapshots, or the desktop bridge, or expose consent/password, erasure,
  deletion, import/export, sync, or backup paths.
- The first-run disclosure states test-only, intended synthetic use, stored unencrypted, no
  password, no migration/export, and disposable browser profile. Desktop is unaffected.
- Implementation and local verification were completed in PR #279 and merged into `main`.
  The current web Beta is `v2.0.0-beta.15`; this Beta publication does not promote the
  separate Stable/Desktop policy. Final Themis review and explicit owner/legal approval remain
  required before Stable promotion.

---

## Priorities (Execution Order)

### 🧹 Higiene do repositório — o que está preservado, o que está órfão e o que não volta

> **Por que fica no topo e não no rodapé.** É a única informação deste documento que não descreve uma fase. É estado do repositório, não plano de produto: enquanto morar no fim do arquivo, ninguém a lê antes de decidir o que apagar.

**Tags `archive/*` — 19 preservadas, 1 extraída até agora.**

| Métrica                                                   | Número |
| --------------------------------------------------------- | ------ |
| Tags `archive/*` no repositório                           | 19     |
| Já extraídas e portadas                                   | 1      |
| Ainda apenas preservadas pela tag                         | 18     |
| Tags no total (38 `v*` + 2 `pre-split*` + 19 `archive/*`) | 59     |

- [x] **`archive/modern-layout-ee5ab13` → extraída.** Os 4 modos de apresentação do painel de resultados (`compact` / `tabs` / `dock` / `expanded`), o `SidebarMode` e o `ResultsSidebar` chegaram em `2ee1332`, no PR #248, junto de 3 suites de teste. A zona foi verificada arquivo por arquivo antes de aplicar: `CostDistributionBars.tsx` foi deliberadamente **não** portado porque já existe em `main` como superconjunto (90 linhas contra 79 da tag, com o guard `Number.isFinite(segment.pct)` que a tag não tem) — aplicar o blob da tag seria regressão silenciosa.

**Regra vigente: nenhuma tag é apagada antes de auditoria granular por arquivo.**

- [x] A armadilha já foi demonstrada uma vez. Uma classificação por `git cherry` classificou `eng-calcs-7d9b09d` como "órfã" e quase a descartou — e era exatamente ela que guardava `printToleranceData.ts` (164 linhas) e o teste (176), código implementado, testado e drop-in, que alimenta a **Phase 6 P2** ainda desmarcada. Classificação por conjunto não é auditoria. Auditoria é abrir o conteúdo.
- [ ] Nenhuma das 18 tags restantes é apagada antes de ser aberta arquivo por arquivo, com o mesmo rigor da extração de `modern-layout-ee5ab13`.

**Branches órfãs ainda não abertas arquivo por arquivo**, pela mesma armadilha.

| Medida (30/09/2026, em `7511904`)                                       | Comando                                       | Resultado                                     |
| ----------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Branches locais não mescladas em `main`                                 | `git branch --no-merged main`                 | 38 (inclui a branch de trabalho atual)        |
| Idem, excluindo a branch de trabalho                                    | idem, menos `feat/layout-chrome-layer`        | **37**                                        |
| Branches remotas não mescladas em `main`                                | `git branch -r --no-merged main`              | 18 (inclui `origin/feat/layout-chrome-layer`) |
| Idem, excluindo a branch de trabalho                                    | idem, menos `origin/feat/layout-chrome-layer` | **17**                                        |
| Nomes distintos na união local ∪ remoto, excluindo a branch de trabalho | união das duas listas, `sort -u`              | **46**                                        |

- [x] A contagem registrada anteriormente como "39 branches órfãs" **não se reproduz** em nenhuma das medidas acima. O número honesto é o da tabela, com o comando ao lado para que qualquer pessoa refaça a conta em vez de confiar no algarismo. Nenhuma limpeza depende do número: dependem de cada uma das 46 ser aberta.
- [ ] Nenhuma branch é apagada ou podada antes de ser aberta arquivo por arquivo. As branches sobrevivem a merges por squash: `git branch --no-merged main` lista trabalho que **já está** em `main` — 8 dos 37 nomes locais existem também no remoto — e, ao mesmo tempo, pode esconder trabalho que não está. As duas respostas exigem abrir o arquivo, não confiar no grafo.
- [ ] A lista é triada por arquivo em três grupos: conteúdo já em `main` via squash, conteúdo exclusivo e ainda não portado, e conteúdo sem valor. Só o primeiro grupo é descartável com consciência.

**4 componentes órfãos dentro do próprio `Example/` que não serão portados.**

| Componente                        | Importadores                            | Veredito                                                                        |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `MonthlyRevenueProjectionSection` | 0                                       | Não portar — e ver a duplicação abaixo                                          |
| `HeaderNav`                       | 0                                       | Não portar                                                                      |
| `LayoutComparisonModal`           | 0                                       | Não portar                                                                      |
| `StudioLayout`                    | 1 (`App.tsx:18`), **nunca renderizado** | Não portar — importado, não usado; `"studio"` não está no union de `LayoutMode` |

- [x] `StudioLayout` **não** tem zero importadores: tem exatamente um, `Example/src/App.tsx:18`, e o componente nunca é renderizado. A afirmação "importado por todos, renderizado por nenhum" era a correta; a contagem de zero importadores, não.
- [ ] `MonthlyRevenueProjectionSection` **duplica** `MonthlyRevenueProjectionCard` com defaults contraditórios. Não é refatoração pendente: são duas respostas diferentes para a mesma pergunta, e as duas estão no mesmo protótipo.

| Default               | `MonthlyRevenueProjectionCard` | `MonthlyRevenueProjectionSection` |
| --------------------- | ------------------------------ | --------------------------------- |
| Dias por mês          | 26 (`:40`)                     | 30 (`:41`, `daysInMonth = 30`)    |
| Ocupação alvo         | 65% (`:41`)                    | 70% (`:38`)                       |
| Valor/hora de receita | R$ 18,50 (`:90`)               | R$ 36,50 (`:62`)                  |
| Margem média          | 52% (`:92`)                    | 63,5% (`:70`)                     |

Nenhuma das duas é medida; as duas são fallback de um dataset fictício. Escolher uma é decisão de produto do dono, não refactor.

### 🔐 Cross-cutting: LGPD & Privacy-by-design

Every phase and change must complete this checklist:

- [ ] Inventory the data collected, generated, stored, and shared.
- [ ] Document the purpose and applicable legal basis for each data category.
- [ ] Collect consent separately for each optional purpose; never bundle consent.
- [ ] Apply data minimization by default.
- [ ] Define and enforce retention and deletion rules.
- [ ] Provide working export and deletion of user data.
- [ ] Protect local data and backups with appropriate access controls and encryption where applicable.
- [ ] Do not send PII to third parties without a documented purpose and legal basis.
- [ ] Keep logs free of secrets and excessive PII.
- [ ] Review suppliers, integrations, and their data-processing terms before adoption.
- [ ] Run privacy regression tests for every relevant change.

**Objective acceptance criteria:**

- [ ] Each release includes a data inventory, purpose/legal-basis record, retention rule, and privacy review.
- [ ] Optional telemetry has separate, explicit opt-in consent, and consent/tutorial/onboarding/migration flags are not synchronized.
- [ ] Export and deletion work for all user data, including local data and backups where applicable.
- [ ] Automated checks confirm that no unapproved PII leaves the device and that logs contain no secrets or excessive PII.
- [ ] Privacy regression tests pass before the release is approved.

### 🔒 Gate transversal de compatibilidade de dados — v2.0

**Obrigatório para cada etapa de implementação deste roadmap e como gate de release da Beta 5 e da 2.0.0.** A atualização de v1 para v2 precisa preservar os dados de trabalho da pessoa usuária: nenhuma atualização pode apagar, resetar, sobrescrever silenciosamente ou tornar inacessíveis dados de versões anteriores.

- [ ] Ler os dados existentes sem perda e preservar as chaves e formatos atuais de armazenamento dos dados centrais; preferir payloads aditivos para novas preferências.
- [ ] Antes de qualquer escrita ou migração, manter os dados originais recuperáveis por backup ou mecanismo equivalente. Migrações são versionadas, idempotentes, seguras para repetição após interrupção e falham fechadas — nunca fazem reset ou overwrite silencioso.
- [ ] Manter fixtures representativas de versões anteriores para configurações da calculadora, histórico, orçamentos, carretéis/inventário, catálogo/impressoras, clientes, produtos e preferências.
- [ ] Testar leitura das fixtures antigas, migração repetida, interrupção e retomada, round-trip de exportação/importação e a persistência de web e desktop, incluindo bridge, manifesto e sync.
- [ ] Registrar cada chave de persistência nova no SPEC-01 antes de usá-la, com política explícita de sync, exportação e apagamento. Não enfraquecer a política de privacidade nem sincronizar por acidente a visibilidade local das abas.
- [ ] Tratar preservação de dados em upgrade v1→v2 como requisito. Compatibilidade de downgrade — binários antigos lendo dados gravados pela v2.0 — é uma decisão separada de produto/release e não pode ser afirmada sem implementação e testes próprios.
- [ ] Até a decisão explícita sobre downgrade, não reescrever destrutivamente chaves anteriores e manter caminho de exportação/backup. Se uma migração exigida não puder ser não destrutiva, adiar a mudança de schema para depois da v2.0.
- [ ] Bloquear Beta 5 e 2.0.0 se qualquer fixture de versão anterior falhar, houver perda de dados ou permanecer migração destrutiva sem recuperação.

**Evidência parcial (09/10/2026):** comparação do source da `v1.14.0` com `main` confirmou que os stores Stable de clientes, orçamentos e histórico conservam suas chaves e versões persistidas. `src/shared/lib/__tests__/saveReloadChannels.test.ts` agora exercita fixtures sintéticas v1.14 desses três stores na Stable Web, incluindo hidratação, escrita e recarga. Isso cobre somente esses stores nesse canal e **não fecha** o gate transversal nem substitui a matriz completa de fixtures e superfícies.

**Bloqueio de compatibilidade Desktop identificado (09/10/2026; auditoria do source, sem leitura de perfis reais):** na `v1.14.0`, o persistence bridge do Desktop carregava e gravava clientes, orçamentos e histórico nas chaves `open3dcalc_customers_v1`, `open3dcalc_quotes_v1` e `open3dcalc_history_v2` da tabela SQLite `storage`. No `main` atual, `App.tsx` redireciona os três stores para o namespace disjunto `open3dcalc_pwless_*`; o bridge atual exclui as chaves antigas e o IPC de leitura legado está desativado. Não foi encontrado caminho que carregue ou migre essas linhas antigas. Portanto, em um perfil Desktop que ainda tenha dados v1.14 nessas linhas, o código atual hidrata o namespace novo, não os registros anteriores: eles podem permanecer fisicamente no perfil e ainda assim ficar inacessíveis na aplicação. As fixtures da Stable Web acima não cobrem esse caso. **A compatibilidade de upgrade Desktop não está aprovada e bloqueia a promoção Stable** até existir uma estratégia de preservação autorizada, documentada e testada sob a política de privacidade vigente; esta auditoria não autoriza ler perfis, reativar o IPC legado ou migrar dados.

### 🔴 Phase 1: Usability & Tutorials

**Problem:** Current tutorials and onboarding are not good. We need a smoother experience that teaches users how to use the calculator without getting in the way.

**What to investigate first (real USAGE):**

- [x] Tooltips on 52+ calculator fields
- [x] LevelToggle renamed (Quick/Detailed/Complete)
- [x] Non-blocking interactive tutorial
- [x] Onboarding with CTA to tutorial
- [x] Skip link + heading hierarchy + accessibility
- [x] Tooltips migrated to i18n (pt-BR + en-US)
- [x] Minimum touch targets (44px) on buttons

**Deliverables:**

- [ ] Optional anonymous telemetry (opt-in) to understand real usage
- [ ] Rewritten interactive tutorial (step-by-step, non-blocking)
- [ ] Progressive onboarding (shows features as the user progresses)
- [ ] Contextual tooltips on calculator fields
- [ ] Informative empty states (when there is no data)
- [ ] Visual feedback for actions (undo, confirmation, animations)
- [ ] "Quick Start" mode with pre-filled values for testing

**Acceptance criteria:**

- Tutorial can be skipped/dismissed at any time
- No blockers — the user can use the calculator without going through the tutorial
- Telemetry is opt-in with explicit consent

---

### 🔶 Phase 1.5: Advanced Usability (PR #7)

**Features delivered in PR #6:** Tooltips, LevelToggle, Tutorial, Skip link, i18n tooltips, accessibility.

**Next cycle — UX refinements:**

#### 5. Quick Start with pre-filled values

- [x] "Quick Start" button that fills the calculator with realistic values
  - PLA R$90/kg, 150g, 2h print, 10% failure rate
  - 50% margin, packaging R$5, shipping R$15
- [x] "Example" vs "Start from scratch" mode
- [x] Tooltip on the button explaining values are editable
- **Files:** CalculatorStore (reset/quickStart action), UI button
- **Tests:** Verify quickStart fills correctly

#### 6. Empty states for sections without data

- [x] Empty history: "No calculations saved yet. Your first result will appear here."
- [x] Empty inventory: "Add filaments to your inventory to speed up calculations."
- [x] Empty quotes: "Create your first quote to send to the client."
- [x] Empty estimates: same approach
- **Files:** HistoryTab, InventorySection, QuoteSection
- **Tests:** Rendering with empty list

#### 7. Smooth scroll between sections

- [x] `scroll-behavior: smooth` in global CSS
- [x] Active section highlighted in navigation
- [x] Smooth scroll when clicking on SectionNav
- **Files:** index.css, SectionNav.tsx

#### 8. Keyboard shortcuts

- [x] `Ctrl+Z` — Undo last change (undo in calculatorStore)
- [x] `Ctrl+Shift+Z` — Redo
- [x] `Ctrl+E` — Export result
- [x] `Ctrl+P` — Print/PDF
- [x] `?` — Show shortcut help
- **Files:** New hook `useKeyboardShortcuts.ts`, calculatorStore (undo stack)
- **Tests:** Simulate keydown events

**Acceptance criteria:**

- Quick Start fills all essential fields
- Empty states have illustration/icon + text + CTA
- Smooth scroll does not break anchor navigation
- Shortcuts do not conflict with browser shortcuts
- All 448+ tests pass

### 🟡 Phase 2: STL Upload + Interactive 3D Preview

**Problem:** The 3D preview exists but is limited — there is no user STL upload or interactive visualization integrated with the calculation.

**What already exists:**

- `src/shared/components/StlPreview/StlPreview.tsx` — basic Three.js component
- `src/shared/lib/stlParser.ts` — STL parser (374 lines)
- Three.js + React Three Fiber + Drei already configured

**What needs to be done:**

- [ ] STL/OBJ/3MF file upload with drag & drop
- [ ] Interactive 3D preview (rotation, zoom, pan)
- [ ] Automatic volume calculation from the 3D model
- [ ] Weight and material estimation based on volume
- [ ] Layer visualization (slicing simulation)
- [ ] Automatic FDM vs Resin detection based on model
- [ ] Support for multiple uploads and comparison

**Acceptance criteria:**

- Upload via click + drag & drop
- Responsive 3D preview (works on mobile)
- Volume calculated correctly (validation with known models)
- Estimated cost appears automatically in the calculation

---

### 🟢 Phase 3: Advanced Dashboard

**Problem:** The current dashboard exists but is basic — it lacks projections, business metrics, and analyses that help the user make decisions.

**What already exists:**

- `src/shared/components/Dashboard/Dashboard.tsx`
- `src/shared/components/Dashboard/RechartsLazy.tsx`
- Recharts 3 already configured
- `historyStore.ts` with historical data

**What needs to be done:**

- [ ] Main KPIs: total profit, average cost per print, average margin
- [x] Profit evolution chart (timeline)
- [x] Cost distribution by category (pie/bar)
- [ ] Projections: "if you print X parts per month..."
- [x] Period comparison (current month vs previous)
- [x] Top most profitable printers
- [x] Top most used materials
- [x] Executive report export (PDF)
- [x] Custom goals (e.g., "I want to profit R$500/month")
- [x] Low margin alerts for recurring parts

**Acceptance criteria:**

- Dashboard loads fast with historical data
- Responsive charts
- PDF export functional
- Real data (not mocked)

---

### 🔵 Phase 4: Multiple Stores, Channels & Printer Organization

**Scope:** Local-first organization of stores, channels, offers, and printers, with no mandatory external APIs or cloud services.

**What needs to be done:**

- [ ] Correct FDM/resin selection throughout the calculator and related data.
- [x] Apply configured marketplace fixed per-unit fees in the FDM and resin calculator flows; legacy calculator data derives the additive field from its selected fee profile without changing storage keys.
- [x] Separate the user's personal printer list from the built-in model library and make catalog profiles selectable in Classic and Bento.
- [x] Resolve personal printer profiles from the local catalog when restoring history and shared calculations.
- [ ] Apply channel-specific shipping rules and fees to calculations and offers.
- [ ] Separate `Marketplace` as a fee-template from `StoreChannel` as a concrete store/channel.
- [ ] Support multiple stores/channels and product offers with price, fee, shipping, margin, SKU, and URL.
- [ ] Preserve historical price and calculation snapshots.
- [ ] Separate `PrinterProfile` from `PrinterAsset` conforme a decisão da Phase 7d.
- [ ] Add printer location, group, technology, status, capacity, and maintenance data.
- [ ] Add filters, cards, tables, and a "use in calculator" action for printers.
- [ ] Add contextual dashboards and alerts for margin, stock, and maintenance.
- [ ] Provide a backward-compatible migration for localStorage and SQLite.

**Acceptance criteria:**

- [ ] Two stores in the same marketplace can use different fee configurations.
- [ ] Two machines of the same model can have different status and location.
- [ ] Existing data remains usable after migration.
- [ ] Historical calculations continue to use the values captured at calculation time.
- [ ] LGPD checks and privacy regression tests pass.

### 🟣 Phase 5: Product, Offers, Stock & Operational Insights

**What needs to be done:**

- [ ] Link products to their offers across stores and channels.
- [ ] Connect product calculations and offers to spool stock.
- [ ] Support minimum-margin rules and reverse-price calculation.
- [ ] Keep and display price history for products and offers.
- [ ] Add batch actions for products, offers, stock, and operational records.
- [ ] Add dashboards contextualized by store/channel and printer.

### 🟤 Phase 6: Maker Toolbox — benchmark Creative3DP Tools

**Context:** Competitive analysis of https://tools.creative3dp.com/ (September 2026) — a free, browser-only, no-upload toolbox built by the Creative3DP team (PETFusion recycler, AeroDry dryer, Luminark lamps). Their "everything runs locally in the browser, no upload" stance matches our local-first principle exactly. What follows is what they ship, what Open3DCalc already covers, and what actually enters the roadmap.

**Already covered by Open3DCalc — no action needed:**

| Creative3DP tool                                                                             | Open3DCalc equivalent                                                                              | Status                      |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| 3D Print Pricing Calculator (60+ printers, AMS purge, Etsy/eBay/Amazon fees, failure buffer) | Core calculator: 385+ printers, marketplace fees, failure mode, purge modeled in cost and estimate | ✅ Covered — ours is deeper |
| 3D Printing Cost Calculator (drop an STL → true cost)                                        | STL/G-code estimator with transparent "assumptions used" panel                                     | ✅ Covered                  |
| Resin Cost Calculator (FEP wear, LCD lifetime, IPA, wash & cure power)                       | `calculateResin()` models FEP per-print, LCD hour amortization, IPA volume, curing kWh             | ✅ Covered                  |
| STL Viewer (rotate, dimensions, volume, watertight check)                                    | `StlPreview` + mesh validation (winding, open edges, manifold)                                     | ✅ Covered                  |
| Print Time Estimator (STL → time/grams/cost, no slicing)                                     | `printTimeEstimator` + G-code parsing (Cura, PrusaSlicer, OrcaSlicer)                              | ✅ Covered                  |

**Gaps, prioritized:**

> 🧭 **Status da fase — Planejamento.** Todos os itens abaixo estão marcados para estudo: nenhum entra em implementação antes de definirmos juntos a abordagem técnica, o escopo e se a ferramenta se paga. O marcador 🧭 em cada item indica exatamente isso.

**P1 — strengthen the core (reuses existing stores and catalogs)**

- [ ] 🧭 **Filament Remaining Calculator** — weigh the spool → grams AND meters left (via diameter + density) and a "will tonight's print make it" check. Extends `filamentInventory` store and `filamentSpools` table with a tare-weight field, a built-in brand tare database (Bambu 208–216g, Prusament ~194g, Polymaker cardboard 140g, Anycubic 127g), and a meters-remaining calculation.
- [ ] 🧭 **Filament Cost Comparator** — side-by-side comparison of the 31-material catalog for the _current part_, factoring density and per-material failure rate, not just $/kg. Reuses the `modelComparison` store pattern (today it compares STL models; add a material axis).
- [ ] 🧭 **Water-washable resin cost path** — `PostProcessingResin` today always models washing as alcohol; add a water-washable mode that removes IPA cost. The catalog entry already exists.

**P2 — engineering calculators (new domain, pure math, fully local)**

- [ ] 🧭 **Hole Tolerance Calculator** — exact CAD diameter for heat-set inserts (M2–M8), bolts, bearings and magnets; material- and nozzle-aware compensation (PLA 0.10–0.30mm, PETG 0.15–0.30mm, ABS 0.20–0.35mm; size-dependent: +0.27mm at 3mm, +0.24mm at 5mm, +0.18mm at 10mm).
  - **Status real: a tabela de dados está pronta, testada e aguardando port. Falta o consumidor — a calculadora em si.** `archive/eng-calcs-7d9b09d` contém `src/shared/lib/printToleranceData.ts` (164 linhas) + `printToleranceData.test.ts` (176 linhas): drop-in absoluto, zero imports, dados puros, cobrindo compensação de furo por material e por diâmetro, insertos rosqueados M2–M8, furos ISO 273, catálogo de 14 rolamentos e offsets de encaixe. O que falta é a interface, a integração com a store e a validação com quemFabrica.
  - [ ] Portar `printToleranceData.ts` + teste em branch própria, **antes** de qualquer trabalho de layout: é código de toolbox da Phase 6 P2, e misturá-lo com a leva da beta 7 seria exatamente a mistura que a higiene do repositório está tentando desfazer.
  - [ ] Construir o consumidor por cima da tabela portada.
- [ ] 🧭 **Press-Fit Calculator** — press / snug / slide / free fits between printed and metal parts (press −0.1mm, snug +0.05mm, sliding +0.15mm, never-bind +0.35mm), bearing pocket numbers, and the teardrop self-supporting hole alternative for vertical holes.
  - **Status real: a mesma tabela de `printToleranceData` cobre os offsets de encaixe e o catálogo de rolamentos.** Não é uma segunda tabela a fazer: é o mesmo port, seguido de um consumidor próprio. Validação de quem fabrica é decisão do dono.

**P3 — mesh utilities (extends `stlParser` from read-only to read/write)**

- [ ] 🧭 **3D File Converter** — STL ↔ OBJ ↔ 3MF ↔ PLY, all routes, 100% local, no size limit. Requires real mesh serializers; today `stlParser` only analyzes and rejects unsupported formats.

**P4 — buying guidance (leverages the 385+ printer catalog)**

- [ ] 🧭 **"Which 3D Printer?" quiz** — a few questions → ranked recommendation from our catalog by budget, materials, build volume and use case. `techRecommendation` already recommends FDM vs resin from mesh geometry; this adds model-level ranking on top of the catalog.

**P5 — generative tools (biggest departure from the core; needs new geometry capability)**

- [ ] 🧭 **Gridfinity Calculator** — drawer dimensions → Gridfinity grid, the baseplates to print for your bed, the tallest bin that fits. Pure math — the cheapest entry point.
- [ ] 🧭 **Gridfinity Generator** — parametric bins and baseplates → STL/3MF export, corrected for your printer. Depends on P3 serializers.
- [ ] 🧭 **Gridfinity Customizer** — a library of ready-made Gridfinity parts (drawers, bit and battery holders, lids, trays).
- [ ] 🧭 **Image → STL / Lithophane Maker** — PNG/JPG → relief and lithophane with exponential (not linear) brightness-to-thickness mapping, which is what stops lithophanes looking washed out.

**Explicitly NOT copied from Creative3DP:**

- ❌ Blog / content-marketing funnel — different channel; our documentation stays in-app
- ❌ AdSense and GA4 analytics — we are telemetry opt-in and local-first
- ❌ "Visit Store" e-commerce funnel — Open3DCalc is permanently free, no monetization

**Acceptance criteria:**

- [ ] Every new tool runs 100% locally — no upload of user files or models
- [ ] New calculators ship with unit tests (calculation-logic coverage ≥ 80%)
- [ ] Mesh export never writes outside a user-chosen path without explicit consent
- [ ] LGPD checklist applies: generative tools create user files, so export/delete must cover them

### ✅ Phase 6 P1: Core Calculation — Filament, Resin & Machine Costs

**Problem:** The calculator knew the price of a full spool and a full bottle of resin, but not what you actually have left in your hand — nor which material or printer is the cheapest for the part in front of you.

> Branch `feat/fase6-p1-core`. Delivered in waves: **A** pure calculation libs (TDD, ≥90% coverage), **B** store / schema / migration wiring, **C** UI. All items below are implemented.

#### P1.1 — Filament remaining & spool tare

- [x] Pure libs `filamentRemaining` (net remaining grams, estimated meters, print coverage) and `brandTare` (built-in brand tare bank)
- [x] `tareGrams` on the spool schema + backward-compatible migration 0003 (legacy payloads stay byte-identical; absent tare falls back to the brand lookup)
- [x] Inventory card shows net remaining (g + m), a tare input with the brand value as placeholder (commit on blur, manual override preserved), and a token-backed coverage badge
- **Files:** `src/shared/lib/filamentRemaining.ts`, `src/shared/lib/brandTare.ts`, `src/shared/components/Catalog/SpoolRemainingBlock.tsx`, `FilamentInventory.tsx`
- **Tests:** `FilamentInventory.test.tsx` (7), `filamentRemaining` + `brandTare` lib suites

#### P1.2 — Water-washable resin (zero-cost washing)

- [x] `washType: "alcohol" | "water"` on `PostProcessingResin` (absent ≡ alcohol — byte-identical legacy compatibility)
- [x] Store auto-switches to `water` when a `water_washable` resin is selected; the manual override remains available afterwards
- [x] Washing cost (IPA) is zeroed in the calculation when `washType` is `water`
- [x] Segmented alcohol/water toggle in the post-processing block, with an explanatory note when water is active
- **Files:** `src/shared/types/index.ts`, `src/shared/stores/calculatorStore.ts`, `src/shared/lib/calculator.ts`, `HardwareSection.tsx`
- **Tests:** `calculatorStore.resin.test.ts`, `HardwareSection.test.tsx`, `calculator.extras.test.ts`

#### P1.3 — Material comparator & machine cost auto-fill

- [x] Pure lib `compareMaterialsForPart` + collapsible comparison table in the results panel (sort by cost, rank, current-material highlight, empty state, resin-not-comparable note)
- [x] Selecting a printer from the catalog derives the active tab's machine costs (single source of truth): `machineCost`, `depreciationMonths` (clamped ≥ 1), `maintenanceEnabled` + `maintenanceCost` with mandatory R$/h → R$/month conversion
- [x] Derive-once on selection — editing `hoursPerMonth` afterwards is intentionally not re-derived
- **Files:** `src/shared/lib/compareMaterials.ts`, `MaterialComparison.tsx`, `ResultsPanel.tsx`, `calculatorStore.ts`, `PrintSection.tsx`
- **Tests:** `compareMaterials` lib suite, `MaterialComparison.test.tsx` (9), `calculatorStore.logic.test.ts`

**Acceptance criteria:**

- [x] Every new i18n key exists in **both** pt-BR and en-US
- [x] New components ≥ 80% coverage; calculation libs ≥ 90%
- [x] WCAG AA: status colors only via design tokens or token-backed classes
- [x] Legacy saved payloads keep working without a forced migration (absent `washType`/`tareGrams`)

---

### 🌈 Phase 7: Adaptive Layouts & Progressive Onboarding

**Status em `2.0.0-beta.6`** (`main` = `2cd273f`): entregue para `classic`, `guided` e `bento`. A limitação "Bento read-only" registrada na `2.0.0-beta.2` está **superada**: a superfície é editável. O que resta é **paridade de cobertura** — os mesmos campos do Clássico — e não "tornar editável". Ver a reformulação na Phase 7i.

**Entregue:**

- [x] `layoutStore` com os modos `classic`, `guided` e `bento`, com persistência local.
- [x] `AppShell` extraído para concentrar a troca da superfície de cálculo.
- [x] `LayoutSwitcher` no header. O Guided já existia, mas era inalcançável porque nenhum componente chamava `setLayoutMode`; o seletor corrigiu esse ponto de entrada.
- [x] Inspetor Financeiro como refactor behavior-preserving do `ResultsPanel`: cálculos mantidos no hook e apresentação em cards.
- [x] Wizard progressivo de 4 passos (`GuidedWizard`).
- [x] `BentoSurface` com **quatro** cards financeiros no grid (`BentoMaterialCard`, `BentoMachineCard`, `BentoLaborCard`, `BentoPricingCard`) e o `ResultsPanel` em `variant="bento"` **acima** do grid, num landmark próprio (`#bento-results`). Grid responsivo `1 / md:2 / lg:3`. A contagem anterior neste documento dizia "cinco cards" e estava errada: o quinto elemento é o `ResultsPanel`, que não mora no grid. Hierarquia de duas colunas em `lg` entregue na beta 6 (`lg:col-span-2` no card Material, fechando 2+1 sobre 1+2).
- [x] Gauge do Bento ligado ao inventário real, sem dados fictícios ou contagem local.
- [x] SPEC-01 na versão 1.4, com três chaves de dados `ui_preference`, incluindo a chave de layout.

**Limitação conhecida:**

- [x] ~~O Bento foi entregue deliberadamente como read-only.~~ **SUPERADA.** A superfície é editável hoje, com cerca de 32 controles `BentoField` e 2 `BentoToggleField` distribuídos pelos cards, e o `calcLevel` do Clássico já é reusado via `isFieldVisibleForLevel`. A Phase 7i foi reformulada em consequência.
- [ ] O Guide de Perfis para associar persona a layout e `calcLevel` continua pendente.
- [ ] Estados vazios e feedback visual completos para as novas superfícies continuam em aberto.

**Acceptance criteria:**

- [x] Os três layouts estão acessíveis pelo header e o Guided deixou de ser um modo órfão.
- [ ] Os três layouts renderizam os mesmos resultados e oferecem a mesma cobertura de edição. **A causa bloqueante mudou:** não é mais a ausência de edição, é a cobertura de campos desigual entre Clássico e Bento (ver Phase 7i).
- [ ] Trocas de layout nunca entram no undo stack nem tornam o cálculo pendente.
- [ ] O wizard pode ser pulado ou dispensado em qualquer etapa; a calculadora permanece utilizável sem ele.
- [x] A chave de layout aparece no manifesto SPEC-01.
- [x] **A chave de layout está incluída na limpeza de dados.** Verificado: `rendererSweep.ts:14-18` faz um _default-deny_ por prefixo — `isAppKey()` aceita qualquer chave que comece com `open3dcalc_` **ou** que esteja no manifesto. `open3dcalc_layout_v1` satisfaz as duas regras, e a entrada do SPEC-01 declara `erasure: "erase_on_delete_all"`. A varredura não é uma lista de chaves: apagar a lista não a quebraria.
- [ ] **A chave de layout não tem teste de regressão de privacidade próprio.** Verificado: existe `navigationPrefsErasure.test.ts`, que prova as duas ramas da varredura para `open3dcalc_nav_v1` (inclusive a que só a regra de prefixo limpa, com o manifesto simulado sem a chave). Nenhum teste equivalente existe para `open3dcalc_layout_v1` — as únicas ocorrências da chave em testes são de registro de manifesto (`manifestGate.test.ts:106`, `dataManifest.test.ts:137-146`) e de store (`layoutStore.test.ts:13`). O critério original não separava as duas metades; separadas, uma está feita e a outra não.
- [ ] Os testes existentes continuam passando e as novas superfícies têm testes RTL.

---

### 💰 Phase 7b: Multi-Network Quotes, Marketplace Profit Comparison & Suggested Price

**Status em `2.0.0-beta.2`:** as três bibliotecas puras foram entregues; não existe interface para nenhuma delas.

**Entregue como lib pura, sem interface:**

- [x] `socialShare.ts` para links oficiais de compartilhamento e modelos de texto, sem chamadas de rede durante a geração.
- [x] `compareMarketplaces.ts` para comparar o lucro líquido no mesmo conjunto de marketplaces.
- [x] `suggestedPrice.ts` para cenários de preço, margem-alvo e profitabilidade.

**Pendente de interface:**

- [ ] `SocialShareModal` com pré-visualização e contadores.
- [ ] `MarketplaceComparison` com tabela ordenada, melhor resultado e ação para usar o marketplace.
- [ ] `SuggestedPriceTool` com cenários e ação para aplicar o preço.
- [ ] Textos e rótulos completos em pt-BR e en-US, incluindo a diferença entre margem sobre preço e markup sobre custo.
- [ ] Painel de premissas para explicitar as diferenças de taxa fixa e percentual.

**Referência de precificação:** [NovaLab 3D — `precificar-impressao-marketplaces`](https://www.novalab3d.app/documentacao).

**Acceptance criteria:**

- [ ] O compartilhamento funciona sem chamadas de rede na geração e sem deep links não documentados.
- [ ] As libs permanecem puras, seguras para NaN e sem Infinity; metas inviáveis são explicadas à pessoa usuária.
- [ ] O teste de paridade preserva a fórmula da calculadora até a centavo.
- [x] `src/shared/lib/calculator.ts` não foi alterado.
- [ ] As libs mantêm cobertura ≥90% e as interfaces, quando entregues, terão testes RTL, navegação por teclado e WCAG AA.
- [ ] A checklist de LGPD e os testes de regressão de privacidade passam para cada nova chave.

---

### 📦 Entregas entre a `2.0.0-beta.2` e a `2.0.0-beta.6`

> **Por que este bloco existe.** As fases 7, 7b, 7c, 7f e 7g registram o estado da `2.0.0-beta.2`. Duas betas completas foram publicadas depois, e o trabalho delas não pertencia a nenhuma fase — era transversal. Sem este bloco, o documento descreve um produto que já foi entregue duas vezes.

#### 🔐 `v2.0.0-beta.5` — segurança e privacidade

**PRs #236 e #241–#246.** Ondas W0–W7 da remediação de privacidade. Entregas:

- [x] Marcador de migração que parou de guardar conteúdo. `useAppInit` escrevia um objeto de recuperação durável — com histórico bruto, `baseEntries` e inventário de produtos — na chave `open3dcalc_migration_done_v2`, que o manifesto declarava `pii: false` / `non_personal_data`. O objeto removido é o que corrigiu a divergência entre a chave e a política.
- [x] Disclosure do resíduo plaintext legado. A cópia sem apagar é **divulgada**, não escondida: o que a beta 5 não faz é alegar apagamento seguro. A limitação está em `docs/privacy/BETA5-RELEASE-EVIDENCE.md` e é uma limitação, não um item aberto.
- [x] Resume idempotente. Repetir a operação não muda o resultado, inclusive após interrupção.
- [x] Re-home de PII do desktop via IPC somente-leitura. O renderer deixa de reescrever PII em plaintext; o main é o único escritor.
- [x] Harness de browser real (Chromium/Playwright), com `test:browser` rodando antes do publish.
- [x] Probe **packaged** dentro de `app.asar`, com matriz CI de 4 distros (`host`, `ubuntu24.04`, `debian12`, `rockylinux9`).

**Limitações registradas, deliberadamente não convertidas em item aberto:** o caminho _keyring disponível_ não foi exercitado — todos os probes retornaram `denied` / `encryption_unavailable` — e macOS/Windows e os backends reais `libsecret`/`kwallet` não foram cobertos.

#### 🎨 `v2.0.0-beta.6` — layout

**PR #247** (`2126865`). Quatro gaps:

- [x] **Hierarquia do bento.** O grid não declarava `items-start` e todos os cards de uma linha esticavam até a altura do mais alto. Medido a 1440px: Material e Mão de obra renderizavam a 497px, a altura do card de Máquina; passaram a 415px e 280px. `lg:col-span-2` no card Material fecha o retângulo 2+1 sobre 1+2 e elimina a célula vazia. Só classes de layout: nenhuma cor nova, nenhuma chave i18n nova, ordem do DOM — e portanto ordem de foco — inalterada.
- [x] **Composição de custo visível no Clássico**, de 3/5 para 5/5 categorias. A variante sidebar do card de custo escondia o donut e mostrava só as três maiores categorias; medido no sidebar a 1920px, Hardware (3,5%) e Falha (7,7%) só apareciam abrindo o disclosure. As barras passaram a ser o padrão do sidebar, com a lista completa visível de imediato; fora do sidebar nada muda.
- [x] **Seções numeradas.** StepBadge + numeração nas seções do Clássico.
- [x] **Sidebar agrupada**, com `SidebarGroup` e os grupos de módulos/recursos.
- [x] **Revisão de acessibilidade** que pegou dois landmarks com o mesmo nome acessível: uma região de módulos e uma navegação de recursos ambos se chamavam `nav.navigation`, e a lista de landmarks oferecia duas entradas idênticas que ninguém conseguia distinguir (WCAG 2.4.6). Coberto por `sidebarLandmarks.test.tsx`.

### 🎨 Phase 7c: Visual Catalogs (Printers & Marketplaces)

**Status em `2.0.0-beta.2`:** baseline visual entregue. Os selects têm thumbnails com fallback monograma `aria-hidden`; parte do catálogo de impressoras foi enriquecida com dados técnicos licenciados e a atribuição foi documentada.

**Entregue:**

- [x] Thumbnails no `Select`, com fallback de monograma marcado como decorativo por `aria-hidden`.
- [x] Enrichment de 70 das 103 impressoras com dados técnicos CC-BY-4.0 do swordlab.
- [x] Dados econômicos existentes preservados: o enrichment nunca sobrescreve preço ou outros valores comerciais.
- [x] `docs/CREDITS.md` com a atribuição da fonte.
- [x] Arte SVG própria para os fallbacks visuais, sem depender de logotipos registrados.

**Pendente:**

- [ ] Reescrita dos cards de `CatalogTab` com thumbnails, badges de tecnologia, arte de marketplace e busca textual.
- [ ] Completar a arte própria e a revisão visual dos assets ainda ausentes.
- [ ] Confirmar carregamento tardio e ausência de imagens quebradas em todos os estados do catálogo.

**Acceptance criteria:**

- [x] O fallback de monograma não é anunciado como informação por leitores de tela.
- [ ] Nenhuma entrada do catálogo renderiza uma imagem quebrada.
- [x] Nenhuma foto de fabricante ou logotipo registrado entra no repositório sem permissão documentada.
- [ ] Os assets de `public/` permanecem fora do bundle JavaScript e sob carregamento tardio.
- [x] O enrichment técnico não altera os dados econômicos existentes.

- [ ] Os dados do catálogo permanecem sem PII e as chaves de catálogo do SPEC-01 não mudam.
- [ ] Todos os rótulos novos existem em pt-BR e en-US; thumbnails são decorativas ou têm texto alternativo.

### 🧾 Pipeline e achados técnicos das betas 1 e 2

- **PR #191 — `package-lock.json` sincronizado:** o lockfile passou a refletir o grafo efetivamente instalado, removendo uma divergência entre manifesto, lockfile e ambiente de release.
- **PR #192 — trim de whitespace no input de versão:** o campo aceitou espaço no início ou fim; a release caiu duas vezes por esse caractere. O hotfix normaliza o valor antes do uso.
- **Ausência de seletor de layout na beta 1:** o `GuidedWizard` existia e funcionava, mas nenhum componente chamava `setLayoutMode`; portanto, o modo guiado era inalcançável pela interface. A correção foi integrada à onda A1 e entregue na beta 2.
- **Teste flaky de foco no Wiki** (`WikiPage.test.tsx`): falhava em cerca de 5% das execuções. A causa raiz era o uso de `useEffect` (fase passiva) em vez de `useLayoutEffect` no foco entre artigos; era um bug real de acessibilidade, não uma instabilidade artificial do teste. Corrigido em `f366726`.
- **Duplicação de inventário:** “Filamentos” e “Carretéis” apresentavam o mesmo array. O `spoolStore` é o owner único de `open3dcalc_filaments`; `filamentInventory.ts` é um shim. Não havia bug de dados, mas havia confusão de UX e ausência de deduplicação.
- **Alcance dos achados da beta 2:** PRs #191 e #192 corrigiram pipeline/operação e não indicam regressão na fórmula de cálculo.

---

### 🏭 Phase 7d: Gestão de Impressoras — perfis e ativos

**Status:** decisão arquitetural tomada; implementação planejada. Esta fase depende de uma nova chave no manifesto SPEC-01 e não modifica a biblioteca de cálculo protegida.

**Decisão arquitetural central:** `PrinterProfile` e `PrinterAsset` são entidades distintas.

**`PrinterProfile` — modelo reutilizável, sem estado operacional:**

- [ ] Identificação: `id`, nome, fabricante, modelo e `technology`.
- [ ] Capacidade: `buildVolumeX`, `buildVolumeY` e `buildVolumeZ`.
- [ ] Custos padrão: `typicalPowerW`, custo de aquisição padrão, moeda, `defaultUsefulLifeYears`, `defaultResidualValue`, `defaultDepreciationMethod`, `defaultMaintenanceCostPerHour` e `defaultLaborRate`.
- [ ] Override de energia previsto no perfil para consumidores que precisem substituir a premissa padrão.

**`PrinterAsset` — máquina física possuída e mantida:**

- [ ] Identificação e vínculo: `id`/`assetTag`, `profileId`, `serialNumber` e `siteId`/`locationId`.
- [ ] Operação: `status`, `acquisitionDate`, `acquisitionCost`, `availableForUseDate` e `queueEligible`.
- [ ] Contabilidade: overrides de vida útil, valor residual e método de depreciação.
- [ ] Uso e manutenção: `hourMeter`, `lastServiceAt`, `nextMaintenanceAt`, `bridgeId`/`externalDeviceId` e `lastSeenAt`.
- [ ] Observação livre: `notes`, sem armazenamento de credenciais.

**Justificativa:** duas impressoras idênticas podem ter custos, valor residual, uso e manutenção diferentes; o mesmo modelo pode estar em várias lojas. Depreciação contábil pertence ao ativo, não ao modelo, e manutenção pertence à máquina física.

**Estados separados, sem badge único:**

- [ ] Capacidade: ligada, conexão instável, offline ou ocupada.
- [ ] Job: livre, a imprimir, em pausa ou com erro.
- [ ] Manutenção: agendada, em curso, concluída ou atrasada.
- [ ] Saúde da conexão, independente dos três domínios anteriores.
- [ ] **Anti-padrão:** não tratar uma máquina offline como quebrada.

**Manutenção:**

- [ ] Plano com intervalos preventivos, registro de avaria, checklist, teste e liberação documentados.
- [ ] A máquina fica `out of use` até a manutenção ser concluída.
- [ ] A referência consultada não bloqueia a máquina automaticamente na fila; a elegibilidade é uma decisão operacional explícita.

**Custo por hora:** `energia + depreciação/h + reserva de manutenção/h + mão de obra amortizada`. A calculadora oferece três ações: **usar perfil padrão**, **usar ativo real** e **criar ativo a partir do perfil**.

**Integração com o cálculo:** a ação **Usar no Cálculo Atual** aplica potência, depreciação por hora e manutenção por hora. `src/shared/lib/calculator.ts` permanece intocável; a depreciação entra como parâmetro de entrada, no mesmo padrão dos demais custos de máquina.

**Privacidade no MVP:** sem telemetria externa. Status e horas são declarados pela pessoa usuária e mantidos local-first; não há integração com API de fabricante nem Bridge obrigatório. Evoluções externas ficam para uma fase futura e precisam de decisão própria de privacidade.

**Dependência obrigatória:** definir a classe e o tratamento de uma chave nova no manifesto SPEC-01 antes de implementar. Incluir a chave, os dados da frota e seus backups na exportação, exclusão e regressão de privacidade.

**Fila de produção — futuro, não MVP:** `aguardando material/aprovação → pronto para fila → em impressão → acabamento/QC → embalado → falhou`, com ordenação por prazo, dependências, material/cor para reduzir purga e SLA.

- [ ] **Anti-padrão:** conclusão da máquina não equivale a peça aprovada.
- [ ] **Anti-padrão:** reimpressão não substitui o job anterior; cria novo job e preserva a falha e seu custo.

**Referências consultadas:** [ERPNext Asset, Maintenance, Depreciation e Repair](https://docs.frappe.io/erpnext/asset), [LutraCAD Print Farm](https://academy.lutracad.com/printfarm/), [Bambu Studio Advanced Settings](https://wiki.bambulab.com/en/software/bambu-studio/parameter/quality-advance-settings), [Ecmaker Machines](https://wiki.ecmaker.space/docs/machines) e [NovaLab 3D](https://www.novalab3d.app/documentacao), especialmente `maquinas-impressoras`, `manutencao`, `telemetria-bridge`, `fila-3d` e `como-calcular-custo-impressao-3d`.

**Acceptance criteria:**

- [ ] Um mesmo perfil pode referenciar vários ativos com contabilidade e manutenção independentes.
- [ ] Capacidade, job, manutenção e conexão são exibidos e persistidos separadamente.
- [ ] A depreciação por hora é exibida e aplicada sem modificar `src/shared/lib/calculator.ts`.
- [ ] A máquina selecionada no cálculo é identificável visualmente e pode ser removida da seleção.
- [ ] A implementação é bloqueada até a classe de dados e o tratamento de privacidade da nova chave do SPEC-01 estarem aprovados.

---

### 🏗️ Phase 7e: Modo Farm (par. print farms)

**Status:** decisão de produto **tomada**; implementação em **zero código**. Verificado em 30/09/2026: `LayoutMode` em `src/shared/stores/layoutStore.ts:31` tem **três** valores — `"classic" | "guided" | "bento"` — e `farm` **não existe** em nenhum lugar do código, nem no tipo, nem no `layoutStore`, nem no `LayoutSwitcher`. **Depende da Phase 7d — Gestão de Impressoras:** o modo só pode existir depois dessa fase, pois exibe dados da frota.

**Contexto:** o modo Clássico se rotula “Desktop Pro / alta densidade para fazendas 3D”, mas não existe um modo de verdade para operar múltiplas impressoras.

**Escopo do modo Farm:**

- [ ] Apresentar a frota: quantas máquinas existem, o que está rodando, o que está livre e o que está em manutenção.
- [ ] Permitir atribuir trabalho por máquina.
- [ ] Mostrar a capacidade da oficina em horas disponíveis versus horas demandadas.
- [ ] Usar densidade alta e manter o painel da frota sempre visível.
- [ ] O `LayoutSwitcher` ganha o quarto botão.

**Decisão tomada:** Farm é o quarto modo do seletor. O tipo `LayoutMode` e o `layoutStore` passam a ter quatro valores: `classic | guided | bento | farm`. A implementação implica atualizar o tipo `LayoutMode`, o `layoutStore`, o `CalculatorSurface` (case `farm` → `FarmSurface`) e o `LayoutSwitcher` (4 botões).

**Referências de operação:** [LutraCAD Print Farm](https://academy.lutracad.com/printfarm/) e [NovaLab 3D — `print-farm-vs-impressao-amadora`](https://www.novalab3d.app/documentacao).

**Acceptance criteria:**

- [ ] O painel de frota e a capacidade da oficina usam os dados locais da Phase 7d, sem API de fabricante.
- [ ] A relação entre trabalho atribuído e capacidade disponível é atualizada sem ambiguidade.
- [ ] A implementação só introduz o modo Farm depois que os dados locais da Phase 7d estão disponíveis.

---

### 🧵 Phase 7f: Estante de Filamento — unificação do inventário

**Status em `2.0.0-beta.2`:** entregue.

**Decisão de produto:** haverá uma aba somente, chamada **Estante de Filamento** / **Filament Shelf**. A Estante é o trabalho já feito no `SpoolShelf`, não uma tela nova do zero.

**Entregue:**

- [x] Grid, busca, filtros e ordenação da Estante.
- [x] `isLowStockSpool` como regra única para contador e badge.
- [x] Card com peso bruto, peso líquido, tara, metros, cobertura e status textual.
- [x] Integração **Adicionar à Estante**.
- [x] Oferta de usar carretel compatível antes de criar duplicata.
- [x] Swatch circular com painel de cor.

**Referência de inventário:** [NovaLab 3D — `gerenciar-estoque-filamento`](https://www.novalab3d.app/documentacao).

**Acceptance criteria:**

- [x] Não existem dois caminhos de edição para o mesmo inventário.
- [x] Peso bruto e peso líquido são legíveis em todos os pontos da interface que exibem massa.
- [x] A oferta de material existente não cria uma duplicata sem ação explícita da pessoa usuária.
- [x] A regra de baixo estoque faz o contador coincidir com o badge.

---

### 🧯 Phase 7h: Correções prioritárias da beta 2

**Status:** prioridade. C2 e a direção de C5 estão decididas; C3 exige reprodução antes de qualquer correção.

#### C2 — Tutorial somente no Clássico

**Decisão tomada:** o tutorial fica disponível apenas no layout Clássico.

**Causa raiz:** `Tutorial` é montado no nível de app (`platform/web/App.tsx:54` e `platform/desktop/App.tsx:49`) sem guarda de `layoutMode`; o auto-start dispara 1,5 s após carregar (`useAppInit.ts:271-284`). As âncoras do tour são do Classic (`tutorialTours.ts:92-100` e `tutorialTours.ts:206-256`) e não existem em Guided/Bento; nesses layouts, o engine degrada para um card sem overlay (`tutorialTours.ts:8-10`).

**Justificativa:** um tutorial que aponta para elemento inexistente é pior que tutorial ausente. Quem está no Guided não precisa dele, porque o Guided já é a experiência guiada; o Clássico precisa de orientação porque reúne mais controles.

**Correção adicional:** os passos do tour básico devem especificar `tab: "calculator"` (`tutorialTours.ts:90-100`). Não há hipótese de referência obsoleta a `spools`: essa hipótese foi refutada e o registro já usa `inventory`.

**Acceptance criteria:** o auto-start e as âncoras do tutorial são habilitados somente no Clássico; no Guided/Bento não há card sem alvo nem modal vazio. A navegação e os nomes acessíveis seguem [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/).

#### C3 — Guided: “Horas 0 / 54 min”

**Status:** reproduzir antes de corrigir. Nenhuma causa foi confirmada e não há correção autorizada sem evidência do bundle afetado.

**O que o código faz:** não existe `Math.floor` nesse caminho. `Step2Printer.tsx:55-59` repassa `draft.printTimeHours` diretamente ao input com `step="0.1"`; `InputGroup.tsx:59-69` não converte o valor; `calculatorStore.compute.ts:25` multiplica horas por 60 para o cálculo.

**Hipóteses, ainda não confirmadas:** `Number("")` resulta em 0 (`Step2Printer.tsx:56`); o valor persistido é 0; locale `0,9` versus `0.9` em `<input type="number">`; ou existe um bundle diferente do inspecionado.

**Sinal adicional:** o sintoma mostra o rótulo “Minutos: 54 min”, mas esse rótulo não existe em `Step2Printer.tsx`. Isso aponta para outro bundle até que a reprodução confirme o caso.

**Acceptance criteria:** primeiro registrar valor persistido, valor do input, locale e versão/bundle; então reproduzir a divergência entre o input e o resultado antes de escolher uma conversão. Não mascarar o problema com `Math.floor` sem evidência.

#### C4 — Bento: espaço vazio e controles duplicados

C4 tem duas metades independentes. **A do espaço vazio está resolvida; a da duplicação continua aberta.** Mantê-las separadas é o que impede que a meia-solução feche o item inteiro.

##### C4a — Espaço vazio e cards esticados: ✅ RESOLVIDO em `2126865` (PR #247, `2.0.0-beta.6`)

**Causa raiz:** o grid não declarava `items-start`, então `align-items` caía no padrão `stretch` e todo card de uma linha era preenchido até a altura do mais alto da linha.

**Correção aplicada — apenas duas classes, em dois lugares:**

| Onde                                          | O que foi adicionado | Por quê                                                                      |
| --------------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `BentoSurface.tsx:151` — o container do grid  | `items-start`        | mata o `stretch` herdado; resolve o esticamento de todos os cards de uma vez |
| `BentoMaterialCard.tsx:120` — o card Material | `lg:col-span-2`      | fecha o retângulo 2+1 sobre 1+2 e elimina a célula vazia na última linha     |

`BentoCard.tsx` **não foi alterado** e não precisava ser: o defeito era do container, não do card. Registrar `self-start`/`h-fit` no `BentoCard` como se tivessem sido a correção seria uma descrição falsa do que está no código.

**Medição, não impressão:**

| Card        | Antes (1440px)           | Depois         |
| ----------- | ------------------------ | -------------- |
| Material    | 497px                    | 415px          |
| Mão de obra | 497px                    | **280px**      |
| Máquina     | 497px (era a referência) | altura natural |

Os três cards da primeira linha mediam 497px — a altura do card de Máquina, o mais alto da linha. Mão de obra desceu a 280px.

**Verificação:** 375 / 768 / 1024 / 1440 / 1920px, sem sobreposição e sem overflow. Só classes de layout: nenhuma cor nova, nenhuma chave de i18n nova. A ordem dos cards no DOM não mudou — **a ordem de foco não mudou**. O span é `lg` de propósito: no breakpoint `md` o grid tem duas colunas e um 2×2 já preenche.

> **Rastreabilidade.** O commit aparece em alguns registros de trabalho como `08af050`. Esse SHA **não é alcançável a partir de `main`**: ele existe apenas em `feat/beta6-layout` e foi squash-merged dentro de `2126865`. `08af050` é a origem, `2126865` é o commit que está no `main` e é o único que este roadmap deve citar.

##### C4b — Controles duplicados: ❌ ABERTO

**Causa raiz:** o mesmo controle foi observado repetido duas, três ou quatro vezes entre os cards. A decisão é unificar cada controle em uma única instância, mantendo contexto e rótulo suficiente para evitar ambiguidade.

**Anti-padrão:** resolver a repetição escondendo controles por breakpoint sem identificar um owner único. A correção deve tratar a origem da duplicação, não apenas a aparência em um tamanho de tela.

> **Nota de estado.** A superfície do Bento passou a ser editável depois desta entrada ser escrita (ver Phase 7i). A duplicação de controle, se ainda existe, hoje aparece entre ~32 `BentoField` e 2 `BentoToggleField` distribuídos pelos quatro cards — e não mais em uma superfície read-only, onde repetir um valor era inofensivo. **C4b ganhou prioridade relativa:** em uma superfície read-only um controle duplicado é ruído; em uma superfície editável, dois inputs ligados ao mesmo campo são um conflito de estado esperando alguém escrever no errado. Esta meia entra na reavaliação da Phase 7i, com o owner de cada campo identificado antes de qualquer mudança de aparência.

**Acceptance criteria (C4b):** cada controle aparece uma vez, com um owner único identificado por campo; navegação por teclado e ordem de foco permanecem previsíveis conforme [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/).

#### C5 — Estante: ação destrutiva sem rótulo visível

**Causa raiz:** a ação inferior usa `Trash2` (`SpoolCard.tsx:3` e `SpoolCard.tsx:167-174`) e possui apenas `aria-label`; não há texto visível.

**Decisão tomada:** manter a ação destrutiva para não aumentar o risco de exclusão acidental e adicionar rótulo/tooltip visível, mantendo também o nome acessível.

**Inconsistência secundária:** `SpoolCard.tsx:62` usa `FALLBACK_HEX` na caixa de cor, enquanto `SpoolCard.tsx:79` passa `spool.colorHex` ao `SpoolThumb`. Sem cor, a caixa fica indigo e o thumbnail vira monograma.

**Acceptance criteria:** a ação destrutiva tem rótulo visível e nome acessível; ausência de cor usa fallback coerente entre caixa e thumbnail; texto e ícone mantêm contraste e alvo suficiente conforme [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/).

---

### 🧩 Phase 7i: Paridade de cobertura de campos entre Clássico e Bento

> **O que mudou no nome desta fase.** A fase se chamava "Bento como calculadora editável" porque essa era a pendência: o Bento não tinha inputs. Ele passou a ter. A pendência real hoje não é mais _tornar editável_ — é **paridade de cobertura**: os mesmos campos do Clássico, com o mesmo dono por campo, sem criar um terceiro contrato de cálculo.

**Status:** direção aprovada. A metas **"tornar editável" está cumprida**; a fase continua aberta pela paridade.

#### ~~Estado anterior: read-only por design~~ — SUPERADO

~~**Estado atual, por design:** o Bento é read-only. Os comentários “read-only five-card financial grid” (`BentoSurface.tsx:57`) e “no calculation is performed here” (`BentoPricingCard.tsx:17-18`) são intencionais; não existe um único `<input>` nessa superfície. Tratar isso como bug seria incorreto.~~

**Verificado em 30/09/2026: essa restrição não existe mais no código.** Os dois comentários citados foram removidos e a afirmação de que "não existe um único `<input>`" é falsa hoje. A superfície é **editável**, com cerca de **32 `BentoField`** e **2 `BentoToggleField`** distribuídos pelos quatro cards:

| Card         | `BentoField` | `BentoToggleField` | `BentoMetric` |
| ------------ | ------------ | ------------------ | ------------- |
| Material     | 10           | 0                  | 1             |
| Máquina      | 8            | 2                  | 4             |
| Mão de obra  | 5            | 0                  | 1             |
| Precificação | 7            | 0                  | 4             |
| **Total**    | **30**       | **2**              | **10**        |

Os campos escreve direto na `calculatorStore` pelo mesmo caminho do Clássico, e o `calcLevel` do Clássico **já é reusado**: os cards chamam `isFieldVisibleForLevel(calcLevel, hiddenFields, "<domínio>", fieldId)` de `Calculator.constants.ts`, exatamente como as seções do Clássico.

**Consequência para esta fase:** as duas primeiras linhas de "Direção de implementação" abaixo (reaproveitar `calcLevel`, e o risco de duplicar inputs) descrevem um estado que não é mais o atual. Elas não foram apagadas — a evidência de como o item foi fechado importa mais que a lista do que falta. O que resta é a **tabela de cobertura** e a **decisão de dono por campo**.

#### Cobertura que falta

A tabela abaixo é a pergunta que sobreviveu. A coluna do Bento precisa ser re-lida contra o código: o que era "apenas resumo" já tem input, e o que era "apenas custo" também. **A auditoria de cobertura campo a campo ainda não foi feita** — e é o primeiro trabalho desta fase, anterior a qualquer linha de código.

| Domínio                                                                  | Cobertura no Clássico                                                                                      | Cobertura no Bento (verificar campo a campo)     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Material                                                                 | Tipo, peso, custo, densidade, purga, eficiência do carretel, seleção de carretel, volume e custo por litro | 10 campos — lista exata a auditar                |
| Falhas                                                                   | Modo, valor e multiplicador                                                                                | Cobertura parcial; dono a identificar            |
| Vendas                                                                   | Quantidade, infill, extras, embalagem, frete, marketplace, imposto, margem/markup e presets                | 7 campos em Precificação — lista exata a auditar |
| Custos fixos, mão de obra, hardware/acabamento, operações/PPE e software | Campos no Clássico                                                                                         | 5 + 8 campos; o restante é omitido               |

- [ ] Auditar cobertura **campo a campo** entre Clássico e Bento e publicar a tabela final. Sem isso, "paridade" é uma intenção, não um estado verificável.
- [ ] Atribuir um **owner único por campo** no Bento. Isto é C4b: a duplicação de controle deixou de ser cosmética quando a superfície ficou editável.

**Direção de implementação:**

- [x] Reaproveitar o `calcLevel` que já existe em `Calculator.constants.ts:99-117` (básico, intermediário e completo). **Feito** — os cards chamam `isFieldVisibleForLevel`; o mesmo nível esconde o mesmo campo nas duas superfícies.
- [x] Tornar a superfície editável. **Feito** — cerca de 32 controles escrevendo na `calculatorStore` pelo mesmo caminho do Clássico.
- [ ] Criar três templates de inicialização, não três formulários: **Básico** com defaults seguros, **Avançado** com disclosure progressivo e **Completo** com organização por processo.
- [ ] Exibir rótulo textual e valor em todos os cards; cor e ícone não substituem o significado.
- [ ] Compartilhar setters e condicionamento FDM/resina com o Clássico em vez de reproduzir regras em componentes locais.

#### ⚠️ Nota de supersessão — 25/09/2026 (revoga a regra deinspiração do `Example/`)

> **A regra abaixo foi revertida pelo dono em 25/09/2026.** A linha que a segue — "nunca como cópia de estrutura, estado ou cálculo" — **não está mais em vigor** e não deve ser lida como restrição vigente.
>
> **O que a decisão de 25/09/2026 diz, na leitura vigente:**
>
> | Categoria                                                                                    | Tratamento no port                                                                                                                                                                                                                                                                    |
> | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | **Frontend e estrutura visual** — layout, componentes, organização, grid, composição de tela | **Portam-se.** O `Example/` é referência de implementação, não de inspiração vaga. Reimplementar do zero o que já existe e foi decidido é retrabalho, não craft.                                                                                                                      |
> | **Backend, cálculo, i18n, acessibilidade e testes**                                          | **Permanecem intocáveis.** `calculator.ts`, `types.ts`, `presets.ts` e `server.ts` do protótipo já foram descartados em 22/09 e continuam descartados. A camada de cálculo, as traduções, a semântica de acessibilidade e a suíte de testes do app real não se portam: reescrevem-se. |
>
> **A linha de separação é o comportamento, não a pasta.** "Portar" a estrutura visual significa que a tela fica com a forma, a hierarquia e a composição do `Example/`. "Portar" o cálculo significaria que `Example/src/calculator.ts` passaria a decidir o preço — e isso continua proibido, exatamente como estava. A revogação afrouxa a **fonte** (o `Example/` pode ser copiado) e **não** afrouxa o **alvo** (a camada de cálculo do app real continua intocável).
>
> **O que não mudou com esta revogação:** dado inventado do protótipo continua não entrando sem verificação contra o tipo real (ver Phase 7p), `Example/` continua sem testes, i18n e a11y próprios, e a cobertura >80% continua exigida. Portar a estrutura não herda as lacunas dela.
>
> **Pendência de autoridade:** esta decisão **não existe em arquivo** — ela vive apenas nesta conversa e neste documento. O dono precisa transformá-la em registro; até lá, esta nota é a única fonte. Ver Phase 7q.

- [ ] Usar `Example/src/components/BentoLayout.tsx` como referência de estrutura visual a portar. **~~nunca como cópia de estrutura, estado ou cálculo~~ — regra revertida em 25/09/2026; ver a nota de supersessão acima.** A estrutura visual porta-se; estado e cálculo continuam não portando.

**Risco principal — reescrito para o estado atual:** o risco original desta fase era "tornar a superfície editável duplica inputs, condicionamento FDM/resina e setters". **Esse risco virou presente em vez de futuro:** a superfície é editável, e os ~32 `BentoField` distribuídos pelos quatro cards reimplementam localmente o caminho de escrita que o Clássico já tem. Um campo que atualiza o estado mas não recalcula é o pior resultado possível, e agora ele é um risco de produção, não um risco de projeto. **A paridade de estado e resultado precisa ser testada como um único contrato** — os mesmos valores, pelos mesmos caminhos, produzem nos dois layouts; não dois caminhos paralelos que parecem iguais.

**Acceptance criteria:** os mesmos valores produzem o mesmo resultado nos layouts Clássico e Bento; toda edição recalcula; alternar FDM/resina preserva as premissas corretas; os três templates usam os mesmos componentes de campo e regras.

---

### 🧭 Phase 7j: Guided com abas rígidas e retorno aos passos anteriores

**Status:** decidido; implementação pendente.

**Decisão:** o Guided mantém abas rígidas, mas permite voltar aos passos anteriores. É permitido voltar e corrigir; não é permitido pular uma etapa obrigatória.

**Comportamento existente:** `wizardStore.goTo` (`wizardStore.ts:266-303`) já implementa essa regra. O retorno é livre; o avanço exige que os passos pulados sejam válidos e redireciona para o primeiro infrator. A correção deve preservar esse contrato, não criar um segundo navegador de etapas no componente.

**Justificativa:** o Guided é para iniciantes, e iniciante precisa de menos intervenção possível. Quem quer navegação flexível usa o Bento ou o Clássico. Três modos com responsabilidades claras valem mais que um único modo que tenta fazer tudo.

**Animação:** moderada, preservando o backstop de `prefers-reduced-motion` já existente em `.wizard-step-enter` e sua keyframe. A mudança de estado não pode depender de movimento para ser explicada.

**Anti-padrão:** habilitar indiscriminadamente “próximo” e esconder a invalidação do formulário; isso transfere para a pessoa usuária o trabalho de descobrir qual etapa está bloqueando o avanço.

**Acceptance criteria:** voltar nunca perde dados; avançar encontra o primeiro passo inválido; a transição moderada respeita a preferência de movimento reduzido; foco e estado da etapa permanecem acessíveis.

---

### 🏬 Phase 7k: Lojas, Canais e Locais de Produção

**Status:** modelo semântico definido; implementação e decisão de reaproveitamento ainda pendentes.

**Decisão semântica central:** produção e retail são domínios separados. Uma loja vende e atende, mas não deve representar automaticamente a fábrica, o laboratório ou a bancada que produz.

**Referência e limite de uso:** a documentação de [NovaLab 3D — primeiros passos](https://www.novalab3d.app/documentacao?doc=primeiros-passos) assume “uma organização = uma loja”. O produto aqui quer o contrário, portanto essa referência não serve como modelo de multi-loja. Para o fluxo de venda e PDV, usar [Odoo POS Workflow](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html) apenas como referência de canal. A página [NovaLab 3D — `clientes-crm`](https://www.novalab3d.app/documentacao) foi consultada como referência de cadastro, não de vínculo entre loja e produção.

**Entidades:**

- `Store`: vende e atende.
- `SalesChannel`: loja online, PDV, marketplace ou B2B.
- `ProductionSite`: fábrica, laboratório ou bancada.
- `PickupPoint`: retirada sem venda.
- `SalesPoint` só deve ser separado se a mesma loja tiver vários balcões ou terminais.

**Dados de `Store`:**

- [ ] Identidade: nome, razão social, documento fiscal, país/estado, status, timezone e moeda.
- [ ] Endereço e contato.
- [ ] Parâmetros comerciais: imposto incluído, regime, margem padrão, método de markup, arredondamento, validade padrão de orçamento, catálogo padrão e SLA.
- [ ] Frete e entrega: transportadora, modo, taxa fixa, percentual, handling, frete grátis acima de valor, endereço de coleta e região atendida.
- [ ] Pagamentos: perfil referenciado, métodos, parcelamento e moeda.
- [ ] Operação: canal padrão, local de produção padrão, unidade/estoque padrão, fila habilitada e ID externo.

**Regras de vínculo:** uma oficina pode produzir para várias lojas; uma loja pode enviar produção para vários locais. A relação é muitos-para-muitos, não uma organização apontando para uma única loja.

**Segurança:** nunca armazenar token ou chave secreta no cadastro da loja. O cadastro referencia um perfil de integração seguro, que responde pelo segredo fora do domínio comercial.

**Dependência obrigatória:** adicionar uma chave nova ao manifesto SPEC-01 antes da implementação e cobrir exportação, exclusão e regressão de privacidade.

**Decisão pendente, deliberadamente não resolvida:** o app já possui `customerStore` e `quoteStore`. Auditar antes de decidir entre reaproveitar, estender ou criar `Store` e `SalesChannel` separados.

**Acceptance criteria:** retail, canal e produção permanecem distinguíveis; uma loja e um local de produção aceitam múltiplos vínculos; segredo não é armazenado no cadastro; a chave nova do SPEC-01 está aprovada antes de persistir dados.

---

### 🔒 Phase 7l: Snapshot imutável de precificação

**Status:** decisão de produto tomada; implementação pendente.

> **Não recalcular orçamentos antigos com a configuração atual.** Margem, frete, impostos e perfil de máquina devem ser versionados no momento do cálculo.

**Snapshot mínimo por orçamento:** loja e canal, moeda, alíquota, método de markup, margem, frete, taxas, premissas de produção, perfil/ativo usado e versão do cálculo.

**Justificativa:** o app já tem `quoteStore` com status, validade, termos de pagamento e entrega. Sem snapshot, editar a loja ou a margem hoje reescreve o passado de orçamentos já emitidos.

**Anti-padrões:** recalcular silenciosamente um orçamento emitido; mostrar o preço histórico como se refletisse premissas atuais; substituir a versão do cálculo sem distinguí-la de uma revisão humana.

**Acceptance criteria:** abrir um orçamento antigo reproduz seus valores mesmo depois de mudanças na loja, na máquina ou nos parâmetros; qualquer mudança posterior gera uma revisão ou novo orçamento, não sobrescrita retroativa.

---

### 🧵 Phase 7m: Multi-material (AMS/CFS/ACE 2)

**Status:** decisão de produto registrada. **M1 — Honestidade imediata: entregue** em `d5b0624`, que está em `main` (publicado na `2.0.0-beta.3` e em todas as betas seguintes). **3 dos 4 itens de M1 estão fechados; o quarto — o arredondamento _fail-high_ — continua aberto.** M2–M7 ficam para depois.

**Objetivo:** suportar a mesma forma de dados para AMS, CFS e ACE 2, sem criar um modelo por hardware. O fatiador é a fonte autoritativa; o app não deve inventar uma taxonomia de máquinas diferente da relatada pelo fatiador.

#### M1 — Honestidade imediata — ✅ entregue em `d5b0624` (com uma pendência real)

A entrega teve uma forma específica que vale registrar: **o recurso foi desligado, não corrigido.** O custo multi-material foi removido do caminho de cálculo (`calculatorStore.compute.ts`) e `setFdmAmsEnabled` passou a forçar `false`. A configuração de slots persistida é preservada, mas não entra em nada. Isso é honestidade imediata: o app deixa de apresentar um cálculo incompleto como correto, e o custo de construir o modelo certo fica para M2.

- [x] **Aviso de que o custo multi-material não entra no total, no preço nem no lucro.** A chave `calc.multiMaterialDisabledDescription` diz exatamente isso — _"o custo dos materiais múltiplos ainda não entra no subtotal, custo total, preço de venda ou lucro"_. O interruptor aparece com `aria-disabled="true"`, `aria-pressed="false"` e `aria-describedby` apontando para o aviso: não é um controle morto sem explicação, é um recurso declarado indisponível.
- [x] **O furo do array vazio que virava custo zero.** Corrigido pela via mais forte: o bloco que somava o custo dos slots foi removido de `computeStoreResults`, então `materialCost` voltou a ser `es.material ? result.materialCost : 0` — o valor real do cálculo, sem a ramo condicional que multiplicava slots. O array vazio deixou de ser um caminho de código. Coberto por `multimaterialDisabled.test.ts`, que prova que um payload persistido com `fdmAmsEnabled: true` é reidratado com o recurso **desligado** e os slots **preservados**.
- [x] **Rótulo neutro "Multi-material".** `calc.multiMaterialLabel` = `"Multi-material"`, em pt-BR e en-US.
- [ ] **Arredondamento _fail-high_ — ❌ NÃO IMPLEMENTADO. Pendência real e não registrada em lugar nenhum até esta atualização.** `roundCurrency` (`src/shared/lib/currency.ts:37-40`) continua sendo `Math.round(val * 100) / 100`. `Math.round` é _half-up_: `10,005` arredonda para `10,01`, mas `10,004` arredonda para `10,00`. Isso **não** é _fail-high_ no sentido desta fase, que é _nunca underestimate o preço_. A correção feita em `d5b0624` no mesmo arquivo foi outra — trocar `if (!Number.isFinite(val)) return 0` por `return val`, para que um valor inválido não virasse um zero crível. Era o item certo, e continua sendo um item diferente.
  - [ ] Fixar a política de arredondamento explicitamente: `roundCurrency` deve Tender para cima no centavo ambíguo, e o comportamento precisa de **teste que o prove**. Hoje `currency.test.ts` só cobre entrada não-finita; não há asserção sobre a direção do arredondamento. Um teste que não existe não é garantia de nada — é a mesma armadilha do guard de layout por string-match, em código de dinheiro.
  - [ ] Conferir se _fail-high_ é a política correta para todo uso de `roundCurrency`, e não só para preço: o helper é compartilhado entre store, painéis e exportação de PDF, e _fail-high_ em um contexto de lucro arredondado para cima superestima o ganho.

**Aceite da beta 3:** ✅ quanto ao aviso, ao furo do array vazio e ao rótulo neutro. ❌ **o critério de arredondamento não é cumprido** — o aceite pede que "o arredondamento monetário não reduza o valor cobrado", e `Math.round` reduz. M1 permanece aberta por esse item.

#### M2 — Modelo de dados por material

- [ ] A peça passa a ter uma **composição de materiais**: N materiais, cada um com peso e custo próprios, em vez de um `materialCost` único.
- [ ] Preservar o cálculo de peça única como caso degenerado dessa composição, sem criar um contrato paralelo para peça simples.
- [ ] Definir a composição como entrada do cálculo e manter a identificação de material e a origem do peso em um contrato verificável.

#### M3 — Integração no resultado

- [ ] Fazer o custo multi-material entrar em `subtotal` → `totalCost` → `sellPrice` → `profit`.
- [ ] Fazer `costPerGram` e `unitWeight` deixarem de assumir material único: expor os valores por material ou declarar explicitamente que não se aplicam ao resultado agregado.
- [ ] Cobrir a integração no resultado com casos de peça única, múltiplos materiais e dados incompletos, sem transformar uma omissão em custo zero.

#### M4 — Purga e transições

- [ ] Separar a purga do material do produto; purga é desperdício de processo, não mais um material que compõe a peça.
- [ ] Registrar a ordem das trocas, o número de transições e a política `purge-into-infill` (ou destino equivalente informado pelo fatiador).
- [ ] Manter o custo de purga por placa e a distribuição pelas peças como responsabilidades do cálculo, sem tratá-la como um peso de material da peça.

#### M5 — Tempo multi-cor

- [ ] Aceitar entrada dupla: tempo multi-cor e tempo single-cor de referência.
- [ ] Calcular a diferença como custo do overhead, mantendo as duas entradas como os dados de origem.

#### M6 — Estoque multi-spool

- [ ] Permitir que uma peça multi-material consuma de vários spools.
- [ ] Fazer a dedução de estoque por slot e vincular `spoolId` por material.

#### M7 — Suporte a CFS e ACE 2

- [ ] Tratar CFS e ACE 2 sem modelar hardware específico: os três sistemas alimentam a mesma forma de dados.
- [ ] Usar os campos relatados pelo fatiador como contrato comum para AMS, CFS e ACE 2; diferenças de hardware ficam fora do modelo de cálculo.

**Decisões e riscos registrados:**

- **Decisão:** o modelo de dados segue **o que o fatiador reporta**, não o hardware. AMS, CFS e ACE 2 alimentam a mesma forma — não são três modelos.
- **Risco registrado:** hoje o custo multi-material é calculado mas **não chega ao preço** (`materialCost` é substituído, `subtotal` não). Qualquer usuário de AMS hoje vê preço subestimado.
- **Estado atual do AMS:** slots genéricos (4 por padrão), UI parcial, sem validação na restauração, `density` e `spoolEfficiency` ignorados pela fórmula, fórmula de transição inventada (`activeCount × (activeCount − 1)`) usando só o primeiro slot.
- **Evidência de mercado:** AMS (Bambu), CFS (Creality, até 16 cores), ACE 2 Pro (Anycubic, até 16 cores), Prusa MMU3, Elegoo CANVAS, QIDI Box e ERCF convergem no mesmo modelo: material do produto separado do desperdício de processo; desperdício por placa e dividido pelas peças; fatiador como fonte autoritativa.

**Referências verificadas:**

- [Bambu Studio — Issue #460, flushed filament e flush/prime tower](https://github.com/bambulab/BambuStudio/issues/460)
- [Prusa MMU3 — Handbook / User Guide](https://help.prusa3d.com/downloads/mmu-family/handbook)
- [OrcaSlicer Wiki — Flush Options / purge into infill](https://www.orcaslicer.com/wiki/print_settings/multimaterial/multimaterial_settings_flush_options)

#### Dívida rastreada (fora desta frente)

- `addToHistory` grava o histórico **antes** da dedução de estoque.
- `demoDataset.ts` chama `computeStoreResults` diretamente, contornando a fronteira de validação.
- Resolvers antigos em `calculatorStore.helpers.ts` ficaram órfãos: existem duas políticas de sanitização, com risco de drift.
- Limites de domínio incompletos: `spoolEfficiency` sem máximo, `wasteMarginPercent` sem máximo e `quantity` sem exigência de inteiro positivo.
- `Product.weightGrams` armazena peso efetivo, após purga e eficiência; a ambiguidade entre bruto e efetivo pode duplicar ajustes.
- C3: Guided exibindo “0h / 54min”; causa ainda não confirmada, aguardando URL do usuário.

---

### 📊 Phase 7n: Ciclo de produção, projeção de faturamento e análise de rentabilidade

**Status:** escopo levantado; **nada implementado**. Esta fase registra intenção de produto e as pré-condições técnicas que hoje não existem. Nenhum item entra em implementação antes de explicitarmos juntos o escopo, a ordem e as premissas.

> **Nota de escopo — o escopo da beta 5 não muda.** O conteúdo desta fase é registro de roadmap. O escopo corrente da `2.0.0-beta.5` permanece as ondas de port visual, e nada aqui autoriza antecipá-las.

#### Estado de referência no protótipo

O protótipo em `Example/` **não é mais um rascunho visual**: seis componentes novos são implementações de referência de itens que esta fase declarava não implementados. Isso muda o custo estimado de N1–N6, **não** o escopo nem a ordem. O protótipo é **material de referência apenas**: tem zero testes, zero i18n e zero acessibilidade, e os tipos e o cálculo dele são incompatíveis com o app real. A estrutura visual **porta-se** (decisão de 25/09/2026, ver a nota de supersessão na Phase 7i); a camada de cálculo, o estado, o i18n, a acessibilidade e os testes **não se portam** — reescrevem-se com TDD. O que o protótipo não traz — testes, traduções, semântica de acessibilidade — continua a ser trabalho nosso, e porta-lo não o adquire.

- **N1 — seleção em lote:** referência **existe**, e é a mais forte das seis. `Example/src/components/HistoryView.tsx` (1.132 linhas) já implementa o escopo inteiro.
- **N2 — projeção de faturamento:** referência **existe**. `Example/src/components/MonthlyRevenueProjectionCard.tsx` (644 linhas) tem as fórmulas corretas e defaults descartáveis.
- **N3 — ponto de equilíbrio e ROI:** referência **existe** para interface e matemática. `Example/src/components/PrinterRoiBreakEvenCard.tsx` (412 linhas). O vínculo de dados está errado e precisa ser reescrito.
- **N4 — simulação dinâmica:** **não existe referência.** Nenhum componente do protótipo cruza a peça em cálculo com o saldo da impressora.
- **N5 — Profit Analytics:** referência **existe e excede o pedido**. `Example/src/components/ProfitAnalyticsModule.tsx` (662 linhas) traz três eixos, não dois.
- **N6 — Revenue Trends:** referência **existe e é descartada**. `Example/src/components/RevenueTrendsChart.tsx` (458 linhas) fabrica a própria projeção; reimplementar sem ela.
- **Fora do escopo desta fase:** `Example/src/components/SmartPricingRecommender.tsx` (590 linhas) implementa preço sugerido, que pertence às Phases 7b e 7h, não a 7n. Registrado aqui só para não ser confundido com N4.
- **Órfão:** `Example/src/components/MonthlyRevenueProjectionSection.tsx` (399 linhas) duplica N2 com defaults conflitantes e **zero importadores**.

#### Decisões tomadas

- **Seleção em lote vai para a entrada de histórico**, não para uma entidade `Quote` separada. O protótipo não tem agregado `Quote`; `status` é um campo opcional na linha do histórico. **Esta decisão substitui a nota anterior que atribuía o item à entidade `Quote`** — as duas não convivem.
- **`RevenueTrendsChart` é descartado e reimplementado** sem a tendência fabricada que ele carrega.
- **`MonthlyRevenueProjectionSection` não é adotado.** Órfão, com defaults conflitantes; `MonthlyRevenueProjectionCard` é a fonte única de intenção.
- **As cinco lavagens (tinted washes) de status e as falhas de `danger`/`warning` no modo escuro do `ConfirmDialog` serão corrigidas antes do lançamento**, e não adiadas como decisão de design.
- **N0 é um store compartilhado sobre uma forma que já existe**, com data em ISO e log de horas mensal — materialmente menor que construir o modelo do zero.

---

#### N0 — Frota de ativos e registro de horas _(pré-requisito duro)_

**Status:** pré-requisito de N2, N3 e N4.

**Problema:** nenhuma análise de rentabilidade por máquina é possível hoje porque **não existe registro de frota própria**. O que existe é um catálogo de produtos, não o que a pessoa usuária possui:

- `src/shared/lib/printers.ts:10` é um array estático de ~80+ especificações de produto. Não é frota.
- `PrinterProfile` (`src/shared/types/index.ts:36-58`) tem 15 campos e **nenhum** deles é `purchasePrice`, `acquisitionDate`, `status` ou qualquer campo de capacidade, ocupação ou horas.
- `selectedPrinterId` (`types/index.ts:359`) é uma string opaca que aponta para o catálogo.
- Busca por `hourMeter`, `acquisitionDate`, `purchasePrice`, `acquisitionCost` e `PrinterAsset` em `src/**/*.ts`, `src/**/*.tsx` e `src/**/*.css` retorna **zero matches**. **No app real não existe log de horas por impressora em lugar nenhum.**

Sem preço de aquisição e sem horas, "quanto falta para amortizar" e "quanto essa máquina rende por mês" não são cálculos: são fiction. Por isso N0 é pré-requisito, não item paralelo.

**Contraponto — no protótipo essa forma já existe.** O diagnóstico acima é sobre o **app real**, e continua verdadeiro nele. No protótipo, porém, o `PrinterProfile` de `Example/src/types.ts:27-44` já carrega `price: number` (`:33`), `lifespanHours` (`:34`), `totalPrintHoursLogged` (`:39`), `status: 'disponivel' | 'imprimindo' | 'manutencao' | 'ociosa'` (`:40`) e `acquisitionDate?: string` (`:43`), com CRUD completo em `Example/src/components/PrinterFleetManagementView.tsx:94-130` e o campo rotulado como "Preço Aquisição (R$)" em `:435`. **N0 não é construir o modelo do zero — é levantar o que existe para dentro de um store compartilhado.**

A forma do protótipo, porém, **não é portátil como está**, por três motivos:

- `acquisitionDate` é uma string `dd/mm/yyyy` escrita com `toLocaleDateString('pt-BR')` (`PrinterFleetManagementView.tsx:117`, semeada em `presets.ts:20`), **não ISO**. Sem ISO não há ordenação, nem comparação de datas, nem migração.
- **Não existe log de horas mensais por impressora.** Só há um escalar de tempo de vida total (`totalPrintHoursLogged`), que não responde "quanto rendeu este mês" — que é exatamente a pergunta de N2.
- A ocupação existe **apenas como `useState` local** dentro dos dois componentes de projeção, nunca em um tipo. Um valor que não está no modelo não sobrevive a recarregar a página.

**O bloqueio real é o store compartilhado, não a ausência de campos.** A tela de frota segura a frota em `useState` local (`PrinterFleetManagementView.tsx:33`), nunca persistida, enquanto `PrinterRoiBreakEvenCard.tsx:57-59` lê o catálogo estático de módulo. Consequência: adicionar ou reprecificar uma impressora na tela de frota **faz ROI, projeção, analytics e preço sugerido ignorarem a máquina em silêncio**. O protótipo tem a forma sem a fonte única da verdade; a fonte única da verdade é o que falta.

**O que precisa ser feito:**

- [ ] Elevar a frota do protótipo a um store persistido e compartilhado, separado do catálogo: preço de aquisição, data de aquisição em **ISO 8601**, status operacional e vínculo com o `profileId`.
- [ ] Registro de horas/uso por impressora **por mês**, com origem declarada: digitada pela pessoa usuária ou derivada do histórico. **Derivada é estimativa, não medição** — a origem precisa ser um campo, não uma suposição implícita. O escalar de vida total que o protótipo tem não substitui essa série.
- [ ] Chave nova no manifesto SPEC-01, com classe de dados e tratamento de privacidade aprovados **antes** de persistir. Incluir frota e backups na exportação, exclusão e regressão de privacidade, como a Phase 7d já exige.
- [ ] Reconciliar a unidade de `usefulLife` antes de qualquer uso financeiro. Hoje o campo vale `3000`, `4000`, `5000` (`printers.ts:17`, `db/seed.ts:40-44`) e é consumido como **horas** em `calculatorStore.ts:305-308` (`depreciationMonths = round(usefulLife / hoursPerMonth)`). A Phase 7d (linha 436) o descreve como `defaultUsefulLifeYears`. **Horas e anos precisam se tornar a mesma unidade antes de virar número de dinheiro.**
- [ ] Declarar explicitamente que `usefulLife` do catálogo é **premissa estimada pelo app por modelo**, não dado da pessoa usuária — ver `printers.ts:7-8`.

**Anti-padrão:** usar `value` do catálogo como se fosse o preço que a pessoa usuária pagou. É preço de tabela do modelo, não preço de aquisição do ativo. Os dois números precisam ser campos distintos e separados na interface.

**Anti-padrão:** exibir "a impressora está 62% amortizada" quando os 62% vêm de um `usefulLife` adivinhado no código. A barra fica bonita e o número não é de ninguém.

**Justificativa:** o app já promete custo por hora com depreciação. A Phase 7d formalizou que depreciação contábil pertence ao **ativo**, não ao modelo. N2/N3/N4 apenas aplicam essa decisão a números que hoje não têm dono.

**Acceptance criteria:**

- [ ] A Phase 7d está implementada ou, no mínimo, o recorte de fleet store necessário está aprovado no SPEC-01.
- [ ] Existe teste que prova que um preço de aquisição definido pela pessoa usuária **sobrevive** à seleção de um modelo de catálogo com `value` diferente.
- [ ] A unidade de `usefulLife` está documentada em um único lugar, e a documentação bate com o código.
- [ ] Entradas de histórico sem `snapshot` (`types/index.ts:320`) são tratadas como órfãs explícitas, nunca agrupadas por processador inventado.

---

#### N1 — Seleção em lote e atualização simultânea de status

**Status:** decisão de domínio fechada — pertence à **`HistoryEntry`**, na lista de histórico. **Não** a uma entidade `Quote` separada: o protótipo não tem agregado `Quote`, e o estado de produção pertence ao registro do trabalho, não a uma negociação comercial. Implementação pendente.

**O que é:** checkbox por linha no modo tabela e por card no modo grid; checkbox mestre no cabeçalho da tabela com estado **indeterminado** (tri-state) que seleciona ou desseleciona **apenas os itens já filtrados**, nunca a lista inteira; realce visual dos selecionados; barra de ação em lote com contador dinâmico; botões de ação rápida aplicando um status a todos os selecionados de uma vez; comparação lado a lado **habilitada automaticamente quando exatamente 2** estiverem selecionados; exportação CSV somente dos selecionados; exclusão em lote com confirmação de segurança; confirmação imediata por toast.

**Estados:** Orçamento, Aprovado, Em Produção, Concluído, Cancelado. São **cinco**, não quatro, porque o registro novo nasce como "Orçamento" e essa é a origem do filtro, não um estado equivalente aos outros.

**Dados e estado de que depende:**

- `HistoryEntry` (`types/index.ts:310-321`) expõe `id`, `timestamp`, `type`, `name`, `summary`, `totalCost`, `sellPrice`, `profit`, `result` e `snapshot`. **Não tem `status`** — o campo é novo.
- O protótipo já define o contrato: `HistoryItemStatus` é o union `'orcamento' | 'aprovado' | 'em_producao' | 'concluido' | 'cancelado'` (`Example/src/types.ts:136`) e o campo é **opcional** (`status?: HistoryItemStatus`, `Example/src/types.ts:156`), com `'orcamento'` como padrão no momento da leitura (`HistoryView.tsx:110`).
- Persistência — `historyStore.ts:238-239` — `name: "open3dcalc_history_v2"`, `version: 2`.

**Esta é uma mudança de modelo persistido, não uma feature de UI.** Exige bump de `version` e caminho de normalização em leitura e em import. A entrada de histórico que já está no disco não tem `status`; sem normalização ela volta com `undefined` e quebra o filtro.

**Sobre o eixo de estado:** como o registro já nasce como "Orçamento", o conflito de eixo que existia ao sobrepor produção e negociação comercial **desaparece** — não há mais union comercial a colidir com o ciclo de produção, porque este item não toca `Quote.status`. O `HistoryItemStatus` é um union só, de um eixo só. Os dois eixos continuam separados: negociação comercial pertence a `Quote` e segue intocada por esta frente.

**Normalização de import (obrigatória):** o import de histórico precisa normalizar `status` ausente ou desconhecido para `'orcamento'` na entrada, e a entrada precisa carregar o status no CSV exportado, senão a seleção em lote sobrevive à tela e morre no arquivo.

**Referência no protótipo — a mais forte das seis.** `Example/src/components/HistoryView.tsx` (1.132 linhas) já implementa o escopo inteiro: tri-state do checkbox mestre (`:143-150`, `:735-742`), selecionar-somente-os-filtrados (`:189-199`), barra de ação em lote (`:588-708`), aplicação de status (`:632-672`), CSV apenas dos selecionados (`:688-695`), exclusão em lote (`:698-705`), comparação com exatamente 2 (`:676-685`) e contador (`:592-600`). A estrutura visual e a máquina de estados de seleção **portam-se** (decisão de 25/09/2026, ver a nota de supersessão na Phase 7i): o comportamento do tri-state e da barra em lote é layout de tabela mais máquina de estados, não cálculo. O que não se porta: o `HistoryEntry` do protótipo — o app real não tem campo `status`, e `historyStore` não tem `updateEntry` (ver N0/N1). Portar a tela não contorna o bloqueio de domínio.

**Defeito conhecido a não portar:** `onBatchUpdateStatus` e `onBatchDelete` são props opcionais (`HistoryView.tsx:37-38`) e caem num `selectedIds.forEach(...)` que atualiza o estado uma vez por id (`:213`, `:230`). Uma seleção de 500 linhas vira 500 atualizações de estado. O store precisa de uma ação em lote única.

**Não-objetivos:**

- ❌ Alterar `Quote.status` ou o ciclo de negociação comercial. A produção é estado do trabalho, a negociação é estado da venda; as duas coisas não dividem campo.
- ❌ Ações em lote de edição de conteúdo (não é edição em massa de itens, valores ou margens — é status).
- ❌ Undo/redo em lote além do que o store já garante. O histórico de undo é do `calculatorStore`, não do `historyStore`.
- ❌ Seleção persistente entre sessões. A seleção é estado de sessão, não dado persistido.

**Acceptance criteria:**

- [ ] O checkbox mestre reflete tri-state: marcado, desmarcado, indeterminado — e o indeterminado aparece quando a seleção é parcial.
- [ ] Com um filtro de status ativo, "selecionar todos" seleciona **exatamente** o conjunto filtrado, e o teste prova isso filtrando o store antes de agir.
- [ ] Selecionar e deselecionar todos não altera a seleção de itens que estavam fora do filtro.
- [ ] A comparação lado a lado só aparece com **exatamente** 2 selecionados, e some com 1 ou com 3.
- [ ] O CSV exportado contém **somente** os selecionados, e o teste compara a contagem de linhas com o contador da barra de ação.
- [ ] A exclusão em lote exige confirmação que **nomeia a quantidade** a ser excluída.
- [ ] A ação em lote atualiza o status em **uma única transação de store**, e existe teste que mede isso — a porta de entrada do `forEach` por id está fechada.
- [ ] Uma entrada importada com `status` ausente ou desconhecido entra no store como `'orcamento'`, e o teste prova que o payload entra com valor válido.
- [ ] Uma entrada persistida antes do bump de `version` continua legível e aparece com status válido.
- [ ] Toda etiqueta nova existe em **pt-BR e en-US**, com paridade verificada.

---

#### N2 — Projeção de faturamento mensal e capacidade produtiva

**Status:** escopo definido; implementação bloqueada por N0.

**O que é:** cruzar a rentabilidade real por hora do histórico de orçamentos — **R$/hora faturado, margem líquida média %, consumo de filamento g/h, duração média de projeto** — com a capacidade da frota de impressoras instalada. Destaques: faturamento mensal projetado (**teto e alvo**, a partir das horas produtivas); lucro líquido projetado a partir da margem histórica; horas efetivas por mês na taxa de ocupação da fazenda; output físico estimado (peças/mês e kg de filamento/mês). Barra de progresso do mês corrente contra a meta, com o valor restante. Cenários comparativos de ocupação: **Conservador** (40% / 1 turno de 8h / 22 dias), **Meta Recomendada** (65% / 16h dia / 26 dias), **Alta Demanda** (85% / 16h / 26 dias), **Teto Operacional 24/7** (100% / 30 dias). Parâmetros ajustáveis: horas/dia (8/12/16/24), dias úteis/mês (22/26/30), slider de ocupação, e override de taxa horária de impressão. Tabela por impressora com status, horas mensais e faturamento estimado individual.

**Dados e estado de que depende:**

- Rentabilidade histórica — `HistoryEntry` (`types/index.ts:310-321`) expõe `timestamp`, `totalCost`, `sellPrice`, `profit` **no plano**.
- **Ressalva:** duração de projeto e consumo de filamento **não são campos planos** de `HistoryEntry`. Vêm de `result` (`types/index.ts:319`) e do `snapshot`. A agregação precisa ler o snapshot, com fallback declarado.
- **Ressalva:** o vínculo com a impressora vem de `snapshot.selectedPrinterId` (`types/index.ts:359`), e `MachineCosts` (`types/index.ts:183-190`) **não tem `printerId`** — só custos derivados. Entradas com `snapshot === null` são órfãs.
- **Pré-requisito duro: N0.** "Capacidade da frota instalada" não tem fonte de dados antes de N0.

**Referência no protótipo — as fórmulas servem, os defaults não.** `Example/src/components/MonthlyRevenueProjectionCard.tsx` (644 linhas) implementa capacidade × taxa histórica: `avgRevenuePerHour` cai em `18.5` quando não há histórico (`:90`), depois `effectivePrintingHours = frota × (horas/dia × dias/mês) × (ocupação/100)` e `projectedRevenue = effectivePrintingHours × effectiveRevenuePerHour` (`:123-131`). Teto e alvo são valores distintos e rotulados (`:550` meta, `:579` teto) e a barra do mês corrente contra a meta existe (`:141-143`). Os quatro cenários de ocupação estão **presentes exatamente como especificados aqui** — 40%/8h×22d (`:148`), 85%/16h×26d (`:156`), 100%/24h×30d (`:160`) e 65% como meta controlável pelo usuário (`:41`). **Veredito: referência utilizável — preserve as fórmulas, descarte os defaults.**

**O órfão não entra.** `MonthlyRevenueProjectionSection.tsx` (399 linhas, zero importadores) duplica o mesmo cálculo com defaults que **contradizem** o card: 30 dias contra 26 (`:42`), 70% contra 65% de ocupação (`:38`), R$ 36,50/h contra R$ 18,50/h (`:62`) e 63,5% contra 52% de margem (`:70`). Duas telas com a mesma fórmula e números diferentes é o oposto de fonte única. **`MonthlyRevenueProjectionCard` é a fonte única de intenção.**

**Não-objetivos:**

- ❌ Previsão com modelo de série temporal, tendência ou machine learning. É multiplicação declarada, não previsão.
- ❌ Adotar `MonthlyRevenueProjectionSection`, ou reconciliar os dois componentes. Um é órfão e contraditório.
- ❌ Integração com API de fabricante, telemetria ou readings de máquina. Todos os números são declarados pela pessoa usuária.
- ❌ Estoque de material como limitante da projeção. Capacidade é horas, não disponibilidade de carretel.
- ❌ Tratar a projeção como meta operacional ou compromisso. Ver N7.

**Acceptance criteria:**

- [ ] Os quatro cenários carregam simultaneamente e o número exibido muda ao trocar de cenário.
- [ ] Teto e alvo são valores **distintos e rotulados separadamente** na interface; um nunca é apresentado como o outro.
- [ ] Trocar `horas/dia`, `dias úteis` ou a ocupação recalcula o conjunto inteiro sem estado residual.
- [ ] O override de taxa horária tem precedência sobre a taxa derivada do histórico, e a interface mostra qual valor está em uso.
- [ ] Entradas órfãs (`snapshot === null`) são excluídas da agregação por impressora e a contagem de exclusão é visível, não silenciosa.
- [ ] A tabela por impressora soma o mesmo total que o total geral do módulo, e um teste prova a paridade.

---

#### N3 — Ponto de equilíbrio e amortização

**Status:** escopo definido; **impossível sem N0**. Esta frente é pré-requisito de dados, não um widget do dashboard.

**O que é:** ponto de equilíbrio em **horas de extrusão** (horas necessárias para amortizar o preço de compra da máquina usando o lucro/h histórico); em **peças/pedidos** (contagem exata de projetos médios para zerar o custo do equipamento); **faturamento bruto alvo** dado a margem média real. Barra sólida de progresso de amortização com o percentual do preço de aquisição já amortizado e o restante. ROI real em %. Notificação automática quando a impressora ultrapassa 100% de amortização.

**Dados e estado de que depende:**

- **Pré-requisito duro: N0.** Sem preço de aquisição (`PrinterProfile` não tem o campo), sem data de aquisição e sem log de horas (zero matches no app real), não há o que amortizar.
- `usefulLife` **não é um input da pessoa usuária.** Ver N0. Se a amortização reta usar esse valor, o número é derivado de uma premissa do autor do catálogo (`printers.ts:7-8`) e precisa aparecer na interface como tal.
- Existe break-even **parcial** hoje: `Dashboard.tsx:139-157` já calcula `breakEvenUnits` e `breakEvenRevenue`, mas a partir de `fixedCosts.monthlyCost` — **não** do preço de uma impressora. `buyPrice` é um input avulso de dashboard persistido em `open3dcalc_dashboard_v1` (`Dashboard.tsx:34`, `46-62`).

**Referência no protótipo — a matemática serve, o vínculo de dados está errado.** `Example/src/components/PrinterRoiBreakEvenCard.tsx` (412 linhas) implementa os três eixos pedidos — `breakEvenHours`, `breakEvenUnits` e `breakEvenGrossRevenue` (`:109-111`) — com barra de amortização (`:223-230`), ROI em % (`:121`) e chip de máquina paga (`:210-213`). **UI e fórmulas são referência utilizável. O binding precisa ser reescrito do zero**, por dois defeitos que estão registrados aqui para não serem adaptados:

- **Preço de catálogo como custo afundado.** `PrinterRoiBreakEvenCard.tsx:75` faz `selectedPrinter.price || 4500`. Esse é o **preço de tabela do modelo**, usado como se fosse o que a pessoa usuária pagou — exatamente o anti-padrão que N0 já proíbe. Somado ao `|| 4500`, o fallback é um número inventado que a interface apresenta como custo de aquisição. Apagado, não adaptado.
- **Casamento por faixa de preço.** `PrinterRoiBreakEvenCard.tsx:66` atribui o histórico a uma máquina com `Math.abs(item.data.printerCost - selectedPrinter.price) < 500`. Uma banda de ±R$ 500 entre impressoras de preço próximo **atribui lucro à máquina errada e produz ROI confiante e errado**. Apagado, não adaptado: o vínculo tem que vir de `snapshot.selectedPrinterId`, como já é exigido em N2.

**Não-objetivos:**

- ❌ Contabilidade fiscal, DRE, depreciação acelerada, valor residual ou método de cotação. Reta simples basta.
- ❌ Reimplementar o break-even de custo fixo que já existe. Esta frente **estende** o existente para o eixo máquina.
- ❌ Portar o casamento por faixa de preço ou o fallback `|| 4500` de `PrinterRoiBreakEvenCard`. São defeitos, não referência.
- ❌ "Payback" como alerta operacional. A notificação é informativa.
- ❌ Inferir horas de impressão a partir da data de aquisição. Tempo em espera não é tempo imprimindo.

**Anti-padrão:** notificar "amortização concluída" a partir de um `usefulLife` estimado no código. Não é marco, é eco de uma premissa. A notificação só é legítima se a pessoa usuária forneceu preço, data e horas — e, mesmo assim, é cenário, não medição (ver N7).

**Acceptance criteria:**

- [ ] O break-even em horas só é exibido quando existe preço de aquisição **e** log de horas; caso contrário, a interface explica o que falta em vez de mostrar zero.
- [ ] O break-even em peças retorna contagem inteira, e um teste cobre o caso de projeto com lucro não positivo — a resposta correta ali é "não existe", não um número gigante.
- [ ] A barra de amortização mostra percentual e restante, e o rótulo diz de qual valor de aquisição ela foi derivada.
- [ ] A notificação de 100% só dispara com dados de entrada realmente fornecidos, e existe teste que prova que ela **não** dispara com `usefulLife` de catálogo.
- [ ] A soma dos valores por impressora bate com o total do módulo, e a cobertura dos cálculos de amortização é ≥ 90%.

---

#### N4 — Simulação dinâmica com o orçamento ativo

**Status:** escopo definido; implementação bloqueada por N0.

**O que é:** cruzar o histórico geral com a peça **atualmente sendo calculada**, exibindo uma linha no formato "Produzindo apenas X unidades deste projeto você quita 100% do saldo restante da impressora". O saldo restante depende do valor de aquisição já amortizado — portanto depende de N0.

**Pontos de integração especificados:**

- [ ] No **Dashboard**, posicionado **abaixo** dos módulos de frota e de estoque crítico, com seletor de máquina e tabela de detalhe dos pedidos vinculados à impressora selecionada.
- [ ] Na **calculadora de preço**, um resumo rápido de ponto de equilíbrio na barra lateral, mais um painel expansível de parâmetros da máquina com a análise completa.

**Dados e estado de que depende:** mesma base de N3 (N0 + rentabilidade histórica). A peça em cálculo vem de `calculatorStore.results`; o saldo restante vem do valor de aquisição do ativo.

**Referência no protótipo — não existe.** Nenhum dos 26 componentes de `Example/src/components/` cruza a peça em cálculo com o saldo restante da impressora. `SmartPricingRecommender.tsx` calcula preço a partir do custo, não o número de unidades que quita um saldo. **Esta é a única frente de N1–N6 sem implementação de referência**, e por isso o custo estimado dela é o menos conhecido da lista.

**Não-objetivos:**

- ❌ Um segundo motor de cálculo. A simulação consome `calculateResult`/`calculateBatch`; não os replica.
- ❌ Pedido de produção, reserva de fila ou commit de capacidade ao clicar. É leitura, não escrita.
- ❌ Alterar o resultado do cálculo atual ao mover um slider. A simulação é leitura sobre o resultado, não escrita nele.

**Anti-padrão:** o resumo da barra lateral e o painel expandido mostrarem números diferentes porque cada um recalcula por conta própria. São duas letras do mesmo cálculo; divergência entre eles é um bug, não uma escolha de layout.

**Acceptance criteria:**

- [ ] Mover qualquer campo do cálculo atual atualiza a linha de simulação sem recarregar a tela.
- [ ] O número de unidades é inteiro e deriva do lucro **por unidade** do cálculo atual, com a conta auditável na própria linha.
- [ ] Trocar a impressora no seletor do Dashboard troca a tabela de detalhe e zera a seleção anterior.
- [ ] Resumo da barra lateral e painel expandido assertam o mesmo valor, coberto por teste.
- [ ] Com lucro não positivo, a linha explica a impossibilidade em vez de exibir uma quantidade.

---

#### N5 — Profit Analytics

**Status:** escopo definido; implementação pendente. Não depende de N0.

**O que é:** quebrar a margem de lucro por **tipo de material** ou por **impressora**, usando barras visuais de dados para expor os jobs mais lucrativos. Alternar por material e por impressora é o eixo da feature.

**Referência no protótipo — excede o pedido.** `Example/src/components/ProfitAnalyticsModule.tsx` (662 linhas) traz **três** eixos, não dois: `AnalyticsViewMode = 'material' | 'printer' | 'jobs'` com `JobSortCriteria = 'margin' | 'profit' | 'hourlyRate'` (`:29-30`). O eixo de jobs é escopo adicional e precisa de decisão própria antes de entrar. As barras são CSS proporcionais, sem biblioteca de gráfico, com as máximas calculadas relativas ao próprio conjunto (`:232-239`) — o padrão certo para esta tela.

**O que trocar no port:** as cores são limiares Tailwind hardcoded, via `getMarginBarColor` com breakpoints 60/45/30 (`:248-252`). Substituir pelos tokens `--cost-*` já existentes, sem exceção e sem hex no componente.

**Tokens — não propõe paleta nova.** Os seis tokens categóricos já existem em `src/styles/tokens.css`:

- `--cost-filament` (`:48` claro, `:98` escuro)
- `--cost-energy` (`:49` / `:99`)
- `--cost-machine` (`:50` / `:100`)
- `--cost-labor` (`:51` / `:101`)
- `--cost-failure` (`:52` / `:102`)
- `--cost-other` (`:53` / `:103`)

Aliados como `--color-cost-*` em `:200-205`. A análise por material reutiliza esses tokens; a análise por impressora precisa de uma escala **derivada** de token, nunca de cor hardcoded.

**Dados e estado de que depende:** `HistoryEntry.profit` e `totalCost` (planos, `types/index.ts:316-318`); eixo material via `snapshot.fdmMaterial`/`resinMaterial`; eixo impressora via `snapshot.selectedPrinterId` (`types/index.ts:359`). Mesma ressalva de órfãos de N2.

**Não-objetivos:**

- ❌ Paleta nova. Os tokens existem e têm modo claro e escuro pronto.
- ❌ Ranqueamento de "melhor impressora" em valor absoluto. A ordenação é por margem, e máquinas sem produção ficam fora, não em zero.
- ❌ Amostragem, mediação ou ajuste de preço. O módulo mostra o que aconteceu, não sugere o que cobrar.

**Acceptance criteria:**

- [ ] A troca entre "por material" e "por impressora" reordena as barras sem recarregar nem perder a ordenação atual.
- [ ] Toda cor usada vem de `--cost-*` ou de alias derivado de token; nenhum hex hardcoded no componente.
- [ ] A ordenação é reprodutível para o mesmo conjunto de entradas, e um teste cobre empate de margem.
- [ ] Entradas órfãs são excluídas e a contagem da exclusão é visível.

---

#### N6 — Revenue Trends

**Status:** escopo definido; implementação pendente. Não depende de N0.

**O que é:** gráfico de faturamento mensal projetado nos últimos 6 meses.

**Referência no protótipo — descartada.** `Example/src/components/RevenueTrendsChart.tsx` (458 linhas) **não é portável**. A distinção visual entre projetado e realizado é boa — traço tracejado com preenchimento a 12% (`:366-374`) — mas **a projeção é fabricada**: `rampFactor = 0.55 + (0.45 * ((monthsBack - 1 - i) / (monthsBack - 1)))` e `projectedRevenue = round(capacityMensalMáxima * 0.40 * rampFactor)` (`:116-118`). Constantes sem origem explicada. O KPI "Atingimento da Meta" (`:171-172`) passa a medir a pessoa usuária **contra um número retrocalculado da própria capacidade dela**. **Este é o caso concreto da regra de falsa confiança que N7 enuncia no abstrato**, e é a razão de o componente ser descartado em vez de adaptado: reimplementar a partir do histórico real, sem tendência inventada. O componente também importa `recharts` de forma eager (`:13`), furando o barrel lazy que o app já tem.

**A biblioteca já está no projeto — não há decisão de dependência a tomar.** `recharts` já é dependência de produção em `package.json:51` (`^3.10.1`), e `src/shared/components/Dashboard/RechartsLazy.tsx:1-31` já reexporta `AreaChart`, `Area`, `BarChart`, `Bar`, `PieChart`, `Cell`, `ResponsiveContainer`, `Tooltip`, `Legend`, `CartesianGrid`, `XAxis`, `YAxis`. Este item **estende um barrel existente**; não adiciona bundle, não introduz dependência nova e não abre discussão de licença.

**Dados e estado de que depende:** `HistoryEntry.timestamp` e `sellPrice` para o histórico realizado; a projeção usa a mesma base de N2. Gráfico de **projeção** é o rótulo honesto — os meses passados são medidos, os futuros não.

**Não-objetivos:**

- ❌ Adicionar biblioteca de gráfico. Recharts já está lá.
- ❌ Série temporal contínua, granularidade diária/semanal, ou drill-down por impressora.
- ❌ Previsão com tendência projetada para frente. O gráfico mostra 6 meses; ele não extrapola.
- ❌ Animação de entrada como informação. O app já tem o hook `useReducedMotion` (`src/shared/hooks/useReducedMotion.ts`) e um precedente de guarda em `Wiki/wiki.css:140`; o gráfico tem de consumir um dos dois.

**Acceptance criteria:**

- [ ] O gráfico renderiza 6 meses e a barra do mês corrente é distinguível das realizadas.
- [ ] O gráfico usa apenas componentes já reexportados por `RechartsLazy.tsx`, ou o barrel é estendido explicitamente no mesmo PR.
- [ ] `package.json` não ganha dependência de gráfico nova como efeito deste item.
- [ ] O gráfico é legível com o dataset mínimo (um único mês) e com o dataset vazio, com estado vazio explícito.
- [ ] Meses sem histórico aparecem como ausência, não como zero.

---

#### 🔒 N7 — Notas transversais (valem para N1–N6)

**Premissas visíveis — o risco de falsa confiança.** Qualquer notificação automática de "a impressora passou de 100% de amortização", ou de "a meta de faturamento foi atingida", é um **número financeiro computado apresentado como marco**. Cada uma dessas figuras depende de premissas que a pessoa usuária não vê: taxa de venda efetiva, taxa de ocupação, vida útil, preço de aquisição, duração média de projeto. A regra que estas seis frentes devem herdar:

- [ ] **Todo número computado expõe as premissas que o produziram**, na mesma tela, sem clique extra.
- [ ] **Todo número computado é rotulado como cenário, nunca como medição.** "Medido" é o que saiu do histórico real.
- [ ] Uma projeção de faturamento **sem a premissa de ocupação visível** repete, em contexto financeiro, uma falha que ainda está no protótipo: o `AIAssistantModal.tsx` declara um estado `analysisError` na linha 53, o renderiza na linha 327, e **nunca o atribui** no bloco `catch` (linhas 105-111) — cenário simulado entregue silenciosamente como análise real.
- [ ] Uma barra de progresso que enche sem indicar de onde veio o número é publicidade, não interface.

**Acessibilidade — o protótipo não tem nenhuma primitiva para copiar.** Um grep por `aria-`, `tabIndex`, `onKeyDown`, `focus-visible`, `min-h-[44`, `prefers-` e `sr-only` em **todo** o `Example/src` retorna **zero matches**. Nenhum dos seis componentes tem rótulo acessível, foco gerenciado ou guarda de movimento reduzido. Armadilhas concretas que não podem ser portadas:

- Controles clicáveis que só o mouse alcança: `div` e `span` com `onClick` envolvendo inputs com `pointer-events-none` (`MonthlyRevenueProjectionCard.tsx:387-407`, `:332-335`). O input é intocável e o wrapper não é focável — o controle inteiro desaparece para quem navega por teclado.
- O checkbox mestre tri-state de 14px (`w-3.5 h-3.5`, `HistoryView.tsx:735-742`) se anuncia por `title` e nada mais. É o controle que N1 inteiro depende, e é o menor alvo da tela.
- Alvos de toque de 20px (`py-0.5` nos chips de status, `HistoryView.tsx:632-672`) e de 28px (`py-1` nos botões de ação) — abaixo do mínimo de 44px.
- `transition-all duration-500` toca sem guarda (`PrinterRoiBreakEvenCard.tsx:223-230`) e as animações do recharts rodam sem `prefers-reduced-motion` (`RevenueTrendsChart.tsx`).

**Consequência para o port:** não há padrão de acessibilidade a portar. N1–N6 precisam ser **construídos contra as convenções que o app real já tem** (foco visível, alvo mínimo, rótulo acessível, `prefers-reduced-motion`), com o comportamento de teclado e leitor de tela decidido antes da interface, não depois. Nenhum critério de acessibilidade desta fase pode ser aceito com "o protótipo já fazia assim".

**Direção visual.** O app está sendo portado para a linguagem visual do protótipo de referência (sidebar, header, menus, cards e layout Bento). **Estes seis itens usam a direção CLASSIC-FLAT** — sem neons, sem sombras em excesso, tipografia tabular e paleta neutra de software de engenharia — porque são telas densas de dados, e é o contexto em que o pedido foi feito. São duas direções convivendo no mesmo app por decisão conscious: **N1–N6 não devem herdar nem contrariar o Bento; elas seguem classic-flat.** Nenhuma decisão de cor, elevação ou densidade de N1–N6 deve ser tomada contra essa direção.

**Tipografia.** O pedido é **tipografia tabular em JetBrains Mono**. Estado atual verificado: `src/styles/fonts.css` auto-hospeda **Plus Jakarta Sans** sob SIL OFL 1.1, em dois subsets `woff2` (latin, latin-ext), com escala `--type-*` e `--type-hero-numeric-font-variant: tabular-nums` na linha 63. `--font-mono-stack` (linhas 34-36) hoje é uma **stack de sistema** — `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono`. **JetBrains Mono não está no projeto.**

- [ ] Se adotado, JetBrains Mono é **bundlado** com subsets `woff2` e `unicode-range` próprios, sob OFL, com a licença em `src/styles/fonts/`. **Nunca CDN** — o app é offline-first e serve local para cumprir CSP.
- [ ] `tabular-nums` continua obrigatório em qualquer numeral que oscile de valor em tempo real: sem alinhamento de coluna, o número parece piscar.
- [ ] **Flag:** adotar JetBrains Mono **reverte** a decisão anterior de manter Plus Jakarta Sans, e é uma troca de identidade tipográfica do app inteiro. Precisa ser decidida como decisão, não absorvida aqui. **Aberto — decisão pendente do usuário.**

---

#### 📎 N8 — Dependências e ordem sugerida

```
N0  Frota de ativos + registro de horas   ── pré-requisito DURO
      │
      ├──► N2  Projeção de faturamento e capacidade
      ├──► N3  Ponto de equilíbrio e amortização
      └──► N4  Simulação dinâmica com o orçamento ativo

N1  Seleção em lote (HistoryEntry)   ── independente, não espera N0
N5  Profit Analytics          ── independente, não espera N0
N6  Revenue Trends            ── independente, não espera N0
```

**Leitura da ordem:**

- **N0 primeiro, sem exceção.** N2, N3 e N4 não são três widgets esperando polimento: são três leituras de dados que não existem. Começar por qualquer um deles entrega tela com número inventado — que é exatamente a falha que N7 existe para impedir.
- **N1, N5 e N6 podem andar em paralelo** e não dependem de N0. N5 e N6 leem o histórico, que já existe. N1 mexe em `HistoryEntry`, o mesmo domínio que N5 e N6 já leem.
- **N6 é o de menor risco da lista** — a biblioteca já está no projeto e o dado já existe, e o protótipo é descartado em vez de adaptado. Se algo for decidido para sair rápido, é N6.
- **N3 é o de maior risco.** Depende de N0, depende da reconciliação de unidade de `usefulLife`, e toca um número financeiro. Se N0 demorar, N3 espera; não se contorna.

**Dependências de roadmap, não só técnicas:** N0 depende da **Phase 7d** (`ROADMAP.md:426`). N1 toca a **Phase 7l** (snapshot imutável, `ROADMAP.md:674`): uma entrada de histórico com snapshot não deve ser reescrita por status em lote sem que as duas fases concordem sobre o que é fato e o que é estado. O snapshot é o fato; o status é estado; os dois convivem na mesma linha.

**Acceptance criteria (transversal às seis frentes):**

- [ ] Nenhuma tela de N1–N6 exibe número financeiro sem premissa visível na mesma tela.
- [ ] Nenhuma notificação automática dispara a partir de dado não fornecido pela pessoa usuária.
- [ ] Toda etiqueta nova existe em **pt-BR e en-US**, com paridade verificada.
- [ ] Cobertura: componentes novos ≥ 80%, libs de cálculo ≥ 90%.
- [ ] WCAG AA, com `prefers-reduced-motion` respeitado em todo gráfico e barra animada.
- [ ] A checklist de LGPD e os testes de regressão de privacidade passam para cada chave nova.

---

### 🧭 Phase 7o: App Shell, navegação e espaços de trabalho

**Status:** etapas aprovadas pela pessoa usuária; Stage 1 — Navigation Context —, Stage 2 — Currency/Theme — e Stage 3 — navegação primária, destino ativo persistido e Manage Visibility — foram implementadas e mescladas em `main`, mas o aceite de 7o.2 segue aberto até reconciliar o plano com a shell web publicada. 7o.4–7o.7 têm implementação parcial/scaffolds, com critérios pendentes; 7o.3 e 7o.8 não iniciadas. Esta fase descreve oito fatias separadas, cada uma entregável em PR próprio; sequência e dependências estão explícitas abaixo. Nenhuma delas autoriza alterar o escopo vigente da Beta 5. O plano desta fase entrou no roadmap pelo PR #223, mesclado como `67b43f34674f2aa5c5c0d394cb68383688509cf1`.

**Relação com o roadmap existente:** esta fase não substitui, reordena nem absorve W1–W3, o port visual da Beta 5 ou a Phase 7n. Esses trabalhos continuam independentes; qualquer dependência entre eles deve ser declarada antes de iniciar a fatia afetada. A Phase 7n mantém seus próprios dados e pré-requisitos: em particular, os itens que dependem de frota real continuam bloqueados até N0, e métricas sem modelos, dados e fórmulas reais permanecem adiadas.

**Gate de implementação e entrega por fatia:**

- [ ] Aplicar o gate transversal de compatibilidade v2.0 acima em **cada** fatia, inclusive nas fatias somente visuais; quando uma fatia não tocar persistência, registrar isso e executar os testes de compatibilidade aplicáveis.
- [ ] Fazer TDD (RED → GREEN → REFACTOR). Antes de cada fatia, reconfirmar a baseline informada de **219 arquivos / 2.924 testes**; a suíte existente deve continuar verde, sem regressões.
- [ ] Em cada fatia verde, executar e registrar testes, typecheck, lint, builds web e desktop e verificações de acessibilidade, i18n e responsividade. Componentes novos devem ter cobertura ≥80%; WCAG AA, contraste adequado, alvos de toque de pelo menos 44px, paridade pt-BR/en-US, navegação por teclado e movimento reduzido são critérios de aceite.
- [ ] Abrir um PR separado por fatia verde, prontamente após sua conclusão, para Iris atualizar o PR da fase. Preferir integrar cada fatia antes de começar as dependentes, evitando uma pilha longa. Nenhum PR deve ser mesclado sem aprovação explícita da pessoa usuária.
- [ ] Usar `Example/` apenas como referência de interação ou linguagem visual quando indicado abaixo; stores, cálculo e dados reais do app continuam sendo a fonte de verdade.

#### 7o.1 — Façades de estado da aplicação

**Status:** Navigation Context implementado, aprovado pela Themis no SHA exato de revisão (uma observação baixa e não bloqueante) e mesclado em `main`. PR [#227](https://github.com/ils15/open3dcalc/pull/227) squash-merged como `d4e3b770c9f8d7876059212171e8329d18a1e2a8`. Commit de trabalho `f8f6b061ef8a4639f15d162fa4ab12e662aefca3`, baseado em `main` (`ec82f651`); na base exata passaram 218 arquivos / 2.870 testes (baseline: 216 / 2.863), `typecheck`, `typecheck:electron`, `lint`, `build:web` e `build:desktop`. O merge foi feito com `--admin` para contornar a regra do repositório de uma aprovação revisora obrigatória; o requisito de revisão foi satisfeito pela revisão da Themis fora da interface do GitHub, e não por uma approval registrada no GitHub. Nenhum dado persistido foi alterado.

Currency e Theme Context implementados, aprovados pela Themis após três correções e mesclados em `main`. Phase 2: commits `7a79e373dad2adcb5b3d805c497bd1143988cee0` e `4885cdaa42fcdc07dc0d4be9acd58863d62d97f3`; PR [#228](https://github.com/ils15/open3dcalc/pull/228) squash-merged como `af37cd5f900dc4616ee5493f7471a3fdd2a9b156`, baseado na Phase 1/PR #227; head aprovado `4885cdaa42fcdc07dc0d4be9acd58863d62d97f3`. Na criação do PR, o CI remoto ainda não tinha check runs; antes do merge, os status checks obrigatórios `checks` e `test` passaram no SHA exato aprovado. A suíte local passou com 223 arquivos / 2.883 testes; typechecks, lint e `build:all` passaram. O merge foi feito com `--admin` para contornar a regra do repositório de uma aprovação revisora obrigatória; o requisito de revisão foi satisfeito pela revisão da Themis fora da interface do GitHub, e não por uma approval registrada no GitHub. Após os dois merges, `origin/main` está em `af37cd5f900dc4616ee5493f7471a3fdd2a9b156`. As chaves de storage existentes não mudaram; a validação cobre Currency/Theme, não o gate completo de compatibilidade v2.0, que permanece aberto. Browser indisponível; sem alterações de CSS/layout.

**Acceptance criteria:**

- [ ] Navigation Context, Currency Context e Theme Context leem e encaminham atualizações aos owners já existentes; nenhum Context mantém uma cópia independente do mesmo estado.
- [ ] Atualizações iniciadas pelo store e pela façade permanecem coerentes e são cobertas por testes de integração.
- [ ] Não há mudança de contrato ou formato dos dados centrais persistidos; o gate transversal de compatibilidade v2.0 permanece obrigatório.

#### 7o.2 — Navegação primária persistente e visibilidade configurável

**Status:** há implementação mesclada em `main`, mas o critério dos cinco destinos — **Pricing, Dashboard, History, Printers e Spools** — permanece aberto até reconciliação: a web beta publicada monta `StudioLayout` com sidebar de dez módulos, não esses cinco destinos. O merge do PR [#229](https://github.com/ils15/open3dcalc/pull/229), squash-merged como `048211ea569c5ad04b13a6b02bf35e803b9dc311` e aprovado pela Themis no SHA exato de revisão `a4333edcd443f965cd8e46d9cb130a2a63fd7a95`, não comprova por si só que o critério esteja presente na UI publicada.

Duas falhas reais foram encontradas e corrigidas durante a revisão, e não depois do merge. `useDismissablePopover` escuta em `window`, que é ancestral de `document` no caminho de propagação, de modo que Escape fechava o diálogo de visibilidade **e** o dropdown de configurações que estava atrás dele. E `useId` estava declarado depois de um retorno antecipado em `MoreMenu`, o que mudava a ordem de hooks sempre que todos os destinos rebaixados estavam ocultos. A autora reportou e restaurou, por conta própria, duas asserções que havia enfraquecido antes.

A entrega cobre apenas esta fatia. Nenhum dado persistido central mudou e nada aqui fecha o gate transversal de compatibilidade v2.0, que permanece aberto.

**Acceptance criteria:**

- [ ] A navegação primária contém os cinco destinos aprovados; Pricing permanece sempre acessível e não pode ser ocultado.
- [ ] Settings oferece **Manage Visibility** para os destinos configuráveis. A visibilidade das abas é uma preferência local e não deve entrar em sync.
- [ ] Infill sai da navegação primária e fica em **Mais**, sem remover o campo da worksheet nem a função standalone.
- [ ] A aba ativa é restaurada ao reabrir a aplicação sem sobrescrever dados centrais; qualquer chave nova de preferência segue SPEC-01 e o gate transversal de compatibilidade v2.0.
- [ ] Os destinos e controles de visibilidade são acessíveis por teclado e leitor de tela, com nomes traduzidos e layout responsivo.

#### 7o.3 — Complexidade escolhida pela pessoa usuária

**Status:** aprovada; não iniciada. Os níveis **Simple** e **Studio Pro** controlam quanto detalhe aparece na calculadora e no Dashboard.

**Acceptance criteria:**

- [ ] Simple reduz a densidade de controles e conteúdo do Dashboard; Studio Pro expande os detalhes, sem mudar os resultados ou apagar entradas.
- [ ] Complexidade é independente da visibilidade das abas e do Focus Mode; mudar uma dessas preferências não ativa ou redefine as outras.
- [ ] A preferência é aditiva e reversível, com leitura preservada de dados e preferências de versões anteriores conforme o gate transversal v2.0.

#### 7o.4 — Focus Mode transitório

**Status:** implementação parcial; scaffolds de Focus Mode existem na shell, mas os critérios de aceite estão pendentes. Oferecer uma superfície somente de calculadora, escondendo a navegação e a sidebar enquanto o modo estiver ativo.

**Acceptance criteria:**

- [ ] O Focus Mode mostra apenas a calculadora e mantém uma saída segura, visível e utilizável em todos os tamanhos de tela.
- [ ] Sair do modo restaura o contexto anterior — destino, sidebar, densidade e foco de navegação — sem perder campos ou resultados.
- [ ] O modo é transitório, não uma nova preferência persistida; entrar ou sair não altera estado de cálculo, undo/redo ou a visibilidade das abas.
- [ ] A entrada, a saída e a restauração funcionam por teclado e respeitam WCAG AA e movimento reduzido.

#### 7o.5 — Mini-Dash fora do Dashboard

**Status:** implementação parcial; há scaffold de Mini-Dash, mas os valores demonstrativos não atendem ao critério de métricas verificadas; critérios de aceite pendentes. Disponibilizar um Mini-Dash compacto fora da tela Dashboard, com opção clara de reabrir ou expandir.

**Acceptance criteria:**

- [ ] O Mini-Dash pode ser compactado, reaberto e expandido sem perder o contexto da tela atual.
- [ ] Exibe somente métricas verificadas que já existam nos dados reais de histórico e carretéis; métricas sem fonte real são omitidas, não simuladas.
- [ ] Em desktop e mobile, o Mini-Dash e sua versão expandida não cobrem campos, ações, foco nem controles necessários da tela subjacente.
- [ ] Conteúdo, rótulos e ações são acessíveis e localizados; aplicar o gate transversal de compatibilidade v2.0 a qualquer preferência persistida introduzida.

#### 7o.6 — Gerenciador e guia global de atalhos

**Status:** implementação parcial; há scaffolding de atalhos, mas o gerenciador/guia global e seus critérios de aceite estão pendentes. Centralizar atalhos da aplicação e oferecer um guia acessível, após auditoria de conflitos com navegador e sistema operacional.

**Acceptance criteria:**

- [ ] Cada atalho proposto tem conflito de navegador e sistema operacional auditado antes de ser adotado; conflitos não são capturados silenciosamente.
- [ ] Atalhos não disparam enquanto o foco estiver em entrada de texto/editável, nem atravessam modal ou diálogo ativo de forma inesperada.
- [ ] O guia lista os atalhos efetivamente ativos, pode ser aberto e fechado por teclado e tem foco, rótulos e textos traduzidos.
- [ ] Testes cobrem conflito, campos editáveis, modais, navegação por teclado e o comportamento de fechamento.

#### 7o.7 — Quick Actions em speed dial

**Status:** implementação parcial; há scaffolding de Quick Actions, com critérios de aceite pendentes. Entregar Quick Actions como uma fatia separada, sem agrupar sua implementação com Mini-Dash ou Dashboard.

**Acceptance criteria:**

- [ ] O speed dial é operável por teclado e toque, anuncia estado e ações de forma acessível e não depende apenas de ícones.
- [ ] Posição, área segura e abertura/fechamento funcionam em telas responsivas sem ocultar controles.
- [ ] A ordem de camadas e a coexistência são verificadas junto a Mini-Dash, tutorial e diálogos; um overlay nunca bloqueia saída, foco ou confirmação de outro.
- [ ] Testes verificam a interação e colisões de camadas nos estados simultâneos relevantes.

#### 7o.8 — Quatro espaços de trabalho no Dashboard

**Status:** aprovada; não iniciada. Organizar o Dashboard em quatro espaços: **Overview/Finances**, **Profitability/Pricing**, **Operations/Quality** e **Engineering/Slicer**. `Example/` é **referência de UI que se porta** — a organização em quatro espaços é exatamente a forma de tela que se aproveita (decisão de 25/09/2026, ver a nota de supersessão na Phase 7i) — e **não** é fonte de modelos, métricas ou dados. A distinção que importa aqui: a **estrutura** dos quatro espaços é do protótipo; os **números** dentro deles são do app real, e nenhum número do protótipo entra sem verificação contra o tipo real (ver Phase 7p).

**Acceptance criteria:**

- [ ] Os quatro espaços têm nomes, conteúdo e navegação distinguíveis; somente o espaço ativo é montado, com lazy mounting dos demais.
- [ ] Trocar de espaço preserva dados e estado de cálculo existentes. Componentes reutilizam os stores e cálculos reais do app.
- [ ] Fleet ROI, live jobs, failure outcomes, tendências de faturamento fabricadas e slicer optimizer do protótipo permanecem adiados até existirem modelos, dados e fórmulas reais aprovados. Dependências de frota continuam subordinadas ao N0 da Phase 7n; nenhuma tela apresenta placeholder como métrica real.
- [ ] Os espaços funcionam em desktop e mobile, são acessíveis por teclado/leitor de tela e mantêm paridade pt-BR/en-US.

**Dependências entre fatias:** 7o.2 depende das façades de navegação de 7o.1; 7o.4 depende da navegação/sidebar de 7o.2; 7o.5 depende da navegação de 7o.2; 7o.7 deve validar a coexistência com o Mini-Dash de 7o.5; 7o.8 usa a navegação de 7o.2. 7o.3 e 7o.6 podem ser planejadas separadamente, mas continuam sujeitas ao gate e à entrega em PRs próprios. Os componentes de Dashboard que dependem de frota real continuam bloqueados por N0 na Phase 7n, sem bloquear a estrutura dos quatro espaços.

---

### 📈 Phase 7p: Camada de gráficos — entrega parcial

> **Estado atual:** o diagnóstico de 30/09 de “substrato zero” foi superado pelas entregas dos PRs #249 e #250: `useHistoryAggregates`, `ProfitAnalyticsModule` e `MaterialEfficiencyHeatmap` existem no source. Isso não significa que a UI esteja publicada: `ProfitAnalyticsModule` está no Dashboard compartilhado, fora da shell web ativa, e o heatmap não tem mount de produção encontrado. Os demais gráficos continuam pendentes; a regra contra dados fictícios permanece.

**Status:** implementação parcial. O hook e os componentes citados acima existem no source; integração na shell web ativa e demais critérios permanecem pendentes.

#### 🚧 O pré-requisito que desbloqueia quatro componentes de uma vez

`src/shared/hooks/useHistoryAggregates.ts` está entregue em 7p.1: funções **puras**, somente leitura, sem store e sem JSX — `byMonth`, `byQuarter`, `byMaterial`, `byPrinter`. **Sem dados, retornam `null` — nunca `0`.** Esta é a decisão mais importante do design: um gráfico que desenha uma linha em `0` quando não há histórico está **assertando** que a pessoa fez receita zero. `null` desenha um estado vazio. O hook espelha `Dashboard.tsx:170`, que já trata esse caso.

- [ ] O hook deve **substituir** as cópias inline que já existem em `historyStore.ts:34-39` (`getTopPrinters` / `getTopMaterials`) e `Dashboard.tsx:248-286`, e não se somar a elas. Duas fontes de agregação é a forma mais rápida de divergirem.
- [ ] Cobertura de teste, cerca de 120 linhas: histórico vazio; histórico com entrada única; entradas sem snapshot (`entry.snapshot` é `| null` em `types/index.ts:320`); entradas antigas sem `profitPerHour` e sem `totalHoursForProfit` (ambos opcionais em `:300,302` — precisam de `?? estimatedPrintTime`, e apesar do nome o valor é **horas**, `calculator.ts:228`).

**Bloqueio técnico a resolver antes do quinto componente:** `RechartsLazy.tsx:17-31` exporta `PieChart`, `Pie`, `Cell`, `ResponsiveContainer`, `Tooltip`, `Legend`, `AreaChart`, `Area`, `CartesianGrid`, `XAxis`, `YAxis`, `BarChart` e `Bar`. **Faltam `ComposedChart`, `Line`, `LineChart` e `ReferenceLine`**, exigidos por `RevenueTrendsChart` e `QuarterlyRevenueProjectionCard`. Os dois primeiros itens da ordem abaixo não dependem disso — e é por isso que estão primeiro.

#### Ordem de implementação

| #   | Componente                                 | Recharts | Risco    | Nota                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `useHistoryAggregates`                     | —        | Baixo    | Desbloqueia 1, 2, 3, 4 e 5 de uma vez                                                                                                                                                                                                                                                                          |
| 2   | `ProfitAnalyticsModule`                    | **Zero** | Baixo    | ~280 linhas, só barras CSS. Dados já existem. A ação de recarga já existe: `loadHistoryItem(snapshot)` em `calculatorStore.ts:659`, usada em `HistoryTab.tsx:268`                                                                                                                                              |
| 3   | `MaterialEfficiencyHeatmap`                | **Zero** | Baixo    | ~230 linhas. O risco é de **correção**, não de arquitetura: apagar `getBaselineEstimates()`, **derivar as linhas das entradas em vez de fixar uma lista de materiais**, e somar sem multiplicar por `quantity` (ver A1)                                                                                        |
| 4   | `MiniDashOverlay` parcial                  | Zero     | Médio    | Seções A (financeiro, `historyStore`), C (estoque, `spoolStore` — `remainingPct()` e `isLowStockSpool()` já existem) e D (cálculo, `calculatorStore`). **Dropar a seção B (frota):** `PrinterProfile` não tem `status`. Overlay exige a11y que o protótipo não tem: portal, focus-trap, `Escape`, `aria-modal` |
| 5   | `RevenueTrendsChart`                       | **Sim**  | Médio    | Primeiro uso real de `ComposedChart`/`Line`. Exige ampliar `RechartsLazy`                                                                                                                                                                                                                                      |
| 6   | `MonthlyRevenueProjectionCard` reduzida    | Sim      | Médio    | ~280 linhas, matemática trivial. O problema é **semântico**: `printersCount` não tem fonte no app. Basear em `printersCount = 1`. Só depois do 5 — é a mesma superfície                                                                                                                                        |
| 7   | `QuarterlyRevenueProjectionCard` reescrito | Sim      | **Alto** | ~300 linhas, das quais ~40% é modelo preditivo fabricado. Se entrar, entra como **realizado por trimestre + QoQ real**                                                                                                                                                                                         |

#### 🛑 Regra da fase: dado do protótipo não entra sem verificação contra o tipo real

O `Example/` traz **números inventados que produziriam gráficos mentirosos**. Não é questão de estilo ou de preferência estética: é dado falso com confiança visual. Um gráfico desenhado a partir de um fallback inventado não fica "aproximado" — ele **afirma** uma verdade que ninguém mediu.

| Número inventado                 | Onde                                                                                                            | O que viraria                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `let lastKnownRevenue = 14500`   | `QuarterlyRevenueProjectionCard.tsx:180`                                                                        | Uma linha de base de receita que é uma constante em código, apresentada como histórico                                                                                                                  |
| `getBaselineEstimates()`         | `MaterialEfficiencyHeatmap.tsx:170-192`                                                                         | Uma tabela **100% fabricada** de ROI e preço por material. Pior: ela **vaza nos "sweet spots"** (`:167`) enquanto a interface continua escrevendo "est." (`:352`). A UI admite a estimativa; o dado não |
| `rampFactor = 0.55 + 0.45 * (x)` | `RevenueTrendsChart.tsx:116-118`                                                                                | Uma reta desenhada com o nome de **curva de crescimento orgânico**. O nome é a mentira                                                                                                                  |
| `benchmarkRate = 95.0`           | `PrintSuccessAnalytics.tsx:150`                                                                                 | Uma taxa de referência sem fonte, com o comentário _"95% target industry standard"_                                                                                                                     |
| Timeline de 7 trimestres         | `QuarterlyRevenueProjectionCard.tsx:170-178`, com preenchimento do trimestre vazio pelo valor anterior (`:190`) | Sete trimestres de histórico que nunca existiram                                                                                                                                                        |

**Quatro armadilhas de porting, verificáveis antes de escrever a primeira linha:**

- **A1 — os dois lados do port têm o modelo de lote invertido, e o risco real é o oposto do que este roadmap afirmava.**

  > **Correção registrada em 30/09/2026.** A versão anterior desta linha afirmava que o `Example/` multiplicava **dinheiro** por `quantity` e que isso super-contaba em 10×. **Era factualmente errado** — e a direção do erro importa: um agregador construído sobre a afirmação errada erra para o lado oposto ao do protótipo.
  - **O protótipo é total de lote.** `Example/src/types.ts:117,125-128` põe `totalProductionCost`, `finalSalePrice` e `netProfit` no **total do lote**, e `:130-133` separa explicitamente os unitários — `unitProductionCost` / `unitSalePrice` / `unitProfit`, com o comentário _"Per unit (when quantity > 1)"_.
  - **O app é por unidade.** `calculatorStore.compute.ts:104-129` faz o **contrário** do que esta linha dizia: quando `qty > 1` ele **divide** — reparte `setupCost/qty`, aplica o desconto de volume e devolve `totalCost`, `sellPrice`, `profit` e `costPerUnit` como valores **unitários**. `CalculationResult` (`types/index.ts:274-303`) não tem campo de lote nenhum, e `HistoryEntry` (`:310-321`) também não. O que o app grava no histórico é o valor **por unidade**.
  - **Varredura das 50 ocorrências de `quantity` em `Example/src`: zero multiplicações de dinheiro.** Toda multiplicação por `quantity` é de **peso** (`printWeightGrams * quantity`) ou de **contagem de unidades** (`totalUnits += quantity`, `accumulatedUnits += quantity`). `RevenueTrendsChart.tsx:107-110` e `QuarterlyRevenueProjectionCard.tsx:86-89` somam `finalSalePrice`, `netProfit`, `totalProductionCost` e `totalHours` **cru**, sem tocar em `quantity`.
  - **O erro possível é nos dois sentidos.** Tratar `entry.sellPrice` como total de lote **sub-conta em 10×**; multiplicar por `quantity` **super-conta em 10×**. O protótipo erra para menos porque é lote e o app é unitário; um portador que leia o protótipo e multiplique erra para mais. Não existe versão deste bug que não erre.

  - **🔒 Decisão registrada — somar como está, sem multiplicar por `quantity`.** Porque é exatamente o que o app já mostra ao usuário: `Dashboard.tsx:172-173` (`reduce((sum, e) => sum + e.profit, 0)` cru), `:324-331` (`sum(current, "sellPrice")` cru) e `historyStore.ts:145` / `:165` (`existing.profit += e.profit`, `existing.totalCost += e.totalCost` — ambos crus). Multiplicar agora seria **regressão visual não autorizada**: o mesmo job apareceria 10× mais hoje no Dashboard do que passaria a aparecer no gráfico novo. Para peso, `result.unitWeight` (`calculator.ts:200`, `types/index.ts:293`) **também sem multiplicar**, por coerência: se as moedas são por unidade e os gramas são por lote, `profitPerGram` sai **inflado em 10×** — a mesma mentira numérica, só do outro lado.
  - **Consequência aceita e registrada:** como os dois lados escalam juntos, as **razões são invariantes** — `profitPerGram`, `pricePerGram`, `avgRoiPercent` e `actualMargin` **não mudam** entre as duas leituras. Só mudam os **totais absolutos** e o **bucket de peso**. Concretamente: o lote de 10 do demo (`demoDataset.ts:638,641` — 60 g/un; `purgeWeight: 8` em `:371-372`, logo ~68 g) cai no bucket **"Médio"** (`[50,150)`) em vez de **"Pesado / Lote"**. É um agregado de 10 unidades de 60 g, não 600 g: o bucket por unidade é o honesto, e as faixas de `MaterialEfficiencyHeatmap.tsx:41-46` são **por job** — que é o que o nome do campo `printWeightGrams` diz.

- **A4 — `useFinancialBreakdown.ts:224` converte horas duas vezes (bug adjacente, achado na mesma investigação).** `time.estimatedHours: result.estimatedPrintTime / 60` divide por 60 **um campo que já é horas**: o comentário em `:40` — _"`estimatedPrintTime` converted from minutes to hours"_ — está errado. `types/index.ts:149` declara `printTimeHours: number`; `calculator.ts:228` (FDM) e `:391` (resina) atribuem `print.printTimeHours` a `estimatedPrintTime`; `quoteApi.ts:89` mapeia esse mesmo valor para `estimatedTimeHours`. Fixtures usam `2.5` e `7` — horas plausíveis, e "7 horas" divided por 60 seria `0.1167`. **Bug a corrigir: remover o `/60`, e propagar ao JSDoc de `:40` e a qualquer rótulo que dependa de `estimatedHours`. A instrução para quem portar é explícita: não copiar o `/60`.** Registre-se a assimetria que já existe no mesmo objeto: `billableHours` (`:225`) vem de `totalHoursForProfit`, cuja docstring em `types/index.ts:301` diz "(print + post + setup minutes) / 60" — **já convertido na origem**. Os dois campos são horas; um deles é tratado como se fossem minutos.
- **A2 — a taxonomia de materiais do `Example/` não existe no app — e a union de 23 não é aplicada em lugar nenhum.** `MATERIALS_ORDER` do protótipo fixa 8 nomes (`'PLA Silk'`, `'Resina Tough'`, `'Nylon (PA)'`). O `MaterialType` real (`types/index.ts:3-26`) tem **23 membros em snake_case** (`pla`, `pla_silk`, `tpu_95a`, `nylon_pa12`, `peek_cf`). **Nenhuma string casa.** Três fatos tornam "mapear os 23 materiais" uma orientação errada, e foi por isso que a ordem da tabela mudou: (1) `MaterialStateFDM.type` é **`string`**, não `MaterialType` (`types/index.ts:86`), e `MaterialStateResin.type` também (`:139`) — **a união de 23 nunca é aplicada no fluxo de estado**; (2) os ids de **resina** (`standard`, `abs_like`, `water_washable`, `tough`, `flexible`, `clear`, `dental`, `castable`) estão **fora** dos 23 e entram por `as unknown as MaterialType` (`materials.ts:30-37`), então uma grade fixa de 23 linhas **descartaria toda a resina em silêncio**; (3) o dataset de demo grava **nomes de exibição**, não ids — `demoDataset.ts:542,557,572,588,603,618,635,652,668,683,698` gravam `"PETG"`, `"PLA Silk"`, `"ABS"`, `"PLA"`, `"TPU 95A"`, `"Standard"`, `"Water Washable"`, e `"PLA"` ≠ `pla`. **Decisão: as linhas são derivadas das entradas presentes (só as com `count > 0`), com a key normalizada** (`toLowerCase()`, não-alfanumérico → `_`, colapsa `_`, trim de `_`), o que faz `"PLA Silk" → pla_silk`, `"TPU 95A" → tpu_95a` e `"Water Washable" → water_washable` casarem com `materials.ts`; o `label` vem do material encontrado, **com fallback para a própria key**. A grade completa é responsabilidade do componente, não do agregador.
- **A3 — o `Example/` lê campos que o app não tem.** Ele espera `item.data.printerId`, `totalHours`, `printWeightGrams`, `quantity`, `projectName`, `clientName`, `materialType` e `status`. Equivalentes reais: `entry.snapshot.selectedPrinterId` (`:359`), `entry.result.totalHoursForProfit` (`:302`), `entry.result.unitWeight` (`:293`), `entry.snapshot.quantity` (`:362`), `entry.snapshot.productName` (`:361`), `entry.snapshot.fdmMaterial.type` (`:86`). E `HistoryEntry` **não tem cliente nenhum** (`:310-321`) — o vínculo cliente↔job existe apenas via `Quote.items[].historyEntryId` → `Quote.customerId`. Ver Phase 7q.

**Fora desta fase, por bloqueio de domínio:** `PrintSuccessAnalytics` (falta o tipo `PrintJobRecord` inteiro, ~900 linhas e domínio novo); `PrinterRoiBreakEvenCard` e `PrinterHealthScoreCard` **juntos** (dependem de `loadMaintenanceCycles()` e `Record<printerId, hoursAccumulated>`, que não existem — construir um sem o outro é retrabalho); `SmartPricingRecommender` (`Product.sold:8` é `boolean`, sem `soldAt`, `quantity` ou histórico). Ver Phase 7q para o modelo de frota.

**Estilo alheio ao app, a corrigir no port:** cores hardcoded (`bg-[#151722]`, `border-[#262b3c]`, `text-slate-*`) → `var(--surface-sunken)`, `var(--border-default)`, `var(--text-primary)`, `var(--cost-*)`; `animate-in`/`fadeIn` e `rounded-xs` não existem na superfície Tailwind do app; emoji como ícone → `lucide-react`; `<input type="checkbox">` com `onChange={() => {}}` e o pai fazendo o toggle (`MonthlyRevenueProjectionCard.tsx:395-401`) é **quebrado para teclado e leitor de tela**; switchers de modo sem semântica de aba → `role="tablist"`; células de heatmap só com `title` → `role="grid"` + `aria-pressed`; sliders sem `aria-label`.

**Acceptance criteria:**

- [x] `useHistoryAggregates` existe, é puro, e **retorna `null` — não `0` — sem dados**, com teste que prova os dois.
- [ ] Cada gráfico entregue usa agregação real sobre `historyStore`; nenhum número do protótipo sobreviveu sem verificação contra o tipo real, e cada um que foi descartado está anotado com o motivo.
- [ ] Nenhuma tela apresenta valor inventado como métrica real, e nenhuma estimativa aparece sem o rótulo que a declara estimativa.
- [ ] Os componentes têm testes RTL, cobertura ≥80%, i18n pt-BR/en-US e WCAG AA — inclusive o overlay, que exige portal, focus-trap, `Escape` e `aria-modal` que o protótipo não tem.
- [ ] `RechartsLazy` exporta `ComposedChart` e `Line` antes do primeiro gráfico que os usa, e o bundle não carrega a biblioteca de gráficos para quem não vê nenhum.

#### 7p.1 — Entrega de `useHistoryAggregates` e `ProfitAnalyticsModule` — ✅ em `11a3695` (PR #249)

**Fechados os itens 1 e 2 da tabela de ordem acima, em 30/09/2026 (PR #249, commit `11a3695`, squash).** Os itens 3 a 7 seguem abertos, sem alteração por esta entrega. O que segue registra o entregue, as decisões que o acompanharam e o que ficou pendente; as justificativas já escritas em **A1** e **A2** são referenciadas, não repetidas.

**`useHistoryAggregates` — entregue.** `src/shared/hooks/useHistoryAggregates.ts`, 620 linhas, 3 suites de teste.

- [x] As quatro funções puras exportadas — `byMonth`, `byQuarter`, `byMaterial`, `byPrinter` — e um envelope memoizado que as compõe para o consumo por componente. As puras **não tocam store, React, JSX nem i18n**: recebem `HistoryEntry[]` e devolvem dados, e é isso que as torna verificáveis sem provider.
- [x] Sem dados, `null` — nunca `0`, como a regra da fase exige.
- [x] Cobertos os casos de borda da fase: entradas sem `snapshot` (`entry.snapshot` é `| null`), entradas antigas sem `profitPerHour` e sem `totalHoursForProfit`, com `?? estimatedPrintTime`.

**🔒 Regra de unidade aplicada: somar como está, sem multiplicar por `quantity`.** `calculatorStore.compute.ts:104-129` reescreve `sellPrice`, `totalCost`, `profit` e `costPerUnit` para **por unidade** quando `quantity > 1`, e `HistoryEntry` não tem campo de lote — o histórico guarda o valor unitário, e somar é exatamente o que o app já mostra ao usuário. Peso também **sem** multiplicar: se as moedas são por unidade e os gramas por lote, `profitPerHour` por grama sai **inflado em 10×**. As **razões** — margem, preço/grama, ROI — são invariantes à escolha; só os **totais** mudam. Argumento completo em **A1**.

**Correção do próprio roadmap, agora refletida no código entregue.** A versão anterior deste documento afirmava que o protótipo multiplica **dinheiro** por `quantity`. **Não multiplica** — das 50 ocorrências de `quantity` em `Example/src`, nenhuma é dinheiro: são peso e contagem de unidades. O modelo do protótipo é **lote** e o do app é **unitário**, de modo que o risco real de um port é **sub-contar**, não super-contar. Ver **A1**.

**Três hazards evitados na implementação.** O terceiro já estava registrado em A2; os dois primeiros não.

- **`getPrinter()` tem fallback silencioso.** `printers.ts:1349-1351` faz `?? printers[0]`, e `printers[0]` é a Bambu A1 Mini: um id desconhecido agruparia os números de uma máquina sob o nome de outra, sem erro visível. Registrado no JSDoc de `useHistoryAggregates.ts:525-526`.
- **A união de 23 `MaterialType` não é aplicada em lugar nenhum.** `MaterialStateFDM.type` e `MaterialStateResin.type` são `string`, e os ids de resina entram por `as unknown as MaterialType` (`materials.ts:30-37`) — uma grade fixa de 23 linhas **descartaria toda a resina, em silêncio**.
- **O dataset de demo grava nomes de exibição, não ids** (`"PLA"`, `"Water Washable"`), e `"PLA"` ≠ `pla`. Por isso as linhas são derivadas das entradas presentes, com key normalizada.

**`ProfitAnalyticsModule` — entregue.** `src/shared/components/Dashboard/ProfitAnalyticsModule.tsx`, 20 testes.

- [x] Duas visões — material e impressora — e 4 KPIs, com as barras em **CSS puro**: **zero Recharts e zero cor hex**, ambos verificados por teste e não por leitura.
- [x] Montado no `Dashboard` em `Dashboard.tsx:743`, recebendo `entries={filteredEntries}` — o mesmo conjunto filtrado que o resto da tela já consome.
- [x] Cobertura do componente: **98,24%** statements (56/57), **93,33%** branch (42/45), **100%** functions (26/26), 100% lines.

**Duas decisões de integridade, ambas sobre o número que a tela mostra:**

- [x] **O KPI de margem declara o método** — "ponderada por receita" — porque `Dashboard.tsx:160-166` já exibe "Margem Média" como média **aritmética** das margens por entrada (`reduce((a, b) => a + b, 0) / margins.length`). Sem o rótulo do método, a mesma tela mostraria dois números diferentes com o mesmo nome.
- [x] **A escala das barras é relativa ao melhor do conjunto nos dois modos.** O protótipo usava margem **absoluta** na visão de material e escala relativa ao **máximo** na de impressora, rotulando as duas como "relativas".

**Limitações conhecidas, registradas e não suavizadas:**

- [ ] **O padrão de `tablist` copiado de `ResultsSidebar.tsx:138-183` não implementa navegação por setas nem _roving tabindex_,** como o padrão APG exige. A semântica (`tablist` / `tab` / `tabpanel`, com `aria-controls` e `aria-labelledby`) está correta; o comportamento de teclado é herança do original, não um padrão novo.
- [ ] **jsdom normaliza cor de `style` inline:** `style={{color:"#ff0000"}}` serializa como `rgb(255,0,0)` e **escapa** da verificação de hex. A forma realista em Tailwind, `text-[#ff0000]`, **é** pega. O guard de zero-hex não tem alcance total.
- [ ] **Existem três fontes de agregação de impressoras:** `topPrintersData` (`Dashboard.tsx:248`), o `byPrinter` do hook, e as cópias inline já existentes.

**Consolidação das três fontes: pendente, e por quê.** O item correspondente da ordem de implementação previa que o hook **substituísse** as cópias inline; isso **não** foi feito, por duas razões que não são de refactor:

- `topPrintersData` ordena por `profit`; `byPrinter` ordena por `profitPerHour`. **São métricas diferentes** — trocar a fonte troca o critério de ordenação, não apenas a implementação.
- `topPrintersData` alimenta o **PDF executivo** (`Dashboard.tsx:423`). Trocar a fonte **reordena o top-5 do relatório** e muda o que o PDF afirma.

É decisão de produto, não de engenharia: exige escolher qual métrica o relatório executivo declara.

**Fora de escopo desta entrega, com o motivo:**

- [ ] **O terceiro eixo do protótipo ("jobs lucrativos")** fica de fora: introduz ordenação por 3 critérios e uma barra que se reescala ao trocar o critério, o que muda o modelo de interação do componente. Não é incremento, é redesenho.
- [ ] **Os outros seis gráficos** continuam sob a regra da fase: `lastKnownRevenue = 14500`, `getBaselineEstimates()` e a curva de crescimento orgânico desenhada como reta são números inventados que produziriam gráficos mentirosos se portados literais. A tabela de invenções acima continua valendo, e o porquê de cada descarte está lá.

#### 7p.2 — Entrega de `MaterialEfficiencyHeatmap` — em 30/09/2026

**🔒 Correção desta própria fase: a prescrição de `role="grid"` da linha de "estilo alheio ao app" está SUPERADA.** Aquela linha pedia, para células de heatmap carregadas só com `title`, `role="grid"` + `aria-pressed`. O componente entregue **não** usa nenhum dos dois, e a linha original **fica registrada como escrita** — esta seção é a que vale. A entrega é a correção do roadmap, não a concordância com ele.

**A prescrição original estava certa no diagnóstico e errada na remédio.** O defeito que ela enxergava é real: `title=` não é nome acessível, não é alcançável por teclado e não sobrevive a leitor de tela — o mesmo defeito que `ProfitAnalyticsModule` já tinha eliminado. O que não se sustenta é a conclusão de que o conserto fosse transformar a célula em botão e a tabela em `role="grid"`.

**Motivo prático: a célula não precisa ser botão quando o valor é texto.** Com `profitPerGram` impresso como texto visível dentro da célula, a informação já está no fluxo de leitura — não depende de `aria-pressed`, não depende de nome acessível, não depende de cor. A tabela fica acessível **sem** `role="grid"`, **sem** navegação por setas e **sem** `aria-pressed`, e a cor deixa de ser o portador do dado e vira **reforço redundante** de um número que já está ali. Um `aria-pressed` sobre um valor numérico também seria semântico: o estado pressionado pertence a algo que se alterna, e uma célula de dado não alterna.

**Precedente interno, e é o que decide.** `MaterialComparison.tsx:170-221` é exatamente este caso: `<table>` semântica com `<caption className="sr-only">`, `<th scope="col">` nos cabeçalhos, e o **botão no `<th>`** da coluna de ação — as células de dados são **texto puro**. A grade do heatmap segue esse mesmo desenho. O botão, quando existe, fica no cabeçalho, onde há uma ação de verdade ainar.

**As cinco tabelas do app são semânticas**, nenhuma usa `role="grid"`: `MaterialComparison.tsx:170`, `ProductInventory.tsx:360`, `InfillCalculator.tsx:186`, `QuoteSection.tsx:736`, `StlPreview.tsx:1225`. E as setas que o `role="grid"` exigiria já têm dono e outro padrão no app: o padrão **de tablist** de `CatalogTab.tsx:41-44`.

**A régua de acessibilidade não recua um milímetro — só muda de onde ela é paga.** WCAG AA mede contraste, e contraste foi medido, não estimado: `src/shared/__tests__/helpers/contrast.ts` contra `themeTokenMap`, nos dois temas. A **fase clara** é a referência porque, nas cinco rungs, a razão clara é sempre a menor das duas — passar na clara garante passar na escura.

| rung     | clara | escura                          |
| -------- | ----- | ------------------------------- |
| `loss`   | 5,89  | 8,52                            |
| `empty`  | 5,17  | 7,85 — a mais próxima de falhar |
| `weak`   | 6,84  | 8,83                            |
| `strong` | 5,21  | 7,83                            |
| `best`   | 5,48  | 10,23                           |

Todos os cinco pares passam AA. O nome do token de tinta (`--color-text-inverse`) foi **medido**, não adivinhado: o palpite óbvio, `--color-text-primary`, **falha nos dois temas** (3,23 claro, 1,75 escuro), porque o quase-branco do tema escuro cai sobre uma amostra verde-clara. E os dois tokens que a nota de design nomeava **não existem em runtime**: `--color-positive` só existe dentro de `@theme inline` (`tokens.css:557`), que é mapeamento de build do Tailwind, não custom property — `bg-[var(--color-positive)]` não pintaria nada —, e `--color-positive-muted` não existe em lugar nenhum do repositório. A camada de alias de runtime (`tokens.css:510-516`) expõe os dois papéis como `--color-success` / `--color-success-muted`.

**A escala é divergente porque os dados obrigam.** `profitPerGram` pode ser negativo: `HistoryEntry.profit` é `number` sem limite inferior (`types/index.ts:318`), e vender abaixo do custo é justamente o caso que este app existe para evitar. A escala do protótipo era unidirecional, com cortes em 0,25/0,40/0,60/0,80 — um valor negativo caía no balde frio e renderizava **idêntico a uma célula quase zero**, enquanto a legenda nomeava aquele degrau de "Baixo", uma afirmação falsa. O app já tem a convenção bilateral em `Dashboard.tsx:704` e `:780`. Mede-se a partir do zero, com o sinal decide o lado.

**Uma métrica só, `profitPerGram`, sem seletor de modo.** `bestCell` já é definido como o maior `profitPerGram` (`useHistoryAggregates.ts:149-150, 495-500`), então colorir por outra métrica faria o hook e a cor discordarem. E `roiPercent` divide por `cost`, que é zero para uma faixa sem custo — custo zero e ROI zero ficariam indistinguíveis.

**Recebe `entries` como prop, não o envelope de `useHistoryAggregates`:** o envelope lê o store sem filtro (`useHistoryAggregates.ts:608`), ignorando o filtro de data do próprio `Dashboard` (`Dashboard.tsx:94-104`).

**O que não foi portado, e por quê** — nenhuma das 32 fictitious de `getBaselineEstimates()`, os tetos de máximo inventados, o denominador fixo `/1.8`, a linha editorial fixa "Insight da Oficina" que renderiza mesmo com histórico vazio, a lista `MATERIALS_ORDER` que não casa com nenhum `MaterialType`, o `onNavigateToCalculator` morto, `title=` usado como rótulo acessível, e `text-emerald-400` sobre ROI negativo — que pintaria **verde** uma perda.

**As quatro chaves `history.aggregates.weight.*` não tinham nenhum consumidor até esta entrega.**

---

### 🧭 Phase 7q: Decisões de domínio pendentes do dono

> **O que é esta fase.** Não é trabalho; é a lista do que **ninguém pode fechar sem o dono**. Cada item abaixo muda tipo de dado, revoga decisão vigente ou redefine o que é métrica — as três coisas que nenhum agente pode decidir sozinho. Estão aqui porque o pedido de "tudo do `Example/`" colidiu com cada uma delas, e uma colisão silenciosa é o pior jeito de falhar.

**Status:** três das cinco decisões já foram respondidas pelo dono — IA fora da V2.0, frota fora desta fase e vínculo cliente↔job no `Quote`. Permanecem abertas a unidade de `usefulLife` (item 4) e a formalização em arquivo da decisão sobre `Example` (item 5). A divergência silenciosa de valores da frota continua registrada como problema, mesmo com as telas adiadas.

#### 1. Cliente Maker — o gap é menor do que se supunha

- [x] **Verificado em 30/09/2026: já existe seletor de cliente na calculadora.** `QuoteSection.tsx:159` lê `useCustomerStore`, `:165` mantém `customerId` em estado, e `:321-329` renderizam o seletor com a lista de clientes. A tela de orçamento já sabe a quem está orçando.
- [x] **O vínculo cliente↔job vive no orçamento, não no cálculo.** `Quote.customerId` guarda o cliente e `Quote.items[].historyEntryId` (`quoteStore.ts:68`) liga o item ao registro de histórico. Essa é a relação que os gráficos da Phase 7p precisam.
- **O que realmente falta:** `HistoryEntry` (`types/index.ts:310-321`) **não tem campo de cliente**. Para o Dashboard e a Phase 7p falarem de receita "da Maker", o histórico precisa saber de quem é — hoje essa informação existe só no orçamento, e um job adicionado manualmente ao histórico nunca a teve.
- [x] **Decisão do dono registrada em 30/09/2026:** manter o histórico agnóstico e cruzar por `historyEntryId` na leitura; `HistoryEntry` não ganha `clientId`. Ver seção 6c. Um job sem orçamento continua sem vínculo de cliente.

#### 2. Camada de IA — decisão vigente e rótulo demonstrativo

- [x] **O `Example/` tem `AIAssistantModal` e 3 endpoints Gemini** server-side (analyze-piece, generate-pitch, estimate-photo multimodal).
- [x] **Existe decisão vigente `v2-no-ai` (22/09/2026) que exclui a camada de IA do escopo imediato da V2.0** — BYOK, Councils #1/#2, ADR-004 e estimate-photo foram adiados.
- **Discrepância na beta.11:** o bundle web contém o rótulo “Copilot IA”, mas `StudioCopilotModal` usa respostas locais fixas e é demonstrativo, não IA funcional. Isso não altera a decisão de manter IA fora da V2.0 nem decide remover ou renomear o rótulo.
- [x] **Decisão do dono registrada em 30/09/2026:** IA fora do port e `v2-no-ai` mantida (ver seção 6a). O rótulo demonstrativo não deve ser interpretado como mudança de escopo ou IA funcional.
- **Nota de histórico que não pode ser ignorada:** o `AIAssistantModal` do protótipo tem um bug de release: `analysisError` é declarado (`:53`) e renderizado (`:327`) mas **nunca setado no `catch`** (`:105-111`) — a simulação mock #1 é entregue silenciosamente como se fosse análise de IA real. Se a IA entrar, esse caminho não pode portar.

#### 3. Modelo de frota — bloqueia três telas, e a falha é silenciosa

- [x] **`printers.ts:10` é catálogo estático.** ~80 perfis de catálogo, com preço de aquisição (`value`), vida útil (`usefulLife`) e custo de manutenção por hora — os três números que o `Example/` usa.
- [x] **`PrinterProfile` (`types/index.ts:36-58`) não tem:** preço de aquisição como dado próprio, data de aquisição, status, capacidade, utilização nem log de horas. O que tem é especificação de fábrica.
- **Bloqueia:** `PrinterRoiBreakEvenCard` (falta `acquisitionDate` e `status`) e `PrinterHealthScoreCard` (falta `loadMaintenanceCycles()` e `Record<printerId, hoursAccumulated>`). Manutenção e ROI precisam ser **juntos** — construir um sem o outro é retrabalho certo.
- **🔴 Consequência medida, e é a mais grave das cinco:** adicionar ou reprecificar uma impressora na tela de frota **faz ROI, projeção, analytics e preço sugerido ignorarem a máquina em silêncio**. O preço novo entra no catálogo, e as quatro telas que deveriam consumi-lo continuam lendo o valor antigo — sem erro, sem aviso, sem estado inválido. Não é uma tela que falta; é uma divergência silenciosa que já existe.
- [x] **Decisão do dono registrada em 30/09/2026:** escolher a opção (b), manter a frota fora desta fase e adiar as telas dependentes. Isso não fecha a divergência silenciosa descrita acima. Ver seção 6b.

#### 4. Contradição de unidade em `usefulLife` — antes de virar dinheiro

- [x] **O campo vale 3000 / 4000 / 5000** (`printers.ts:17,32,47,62,77,90`) e a interface o apresenta com a unidade: `CatalogTab.tsx:483` renderiza `{p.usefulLife}h` — **horas**.
- [x] **O consumo é em horas.** `calculatorStore.ts:311-314` calcula `depreciationMonths = Math.max(1, Math.round(selectedPrinter.usefulLife / hpm))`, dividindo por `hoursPerMonth`. A unidade está coerente no código.
- [x] **A Phase 7d (linha 449) descreve o mesmo campo como `defaultUsefulLifeYears`.** Anos. O documento e o código discordam sobre a mesma constante, e a Phase 7d é a fonte do modelo de frota do item 3 acima.
- **Por que é sério e não pedante:** 3000 horas são ~14 meses de uso contínuo; 3000 anos são absurdo. O número é o mesmo, então o erro de leitura não aparece no número — aparece quando alguém implementa a Phase 7d pela documentação e converte 3000 anos em meses. **Horas e anos precisam ser a mesma unidade antes de virar dinheiro.**
- [ ] Decisão do dono: (a) a Phase 7d passa a declarar `defaultUsefulLifeHours` e o problema fecha; ou (b) o modelo novo passa a trabalhar em anos e `usefulLife` é convertido explicitamente na migração, com a conversão testada. A opção (a) é a mais barata e não mexe no código existente.

#### 5. Autoridade fora do disco — a decisão de 25/09 não existe em arquivo

- [x] **A decisão de 25/09/2026 que revogou a regra "nunca copiar estrutura do `Example/`" só existe nesta conversa e na nota de supersessão da Phase 7i.** Não há ADR, decisão registrada, ou arquivo que a contenha.
- **Consequência:** o próximo agente, ou a próxima sessão, vai ler a nota e não terá como confirmar se ela ainda vale. A autoridade de uma decisão que só existe no chat expira com o chat.
- [ ] O dono precisa fechá-la em arquivo. Até lá, a nota na Phase 7i é a única fonte, e qualquer agente que trabalhar por ela deve dizer que está lendo uma fonte sem lastro.

#### 6. As quatro decisões do dono — 30/09/2026

> **O que esta seção é.** As respostas dos itens 1, 2 e 3 acima, mais uma decisão de infraestrutura que nunca foi item de fase nenhuma. As quatro foram tomadas pelo dono em 30/09/2026 e estão aqui **em arquivo** — que era precisamente o item 5 desta fase. Cada uma fecha um item aberto, e cada uma registra o que **custa**: um escopo mais estreito só é decisão se o que ficou de fora também estiver escrito.

**a) A IA fica fora da V2.0 — a `v2-no-ai` continua vigente.**

- [x] **`v2-no-ai` (22/09/2026) não é revogada.** O item 2 acima registra uma contradição que não estava no código, estava no pedido: "tudo do `Example/`" contra uma decisão vigente. Ela não precisa de revogação nenhuma, porque a decisão não mudou — o escopo sim.
- **O que sai, medido:** `Example/src/components/AIAssistantModal.tsx`, **685 linhas**, e os **3 endpoints Gemini** de `Example/server.ts` — `POST /api/ai/analyze-piece` (`:37`), `POST /api/ai/generate-pitch` (`:80`) e `POST /api/ai/estimate-photo` (`:130`), todos em `model: "gemini-3.8-flash"` (`:64`, `:114`, `:172`).
- **O que a decisão compra:** sem chave de API, sem custo por chamada e sem superfície de segurança nova. Vale registrar que o protótipo **tem** essa superfície e o app não: `GET /api/health` (`:32-33`) já responde `geminiConfigured: !!process.env.GEMINI_API_KEY`, enquanto o app declara que **não faz nenhuma chamada de rede** (`PrinterProfile.websiteUrl`, `types/index.ts:56`).
- **O bug de release do protótipo tem dono agora.** `analysisError` é declarado (`:53`) e renderizado (`:327`) mas **nunca setado** no `catch` (`:105-111`): a simulação mock é entregue como se fosse análise real. Se a IA voltar, esse caminho não porta — e a decisão de hoje é o que impede que ele entre por descuido.

**b) O modelo de frota fica fora desta fase — as três telas são adiadas.**

- [x] **A alternativa (b) do item 3 foi escolhida:** registrar aqui, portar em versão posterior. **Nenhuma mudança de schema nesta fase.** `PrinterProfile` (`types/index.ts:36-58`) continua como está — verificado no código em 30/09/2026, o tipo **não tem** `acquisitionDate`, **não tem** `status` e **não tem** log de horas.
- **O que fica adiado, com o peso medido:** `PrinterFleetManagementView` (**512**), `PrinterRoiBreakEvenCard` (**412**) e `PrinterHealthScoreCard` (**439**), os três em `Example/src/components/` — **1.363 linhas somadas**.
- **A perda é menor do que a contagem de linhas sugere, e vale dizer por quê.** ROI por impressora **já está coberto** pelo `ProfitAnalyticsModule` entregue em 7p.1, montado no `Dashboard.tsx:743`, com visão por impressora, 4 KPIs e barras em CSS puro. O que adia é a **gestão de frota** e os dois cards especializados — não a pergunta "esta impressora está dando dinheiro", que a tela já responde. O ganho perdido é o das três telas, não o da métrica.
- **A divergência silenciosa do item 3 não foi fechada por esta decisão, e isso precisa ficar escrito.** Ela nasce de **reprecificar** uma impressora no catálogo e continua valendo tal como está descrita acima: as quatro telas leem o valor antigo, sem erro e sem aviso. Adiar as três telas **não a corrige** — só evita que a Phase 7p a herde. O item 3 **continua aberto**.

**c) O vínculo cliente↔job permanece no `Quote` — `HistoryEntry` não ganha `clientId`.**

- [x] **A segunda alternativa do item 1 foi escolhida:** manter o histórico agnóstico e cruzar por `historyEntryId` na leitura. **Zero mudança de domínio**, zero mudança de snapshot, zero retrocompatibilidade a resolver. `HistoryEntry` (`types/index.ts:310-321`) segue sem campo de cliente — verificado no código em 30/09/2026.
- **O caminho da junção, que já existe:** `Quote.items[].historyEntryId` (`quoteStore.ts:68`) → `Quote.customerId`. É a relação que os gráficos da Phase 7p consomem.
- **A consequência, registrada sem suavizar: um job sem orçamento não mostra cliente.** É o preço da opção mais barata, e é exatamente por isso que **o protótipo não pode ser portado neste ponto** — o `Example/` lê `clientName` como campo direto, e não existe como preencher honestamente uma coluna a partir de um vínculo que pode não existir.
- **A opção (a) continua registrada como a mais completa.** Se um dia a Phase 7p precisar de receita por cliente em granularidade que a junção na borda não dê, o campo volta — com retrocompatibilidade de snapshot (ausente = sem cliente). Decidir isso hoje seria decidir sem medição.

**d) `testTimeout: 10s` no `vitest.config.ts` — margem honesta, não correção de flake.**

- [x] **Entregue em 30/09/2026 no PR #251, commit `90de2d0`, num único arquivo:** `vitest.config.ts`, **+27 linhas, das quais 26 são comentário**. O valor é `testTimeout: 10_000`.
- **O que era antes: nada.** `testTimeout` não estava configurado em nenhum arquivo deste repositório — a varredura repo-wide dos knobs de timeout e de worker não devolve nenhuma ocorrência fora desta mudança. O orçamento era o **default do vitest para o pool forks, 5.000ms**, e ninguém tinha escrito isso em lugar nenhum.
- **A medição que justifica o número:** os 8 arquivos da família Electron/segredo — `electron/__tests__/{cryptoCapability,legacyRecovery,legacyScan,osKeyring,persistGate,piiDomainTables,piiStage,piiStageResidue}.test.ts` — têm o teste mais lento entre **2.564ms e 3.331ms**, ou seja **51% a 67%** do orçamento de 5s. Com 10s a mesma faixa cai para **~26% a ~33%**. A margem passa de 1,5×–2× para ~3×, acima do piso de 2× que a própria configuração registra.
- **Por que isto é margem e não correção.** A flake reportada **não reproduziu em 5 rodadas** com carga baixa (load 2,99). A alteração **não elimina nada**: ela remove um orçamento **implícito** e **torna visível** um número que hoje ninguém tem de ler. Afirmar o contrário seria declarar uma correção que não foi medida.
- **O teste mais lento da suíte não é evidência de risco, e é bom registrar por quê.** `crypto.selftest.test.ts` roda `runSelftest()` **síncrono** a 6.781ms, e o call site já declara o próprio orçamento de `180_000ms` (`:277`). Teste síncrono não é interrompido pelo timeout do vitest.
- **`hookTimeout` e `teardownTimeout` ficaram de fora de propósito.** A família Electron não registra `beforeAll`/`afterAll` — o trabalho lento está no corpo dos testes — e teardown não é ponto quente. Configurar um knob sem consumidor é ruído.
- **Ver a issue upstream `vitest-dev/vitest#9751`** — _"Unify and simplify timeout configuration"_, aberta em 26/02/2026. Ela documenta que esses knobs vivem espalhados entre `testTimeout`, `expect.poll.timeout` e `browser.providerOptions.actionTimeout`, sem um lugar único de raciocínio, e é a razão de o bloco estar centralizado e comentado num só ponto deste repositório. **O bug de testes concorrentes discutido lá — `_currentTaskStartTime` / `_currentTaskTimeout` armazenados no runner singleton — não afeta este repositório:** zero usos de `test.concurrent` / `describe.concurrent` / `it.concurrent` em `src/` e `electron/`, verificado em 30/09/2026.
- [ ] **O portão desta entrega é o do CI, não o de um rodízio local.** Na `main` mergeada: **293 arquivos / 4.105 testes verdes**, `typecheck` e `lint` limpos. Nenhuma rodada extra foi feita para provar o que já está provado — a flake não reproduz.

**Como estas decisões se posicionam contra os acceptance criteria da fase.** A lista abaixo é **preservada na íntegra e não foi reescrita**: esta entrada é aditiva, e reescrever um critério para marcá-lo como cumprido apagaria o texto que o definia. O que mudou é o estado, e ele fica aqui:

| Acceptance criterion                                                                                  | Estado em 30/09/2026                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| As cinco decisões têm resposta do dono, registrada em arquivo                                         | ⚠️ **três de cinco** — itens 1, 2 e 3 respondidos; 4 e 5 seguem abertos                                              |
| A `v2-no-ai` está revogada **ou** a IA está declarada fora do port                                    | ✅ **cumprida pela segunda via** — declarada fora do port, `v2-no-ai` não revogada                                   |
| A Phase 7d descreve `usefulLife` na mesma unidade do código                                           | ❌ **aberta** — é o item 4, que esta entrada não toca                                                                |
| A divergência silenciosa da frota está fechada ou as telas estão fora do escopo até existir instância | ⚠️ **pela metade** — as três telas estão explicitamente fora do escopo; a divergência em si continua aberta (item 3) |
| Nenhum agente implementa decisão de domínio com base em premissa não registrada                       | ⚠️ **reforçada, não fechada** — vale a partir de agora, mas o item 5 é estrutural                                    |

**Acceptance criteria desta fase:**

- [ ] As cinco decisões têm resposta do dono, registrada em arquivo — não em conversa.
- [x] A `v2-no-ai` está explicitamente revogada **ou** a IA está declarada fora do port; não existem duas decisões vigentes e contraditórias.
- [ ] A Phase 7d descreve `usefulLife` na mesma unidade em que o código a consome, e a conversão, se houver, é testada.
- [ ] A divergência silenciosa da frota — preço novo ignorado por quatro telas — está fechada ou as quatro telas estão explicitamente fora do escopo até existir instância.
- [ ] Nenhum agente implementa decisão de domínio com base em premissa não registrada.

---

### 📐 Phase 7r: Defeitos de layout medidos e abertos

> **O que esta fase é.** D1–D4 são medições de 30/09/2026 na shell anterior, não medições da `StudioLayout` montada pela web beta. O PR #248 corrigiu parcialmente o logo a 1280px, mas ele ainda colapsa a 1024px e o breadcrumb não cabia a 1280px. D2 e D4 precisam ser re-medidos na shell atual; nenhum D1–D4 é declarado resolvido.

**Status:** D1–D4 permanecem abertos, com baseline de 30/09 na shell anterior. A correção parcial do logo pelo #248 não fecha D1; re-medidas na shell atual são necessárias, especialmente para D2 e D4.

#### 🔴 D1 — A 1024px a marca colapsa para 0,0px

| Medida                                         | Valor                         |
| ---------------------------------------------- | ----------------------------- |
| Largura da marca (lockup logo + nome) a 1024px | **0,0px**                     |
| Botões `shrink-0` na linha do header           | 11                            |
| Elementos que cedem                            | 1 — o logo, o único `min-w-0` |

**Causa:** a linha do header (`Header.tsx:50`) é um `flex justify-between` com onze botões `shrink-0` no cluster de ações (`:93`). `shrink-0` significa "não cedo" — e nenhum deles cede. O único elemento com `min-w-0` é o lockup do logo (`:54`), e `min-w-0` é justamente a permissão para ceder até zero. Com onze botões que não cedem e um logo que cede sem limite, o logo é o único que paga a conta, e paga a conta inteira.

**Por que o teto de 248px não corrige:** `max-w-[248px]` (`:54`, `459593e`) limita o **crescimento**. O defeito é **colapso**. Um teto contra crescimento não impede uma largura de zero — pior, ele torna o defeito invisível na revisão de código, porque o número que se vê é razoável e o número que se sente é zero. **Um teto de largura não é uma defesa contra colapso; um piso é.**

**Permanece aberto a 1024px.** O PR #248 corrigiu parcialmente o logo a 1280px; essa correção não resolve o colapso medido a 1024px.

- [ ] O logo recebe largura mínima de verdade, ou o cluster de ações cede. Decisão de produto: as duasmudam o que cabe a 1024px.
- [ ] Teste de layout que **mede** a largura renderizada do lockup a 1024px. Não um teste que confere a string de classe — ver a regra transversal no fim desta fase.

#### 🔴 D2 — A 1024px o form central mede 554px contra um lock de 560px

| Medida                                       | Valor                                      |
| -------------------------------------------- | ------------------------------------------ |
| Largura do form central renderizado a 1024px | **554px**                                  |
| Lock declarado                               | `2xl:min-w-[560px]` (`Calculator.tsx:115`) |
| Diferença                                    | **−6px**                                   |

**O guard não prova nada.** `Calculator.test.tsx:42-44` verifica o lock por **regex sobre a string de classe**:

```
/flex-1 min-w-0 2xl:min-w-\[560px\] @container/
```

Esse teste passa se o texto `2xl:min-w-[560px]` existir na fonte. Ele **não renderiza a caixa, não mede nada e não falha** quando o layout real mede 554px. Um guard que confirma a presença de uma classe não é um guard de layout — é uma asserção de que a intenção foi digitada.

**E há um problema de segundo grau:** `2xl` é 1536px. A 1024px esse `min-w` **não se aplica**. O lock de 560px é uma condição de `1536px`, e o defeito está a 1024px — abaixo do próprio breakpoint do lock. A pergunta "por que 554px a 1024px" tem uma resposta anterior à medição: a 1024px não existe lock nenhum para violar.

- [ ] Decidir se 560px é o piso certo e em qual breakpoint. Um `min-w` de 560px abaixo de 1536px pode não caber no conteúdo disponível; um `min-w` de 560px só a 1536px não protege nada a 1024px.
- [ ] Substituir o guard por regex por um que **renderize e meça** a largura real no breakpoint relevante.

#### 🔴 D3 — A 1280px o breadcrumb não cabe, por aritmética

| Parcela                             | Medida                                       |
| ----------------------------------- | -------------------------------------------- |
| Piso do logo (lockup com subtítulo) | 240,5px                                      |
| Breadcrumb                          | 156px                                        |
| **Soma**                            | **396,5px**                                  |
| Disponível na linha                 | 250px                                        |
| **Déficit**                         | **23,3px, antes de desenhar um único ícone** |

A conta fecha antes de qualquer decisão de conteúdo: 396,5px contra 250px. **O breadcrumb não cabe a 1280px.** O `ContextBreadcrumb` (`Header.tsx:90`) foi introduzido na leva atual (`7722b95`) e o lockup do logo ganhou o teto de 248px depois (`459593e`) — as duas medidas são pós-`beta.6` e nenhuma delas mexe no outro lado da soma.

**Duas saídas, ambas de produto — nenhuma é de CSS:**

- [ ] **Migrar um utilitário para a barra.** A `UtilityBar` (`0db0c93`) existe e está quase vazia. `TutorialLauncher` ocupa ~131px e `DataSyncButton` ~206px na linha do header. Mover um dos dois para a barra resolve o déficit e usa espaço que já foi criado para isso.
- [ ] **Retirar o subtítulo do lockup do logo.** Reduz o piso e deixa o breadcrumb respirar, ao custo de perder a descrição da seção.

Escolher entre as duas é decisão do dono: a primeira move função, a segunda move identidade.

#### 🔴 D4 — A causa raiz do rail não aparecer antes de 1536px é o gutter, não o breakpoint

| Parcela                      | Web                                        | Desktop                                    |
| ---------------------------- | ------------------------------------------ | ------------------------------------------ |
| Padding horizontal do `main` | `xl:px-14` = 56px de cada lado = **112px** | `xl:px-16` = 64px de cada lado = **128px** |
| Origem                       | `platform/web/App.tsx:85`                  | `platform/desktop/App.tsx:79`              |

**A leitura:** o rail de resultados não aparece antes de 1536px, e a tentação é mudar o breakpoint para ele aparecer mais cedo. **Isso moveria o número sem resolver a causa.** O gutter consome 112px (web) e 128px (desktop) de largura horizontal antes de o conteúdo existir; a margem para o rail é o que sobra, e o que sobra é insuficiente. Mudar `2xl` para `xl` faria o rail aparecer espremido contra o gutter, e a medição seguinte seria "o rail aparece mas está errado" — a mesma classe de defeito com um número diferente.

- [ ] Reduzir o gutter horizontal do `main` nos breakpoints em que o rail deve coexistir com o conteúdo, **e então** reavaliar o breakpoint. Nessa ordem.
- [ ] Web e desktop medidos **juntos**: os dois têm gutters diferentes (112px e 128px) e um breakpoint que serve a um não serve ao outro.

#### 📏 Regra transversal desta fase: guard de layout que faz string-match não é prova de layout

Esta regra não é uma preferência de estilo. Ela nasce de D2, onde um teste verde coexistia com um defeito de 6px em produção: **o guard confirmou a intenção, não o resultado.** A mesma armadilha já apareceu em código de dinheiro — o `roundCurrency` fail-high da Phase 7m é uma política que ninguém implementou e que nenhum teste prova.

- [ ] **Toda medição de layout é feita no browser, no shell alvo.** Web e desktop, medidos **juntos** — não em um e extrapolados para o outro.
- [ ] **Em build beta**, sempre que a superfície depender do `BetaBadge`. Ele retorna `null` em build estável (`BetaBadge.tsx:13-14`), então qualquer asserção de legibilidade, largura ou contraste feita em build estável **passa trivialmente** sem ter nada verificado. Um guard que passa em build estável e nunca foi rodado em build beta não foi testado.
- [ ] **Nenhum guard de layout nova baseado em regex sobre a string de classe.** Se a asserção é sobre texto na fonte, ela prova que alguém digitou a intenção. Para provar layout é preciso renderizar e medir a caixa.
- [ ] A medição entra no commit com o número, como os quatro acima. Correção de layout sem número medido é opinião.

**Acceptance criteria:**

- [ ] Os quatro defeitos estão corrigidos **ou** explicitamente aceitos como dívida, com o número medido de antes e de depois.
- [ ] Nenhum dos quatro é corrigido mudando o número do sintoma em vez da causa — em especial D4, onde mudar o breakpoint sem mexer no gutter é a correção que não corrige.
- [ ] O guard de 560px em `Calculator.test.tsx` mede caixa em vez de conferir classe, ou está removido em favor de um que mede.
- [ ] Qualquer superfície que dependa do `BetaBadge` tem sua verificação de legibilidade executada em build beta, com o resultado registrado.

---

### 🎨 Onda de contraste WCAG AA — cadeia consolidada

**Status:** entregue e mesclada em `main`. Onda independente: não substitui, não reordena nem absorve nenhuma fatia da Phase 7o, da Phase 7n ou do port visual da Beta 5, e não fecha o gate transversal de compatibilidade v2.0.

Os quatro PRs empilhados #222, #224, #225 e #226 foram consolidados sobre `main` em um único branch e mesclados como `3761a76a4584f609ee00db7da1b8c8145bffc49c` pelo PR #230, aprovado pela Themis no SHA exato `eadd10e44249535df782b18917b8182fa86378fc` em duas passagens de revisão.

**Por que a consolidação foi necessária:** `ci-cd.yml` dispara apenas em `pull_request` com destino `main`. O PR #226, aberto sobre um branch de feature, nunca teve uma única execução de CI, e a cadeia empilhada não podia ser validada de forma confiável naquela forma.

**Como a aprovação foi verificada:** a Themis reimplementou de forma independente a aritmética de contraste WCAG, em vez de reutilizar o helper do repositório, e as seis razões alegadas bateram em 0,00. Também provou mecanicamente que os dois commits "somente Prettier" eram de fato apenas formatação, executando o Prettier no parent de cada arquivo e comparando por diff.

**Pendência administrativa:** os quatro PRs originais continuam abertos e estão agora totalmente superados; precisam ser fechados pelo owner.

#### Próxima onda de acessibilidade — follow-ups registrados

- [x] `src/shared/components/ui/Toast.tsx:18` — falha WCAG AA viva. ~~**2,83:1 no claro e 3,26:1 no escuro**~~ — reprovado nos **dois** temas, e o pior caso real é **2,07:1 no escuro**; a cifra original media só o par de acento e subestimava o defeito. Corrigido com tinta pareada por variante sobre preenchimento sólido, em `fix/toast-contrast-and-guard-floor` (SHA de origem `def8080`). **Revisão e merge pendentes.**
- [x] O piso de população adiada do guard de contraste prendia **contagem de arquivos**, não de sítios. `keeps the deferred translucent-accent population shrinking` asseria `files.length <= 16`, e o pino de sítios descobertos asseria `files.size > 5`. Um sítio que migrava de uma forma quebrada para **outra** forma quebrada mantinha as duas contagens iguais, e a falha se escondia. **Esse piso de sítios também já não existe.** Prender um número é a mesma classe de defeito que prender arquivos: um sítio corrigido baixa a contagem, e o piso reprova o progresso. O que ficou é o **pin por sítio** — identidade -> formas, validado só na **direção do fonte atual** — e é mais forte do que qualquer contagem, porque nomeia o sítio em vez de apenas notar que algum número mexeu. Nenhuma asserção do ficheiro conta a população: nem `pairings.length > 20`, nem `shapes.size > 10`, nem `census.failing.length <= 15`, nem `palette.failing.length <= 11`, nem `census.failing.length > 0`. A garantia de que a varredura não ficou muda passou a ser **fixture dirigida pelo scanner de produção**, e sobraram duas medição monotónica no sentido certo: `unresolved === 0` e nada mais. Ao re-derivar o censo, os números do cabeçalho se revelaram errados por ~2,5x (48/13 e 27/8 → 18 sítios/10 formas/11 arquivos e 11/4/7). Em `fix/toast-contrast-and-guard-floor` (SHA de origem `def8080`). **Revisão e merge pendentes.**
- [ ] **O guard de contraste mede texto-sobre-preenchimento e nunca mede a fronteira do controle (WCAG 1.4.11).** As duas lacunas são distintas e só uma está coberta. O guard **mede** o estado de hover, porque os prefixos de variante são removidos antes do casamento e `hover:bg-X` é medido como um pareamento de repouso — logo o texto do hover **é** fiscalizado. O que ele **não** faz é confrontar o preenchimento com o fundo vizinho: em `StudioLayout.tsx:124` o fundo é `#080c14`, e 1.4.11 exige 3:1 nessa fronteira. É por isso que `db81b99` conseguiu inverter 30 hovers para `-700`/`-800` mantendo o guard verde: o texto melhorou, e a **fronteira degradou exatamente no momento da interação**, sem que nada medisse. Medido com a aritmética do próprio repositório (`src/shared/__tests__/helpers/contrast.ts`) contra `#080c14`, nos cinco pares que o commit tocou:

  | família | repouso       | hover `db81b99` | texto/repouso | texto/hover | fronteira/repouso | **fronteira/hover** |
  | ------- | ------------- | --------------- | ------------- | ----------- | ----------------- | ------------------- |
  | blue    | `blue-600`    | `blue-700`      | 5,25          | 6,83        | 3,73              | **2,86**            |
  | purple  | `purple-600`  | `purple-700`    | 5,54          | 7,07        | 3,53              | **2,77**            |
  | rose    | `rose-700`    | `rose-800`      | 6,03          | 7,92        | 3,24              | **2,47**            |
  | emerald | `emerald-700` | `emerald-800`   | 5,36          | 7,61        | 3,65              | **2,57**            |
  | amber   | `amber-700`   | `amber-800`     | 5,03          | 7,09        | 3,89              | **2,76**            |

  **Consequência não óbvia, e é a que trava a correção:** para estas cinco famílias **não existe passo de hover que satisfaça os dois critérios**. A tinta branca exige o preenchimento escuro (≥4,5) e a fronteira exige o preenchimento claro (≥3), e a interseção é um único passo — o próprio de repouso. Os passos que limpam texto **e** fronteira são `blue-600`, `purple-600`, `rose-600`/`rose-700`, `emerald-700`, `amber-700`, ou seja, em todas as cinco o hover fica preso ao passo de repouso. Antes de `db81b99` o hover era `-500` e reprovava texto nas cinco (2,13 a 4,12), ou seja, **aquele hover já era um defeito de 1.4.3** e foi um ganho real que o commit corrigiu; a inversão de direção, não, porque trocou um preenchimento que se afastava do fundo por um que afunda nele. O affordance de hover não pode viver na cor do preenchimento, e foi para um anel pintado **fora** dele (`hover:ring-2 hover:ring-<fam>-500/40`).

**O que o anel faz, medido.** A fronteira que identifica o controle deixa de degradar no hover: ela conserva o valor de repouso (3,24 a 3,89), porque o preenchimento não muda mais. E a força do sinal de hover **sobe** — que é o ganho real e verificável. O affordance é o delta entre o estado de repouso e o de hover, e ele passou do passo de preenchimento que o anel substituiu para o anel contra o fundo (que, sem anel, é 1,00:1 contra si mesmo):

| família | delta do `hover:bg-*-700/800` removido | delta do anel | ganho |
| ------- | -------------------------------------- | ------------- | ----- |
| blue    | 1,30                                   | 1,75          | 1,35x |
| purple  | 1,28                                   | 1,65          | 1,30x |
| rose    | 1,31                                   | 1,64          | 1,25x |
| emerald | 1,42                                   | 2,13          | 1,50x |
| amber   | 1,41                                   | 2,30          | 1,63x |

**O que o anel NÃO faz — e é o que a medição do dono derrubou.** Ele **não cumpre 1.4.11 no hover**. A 40% de opacidade sobre `#080c14` o anel dá **1,64 a 2,30:1**, todas abaixo da barra de 3:1; para limpá-la seria preciso alfa entre 0,51 (amber) e 0,74 (purple). A afirmação anterior de que o anel "reforçava 1.4.11 em vez de negociar com ela" **não se sustenta** sob a leitura estrita do critério, e a tabela que a acompanhava listava os valores de repouso (5,25 / 3,73 …) sob o cabeçalho `edge/hover`.

**O que sustenta, e é a leitura que o próprio repositório já adota:** `tokens.test.ts:104-129` declara, no comentário do teste, que o hover **não** é asseverado de propósito porque _"1.4.11 governs the resting state that identifies the control, and a transient hover is not required to re-establish it"_. Debaixo dessa leitura nada precisava ser reforçado: o anel devolve ao repouso exatamente o que o hover tinha tirado, e o que ele acrescenta é affordance, não conformidade.

**O anel continua sendo a melhor solução disponível**, e a direção do dono foi mantida: as duas alternativas de preenchimento reprovam 1.4.3 nas cinco famílias (2,13 a 4,12), que era o defeito real que o lote 3 corrigiu. O que muda nesta revisão é a **descrição**, não a implementação — e o item segue **aberto**, porque a lacuna que ele aponta (o guard não mede fronteira por sítio, por variante e ciente do fundo) continua inteira, e agora com um segundo caso a favor dela: nem o preenchimento nem o anel entregam 3:1 no hover.
**Onde este follow-up NÃO é resolvido, deliberadamente:** cinco sítios com a **mesma forma de defeito** já carregavam `hover:bg-*-700/800` **antes** de `db81b99` e ficaram de fora do escopo daquele commit — `src/shared/components/Dashboard/Dashboard.tsx:630`, `src/shared/components/SpoolShelf/SpoolShelf.tsx:153`, `src/shared/components/SpoolShelf/SpoolCard.tsx:228`, `src/shared/components/AIAssistant/AIAssistantPanels.tsx:180` (todos `text-white`, mesma inversão) e `src/shared/components/Catalog/CatalogTab.tsx:560`, que é uma **forma diferente**: preenchimento de token `bg-[var(--positive-fill)]` com hover de paleta crua. Nenhum dos cinco é um sítio reprovado, e por isso nenhum deles deve ser tratado como dívida nova — são dívida de 1.4.11 pré-existente, invisível ao guard pela mesma razão.
**Por que isto não vai para o `PALETTE_SITE_PIN`:** o pino é um livro-razão de sítios **reprovados deliberadamente** e adiados por acordo. Estas cinco famílias nunca foram adiadas por ninguém — chegaram com um commit de feature — e depois da correção nada fica reprovado. Pôr estas famílias no pino usaria o livro-razão para esconder uma falha de **medição**, que é precisamente o que o pino não deve fazer. O que falta é cobertura de fronteira **por sítio e por variante**, ciente do fundo, no guard — e é isso que este item pede.

---

### 🔧 Toast AA + censo de contraste adiado por sítio

**Status:** implementação e **os seis gates de código aprovados** — **stage concluído**, em revisão. A Themis bloqueou este stage **sete vezes**, e cada bloqueio corrigiu um defeito real: `def8080` (2 HIGH + 1 LOW — o contraste do Toast), `53c1d00` (3 MEDIUM + 2 LOW — o controle de fechar, o censo que falhava aberto, e um byte NUL), `009a509` (1 MEDIUM — a identidade de sítio não sobrevivia a uma substituição na mesma declaração), `e11b31c` (1 HIGH + 1 MEDIUM + 1 LOW — a posse de um marcador não era exclusiva, e um piso de uma direção só era contradito por uma asserção global), `57208c9` (1 HIGH + 1 MEDIUM + 1 LOW — um marcador podia vazar para um elemento posterior, e os testes de posse não comprovavam o que afirmavam), a ronda sobre `22fa380` (2 achados — a contagem exata do inventário impedia corrigir sítios, e o próprio ROADMAP afirmava uma regra reversa que já não existia) e a ronda sobre `c8857a` (3 MEDIUM — a posse era decidida por regex, ainda restavam dois pisos de população, e a definição de órfão neste documento estava errada). **Árvore exata cujos seis gates valem: `1b846719e62a5c49e15e574b25055a1a00abe6e3`** — rodados nela, com saída 0 nos seis: `test:run` (**236 arquivos / 3294 testes**), `test:run -- --coverage` (os mesmos 236 arquivos / 3294 testes, **82,97% statements, 77,01% branches, 78,58% functions, 84,04% lines**, sem timeout), `typecheck`, `typecheck:electron`, `lint` e `build:all`. **Cobertura: o agregado passa, o detalhe é divulgação.** Os quatro agregados estão acima do **mínimo de 60% que o utilizador aprovou para a Beta 5**, e esse 60% é um **critério de aceitação da release, não um threshold que o CI imponha** — o Vitest tem thresholds **globais** (statements 30, branches 26, functions 28, lines 33) e **nenhum por ficheiro**, e a conferência dos quatro agregados é feita manualmente no gate final da Themis. A tabela tem 262 ficheiros: **38 abaixo de 60% de linhas**, **70 abaixo de 80%** e **12 a 0%**. Esses números são **divulgação, não um gate por ficheiro**. `55ba882` fica como histórico: foi ele que reprovou o gate de cobertura por timeout, corrigido em `1b84671` pelo cache de AST. `b252319`, `26cc674`, `160c1d9`, `777f488` e os SHA anteriores são **histórico** e não valem como evidência para esta árvore. O commit de documentação que traz esta entrada **segue** `1b84671` e **não** foi ele próprio sujeito de uma execução dos seis gates. O branch foi criado a partir de `main` em `e682f09`. **Revisão e merge da Themis pendentes** — não mesclado em `main` e não liberado. Este stage é só o do Toast/guard: o **#221 continua aberto, fora deste stage**, e fica enfileirado a seguir, na ordem de um PR por vez. Onda independente: não substitui, não reordena nem absorve nenhuma fatia da Phase 7o, da Phase 7n ou do port visual da Beta 5, e não fecha o gate transversal de compatibilidade v2.0.

**1. Falha WCAG AA viva no Toast — corrigida.** Os três variantes pintavam um token de primeira plana como fundo, com tinta que troca no `.dark` (`bg-[var(--color-danger)]/90`, `bg-[var(--color-success)]/90`, `bg-[var(--color-accent)]/90` + `text-[var(--color-text-primary)]`). Reprovaram WCAG 1.4.3 nos **dois** temas; o pior caso medido foi **2,07:1** no escuro (a cifra de 2,83/3,26 registrada no follow-up abaixo era do par de acento e subestimava o problema — o toast de erro renderizava como um pílula rosa-claro com texto quase branco, ou seja, ilegível, e não apenas abaixo do limite).

| variante  | claro (antes → depois) | escuro (antes → depois) |
| --------- | ---------------------- | ----------------------- |
| `error`   | 3,10:1 → 4,77:1        | **2,07:1** → 4,77:1     |
| `success` | 3,84:1 → 5,36:1        | **2,10:1** → 5,36:1     |
| `info`    | 3,38:1 → 6,29:1        | 3,18:1 → 6,29:1         |

**Decisão:** tinta pareada sobre preenchimento **sólido**, seguindo o padrão que `--danger-fill`/`--warning-fill` já tinham resolvido — e não uma mudança de alpha. O `90` é o amplificador, não a causa: diminuí-lo move a cor efetiva _mais_ perto do que está atrás, e o toast é `fixed` sobre conteúdo arbitrário, então o par deixa de ser decidível a partir da class string. Um fundo sólido não supõe backdrop nenhum e, de quebra, traz o toast para dentro do scan existente, que mede fundos sólidos e pula translúcidos por desenho. Novo token `--positive-fill: #007a55` + `--positive-fill-fg: #ffffff`, declarados em `:root`, em `.dark` e na camada de aliases com valores idênticos, para que uma edição de um tema só vire falha de teste. Sem `-hover` de propósito: os outros dois respondem a um botão, e um toast é `role="region"`.

**2. Piso da população adiada — de arquivos para o elemento que possui o site.** Quatro chaves foram tentadas e três foram reprovadas pela revisão, e são elas que explicam a última:

| chave                         | o que não enxerga                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| contagem de arquivos          | um site corrigido e um site que mudou de forma dão o mesmo número                                                       |
| conjunto **global** de formas | um site que migra de uma forma já permitida para outra forma já permitida: contagem igual, conjunto igual, guarda verde |
| `arquivo#declaração#ordinal`  | a **substituição na mesma declaração**: dois elementos trocam de pareamento e todo ordinal continua no lugar            |
| forma (ou hash da forma)      | dois sites da mesma forma são indiscerníveis — a mesma falha com passos a mais                                          |

**A identidade de um site é o elemento JSX que o possui**, por esquema híbrido: um atributo **estático que o elemento já tem** — o `data-testid="spool-thumb"` do `SpoolThumb` é reutilizado, porque não acrescentar nada é melhor do que acrescentar algo — ou, na falta dele, um **comentário source-only** ao lado do elemento. São **21 comentários** cobrindo os outros 21 elementos, mais **1** reutilizado, em **14 arquivos de produto**. Nenhum atributo de runtime é adicionado. O `data-testid` dinâmico do `ChangelogPage` não é identidade, e `aria-label` nunca é consultado: em 20 destes sites ele é localizado, o que tornaria a chave uma string de tradução.

O comentário tem **dois formatos legais**, porque a posição importa e errar é erro de sintaxe, não bug sutil: `{/* contrast-site: id */}` entre irmãos, e `/* contrast-site: id */` quando o elemento é a primeira coisa dentro de uma expressão parenthesada (`return (`, `{x ? (`, `{x && (`) — lá as chaves seriam um literal de objeto. A forma é **derivada** da linha acima do elemento, e não assumida: foi essa derivação que pegou três sites que a lista manual dava como forma JSX.

O pin é `identidade -> formas[]`, com **duas** formas em **quatro** elementos, que emparelham `bg-emerald-600` e o seu `hover:bg-emerald-500` com a mesma tinta.

**Nenhuma contagem é asserida, e isso é deliberado.** Nenhuma asserção deste ficheiro conta a população de sítios. Saiu primeiro a contagem **exata** — 22 elementos proprietários, 26 pareamentos, 21 marcadores — e uma asserção de que **toda** forma pinada ainda aparecia em algum lugar do fonte. Saiu depois o resto dos pisos, que as versionais anteriores usavam como garantia de que a varredura não ficava muda: `pairings.length > 20`, `shapes.size > 10`, `census.failing.length <= 15`, `palette.failing.length <= 11` e `census.failing.length > 0`. Todos punem o trabalho que a guarda existe para fiscalizar — `failing > 0` reprovaria no dia em que o último sítio fosse corrigido. E a presença reversa contradiz a política de uma direção que o resto desta entrada descreve.

**O que substitui a contagem é o pin por sítio, e é mais forte.** A validação é de **uma direção só, sobre o fonte atual**: todo sítio que está a falhar agora tem de ter uma identidade pinada **única** e a **sua** forma. Reprova uma identidade nova que ninguém pinou, reprova uma forma que mudou, reprova ambiguidade, identidade em falta, marcador órfão, id duplicado e reaproveitado. Um sítio resolvido simplesmente deixa de aparecer na varredura ativa e **deixa um pino obsoleto** — o custo aceito. Não há piso populacional, nem mínimo frouxo, porque qualquer número hoje seria um número errado amanhã. O pin nomeia o sítio; um total apenas notaria que algum número mexeu, sem dizer qual.

**A garantia de que a varredura não ficou muda deixou de ser um número e passou a ser fixture.** Fonte que o teste possui, passada pelo **scanner de produção**, exigindo que encontre os pareamentos que foi escrito para achar e que reporte zero numa fonte sem nenhum. Resta **uma** medição real, a única que não pune uma correção: `unresolved` tem de ser **0** nas duas famílias, porque o censo falha fechado e um par indecifrável tem de aparecer em vez de passar por limpo. A exigência de que a metade **passing** fosse não vazia **também era um piso** — mesmo que só apontasse no sentido seguro, continuava a ser um número sobre a população real, e por isso saiu com os outros. O que prova que a varredura mede são as fixtures, nas duas direções e para as duas famílias. As duas direções do scanner são também verificadas por fixture: uma wash translúcida que falha é reprovada, uma wash translúcida que passa é aprovada e sai da população adiada, e o mesmo para a família de paleta.

**O inventário fica como retrato medido, não como limiar.** Re-derivado em `1b84671` sobre a árvore real — os mesmos números desde `26cc674`, que não tocou fonte de produto —: **22 elementos proprietários**, **26 pareamentos de forma**, **21 comentários de fonte** em **14 arquivos de produto**, 0 sem identidade, 0 falha de posse, 0 par não resolvido, 4 elementos com duas formas, 1 elemento resolvido pelo `data-testid` estático reutilizado. **Estes números não são asseridos por teste nenhum e não são um gate.** A asserção real é de integridade e passa hoje: a varredura resolve, todo sítio atual bate com o seu pino, e não há identidade ambígua.

**Prova por mutação, com o número medido.** As duas occurrences do `SectionNav` — mesma declaração, elementos irmãos, ids distintos — foram migradas para uma forma já pinada no `Select.tsx`. A troca foi reprovada nomeando **os dois** sites, e o pin acusou a entrada agora sem correspondência. A prova anterior só movia uma forma para uma forma inédita; esta move para uma forma **já permitida em outro arquivo**, que é justamente o caso que o pin por arquivo não via.

**Regressão pelo scanner de produção.** Tudo que segue está commitado e dirige `scanWashesInSource` mais as funções reais de identidade, com fixtures de fonte malformada, e afirma sobre as falhas que o código de produção produziu:

- um marcador antes de um elemento pareado e depois um **segundo** elemento pareado: o primeiro consome o marcador, o segundo é reprovado com o **sem identidade** — sem herança;
- marcador antes de um elemento que **já não tem** pareamento adiado, seguido de um elemento pareado: **não** é órfão (é o que um sítio corrigido parece), e o par posterior continua sem identidade, de modo que o pino o acusa como sítio novo e não pinado;
- dois marcadores reivindicando um elemento: `ambiguousMarker`, nomeando os dois marcadores e o elemento;
- id de marcador duplicado em dois elementos, e `data-testid` estático duplicado: `duplicateIdentity` nos dois casos;
- marcador sem nenhum elemento depois: `orphanMarker`;
- a troca A/B na mesma declaração, preservada, com multiconjunto e contagem idênticos e os dois sites nomeados.

**Três testes passam pelo caminho integrado de produção, não por `siteFaults` sobre linhas filtradas à mão.** A versão anterior do teste de pino obsoleto filtrava a resposta do censo e chamava `siteFaults` — o que, por construção, **não pode ver** uma falha de identidade nem um pareamento não resolvido, e portanto não falharia quando um sítio corrigido fosse acusado de órfão. Estes três dirigem `validateRealTree`, que varre todos os componentes, resolve a identidade de cada pareamento, recolhe as falhas de posse e depois compara cada sítio atual com o seu pino, substituindo o fonte de **um** ficheiro e deixando o resto da árvore real:

- **um sítio corrigido passa.** `price-hero-margin-label`, um `wash` cujo dono único é ele próprio, é migrado para `bg-[var(--accent-fill)] text-[var(--accent-fill-fg)]` com o **marcador mantido**; a população ativa desce, a entrada do pino fica obsoleta, e a validação integrada **não reporta nada**. Reverter a regra de órfão para a anterior faz este teste reprovar, nomeando `price-hero-margin-label [orphanMarker]`;
- **um sítio novo reprova.** Injetar um elemento adiado com identidade inédita no mesmo ficheiro reprova pela via integrada, nomeando a identidade e a kind `unpinned`;
- **uma forma que mudou reprova.** Alterar a opacidade do `wash` do sítio real mantém a identidade, e o pino acusa `changedForm` pelo nome.

Um quarto teste afirma que uma contagem não veria: dois elementos que trocam de forma dentro da **mesma** declaração, com multiconjunto e contagem do ficheiro idênticos. Anteriormente isso reprovava por uma contagem de formas por família; já não há contagem nenhuma, e ele reprova pelo pin, nomeando os dois sítios.Todas estas estão **commitadas** e dirigem o scanner de produção. **Não há teste de mutação commitado neste repositório**, e nenhuma das afirmações acima o é. O que existe são regressões de comportamento que afirmam sobre as falhas que o código de produção produziu, mais **duas mutações manuais feitas durante este trabalho** e revertidas em seguida: **repor a regra de órfão antiga** — a que marca como órfão um elemento que existe mas já não tem pareamento adiado — levou o teste do sítio corrigido a reprovar, nomeando `price-hero-margin-label [orphanMarker]`, enquanto o teste antigo baseado em `siteFaults` sobre linhas filtradas à mão **não** reprovou, como se previa; e **neutralizar `siteFaults`** levou dez testes a reprovar, incluindo os três integrados.

**A AST é memoizada pelo texto exato do ficheiro.** A posse é resolvida pelos nós `JsxOpeningElement` / `JsxSelfClosingElement` por offset, e esse parse é cacheado por **texto exato**, não por caminho — deliberadamente, porque os testes integrados percorrem a árvore inteira e depois trocam o fonte de **um** ficheiro entre passagens para simular uma correção. Uma chave por caminho devolveria o parse da passagem anterior para o ficheiro sobrescrito, e a guarda validaria uma árvore obsoleta passando pelo motivo errado. Com o texto como chave, uma sobrescrita é outra chave e é reapurada a sério, enquanto os restantes ficheiros vêm da cache. É isso que impede os dois testes integrais de rebentarem o timeout de 5s por teste: o custo deixou de ser multiplicado pelo número de passagens. Nenhum timeout foi ampliado — `vitest.config.ts` está intacto.

**Duas correções de parsing vieram junto.** O `stripComments` passou a preservar **tamanho**, não só quebras de linha: o branch de `//` apagava texto, então um offset no fonte removido não era offset no original, e a identidade resolvia elementos centenas de linhas longe — bug latente em código já mergeado. E a tag proprietária agora é lida até o `>` correspondente, com ciência de string e de chave, para que `onClick={() => …}` não trunque a varredura.

**A posse de uma identidade é exclusiva, e é posicional.** Um marcador — ou um `data-testid` estático — nomeia **exatamente um** elemento, e um marcador nomeia **apenas o próximo elemento JSX real**, e é consumido uma única vez. Se esse elemento não tiver pareamento adiado, o marcador **não** é órfão — é o que um sítio corrigido parece — e um elemento posterior **não** pode herdá-lo. **Órfão** significa um marcador que não nomeia **nenhum elemento JSX real**: o resto sobrou de um elemento apagado, ou um comentário que nada segue. "Real" é a palavra que importa, e a posse é resolvida pelo **parser do TypeScript**, não por regex: um literal `{"<span>"}` é uma string, não um elemento, e um regex não sabe a diferença — um marcador solto acima de tal string era ligado a um nó que não existe, e o censo reportava um sítio que nada protegia. Ligação, herança e leitura da tag de abertura passam agora pelos nós `JsxOpeningElement` / `JsxSelfClosingElement`, por offset. Ampliar órfão para "elemento existe mas não tem pareamento adiado" faria a guarda reprovar cada vez que um sítio fosse corrigido, que é o oposto do que a guarda existe para.

Essa definição é o conserto de um vazamento real: o resolvedor anterior escolhia o marcador mais próximo _antes_ de um literal de classe, o que não é a mesma coisa. Um marcador cujo elemento não tinha pareamento adiado entregava sua identidade ao elemento seguinte, de modo que um sítio podia ser nomeado por um comentário que estava acima de um irmão. O vínculo agora é calculado adiante, e não é herdável.

Três condições reprovam, e nenhuma delas é visível comparando totais — com dois elementos de mesma forma, contagens e multiconjuntos são idênticos ao caso saudável:

| condição            | o que significa                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orphanMarker`      | o marcador não nomeia **nenhum** elemento JSX real: sobrou de um elemento apagado, ou nada segue ao comentário. Um elemento que **existe** mas já não tem pareamento adiado **não** é órfão — é o que um sítio corrigido parece |
| `duplicateIdentity` | uma identidade alcançada por dois elementos distintos, por marcador ou por atributo                                                                                                                                             |
| `ambiguousMarker`   | dois marcadores reivindicando o mesmo elemento, que então não tem nome inequívoco                                                                                                                                               |

**O pin é de uma direção só, e isso é o contrato.** Um site corrigido deixa entrada obsoleta e **não** gera falha, porque corrigir um site nunca pode reprovar a suíte. Uma asserção que exigisse o contrário — que toda forma pinada ainda aparecesse _em algum lugar_ da árvore — falharia exatamente quando a política estaria funcionando: resolver o último sítio de uma forma tira a forma da população, o que é progresso. O que é verificado é a outra direção: todo sítio **atual** existe, tem exatamente uma identidade e casa com o **seu próprio** valor pinado; identidade nova ou forma alterada reprova. Há regressão para o sítio resolvido cujo dono era o único de uma forma — escolhida no censo, porque a wash de acento tem cinco donos e passaria pelo motivo errado.

**Censo re-derivado, e as chaves que foram reprovadas.** Os números que o cabeçalho do arquivo citava estavam **errados por ~2,5x**, e errados na direção que faz um piso parecer _menos_ trabalho do que existe. Quatro chaves foram tentadas como identidade de sítio e três reprovaram:

| chave                         | o que não enxerga                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| contagem de arquivos          | um sítio corrigido e um sítio que mudou de forma dão o mesmo número                                                      |
| conjunto **global** de formas | um sítio que migra de uma forma já permitida para outra forma já permitida: contagem igual, conjunto igual, guarda verde |
| `arquivo#declaração#ordinal`  | a **substituição na mesma declaração**: dois elementos trocam de pareamento e todo ordinal continua no lugar             |
| forma (ou hash da forma)      | dois sítios da mesma forma são indiscerníveis — a mesma falha com passos a mais                                          |

A guarda fixa hoje a validação **por elemento** sobre o fonte atual, e **nenhuma contagem**: todo sítio que está a falhar tem identidade pinada única e a sua forma, e não há identidade ambígua, órfã, duplicada nem reaproveitada. A única afirmação que resta sobre a população real é `unresolved === 0` em ambas as famílias, que é monotónica no sentido de não punir uma correção. Não há mais nenhuma. O inventário medido em `1b84671` — **22 elementos proprietários**, **26 pareamentos de forma**, **21 comentários** mais **1** `data-testid` reutilizado, **0** sem identidade, **0** ids duplicados, **4** elementos com duas formas — é um **retrato datado**, não um limiar, e nenhum teste o compara.

O regex antigo casava **só o token accent**, então nunca contou as washes de status: `--color-danger/90` e `--color-success/90` eram invisíveis para ele, e são os dois piores pares do app. A queda de 18 para 15 é o toast, cujas três variantes `/90` saíram da população ao virarem preenchimentos sólidos.

**O pin é de uma direção só, e o custo é declarado:** um sítio que aparece e não está pinado no seu elemento reprova; uma entrada pinada que deixou de ser descoberta **não** reprova. Corrigir um sítio nunca pode reprovar a suíte — só baixar a contagem. O custo é uma entrada obsoleta por sítio resolvido, e o mapa passa a descrever mais do que existe até ser podado à mão.

**3. Botão de fechar e indicador de foco do Toast — achado HIGH da Themis, corrigido.** A correção do texto mediu só o texto da mensagem, e duas coisas ficaram sem medir — as duas reprovando. Um botão de fechar é um **controle**, e o indicador visual de um controle é contraste **não textual**: WCAG 1.4.11 pede 3:1, não os 4,5:1 do 1.4.3. O texto passar em 1.4.3 não dizia nada sobre o botão.

| o que estava                                          | medido                             | agora                                   | barra (1.4.11) |
| ----------------------------------------------------- | ---------------------------------- | --------------------------------------- | -------------- |
| glifo do fechar a `opacity-70` sobre o fill de danger | **2,75:1**                         | `opacity-90` → **4,01:1**, hover 4,77:1 | 3:1            |
| anel `focus-visible:ring-[var(--color-accent)]/50`    | **1,00:1** no fill de info (light) | anel opaco de duas tonalidades          | 3:1            |

O anel antigo media 1,00:1 porque em light `--color-accent` e `--color-accent-fill` são o mesmo valor (`#4f46e5`): o anel a 50% compunha exatamente o próprio fill, e `focus-visible:outline-none` desligava o contorno do navegador que teria servido de reserva. Foco chegava e nada era desenhado.

A troca é por **duas tonalidades** porque uma cor não dá conta: o anel claro senta no fill saturado e passa de 4,77:1 a 6,29:1 em todas as variantes, e o offset escuro é a única parte que encontra uma superfície de página, passando de 17:1 a 20:1 contra as claras. Tokens novos `--focus-ring-light: #ffffff` e `--focus-ring-dark: #0a0b10`, declarados em `:root` e em `.dark` com valores idênticos e pinados em `tokens.test.ts` — um anel de foco que troca de tema é um anel que some em um deles. Nenhum dos dois é cor de foco geral: o claro é 1,00:1 sobre `--surface-raised` e o escuro é 1,00:1 sobre o canvas escuro.

`Toast.test.tsx` **renderiza** o componente e mede as classes que o DOM realmente tem, em vez de afirmar nomes de classe — `toContain("ring-white")` passaria para uma classe que nunca renderiza, num tamanho que não desenha nada, ou com um alpha que cancela o fill. Nome, ativação por teclado e descarte foram preservados e são afirmados.

**3b. Achados da segunda rodada (3 MEDIUM + 2 LOW), todos com mutação provada.** _Opacidade no botão escurecia o anel de foco:_ `opacity-90` estava no **botão**, e como o Tailwind pinta o anel como `box-shadow`, compor o elemento compunha o **indicador** junto — o anel efetivo era 4,01:1 no fill de danger, e não os 4,77:1 que o token do anel entrega, com o teste lendo o token cru e superestimando em um quarto. Passava em 1.4.11, mas aos 0,7 o anel cairia para 2,75:1, ou seja, o indicador de teclado abaixo da barra no mesmo controle que já estava abaixo por causa do glifo. A desênfase foi para o **glifo** (`<X>`), o botão ficou sem opacidade e o anel passou a medir 4,77 / 5,36 / 6,29:1 com verdade — o anel é pintado como `box-shadow`, então `opacity` no botão o escureceria junto. Duas regressões: uma falha se qualquer `opacity` voltar ao botão ou a até quatro ancestrais, outra falha se o glifo parar de estar desênfatizado — assim "mover" não decai em "apagar". _O censo de paleta falhava **aberto**:_ um passo fora do mapa do Tailwind era descartado com `continue`, o sítio sumia da população e, como `worst` continuava `Infinity`, o pareamento era classificado como **aprovado** — uma medição ilegível registrada como limpa, e um piso `toBeLessThanOrEqual` lia a ausência como o backlog encolhendo. Pareamentos indecidíveis agora vão para `unresolved` e não contam em direção nenhuma, com asserção de vazio nas duas famílias; medido, `bg-red-500` → `bg-red-550` derruba a contagem de 11 para 10 — o que o piso lê como progresso — enquanto o canal fecha-falho reporta a linha e a ocorrência certas. _Um byte NUL literal_ fazia o `git` e o `file` classificarem o arquivo de teste como **dados binários**, o que suprime diffs e impede revisão; removido, e `stripComments` passou a preservar as quebras de linha, porque apagar um comentário de bloco deslocava toda linha seguinte e um número de linha reportado apontava 12 linhas acima do sítio real.

**4. Dois LOWs contra a auditoria de `z-50`, ambos com mutação provada.** A lista de arquivos era derivada com `/class(Name)?=[^\n]*\bz-50\b/`, que exige o token na mesma linha do `className` — um class string quebrado em várias linhas escondia uma camada da auditoria. A derivação agora varre o texto do arquivo em busca do token, com **comentários removidos** (cinco arquivos discutem `z-50` em prosa justamente para explicar por que **não** estão nele) e com `https://` preservado pelo guarda `[^:]`. Um painel de bottom sheet deixou de ser reconhecido pelo proxy cosmético `rounded-t-2xl` e passou a exigir `bottom-0`, e o pareamento passou de "existe um backdrop neste arquivo" para **`panels <= backdrops`**. A regra de pareamento precisou antes ser extraída para uma função: com um painel e um backdrop em cada arquivo real, o estreitamento não alterava nenhuma asserção e nenhum teste ficava vermelho — o estreitamento era real, mas estava sem registro até uma mutação expô-lo.

**Gates no SHA de origem `def8080`:** `test:run` 0 (236 arquivos / 3236 testes), `test:run -- --coverage` 0, `typecheck` 0, `typecheck:electron` 0, `lint` 0, `build:all` 0. O commit que registra esta entrada é somente de documentação e **não** reexecuta os gates de código.
---

### 🔎 Investigação — uso atual de lojas e clientes

**Status:** investigação; não é uma fase de implementação.

Auditar como o app atualmente usa lojas e clientes, com foco em `customerStore` e `quoteStore`, e estabelecer o que “loja” significa no código e na experiência existente. Levantar dados órfãos, duplicados ou sem uso real. Só depois decidir o que reaproveitar, estender ou substituir na Phase 7k.

---

### ✅ Decisão TAKEN — margem vs markup

**Decisão:** a entrada será **“Markup sobre custo (%)”**, preservando os valores atuais e resultando em zero mudança de preço e zero preset quebrado. A saída será **“Margem real”**, campo derivado somente-leitura, exibido como informação com rótulo explicativo.

**Problema que motivou:** `profitMarginPercent` executa `lucro = custo × margem / 100` (`calculatorStore.compute.ts:97-105`). Esse valor é markup, não margem: “Margem 110%” significa lucro igual a 110% do custo e venda a 2,1× o custo. Como margem real, o valor seria impossível, pois acima de 100% o custo-resultante seria negativo. Os presets de 110% e 140% são markup válido.

**Justificativa da interface:** quem faz impressão fala em custo — “cobro 3× o custo” é a linguagem real. Forçar margem abstrata no campo de entrada trocaria a linguagem certa por uma menos natural. Exibir as duas grandezas elimina a confusão e evita mais um controle repetido.

**Objetivos já cobertos pela lib:** `suggestedPrice` resolve margem-alvo, lucro por peça, lucro mensal, break-even e preço de concorrente. O campo manual fica para quem decide sair desses padrões.

---

### ⏸️ Deferred: IA/BYOK (sem IA nesta V2.0)

IA foi explicitamente confirmada como fora da V2.0. A única área deferred é IA/BYOK: Consultor de Risco & Margem, WhatsApp Pitch, Visão Multimodal, estimativa por foto, análise textual e geração assistida de pitch. Esses recursos dependem de backend ou de política de IA e só poderão voltar em uma decisão futura, com assessor de privacidade, ADR e consentimento separados. Nenhuma fase acima depende deles.

---

## 📊 Quality Metrics

| Metric                  | Current                                               | Target                                  |
| ----------------------- | ----------------------------------------------------- | --------------------------------------- |
| Test coverage (overall) | ⚠️ **Não medida para a beta.11** — ver nota abaixo    | ≥60% (Beta 5, aprovado pelo utilizador) |
| Coverage (calculation)  | ⚠️ Não medida para a beta.11                          | ≥90%                                    |
| Tests                   | 4.255 (304 files) — último CI pós-#264, parent da tag | 500+                                    |
| Components with tests   | Partial                                               | 100%                                    |
| Accessibility (a11y)    | —                                                     | WCAG A                                  |

#### ⚠️ A cobertura da beta.11 não foi medida

**O último CI completo após o PR #264 foi executado em `080a23d794e8d543136e1e4de180d6bd7d17f5f6`: 4.255 testes em 304 arquivos.** Esse commit é o parent da tag; `v2.0.0-beta.11` (`fa23ac5`) acrescenta o bump de versão, mas os testes não foram reexecutados diretamente na tag. Portanto, 4.255/304 é a última medição do CI, não uma execução direta da beta.11. Coverage da beta.11 não foi medida; não inferir percentuais a partir de medições antigas.

- [ ] **Medir coverage para a beta.11 e atualizar os agregados desta tabela.** Até lá, coverage overall e de cálculo permanecem explicitamente sem medição atual.
- **Não preencher coverage atual com os percentuais históricos de `1b846719`.** Um número velho honesto vale mais que um número velho fingindo ser de hoje.
- **Contagem atual do último CI completo após #264:** 4.255 testes em 304 arquivos, no commit `080a23d794e8d543136e1e4de180d6bd7d17f5f6`, parent da tag. Não houve execução direta desses testes na tag beta.11.
- Contexto histórico preservado: em `1b846719` a medição foi de 82,97% statements, 77,01% branches, 78,58% functions e 84,04% lines, com 262 ficheiros na tabela — 38 abaixo de 60% de linhas, 70 abaixo de 80% e 12 a 0%. Esses são os números da **medição antiga**, registrados para comparação quando a nova medição existir. A porta de 60% aprovada pelo utilizador para a Beta 5 continua sendo o alvo; o que mudou foi a árvore, não a meta.

## 🔒 Not in scope (for now)

- ❌ **Modo Studio como quinto `LayoutMode`**: continua fora do escopo. Isso não contradiz a marca ou a shell Studio da web beta; `layoutStore.ts:31` define `classic`, `guided` e `bento`.
- ❌ Abas de IA: Consultor de Risco & Margem, WhatsApp Pitch e Visão Multimodal (ver Deferred: IA/BYOK)
- ❌ Estimativa por foto: adiada por depender de backend e de uma política de IA
- ❌ Extras itemizados: o app tem `extrasCost` escalar; a lista do protótipo exigiria um novo contrato de dados
- ❌ Viewer 3D sintético do protótipo: o app já tem `StlPreview` e `GcodePreviewPanel` reais, que devem ser usados
- ❌ Skin PBR experimental para o `StlPreview`: os previews reais existentes permanecem como referência
- ❌ Paid plans, subscriptions, monetization, checkout, and billing — permanently out of scope
- ❌ Transactional marketplace and marketplace/API synchronization
- ❌ Mandatory cloud sync or multi-user cloud architecture
- ❌ Bridge, telemetry, and camera integrations — remain outside the immediate scope
- ❌ Full ERP
- ❌ Microservices in the immediate scope
- ❌ Integration with supplier APIs
- ❌ FDM vs Resin comparison (not meaningful — each serves a different purpose)
- ❌ 3D model marketplace

---

## How to contribute

1. Pick an issue or feature from this roadmap
2. Create branch: `feat/<feature-name>`
3. Develop with TDD (RED → GREEN → REFACTOR)
4. Commit following [Conventional Commits](https://www.conventionalcommits.org/)
5. Open PR → wait for review → merge

---

_Atualizado em 04 de outubro de 2026 — a versão publicada é `2.0.0-beta.11` (tag `fa23ac5`; `main` = `1057e769`). O resumo que segue preserva o registro histórico de 30/09/2026, quando `2.0.0-beta.6` e `main` `2cd273f` eram a referência. Onze correções e seis blocos novos, cada afirmação verificada no código antes de ser escrita. As phases 7, 7b, 7c, 7f e 7g registram a `2.0.0-beta.2`; as entregas das `2.0.0-beta.5` (segurança e privacidade, ondas W0–W7, PRs #236 e #241–#246) e `2.0.0-beta.6` (layout, PR #247, `2126865`) passam a ter bloco próprio. A Phase 7 vai a `beta.6`; a Phase 7i é reformulada — a restrição "Bento read-only" está superada e a pendência virou paridade de cobertura de campos; a C4 da Phase 7h está resolvida com a medição 497px → 280px, e a C4b (controles duplicados) continua aberta e subiu de prioridade porque a superfície ficou editável. A Phase 6 P2 (Hole Tolerance e Press-Fit) passa a constar como tabela pronta e testada aguardando port, com o consumidor por fazer. A Phase 7e registra a decisão de Farm como o quarto modo com zero código implementado — `LayoutMode` tem três valores. O M1 da Phase 7m está entregue em `d5b0624`, com a pendência real do `roundCurrency` fail-high, que não foi implementado. Entram a Higiene do repositório (19 tags `archive/*`, 1 extraída; branches órfãs; 4 componentes órfãos no `Example/`), a Phase 7p (naquele registro, descrita como substrato zero), a Phase 7q (cinco decisões de domínio listadas) e a Phase 7r (quatro defeitos medidos na shell então vigente, com a regra de que guard por string-match não é prova de layout). Naquele snapshot, a cobertura era a de `1b846719`, **anterior à `beta.6`**, e a contagem de testes era 4.036 em 289 arquivos, medida em `7511904`. No estado atual, o hook de 7p está entregue, 7q tem três decisões respondidas e duas abertas, e o CI completo mais recente após #264 registrou 4.255 testes em 304 arquivos no parent da tag; esses testes não foram reexecutados diretamente na beta.11 e sua coverage não foi medida.

**O gate transversal de compatibilidade v2.0 continua aberto, e nada nesta atualização o fecha.** Esta alteração só atualiza o roadmap: não testa v1→v2 nem altera migrações, fixtures ou chaves de persistência. O `useHistoryAggregates` da Phase 7p já foi entregue e é puro/read-only sobre o `historyStore`, sem escrita ou formato de storage novo; sua existência não fecha o gate e não constitui feature de persistência. A decisão 4 da Phase 7q (`usefulLife` em horas ou em anos) continua pendente do dono._
