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

**Problem:** The calculator exposes every parameter at once. Beginners drown before they price their first print; power users click through sections they never use. One rigid layout cannot serve both.

**What to investigate first:**

- [ ] Which user persona maps to which layout density (maker hobbyist vs. small shop vs. pro studio)
- [ ] How much of the current `ResultsPanel` (975 lines) can be decomposed without breaking the existing keyboard-shortcut and SectionNav contracts
- [ ] Whether the existing `calcLevel` axis (Quick/Detailed/Complete, already in the store) can be reused as the density axis instead of inventing a new one

**What needs to be done:**

- [ ] Layout engine: `classic` (today's full form), `guided` (step-by-step, sections released progressively), `bento` (compact cards dashboard-style)
- [ ] `layoutStore` — separate from the undo stack (layout switches are NOT calculation changes), persisted under `open3dcalc_layout_v1` (class `ui_preference`, sync never)
- [ ] AppShell refactor: web and desktop `App.tsx` each under ~120 lines, single `CalculatorSurface` switch point
- [ ] Profile Guide (Guia de Perfis): pick a persona → applies (layout, calcLevel) using the existing `calcLevel` axis
- [ ] LayoutSwitcher in the header with live preview
- [ ] Progressive onboarding Wizard: 4 steps, non-blocking, skippable, replaces the current one-shot tutorial
- [ ] `FinancialInspector` — decomposed, focused view of the pricing breakdown (profit, fees, margin, break-even)
- [ ] Informative empty states and visual feedback for actions across the new surfaces
- [ ] Bento cards responsive across the existing breakpoints (640/768/1024/1280px)

**Acceptance criteria:**

- [ ] All three layouts render the SAME calculation results (zero divergence)
- [ ] Layout switches never enter the undo stack and never dirty the calculation
- [ ] Wizard is skippable and dismissable at any step; the calculator is fully usable without it
- [ ] `open3dcalc_layout_v1` appears in the SPEC-01 manifest (policy_version 1.4) and is covered by delete-all and privacy regression tests
- [ ] All existing tests still pass; new surfaces have RTL tests (no snapshot testing)

---

### 💰 Phase 7b: Multi-Network Quotes, Marketplace Profit Comparison & Suggested Price

**Problem:** Pricing a part is only half the job — makers also have to **sell** it. Today the app exports a JSON quote and copies a calculation link, but offers no help for the three questions that decide whether a print is worth running: _How do I post this?_, _Which marketplace pays me the most?_, and _What price should I actually charge?_

**What to investigate first (real capability):**

- [ ] Which social networks offer **official**, key-free sharing web intents (verified: WhatsApp, Telegram, X, e-mail — official; Instagram and Facebook do NOT accept a pre-filled caption, so they get an honest copy-to-clipboard path instead of a fake deep link)
- [ ] How the existing `marketplaces` catalog (Shopee, Mercado Livre, Amazon, Etsy, Direct — with percent + fixed fees) can be compared **without touching the frozen calculation layer**
- [ ] Reuse of `getBulkDiscount` (pure helper) and `reverseFromSellPrice` (pure reverse-pricing) so nothing is rewritten

**What needs to be done:**

- [ ] **Multi-network quote sharing** — `socialShare.ts` pure lib (official web intents + per-network copy templates, pt-BR/en-US), `SocialShareModal` with live preview card, character counters (280 for X, hashtag block for Instagram), `useReducedMotion`-aware success feedback
- [ ] **Marketplace profit comparison** — `compareMarketplaceProfits()` pure lib: same part, net profit ranked across the whole catalog (percent + fixed fees), parity test locked to the real calculator; `MarketplaceComparison` UI (ranked table, best highlighted, delta vs. best, "use this marketplace" writes the existing `marketplaceFeePercent` — calculation layer untouched)
- [ ] **Suggested price tool** — `suggestPrices()` pure lib: target margin %, desired profit per part, desired monthly profit (projections), fee-inclusive break-even, and competitor-price mode (reusing `reverseFromSellPrice`); integrates existing `VolumeDiscount` tiers and already consumes post-`riskMultiplier` cost; `SuggestedPriceTool` UI with scenario cards and an "apply price" action
- [ ] Copy templates and every label in pt-BR + en-US, with explicit "margin over price" vs. "markup over cost" wording
- [ ] Assumptions panel reuse so the fee-fixed vs. fee-percent difference between the comparison and the main calculation is stated, not hidden

**Acceptance criteria:**

- [ ] Sharing works with zero network calls at generation time (the OS/browser opens the intent); no undocumented deep links
- [ ] Comparison and suggested-price libs are pure, NaN-safe, and never return Infinity; infeasible price targets report `feasible: false` with a human explanation
- [ ] Parity test proves the mirrored pricing formula matches the real calculator to the cent; any drift fails CI
- [ ] Calculation layer (`calculator.ts`) is not modified — verified by diff in the PRs
- [ ] Pure libs at ≥90% coverage; UI components RTL-tested, keyboard-navigable, WCAG AA
- [ ] Only `open3dcalc_share_prefs_v1` and `open3dcalc_marketplace_comparison_v1` are added to SPEC-01 (last network id and last marketplace ids — catalog ids only, no message text, no user data); the suggested-price tool is stateless per session
- [ ] LGPD checklist and privacy regression tests pass for every new key

---

### 🎨 Phase 7c: Visual Catalogs (Printers & Marketplaces)

**Problem:** The catalogs are functional but visually flat — 103 printers in a text-only dropdown, 6 marketplaces with no branding, materials without color swatches. The `image` field already exists in `PrinterProfile` and even in the `Select` component's option API, but it is dangling: zero files under `public/images/` and the `<img>` render path was never finished.

**What to investigate first:**

- [ ] Trademark/copyright posture for manufacturer product photos and marketplace logos (verified: brand names in text are nominative fair use; logos and product photos are NOT freely usable — we ship our own SVG art and link out instead)
- [ ] Which manufacturers publish press/media kits with permissive terms for a future "featured" photo subset
- [ ] Whether the `public/` static path behaves identically on web/PWA and Electron

**What needs to be done:**

- [ ] Finish the `Select` render path: render `<img>` when `option.image` is present (keep the monogram as fallback)
- [ ] `public/images/printers/fallback-fdm.svg` + `fallback-resin.svg` — our own illustrations by technology
- [ ] Add `technology: "fdm" | "resin"` to the printer catalog entries (derivable from model families: Photon/Halot/Saturn/Mars/SL1S/Sonic-style names are resin, the rest FDM)
- [ ] Fill the printer entries missing `image` with the fallback path so nothing is ever broken
- [ ] Add `logo?` to `Marketplace` + our own stylized marketplace art (never the trademarked logos)
- [ ] Optional `websiteUrl?` on `PrinterProfile` — an external link the user clicks; the app itself makes zero network calls
- [ ] Rewrite `CatalogTab` cards: printer thumbnails, technology badges, marketplace art, text search

**Acceptance criteria:**

- [ ] Every catalog entry renders a thumbnail (real art or our fallback) with zero broken images
- [ ] No trademarked logo or manufacturer photo ships without documented permission; brand names in text are fine
- [ ] `public/` assets never enter the JS bundle and load lazily (`loading="lazy" decoding="async"`)
- [ ] Catalog data stays code-seeded and non-PII (SPEC-01 catalog keys unchanged)
- [ ] i18n pt-BR/en-US for all new labels; a11y: thumbnails are decorative or carry alt text

---

### ⏸️ Deferred: Optional AI (out of V2.0)

The optional BYOK AI features (text analysis, photo-based estimation, AI-assisted pitch generation) and the PBR skin for `StlPreview` are **deferred to a future major version**. They stay off by default, behind privacy councils, an ADR and a separate consent policy version. Nothing in V2.0 depends on them.

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

_Updated 23 September 2026 — V2.0 phases 7/7b/7c added (adaptive layouts & progressive onboarding, multi-network quotes with marketplace profit comparison and suggested price, visual catalogs); optional BYOK AI deferred to a future major version. Phase 6 was added 18 September 2026 after benchmarking Creative3DP Tools. Quality metrics refreshed from the current suite run. This roadmap is alive and changes based on user feedback._
