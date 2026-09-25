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

| Domínio | Cobertura no Clássico | Cobertura atual no Bento |
| --- | --- | --- |
| Material | Tipo, peso, custo, densidade, purga, eficiência do carretel, seleção de carretel, volume e custo por litro | Apenas resumo |
| Falhas | Modo, valor e multiplicador | Apenas custo |
| Vendas | Quantidade, infill, extras, embalagem, frete, marketplace, imposto, margem/markup e presets | Apenas exibição |
| Custos fixos, mão de obra, hardware/acabamento, operações/PPE e software | Campos no Clássico | Resumo parcial; o restante é omitido |

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

#### M1 — Honestidade imediata *(entra na beta 3)*

- [ ] Exibir aviso de que o custo de material multi-material não entra no total, no preço nem no lucro.
- [ ] Corrigir o furo que transforma um array de materiais vazio em custo zero; o caso inválido precisa ser explícito, não um total silenciosamente incorreto.
- [ ] Usar o rótulo neutro **Multi-material**, em vez de “AMS”, em qualquer aviso ou cálculo que apresente esse recurso como suporte a um único sistema.
- [ ] Fazer `roundCurrency` usar arredondamento *fail-high* (para cima), sem subestimar o preço ao arredondar valores monetários.

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

#### N0 — Frota de ativos e registro de horas _(pré-requisito duro)_

**Status:** pré-requisito de N2, N3 e N4.

**Problema:** nenhuma análise de rentabilidade por máquina é possível hoje porque **não existe registro de frota própria**. O que existe é um catálogo de produtos, não o que a pessoa usuária possui:

- `src/shared/lib/printers.ts:10` é um array estático de ~80+ especificações de produto. Não é frota.
- `PrinterProfile` (`src/shared/types/index.ts:36-58`) tem 14 campos e **nenhum** deles é `purchasePrice`, `acquisitionDate`, `status` ou qualquer campo de capacidade, ocupação ou horas.
- `selectedPrinterId` (`types/index.ts:359`) é uma string opaca que aponta para o catálogo.
- Busca por `hourMeter`, `acquisitionDate`, `purchasePrice`, `acquisitionCost` e `PrinterAsset` em `*.ts`/`*.tsx`/`/*.css` retorna **zero matches**. **Não existe log de horas por impressora em lugar nenhum do repositório.**

Sem preço de aquisição e sem horas, "quanto falta para amortizar" e "quanto essa máquina rende por mês" não são cálculos: são fiction. Por isso N0 é pré-requisito, não item paralelo.

**O que precisa ser feito:**

- [ ] Store persistido de frota própria, separado do catálogo: preço de aquisição, data de aquisição, status operacional e vínculo com o `profileId`.
- [ ] Registro de horas/uso por impressora, com origem declarada: digitada pela pessoa usuária ou derivada do histórico. **Derivada é estimativa, não medição** — a origem precisa ser um campo, não uma suposição implícita.
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

**Status:** decisão de domínio fechada — pertence à entidade **`Quote`**, na aba de orçamentos. **Não** pertence ao `HistoryEntry`. Implementação pendente.

**O que é:** checkbox por linha no modo tabela e por card no modo grid; checkbox mestre no cabeçalho da tabela com estado **indeterminado** (tri-state) que seleciona ou desseleciona **apenas os itens já filtrados**, nunca a lista inteira; realce visual dos selecionados; barra de ação em lote com contador dinâmico; botões de ação rápida aplicando um status a todos os selecionados de uma vez; comparação lado a lado **habilitada automaticamente quando exatamente 2** estiverem selecionados; exportação CSV somente dos selecionados; exclusão em lote com confirmação de segurança; confirmação imediata por toast.

**Estados:** Aprovado, Em Produção, Concluído, Cancelado.

**Dados e estado de que depende:**

- `Quote.status` — `types/quote.ts:26` — `'draft' | 'sent' | 'approved' | 'rejected'`
- `QuoteStore.statusFilter` — `quoteStore.ts:14` — `"all" | "draft" | "sent" | "approved" | "rejected"`
- `QuoteStore.setQuoteStatus` — declarado em `quoteStore.ts:21`, implementado em `quoteStore.ts:127-133`
- Persistência — `quoteStore.ts:212-216` — `name: "open3dcalc_quotes_v1"`, `version: 1`

**Esta é uma mudança de modelo persistido, não uma feature de UI.** Exige bump de `version` e caminho de normalização em leitura e em import.

**Conflito de eixo a resolver antes de codar:** os quatro status pedidos são um **ciclo de produção**. O union atual é um **ciclo de negociação comercial**. Os dois se sobrepõem em dois pontos: `approved` já é "Aprovado" e `rejected` já é "não". Expandir literalmente o union cria **duas formas de dizer a mesma coisa**. A decisão é de modelo, não de layout: ou `rejected` colapsa em `cancelled`, ou os dois eixos passam a ser campos separados (`dealStatus` + `productionStatus`) em vez de um union só. **Aberto — decisão pendente do usuário.**

**Normalização de import (obrigatória):** `importQuotes` (`quoteStore.ts:171-210`) hoje faz cast cego `e as Quote` na linha 192 e deduplica apenas por `id`. Um payload exportado por versão anterior, ou editado à mão, entra com qualquer string em `status`. Ampliar o union sem normalizar aqui importa lixo para dentro do modelo.

**Não-objetivos:**

- ❌ Seleção em lote no `HistoryEntry`. Decidido: a entidade é `Quote`.
- ❌ Ações em lote de edição de conteúdo (não é edição em massa de itens, valores ou margens — é status).
- ❌ Undo/redo em lote além do que o store já garante. O histórico de undo é do `calculatorStore`, não do `quoteStore`.
- ❌ Seleção persistente entre sessões. A seleção é estado de sessão, não dado persistido.

**Acceptance criteria:**

- [ ] O checkbox mestre reflete tri-state: marcado, desmarcado, indeterminado — e o indeterminado aparece quando a seleção é parcial.
- [ ] Com um filtro de status ativo, "selecionar todos" seleciona **exatamente** o conjunto filtrado, e o teste prova isso filtrando o store antes de agir.
- [ ] Selecionar e deselecionar todos não altera a seleção de itens que estavam fora do filtro.
- [ ] A comparação lado a lado só aparece com **exatamente** 2 selecionados, e some com 1 ou com 3.
- [ ] O CSV exportado contém **somente** os selecionados, e o teste compara a contagem de linhas com o contador da barra de ação.
- [ ] A exclusão em lote exige confirmação que **nomeia a quantidade** a ser excluída.
- [ ] Um payload de import com `status` desconhecido é normalizado, e o teste prova que o payload entra no store com valor válido.
- [ ] Um orçamento persistido antes do bump de `version` continua legível e aparece com status válido.
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

**Não-objetivos:**

- ❌ Previsão com modelo de série temporal, tendência ou machine learning. É multiplicação declarada, não previsão.
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

- **Pré-requisito duro: N0.** Sem preço de aquisição (`PrinterProfile` não tem o campo), sem data de aquisição e sem log de horas (zero matches no repositório), não há o que amortizar.
- `usefulLife` **não é um input da pessoa usuária.** Ver N0. Se a amortização reta usar esse valor, o número é derivado de uma premissa do autor do catálogo (`printers.ts:7-8`) e precisa aparecer na interface como tal.
- Existe break-even **parcial** hoje: `Dashboard.tsx:139-157` já calcula `breakEvenUnits` e `breakEvenRevenue`, mas a partir de `fixedCosts.monthlyCost` — **não** do preço de uma impressora. `buyPrice` é um input avulso de dashboard persistido em `open3dcalc_dashboard_v1` (`Dashboard.tsx:34`, `46-62`).

**Não-objetivos:**

- ❌ Contabilidade fiscal, DRE, depreciação acelerada, valor residual ou método de cotação. Reta simples basta.
- ❌ Reimplementar o break-even de custo fixo que já existe. Esta frente **estende** o existente para o eixo máquina.
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

**Tokens — não propõe paleta nova.** Os seis tokens categóricos já existem em `src/styles/tokens.css`:

- `--cost-filament` (`:65` claro, `:139` escuro)
- `--cost-energy` (`:66` / `:140`)
- `--cost-machine` (`:67` / `:141`)
- `--cost-labor` (`:68` / `:142`)
- `--cost-failure` (`:69` / `:143`)
- `--cost-other` (`:70` / `:144`)

Aliados como `--color-cost-*` em `:241-246`. A análise por material reutiliza esses tokens; a análise por impressora precisa de uma escala **derivada** de token, nunca de cor hardcoded.

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

**A biblioteca já está no projeto — não há decisão de dependência a tomar.** `recharts` já é dependência de produção em `package.json:52` (`^3.10.1`), e `src/shared/components/Dashboard/RechartsLazy.tsx:1-31` já reexporta `AreaChart`, `Area`, `BarChart`, `Bar`, `PieChart`, `Cell`, `ResponsiveContainer`, `Tooltip`, `Legend`, `CartesianGrid`, `XAxis`, `YAxis`. Este item **estende um barrel existente**; não adiciona bundle, não introduz dependência nova e não abre discussão de licença.

**Dados e estado de que depende:** `HistoryEntry.timestamp` e `sellPrice` para o histórico realizado; a projeção usa a mesma base de N2. Gráfico de **projeção** é o rótulo honesto — os meses passados são medidos, os futuros não.

**Não-objetivos:**

- ❌ Adicionar biblioteca de gráfico. Recharts já está lá.
- ❌ Série temporal contínua, granularidade diária/semanal, ou drill-down por impressora.
- ❌ Previsão com tendência projetada para frente. O gráfico mostra 6 meses; ele não extrapola.
- ❌ Animação de entrada como informação. A classe do movimento já respeita `prefers-reduced-motion`.

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
- [ ] Uma projeção de faturamento **sem a premissa de ocupação visível** repete, em contexto financeiro, uma falha que já aconteceu no protótipo descartado: o `AIAssistantModal.tsx` declarava um estado `analysisError` na linha 53, o renderizava na linha 327, e **nunca o atribuía** no bloco `catch` (linhas 105-111) — cenário simulado entregue silenciosamente como análise real.
- [ ] Uma barra de progresso que enche sem indicar de onde veio o número é publicidade, não interface.

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

N1  Seleção em lote (Quote)   ── independente, não espera N0
N5  Profit Analytics          ── independente, não espera N0
N6  Revenue Trends            ── independente, não espera N0
```

**Leitura da ordem:**

- **N0 primeiro, sem exceção.** N2, N3 e N4 não são três widgets esperando polimento: são três leituras de dados que não existem. Começar por qualquer um deles entrega tela com número inventado — que é exatamente a falha que N7 existe para impedir.
- **N1, N5 e N6 podem andar em paralelo** e não dependem de N0. N5 e N6 leem o histórico, que já existe. N1 mexe em `Quote`, outro domínio.
- **N6 é o de menor risco da lista** — a biblioteca já está no projeto e o dado já existe. Se algo for decidido para sair rápido, é N6.
- **N3 é o de maior risco.** Depende de N0, depende da reconciliação de unidade de `usefulLife`, e toca um número financeiro. Se N0 demorar, N3 espera; não se contorna.

**Dependências de roadmap, não só técnicas:** N0 depende da **Phase 7d** (`ROADMAP.md:426`). N1 toca a entidade `Quote` e tangencia a **Phase 7l** (snapshot imutável, `ROADMAP.md:674`) — um orçamento com snapshot não deve ser reescrito por status em lote sem que as duas fases concordem sobre o que é fato e o que é estado.

**Acceptance criteria (transversal às seis frentes):**

- [ ] Nenhuma tela de N1–N6 exibe número financeiro sem premissa visível na mesma tela.
- [ ] Nenhuma notificação automática dispara a partir de dado não fornecido pela pessoa usuária.
- [ ] Toda etiqueta nova existe em **pt-BR e en-US**, com paridade verificada.
- [ ] Cobertura: componentes novos ≥ 80%, libs de cálculo ≥ 90%.
- [ ] WCAG AA, com `prefers-reduced-motion` respeitado em todo gráfico e barra animada.
- [ ] A checklist de LGPD e os testes de regressão de privacidade passam para cada chave nova.

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

_Atualizado em 24 de setembro de 2026 — as phases 7/7b/7c, 7f e 7g registram a entrega real da `2.0.0-beta.2`; as correções C1–C5, o Bento editável, a navegação do Guided, a reformulação da Phase 7d, lojas/canais/locais, snapshot de precificação e a decisão margem vs. markup foram incorporadas. A ausência de IA foi mantida explícita; PRs #191 e #192 e seus efeitos de pipeline também estão registrados._
