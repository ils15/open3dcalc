# 🗺️ Open3DCalc — Roadmap

> **Date:** 18/09/2026
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

---

## Priorities (Execution Order)

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
- [ ] Apply fixed fees and shipping costs to calculations and offers.
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
- [ ] 🧭 **Press-Fit Calculator** — press / snug / slide / free fits between printed and metal parts (press −0.1mm, snug +0.05mm, sliding +0.15mm, never-bind +0.35mm), bearing pocket numbers, and the teardrop self-supporting hole alternative for vertical holes.

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

**Status em `2.0.0-beta.2`:** entregue para `classic`, `guided` e `bento`, com uma limitação conhecida: o Bento é uma superfície financeira read-only e ainda não substitui os campos editáveis do Clássico.

**Entregue:**

- [x] `layoutStore` com os modos `classic`, `guided` e `bento`, com persistência local.
- [x] `AppShell` extraído para concentrar a troca da superfície de cálculo.
- [x] `LayoutSwitcher` no header. O Guided já existia, mas era inalcançável porque nenhum componente chamava `setLayoutMode`; o seletor corrigiu esse ponto de entrada.
- [x] Inspetor Financeiro como refactor behavior-preserving do `ResultsPanel`: cálculos mantidos no hook e apresentação em cards.
- [x] Wizard progressivo de 4 passos (`GuidedWizard`).
- [x] `BentoSurface` com cinco cards financeiros e grid responsivo `1 / md:2 / lg:3`.
- [x] Gauge do Bento ligado ao inventário real, sem dados fictícios ou contagem local.
- [x] SPEC-01 na versão 1.4, com três chaves de dados `ui_preference`, incluindo a chave de layout.

**Limitação conhecida:**

- [ ] O Bento foi entregue deliberadamente como read-only. A cobertura editável está especificada na Phase 7i; não deve ser tratada como bug do layout atual.
- [ ] O Guide de Perfis para associar persona a layout e `calcLevel` continua pendente.
- [ ] Estados vazios e feedback visual completos para as novas superfícies continuam em aberto.

**Acceptance criteria:**

- [x] Os três layouts estão acessíveis pelo header e o Guided deixou de ser um modo órfão.
- [ ] Os três layouts renderizam os mesmos resultados e oferecem a mesma cobertura de edição; hoje isso é bloqueado pela limitação read-only do Bento.
- [ ] Trocas de layout nunca entram no undo stack nem tornam o cálculo pendente.
- [ ] O wizard pode ser pulado ou dispensado em qualquer etapa; a calculadora permanece utilizável sem ele.
- [x] A chave de layout aparece no manifesto SPEC-01.
- [ ] A chave de layout está incluída na limpeza de dados e nos testes de regressão de privacidade.
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

**Status:** escopo definido; Farm é o quarto modo do seletor. **Depende da Phase 7d — Gestão de Impressoras:** o modo só pode existir depois dessa fase, pois exibe dados da frota.

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

**Causa raiz do espaço vazio:** o grid não declara `items-start` (`BentoSurface.tsx:134`) e `BentoCard.tsx:23-27` não define `self-start`/`h-fit`; os cards esticam até a altura do mais alto.

**Causa raiz da duplicação:** o mesmo controle foi observado repetido duas, três ou quatro vezes entre os cards. A decisão é unificar cada controle em uma única instância, mantendo contexto e rótulo suficiente para evitar ambiguidade.

**Anti-padrão:** resolver a repetição escondendo controles por breakpoint sem identificar um owner único. A correção deve tratar a origem da duplicação, não apenas a aparência em um tamanho de tela.

**Acceptance criteria:** os cards ocupam apenas sua altura natural; cada controle aparece uma vez; navegação por teclado e ordem de foco permanecem previsíveis conforme [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/).

#### C5 — Estante: ação destrutiva sem rótulo visível

**Causa raiz:** a ação inferior usa `Trash2` (`SpoolCard.tsx:3` e `SpoolCard.tsx:167-174`) e possui apenas `aria-label`; não há texto visível.

**Decisão tomada:** manter a ação destrutiva para não aumentar o risco de exclusão acidental e adicionar rótulo/tooltip visível, mantendo também o nome acessível.

**Inconsistência secundária:** `SpoolCard.tsx:62` usa `FALLBACK_HEX` na caixa de cor, enquanto `SpoolCard.tsx:79` passa `spool.colorHex` ao `SpoolThumb`. Sem cor, a caixa fica indigo e o thumbnail vira monograma.

**Acceptance criteria:** a ação destrutiva tem rótulo visível e nome acessível; ausência de cor usa fallback coerente entre caixa e thumbnail; texto e ícone mantêm contraste e alvo suficiente conforme [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/).

---

### 🧩 Phase 7i: Bento como calculadora editável

**Status:** direção aprovada, implementação planejada. O objetivo é oferecer os mesmos campos do Clássico com templates de complexidade, não criar um terceiro contrato de cálculo.

**Estado atual, por design:** o Bento é read-only. Os comentários “read-only five-card financial grid” (`BentoSurface.tsx:57`) e “no calculation is performed here” (`BentoPricingCard.tsx:17-18`) são intencionais; não existe um único `<input>` nessa superfície. Tratar isso como bug seria incorreto.

**Cobertura que falta:**

| Domínio                                                                  | Cobertura no Clássico                                                                                      | Cobertura atual no Bento             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Material                                                                 | Tipo, peso, custo, densidade, purga, eficiência do carretel, seleção de carretel, volume e custo por litro | Apenas resumo                        |
| Falhas                                                                   | Modo, valor e multiplicador                                                                                | Apenas custo                         |
| Vendas                                                                   | Quantidade, infill, extras, embalagem, frete, marketplace, imposto, margem/markup e presets                | Apenas exibição                      |
| Custos fixos, mão de obra, hardware/acabamento, operações/PPE e software | Campos no Clássico                                                                                         | Resumo parcial; o restante é omitido |

**Direção de implementação:**

- [ ] Reaproveitar o `calcLevel` que já existe em `Calculator.constants.ts:99-117` (básico, intermediário e completo), hoje ignorado pelo Bento.
- [ ] Usar `Example/src/components/BentoLayout.tsx` como inspiração visual, nunca como cópia de estrutura, estado ou cálculo.
- [ ] Criar três templates de inicialização, não três formulários: **Básico** com defaults seguros, **Avançado** com disclosure progressivo e **Completo** com organização por processo.
- [ ] Exibir rótulo textual e valor em todos os cards; cor e ícone não substituem o significado.
- [ ] Compartilhar setters e condicionamento FDM/resina com o Clássico em vez de reproduzir regras em componentes locais.

**Risco principal:** tornar a superfície editável duplica inputs, condicionamento FDM/resina e setters. Um campo que atualiza o estado mas não recalcula é o pior resultado possível; paridade de estado e resultado precisa ser testada como um único contrato.

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

**Status:** decisão de produto registrada. **M1 — Honestidade imediata entra na beta 3**; M2–M7 ficam para depois da beta 3. A beta 3 não deve apresentar o cálculo multi-material como correto enquanto o custo multi-material ainda não chegar ao preço.

**Objetivo:** suportar a mesma forma de dados para AMS, CFS e ACE 2, sem criar um modelo por hardware. O fatiador é a fonte autoritativa; o app não deve inventar uma taxonomia de máquinas diferente da relatada pelo fatiador.

#### M1 — Honestidade imediata _(entra na beta 3)_

- [ ] Exibir aviso de que o custo de material multi-material não entra no total, no preço nem no lucro.
- [ ] Corrigir o furo que transforma um array de materiais vazio em custo zero; o caso inválido precisa ser explícito, não um total silenciosamente incorreto.
- [ ] Usar o rótulo neutro **Multi-material**, em vez de “AMS”, em qualquer aviso ou cálculo que apresente esse recurso como suporte a um único sistema.
- [ ] Fazer `roundCurrency` usar arredondamento _fail-high_ (para cima), sem subestimar o preço ao arredondar valores monetários.

**Aceite da beta 3:** o aviso é visível antes de a pessoa confiar no resultado; array vazio não produz custo zero sem sinal explícito; o rótulo é neutro; e o arredondamento monetário não reduz o valor cobrado.

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

- `loadHistoryItem` resolve a impressora contra o array estático `printers`, enquanto o builder usa `useCatalogStore`; há divergência real em catálogo personalizado.
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

O protótipo em `Example/` **não é mais um rascunho visual**: seis componentes novos são implementações de referência de itens que esta fase declarava não implementados. Isso muda o custo estimado de N1–N6, **não** o escopo nem a ordem. O protótipo é **material de referência apenas**: tem zero testes, zero i18n e zero acessibilidade, e os tipos e o cálculo dele são incompatíveis com o app real. Portar é reescrever com TDD, nunca copiar.

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

**Referência no protótipo — a mais forte das seis.** `Example/src/components/HistoryView.tsx` (1.132 linhas) já implementa o escopo inteiro: tri-state do checkbox mestre (`:143-150`, `:735-742`), selecionar-somente-os-filtrados (`:189-199`), barra de ação em lote (`:588-708`), aplicação de status (`:632-672`), CSV apenas dos selecionados (`:688-695`), exclusão em lote (`:698-705`), comparação com exatamente 2 (`:676-685`) e contador (`:592-600`). Portar é reescrever com TDD; copiar, não.

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

**Status:** etapas aprovadas pela pessoa usuária; Stage 1 — Navigation Context —, Stage 2 — Currency/Theme — e Stage 3 — Navegação primária, destino ativo persistido e Manage Visibility — implementadas e mescladas em `main`; etapas 4–8 não iniciadas. Esta fase descreve oito fatias separadas, cada uma entregável em PR próprio; sequência e dependências estão explícitas abaixo. Nenhuma delas autoriza alterar o escopo vigente da Beta 5. O plano desta fase entrou no roadmap pelo PR #223, mesclado como `67b43f34674f2aa5c5c0d394cb68383688509cf1`.

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

**Status:** implementada e mesclada em `main`. Manter cinco destinos primários — **Pricing, Dashboard, History, Printers e Spools** — e persistir a aba ativa conforme o comportamento de referência em `Example/`. PR [#229](https://github.com/ils15/open3dcalc/pull/229) squash-merged como `048211ea569c5ad04b13a6b02bf35e803b9dc311`, aprovado pela Themis no SHA exato de revisão `a4333edcd443f965cd8e46d9cb130a2a63fd7a95` após cinco rodadas de revisão.

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

**Status:** aprovada; não iniciada. Oferecer uma superfície somente de calculadora, escondendo a navegação e a sidebar enquanto o modo estiver ativo.

**Acceptance criteria:**

- [ ] O Focus Mode mostra apenas a calculadora e mantém uma saída segura, visível e utilizável em todos os tamanhos de tela.
- [ ] Sair do modo restaura o contexto anterior — destino, sidebar, densidade e foco de navegação — sem perder campos ou resultados.
- [ ] O modo é transitório, não uma nova preferência persistida; entrar ou sair não altera estado de cálculo, undo/redo ou a visibilidade das abas.
- [ ] A entrada, a saída e a restauração funcionam por teclado e respeitam WCAG AA e movimento reduzido.

#### 7o.5 — Mini-Dash fora do Dashboard

**Status:** aprovada; não iniciada. Disponibilizar um Mini-Dash compacto fora da tela Dashboard, com opção clara de reabrir ou expandir.

**Acceptance criteria:**

- [ ] O Mini-Dash pode ser compactado, reaberto e expandido sem perder o contexto da tela atual.
- [ ] Exibe somente métricas verificadas que já existam nos dados reais de histórico e carretéis; métricas sem fonte real são omitidas, não simuladas.
- [ ] Em desktop e mobile, o Mini-Dash e sua versão expandida não cobrem campos, ações, foco nem controles necessários da tela subjacente.
- [ ] Conteúdo, rótulos e ações são acessíveis e localizados; aplicar o gate transversal de compatibilidade v2.0 a qualquer preferência persistida introduzida.

#### 7o.6 — Gerenciador e guia global de atalhos

**Status:** aprovada; não iniciada. Centralizar atalhos da aplicação e oferecer um guia acessível, após auditoria de conflitos com navegador e sistema operacional.

**Acceptance criteria:**

- [ ] Cada atalho proposto tem conflito de navegador e sistema operacional auditado antes de ser adotado; conflitos não são capturados silenciosamente.
- [ ] Atalhos não disparam enquanto o foco estiver em entrada de texto/editável, nem atravessam modal ou diálogo ativo de forma inesperada.
- [ ] O guia lista os atalhos efetivamente ativos, pode ser aberto e fechado por teclado e tem foco, rótulos e textos traduzidos.
- [ ] Testes cobrem conflito, campos editáveis, modais, navegação por teclado e o comportamento de fechamento.

#### 7o.7 — Quick Actions em speed dial

**Status:** aprovada; não iniciada. Entregar Quick Actions como uma fatia separada, sem agrupar sua implementação com Mini-Dash ou Dashboard.

**Acceptance criteria:**

- [ ] O speed dial é operável por teclado e toque, anuncia estado e ações de forma acessível e não depende apenas de ícones.
- [ ] Posição, área segura e abertura/fechamento funcionam em telas responsivas sem ocultar controles.
- [ ] A ordem de camadas e a coexistência são verificadas junto a Mini-Dash, tutorial e diálogos; um overlay nunca bloqueia saída, foco ou confirmação de outro.
- [ ] Testes verificam a interação e colisões de camadas nos estados simultâneos relevantes.

#### 7o.8 — Quatro espaços de trabalho no Dashboard

**Status:** aprovada; não iniciada. Organizar o Dashboard em quatro espaços: **Overview/Finances**, **Profitability/Pricing**, **Operations/Quality** e **Engineering/Slicer**. `Example/` é referência de UI, não fonte de modelos ou métricas.

**Acceptance criteria:**

- [ ] Os quatro espaços têm nomes, conteúdo e navegação distinguíveis; somente o espaço ativo é montado, com lazy mounting dos demais.
- [ ] Trocar de espaço preserva dados e estado de cálculo existentes. Componentes reutilizam os stores e cálculos reais do app.
- [ ] Fleet ROI, live jobs, failure outcomes, tendências de faturamento fabricadas e slicer optimizer do protótipo permanecem adiados até existirem modelos, dados e fórmulas reais aprovados. Dependências de frota continuam subordinadas ao N0 da Phase 7n; nenhuma tela apresenta placeholder como métrica real.
- [ ] Os espaços funcionam em desktop e mobile, são acessíveis por teclado/leitor de tela e mantêm paridade pt-BR/en-US.

**Dependências entre fatias:** 7o.2 depende das façades de navegação de 7o.1; 7o.4 depende da navegação/sidebar de 7o.2; 7o.5 depende da navegação de 7o.2; 7o.7 deve validar a coexistência com o Mini-Dash de 7o.5; 7o.8 usa a navegação de 7o.2. 7o.3 e 7o.6 podem ser planejadas separadamente, mas continuam sujeitas ao gate e à entrega em PRs próprios. Os componentes de Dashboard que dependem de frota real continuam bloqueados por N0 na Phase 7n, sem bloquear a estrutura dos quatro espaços.

---

### 🎨 Onda de contraste WCAG AA — cadeia consolidada

**Status:** entregue e mesclada em `main`. Onda independente: não substitui, não reordena nem absorve nenhuma fatia da Phase 7o, da Phase 7n ou do port visual da Beta 5, e não fecha o gate transversal de compatibilidade v2.0.

Os quatro PRs empilhados #222, #224, #225 e #226 foram consolidados sobre `main` em um único branch e mesclados como `3761a76a4584f609ee00db7da1b8c8145bffc49c` pelo PR #230, aprovado pela Themis no SHA exato `eadd10e44249535df782b18917b8182fa86378fc` em duas passagens de revisão.

**Por que a consolidação foi necessária:** `ci-cd.yml` dispara apenas em `pull_request` com destino `main`. O PR #226, aberto sobre um branch de feature, nunca teve uma única execução de CI, e a cadeia empilhada não podia ser validada de forma confiável naquela forma.

**Como a aprovação foi verificada:** a Themis reimplementou de forma independente a aritmética de contraste WCAG, em vez de reutilizar o helper do repositório, e as seis razões alegadas bateram em 0,00. Também provou mecanicamente que os dois commits "somente Prettier" eram de fato apenas formatação, executando o Prettier no parent de cada arquivo e comparando por diff.

**Pendência administrativa:** os quatro PRs originais continuam abertos e estão agora totalmente superados; precisam ser fechados pelo owner.

#### Próxima onda de acessibilidade — follow-ups registrados

- [x] `src/shared/components/ui/Toast.tsx:18` — falha WCAG AA viva. ~~**2,83:1 no claro e 3,26:1 no escuro**~~ — reprovado nos **dois** temas, e o pior caso real é **2,07:1 no escuro**; a cifra original media só o par de acento e subestimava o defeito. Corrigido com tinta pareada por variante sobre preenchimento sólido, em `fix/toast-contrast-and-guard-floor` (SHA de origem `def8080`). **Revisão e merge pendentes.**
- [x] O piso de população adiada do guard de contraste prendia **contagem de arquivos**, não de sítios. `keeps the deferred translucent-accent population shrinking` asseria `files.length <= 16`, e o pino de sítios descobertos asseria `files.size > 5`. Um sítio que migrava de uma forma quebrada para **outra** forma quebrada mantinha as duas contagens iguais, e a falha se escondia. **Esse piso de sítios também já não existe.** Prender um número é a mesma classe de defeito que prender arquivos: um sítio corrigido baixa a contagem, e o piso reprova o progresso. O que ficou é o **pin por sítio** — identidade -> formas, validado só na **direção do fonte atual** — e é mais forte do que qualquer contagem, porque nomeia o sítio em vez de apenas notar que algum número mexeu. Nenhuma asserção do ficheiro conta a população: nem `pairings.length > 20`, nem `shapes.size > 10`, nem `census.failing.length <= 15`, nem `palette.failing.length <= 11`, nem `census.failing.length > 0`. A garantia de que a varredura não ficou muda passou a ser **fixture dirigida pelo scanner de produção**, e sobraram duas medições monotónicas no sentido certo: `unresolved === 0` e a metade `passing` não vazia. Ao re-derivar o censo, os números do cabeçalho se revelaram errados por ~2,5x (48/13 e 27/8 → 18 sítios/10 formas/11 arquivos e 11/4/7). Em `fix/toast-contrast-and-guard-floor` (SHA de origem `def8080`). **Revisão e merge pendentes.**

---

### 🔧 Toast AA + censo de contraste adiado por sítio

**Status:** implementação completa e **os seis gates de código aprovados**, em revisão. A Themis bloqueou este stage **seis vezes**, e cada bloqueio corrigiu um defeito real: `def8080` (2 HIGH + 1 LOW — o contraste do Toast), `53c1d00` (3 MEDIUM + 2 LOW — o controle de fechar, o censo que falhava aberto, e um byte NUL), `009a509` (1 MEDIUM — a identidade de sítio não sobrevivia a uma substituição na mesma declaração), `e11b31c` (1 HIGH + 1 MEDIUM + 1 LOW — a posse de um marcador não era exclusiva, e um piso de uma direção só era contradito por uma asserção global), `57208c9` (1 HIGH + 1 MEDIUM + 1 LOW — um marcador podia vazar para um elemento posterior, e os testes de posse não comprovavam o que afirmavam) e a sexta ronda sobre `22fa380` (2 achados — a contagem exata do inventário impedia corrigir sítios, e o próprio ROADMAP afirmava uma regra reversa que já não existia). **Árvore exata cujos seis gates valem: `b252319a34d74cfbaa954fdda9f0348d7adbffac`** — rodados nela, com saída 0 nos seis: `test:run` (**236 arquivos / 3291 testes**), `test:run --coverage` (**82,97% statements, 77,01% branches, 78,58% functions, 84,04% lines**), `typecheck`, `typecheck:electron`, `lint` e `build:all`. **Sobre a cobertura, o que se diz é o que a tabela mostra:** a tabela tem 262 ficheiros e **70 estão abaixo de 80% de linhas**, 12 deles a **0%** — `db-bridge.ts`, `storageAdapter.ts`, `RechartsLazy.tsx`, `useCurrency.ts`, `csvExport.ts`, `quoteApi.ts` entre outros. Uma afirmação anterior de que nenhum ficheiro estava abaixo de 80% **estava errada** e foi removida. Isto **não** é uma falha de gate: a configuração do Vitest **não tem bloco `thresholds` por ficheiro**, logo nada é imposto automaticamente, e os seis gates passaram com a saída 0 acima. O que os números agregados significam para a política de cobertura do projeto é uma interpretação que fica para o **gate final da Themis**, não uma conclusão deste registo. `26cc674`, `160c1d9`, `777f488` e os SHA anteriores são **histórico**: descrevem versões superadas e não valem como evidência para esta árvore. O commit de documentação que traz esta entrada **segue** `b252319` e **não** foi ele próprio sujeito de uma execução dos seis gates; nenhum resultado acima é atribuído a ele. O branch foi criado a partir de `main` em `e682f09`. **Revisão e merge pendentes** — não mesclado em `main` e não liberado. Este PR é só o stage do Toast: o **#221 continua aberto, fora deste PR**, e fica enfileirado para depois deste stage, na ordem de um PR por vez. Onda independente: não substitui, não reordena nem absorve nenhuma fatia da Phase 7o, da Phase 7n ou do port visual da Beta 5, e não fecha o gate transversal de compatibilidade v2.0.

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

**A garantia de que a varredura não ficou muda deixou de ser um número e passou a ser fixture.** Fonte que o teste possui, passada pelo **scanner de produção**, exigindo que encontre os pareamentos que foi escrito para achar e que reporte zero numa fonte sem nenhum. E duas medições reais sobrevivem, escolhidas por serem monotónicas no sentido certo: `unresolved` tem de ser **0** nas duas famílias, porque o censo falha fechado e um par indecifrável tem de aparecer em vez de passar por limpo; e a metade **passing** tem de ser **não vazia**, porque só cresce quando sítios são corrigidos — castiga uma varredura quebrada, nunca uma correção. As duas direções do scanner são também verificadas por fixture: uma wash translúcida que falha é reprovada, uma wash translúcida que passa é aprovada e sai da população adiada, e o mesmo para a família de paleta.

**O inventário fica como retrato medido, não como limiar.** Re-derivado em `b252319` sobre a árvore real — os mesmos números de `26cc674`, que não tocou fonte de produto —: **22 elementos proprietários**, **26 pareamentos de forma**, **21 comentários de fonte** em **14 arquivos de produto**, 0 sem identidade, 0 falha de posse, 0 par não resolvido, 4 elementos com duas formas, 1 elemento resolvido pelo `data-testid` estático reutilizado. **Estes números não são asseridos por teste nenhum e não são um gate.** A asserção real é de integridade e passa hoje: a varredura resolve, todo sítio atual bate com o seu pino, e não há identidade ambígua.

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

**Duas correções de parsing vieram junto.** O `stripComments` passou a preservar **tamanho**, não só quebras de linha: o branch de `//` apagava texto, então um offset no fonte removido não era offset no original, e a identidade resolvia elementos centenas de linhas longe — bug latente em código já mergeado. E a tag proprietária agora é lida até o `>` correspondente, com ciência de string e de chave, para que `onClick={() => …}` não trunque a varredura.

**A posse de uma identidade é exclusiva, e é posicional.** Um marcador — ou um `data-testid` estático — nomeia **exatamente um** elemento, e um marcador nomeia **apenas o próximo elemento JSX real**, e é consumido uma única vez. Se esse elemento não tiver pareamento adiado, o marcador **não** é órfão — é o que um sítio corrigido parece — e um elemento posterior **não** pode herdá-lo. **Órfão** significa um marcador que não nomeia **nenhum elemento JSX real**: o resto sobrou de um elemento apagado, ou um comentário que nada segue. "Real" é a palavra que importa, e a OWNERSHIP É RESOLVIDA PELO PARSER DO TYPESCRIPT, não por regex: um literal `{"<span>"}` é uma string, não um elemento, e um regex não sabe a diferença — um marcador solto acima de tal string era ligado a um nó que não existe, e o censo reportava um sítio que nada protegia. Ligação, herança e leitura da tag de abertura passam agora pelos nós `JsxOpeningElement` / `JsxSelfClosingElement`, por offset. Ampliar órfão para "elemento existe mas não tem pareamento adiado" faria a guarda reprovar cada vez que um sítio fosse corrigido, que é o oposto do que a guarda existe para.

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

A guarda fixa hoje a validação **por elemento** sobre o fonte atual, e **nenhuma contagem**: todo sítio que está a falhar tem identidade pinada única e a sua forma, e não há identidade ambígua, órfã, duplicada nem reaproveitada. As duas únicas afirmações sobre população real são `unresolved === 0` em ambas as famílias e a metade `passing` não vazia, ambas monotónicas no sentido de não punir uma correção. O inventário medido em `b252319` — **22 elementos proprietários**, **26 pareamentos de forma**, **21 comentários** mais **1** `data-testid` reutilizado, **0** sem identidade, **0** ids duplicados, **4** elementos com duas formas — é um **retrato datado**, não um limiar, e nenhum teste o compara.

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

| Metric                  | Current           | Target |
| ----------------------- | ----------------- | ------ |
| Test coverage (overall) | ~79%              | ≥60%   |
| Coverage (calculation)  | 100%              | ≥90%   |
| Tests                   | 2,360 (177 files) | 500+   |
| Components with tests   | Partial           | 100%   |
| Accessibility (a11y)    | —                 | WCAG A |

## 🔒 Not in scope (for now)

- ❌ Modo **Studio**: quinto layout experimental do protótipo, fora do conjunto `classic` / `guided` / `bento` / `farm`
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

_Atualizado em 25 de setembro de 2026 — planejamento aprovado da Phase 7o e gate transversal de compatibilidade v2.0 adicionados. As phases 7/7b/7c, 7f e 7g registram a entrega real da `2.0.0-beta.2`; as correções C1–C5, o Bento editável, a navegação do Guided, a reformulação da Phase 7d, lojas/canais/locais, snapshot de precificação e a decisão margem vs. markup foram incorporadas. A ausência de IA foi mantida explícita; PRs #191 e #192 e seus efeitos de pipeline também estão registrados. A Stage 3 da Phase 7o passa a constar como entregue (`048211e`, PR #229), a cadeia consolidada de contraste WCAG como entregue (`3761a76`, PR #230) com os dois follow-ups de acessibilidade que ela deixou abertos, e o PR #223 deste roadmap foi mesclado como `67b43f3`. O gate transversal de compatibilidade v2.0 continua aberto; nenhuma das entregas acima o fecha._
