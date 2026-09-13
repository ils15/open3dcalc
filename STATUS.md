# Fase 2 (conclusão) — Model analysis: tech suggestion, comparison, layers

- **Branch/worktree:** `feat/fase2-model-analysis` / `../open3dcalc-f2-roadmap`
- **Status:** implementation complete — local gates green; PR next.
- **Scope:** closes the three remaining Fase 2 roadmap items — automatic FDM vs
  Resin suggestion, multiple-model comparison, and layer (slicing) preview.
  Contract change: SPEC-01 fixture `policy_version` 1.2 → 1.3, registering
  `open3dcalc_model_comparison` (derived_analytics, no PII).
- **Base:** `main` @ `296460f` (v1.12.0 release + #119 changelog fix).

## What landed

- `src/shared/lib/techRecommendation.ts` — documented heuristic model: resin build
  volume is a LIMITATION (big parts score FDM), detail (triangle count/density)
  scores resin, miniature profile (≤80 mm + dense) is the strong resin signal,
  ties default to FDM (cheaper, safer). Output = suggestion + confidence +
  i18n-keyed reasons — informational only, the user stays in control.
- StlPreview — suggestion banner: recommended technology, confidence badge, reason
  list, and an opt-in "switch calculator" button (never auto-switching).
- `src/shared/stores/modelComparison.ts` — comparison store (max 4 entries,
  same-file replacement, persisted via the gated storage; manifest-registered key).
- StlPreview comparison panel — side-by-side table (weight/print time/volume) with
  the heaviest model highlighted and per-row removal.
- StlPreviewCanvas — layer (slicing) preview: a horizontal THREE.Plane clipping
  the model at a user-chosen Z height with a slider (0 = off), `localClippingEnabled`.
- i18n pt-BR/en-US for all new strings; estimation-modes test updated (the layer
  slider is always available; estimation controls still scope-checked).

## Verification

- 1,386 tests across 110 files; typecheck (app + Electron), strict lint, builds.
- Roadmap acceptance: "suggestion is informational, user stays in control" honored;
  no automatic FDM-vs-Resin comparison (roadmap out-of-scope item respected).
