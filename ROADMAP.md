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
- Recharts 2 already configured
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
- [ ] Separate `PrinterProfile` from `PrinterInstance`.
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

**Status em `2.0.0-beta.1` (PRs #182–#192):** parcial. A base de layouts, o shell da aplicação, o Inspetor Financeiro e o wizard foram entregues; o Bento Grid e o seletor de layout ainda não estavam acessíveis na beta.

**Entregue:**

- [x] `layoutStore` com os modos `classic`, `guided` e `bento`, com persistência local.
- [x] `AppShell` extraído para Concentrar o ponto de troca da superfície de cálculo.
- [x] Inspetor Financeiro como refactor behavior-preserving do `ResultsPanel`: cálculos mantidos no hook e apresentação em 8 cards.
- [x] Wizard progressivo de 4 passos (`GuidedWizard`).
- [x] SPEC-01 na versão 1.4, com três chaves de dados `ui_preference`, incluindo a chave de layout.

**Pendente:**

- [ ] Bento Grid: não implementado; o modo `bento` cai em `ClassicSurface` com `TODO(W3)`.
- [ ] `LayoutSwitcher`: ausente na beta; a correção pertence à onda A1, ainda não lançada na beta.
- [ ] Guia de Perfis para associar persona a layout e `calcLevel`.
- [ ] Estados vazios e feedback visual completos para as novas superfícies.
- [ ] Bento cards responsivos nos breakpoints existentes.

**Acceptance criteria:**

- [ ] Os três layouts renderizam os mesmos resultados de cálculo.
- [ ] Trocas de layout nunca entram no undo stack nem tornam o cálculo pendente.
- [ ] O wizard pode ser pulado ou dispensado em qualquer etapa; a calculadora permanece utilizável sem ele.
- [x] A chave de layout aparece no manifesto SPEC-01.
- [ ] A chave de layout está incluída na limpeza de dados e nos testes de regressão de privacidade.
- [ ] Os testes existentes continuam passando e as novas superfícies têm testes RTL.

---

### 💰 Phase 7b: Multi-Network Quotes, Marketplace Profit Comparison & Suggested Price

**Status em `2.0.0-beta.1`:** parcial. As três bibliotecas puras foram entregues; as interfaces de usuário permanecem pendentes.

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

**Acceptance criteria:**

- [ ] O compartilhamento funciona sem chamadas de rede na geração e sem deep links não documentados.
- [ ] As libs permanecem puras, seguras para NaN e sem Infinity; metas inviáveis são explicadas à pessoa usuária.
- [ ] O teste de paridade preserva a fórmula da calculadora até a centavo.
- [x] `src/shared/lib/calculator.ts` não foi alterado.
- [ ] As libs mantêm cobertura ≥90% e as interfaces, quando entregues, terão testes RTL, navegação por teclado e WCAG AA.
- [ ] A checklist de LGPD e os testes de regressão de privacidade passam para cada nova chave.

---

### 🎨 Phase 7c: Visual Catalogs (Printers & Marketplaces)

**Status em `2.0.0-beta.1`:** parcial. Os selects passaram a exibir thumbnails e o catálogo de impressoras recebeu enriquecimento técnico; a arte própria dos fallbacks e a modernização completa do `CatalogTab` continuam pendentes.

**Entregue:**

- [x] Thumbnails nos selects, com o caminho visual já existente em `Select`.
- [x] Dados técnicos de 103 impressoras enriquecidos com atribuição CC-BY-4.0.

**Pendente:**

- [ ] Ilustrações próprias `fallback-fdm.svg` e `fallback-resin.svg`.
- [ ] Preenchimento das imagens ausentes do catálogo sem imagens quebradas.
- [ ] Arte própria para marketplaces, sem uso de logotipos registrados.
- [ ] Reescrita dos cards de `CatalogTab` com thumbnails, badges de tecnologia, arte de marketplace e busca textual.

**Acceptance criteria:**

- [ ] Nenhuma entrada do catálogo renderiza uma imagem quebrada.
- [ ] Nenhuma foto de fabricante ou logotipo registrado entra no repositório sem permissão documentada.
- [ ] Os assets de `public/` permanecem fora do bundle JavaScript e sob carregamento tardio.
- [ ] Os dados do catálogo permanecem sem PII e as chaves de catálogo do SPEC-01 não mudam.
- [ ] Todos os rótulos novos existem em pt-BR e en-US; thumbnails são decorativas ou têm texto alternativo.

### 🔎 Achados técnicos da `2.0.0-beta.1`

- **Ausência de seletor de layout na interface:** o `GuidedWizard` existia e funcionava, mas nenhum componente chamava `setLayoutMode`; portanto, o modo guiado era inalcançável pela interface. A correção foi integrada à onda A1.
- **Teste flaky de foco no Wiki** (`WikiPage.test.tsx`): falhava em cerca de 5% das execuções. A causa raiz era o uso de `useEffect` (fase passiva) em vez de `useLayoutEffect` no foco entre artigos; era um bug real de acessibilidade, não uma instabilidade artificial do teste. Corrigido em `f366726`.
- **Duplicação de inventário:** “Filamentos” e “Carretéis” apresentavam o mesmo array. O `spoolStore` é o owner único de `open3dcalc_filaments`; `filamentInventory.ts` é um shim. Não havia bug de dados, mas havia confusão de UX e ausência de deduplicação.

---

### 🏭 Phase 7d: Gestão de Frota & Parque de Impressoras

**Status:** planejada. Esta fase introduz dados operacionais da oficina e depende de uma nova entidade, um novo store e uma nova chave no manifesto SPEC-01.

**KPIs de frota:**

- [ ] Máquinas na oficina: total e quantas estão imprimindo.
- [ ] Capital em equipamentos: valor contábil de aquisição.
- [ ] Horas totais rodadas, com histórico acumulado.
- [ ] Saúde operacional: percentual da frota pronta para produzir e contagem de máquinas em manutenção.

**Entidade `FleetMachine`:**

- [ ] Identificação: marca, modelo e tecnologia FDM/RESINA.
- [ ] Bico (`nozzleDiameterMm`), potência (`powerW`) e volume útil (`buildVolumeMm`), reaproveitando o tipo que já existe em `src/shared/lib/printers.ts`.
- [ ] Preço de aquisição e data de aquisição.
- [ ] Vida útil estimada em horas e horas já consumidas.
- [ ] Custo de manutenção por hora.
- [ ] Status: `printing`, `available`, `maintenance` ou `idle`.
- [ ] Trabalho em execução com nome e progresso, por exemplo “Camada 180/420”.
- [ ] Motivo de parada quando a máquina estiver em manutenção.

**Custos e integração com a calculadora:**

- [ ] Depreciação contábil por hora = preço de aquisição ÷ vida útil estimada em horas. Este é um cálculo novo e não deve alterar `src/shared/lib/calculator.ts`, que é intocável por contrato.
- [ ] A depreciação entra como parâmetro de entrada no orçamento ativo, no mesmo padrão dos demais custos de máquina.
- [ ] Ação **Usar no Cálculo Atual** para aplicar potência, depreciação por hora e manutenção por hora. A impressora selecionada recebe contorno roxo como indicador visual.
- [ ] Modal de cadastro para máquinas fora do catálogo, com depreciação calculada a partir do preço pago e da vida útil estimada.
- [ ] Barra de vida útil consumida, por exemplo “1240h de 4000h — 31%”, com transição de cor por proximidade do fim da vida útil.
- [ ] Badge **Dados Reais & Telemetria** e sinalização da impressora em uso na calculadora.

**Privacidade e dependências obrigatórias:**

- [ ] Status e horas são declarados pela pessoa usuária e mantidos local-first. Não haverá integração com API de fabricante nem qualquer telemetria externa nesta fase.
- [ ] Definir a nova entidade `FleetMachine` e seu store próprio.
- [ ] Adicionar uma chave nova ao SPEC-01. A classe de dados precisa ser definida antes da implementação; `user_content` é a hipótese mais provável.
- [ ] Incluir a chave, os dados da frota e seus backups na exportação, exclusão e regressão de privacidade.

**Acceptance criteria:**

- [ ] Os KPIs são calculados exclusivamente a partir dos registros locais declarados pela pessoa usuária.
- [ ] A depreciação por hora é exibida e aplicada sem modificar `src/shared/lib/calculator.ts`.
- [ ] A máquina selecionada no cálculo é identificável visualmente e pode ser removida da seleção.
- [ ] A implementação é bloqueada até a classe de dados e o tratamento de privacidade da nova chave do SPEC-01 estarem aprovados.

---

### 🏗️ Phase 7e: Modo Farm (par. print farms)

**Status:** escopo definido; Farm é o quarto modo do seletor. **Depende da Phase 7d — Gestão de Frota & Parque de Impressoras:** o modo só pode existir depois dessa fase, pois exibe dados da frota.

**Contexto:** o modo Clássico se rotula “Desktop Pro / alta densidade para fazendas 3D”, mas não existe um modo de verdade para operar múltiplas impressoras.

**Escopo do modo Farm:**

- [ ] Apresentar a frota: quantas máquinas existem, o que está rodando, o que está livre e o que está em manutenção.
- [ ] Permitir atribuir trabalho por máquina.
- [ ] Mostrar a capacidade da oficina em horas disponíveis versus horas demandadas.
- [ ] Usar densidade alta e manter o painel da frota sempre visível.

**Decisão tomada:** Farm é o quarto modo do seletor. O tipo `LayoutMode` e o `layoutStore` passam a ter quatro valores: `classic | guided | bento | farm`. A implementação implica atualizar o tipo `LayoutMode`, o `layoutStore`, o `CalculatorSurface` (case `farm` → `FarmSurface`) e o `LayoutSwitcher` (4 botões).

**Acceptance criteria:**

- [ ] O painel de frota e a capacidade da oficina usam os dados locais da Phase 7d, sem API de fabricante.
- [ ] A relação entre trabalho atribuído e capacidade disponível é atualizada sem ambiguidade.
- [ ] A implementação só introduz o modo Farm depois que os dados locais da Phase 7d estão disponíveis.

---

### 🧵 Phase 7f: Estante de Filamento — unificação do inventário

**Status:** visual da Estante de Carretéis entregue na beta; unificação de inventário planejada.

**Decisão de produto:** haverá uma aba somente, chamada **Estante de Filamento** / **Filament Shelf**. A Estante de Filamento é o trabalho já feito no `SpoolShelf`, mantido e refinado — não uma tela nova do zero: o grid, a busca e a ordenação existentes são a base. A diretriz de execução é incorporar layout, ícones Lucide (sem emoji) e filtros melhores, além dos cálculos e dados que faltam: tara, peso líquido, metros restantes e cobertura da peça.

**Implementação:**

- [x] Grid, busca, filtros e ordenação do `SpoolShelf` entregues na beta.
- [ ] Substituir as abas duplicadas “Filamentos” e “Carretéis” pela Estante unificada.
- [ ] Não exibir aviso genérico de duplicidade. A ação ao usar um material no cálculo deve oferecer **Adicionar à Estante** com peso e custo pré-preenchidos.
- [ ] Quando já existir filamento compatível, oferecer **usar o existente** em vez de duplicar o registro.
- [ ] Exibir rótulos explícitos para peso bruto, que é o valor mostrado pela balança e inclui o carretel, e peso líquido, calculado como bruto menos a tara. A distinção evita que um carretel completo pareça não estar em 100%.
- [ ] Adotar uma única regra de baixo estoque: `status === "in_stock" && weightGrams < threshold`. Contador e badge passam a usar a mesma condição.
- [ ] Tornar o padrão de grid, busca, filtros e ordenação da Estante a referência para modernizar os demais layouts.

**Acceptance criteria:**

- [ ] Não existem dois caminhos de edição para o mesmo inventário.
- [ ] Peso bruto e peso líquido são legíveis em todos os pontos da interface que exibem massa.
- [ ] A oferta de material existente não cria uma duplicata sem ação explícita da pessoa usuária.
- [ ] A regra de baixo estoque é coberta por teste e o contador coincide com o badge.

---

### ⚡ Phase 7g: Presets estáticos de calculadora (sem IA)

**Status:** planejada. São três cenários demonstrativos estáticos; não usam IA, backend ou serviço externo.

**Cenários:**

- [ ] Vaso Espiral Geométrico — 140g, PLA Silk.
- [ ] Suporte Reforçado de Guidão para GoPro — 48g, PETG.
- [ ] Estatueta Colecionável RPG/Dragão — Resina UV 8K.
- [ ] Botão **Preencher Calculadora com esses Dados** para carregar cada cenário.

**Fora desta fase:** as abas Consultor de Risco & Margem, WhatsApp Pitch e Visão Multimodal do protótipo dependem de backend e foram explicitamente adiadas. Nenhuma delas é requisito dos presets estáticos ou da V2.0.

**Acceptance criteria:**

- [ ] Os valores de cada cenário são determinísticos e podem ser revisados como dados versionados no código.
- [ ] O botão substitui somente os campos do cenário e deixa claro que os dados podem ser editáveis.
- [ ] A funcionalidade funciona offline, sem chamadas de rede ou consentimento de IA.

---

### ⏸️ Deferred: Optional AI (out of V2.0)

As abas **Consultor de Risco & Margem**, **WhatsApp Pitch** e **Visão Multimodal**, a estimativa por foto e os recursos BYOK de análise textual e geração assistida de pitch dependem de backend ou de uma política de IA e foram explicitamente adiados para uma versão futura. Eles ficam fora da V2.0, desligados por padrão e sujeitos aos conselhos de privacidade, a um ADR e a uma política de consentimento separada. Nenhuma das fases acima depende deles.

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

- ❌ Modo **Studio**: quarto layout experimental do protótipo, fora da tríade `classic` / `guided` / `bento`
- ❌ Abas de IA: Consultor de Risco & Margem, WhatsApp Pitch e Visão Multimodal (ver Deferred: Optional AI)
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

_Updated 23 September 2026 — V2.0 phases 7/7b/7c now record the actual `2.0.0-beta.1` delivery state (PRs #182–#192), including the pure-library-only state of Phase 7b and the pending UI work. Added Phase 7d fleet management, Phase 7e Farm mode, Phase 7f unified Filament Shelf and Phase 7g static presets. The out-of-scope list and the optional BYOK AI deferral are explicit._
