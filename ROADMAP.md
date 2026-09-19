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

---

## 📊 Quality Metrics

| Metric                  | Current | Target |
| ----------------------- | ------- | ------ |
| Test coverage (overall) | ~33%    | ≥60%   |
| Coverage (calculation)  | ~85%    | ≥90%   |
| Tests                   | 417     | 500+   |
| Components with tests   | Partial | 100%   |
| Accessibility (a11y)    | —       | WCAG A |

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

_Updated 18 September 2026 — Phase 6 added after benchmarking Creative3DP Tools. This roadmap is alive and changes based on user feedback._
