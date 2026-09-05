# Changelog

## v1.11.0

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.10.0...v1.11.0)

### 🚀 Enhancements

- **sync:** Add text label to DataSyncButton for better visibility ([a6da01d](https://github.com/ils15/open3dcalc/commit/a6da01d))
- UI/UX improvements — STL support estimation, Resin preview, safety fixes ([#57](https://github.com/ils15/open3dcalc/pull/57))
- **calc:** Exibe lucro por hora (profit/hr) FDM+Resina ([#77](https://github.com/ils15/open3dcalc/pull/77))
- **products:** Cadastro produtos + vendido + CSV + sync ([#78](https://github.com/ils15/open3dcalc/pull/78))

### 🩹 Fixes

- **ci:** Remove v1.10.0 exclusion and sync changelog ([7794266](https://github.com/ils15/open3dcalc/commit/7794266))
- **dashboard:** Replace React.lazy with static recharts imports to fix #7463 crash ([#7463](https://github.com/ils15/open3dcalc/issues/7463))
- **3mf:** Segue p:path da production extension e corrige volume 3x maior ([#72](https://github.com/ils15/open3dcalc/pull/72))
- **estimators:** Casca por area de superficie e fisica da extrusao no… ([#73](https://github.com/ils15/open3dcalc/pull/73))
- **release:** Windows exe + auto-update resiliente ([#76](https://github.com/ils15/open3dcalc/pull/76))
- **release:** Join --body into single quoted string in release PR step ([#79](https://github.com/ils15/open3dcalc/pull/79))

### ✅ Tests

- Increase ChangelogPage test timeout to 15s for CI stability ([1bee06d](https://github.com/ils15/open3dcalc/commit/1bee06d))

### 🤖 CI

- Split quality into checks+test and run on fork PRs ([#74](https://github.com/ils15/open3dcalc/pull/74))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))
- Lupolima <lucasguilherme_@hotmail.com>

## v1.10.0

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.9.3...v1.10.0)

### 🚀 Enhancements

- **sync:** Cross-device data sync via encrypted export/import ([#56](https://github.com/ils15/open3dcalc/pull/56), closes [#55](https://github.com/ils15/open3dcalc/issues/55))
  - AES-256-GCM encryption with PBKDF2 key derivation (browser-native Web Crypto API)
  - Export/import modal with merge/replace modes
  - Header bar button for easy access
  - Full i18n support (PT-BR + EN-US)
  - LGPD-compliant: 100% client-side, zero server transmission

### 🩹 Fixes

- **ci:** Fix npm ci failure — regenerate lock file with missing Windows-only optional deps
- **ci:** Make postinstall (`electron-rebuild`) conditional — skips in CI environments
- **vite:** Resolve CJS interop issues with `use-sync-external-store` and `scheduler`
- **ui:** Resolve recharts infinite loop via i18n `useSuspense: false` workaround ([recharts#7463](https://github.com/recharts/recharts/issues/7463))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))

## v1.9.3

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.9.2...v1.9.3)

### 🚀 Enhancements

- **release:** Deterministic audited English release notes generator (dry-run) ([#26](https://github.com/ils15/open3dcalc/pull/26))
- **stlpreview:** Auto-fit camera, fullscreen overlay and clear model ([#29](https://github.com/ils15/open3dcalc/pull/29))
- **changelog:** Sync in-app changelog automatically on release ([#31](https://github.com/ils15/open3dcalc/pull/31))

### 🩹 Fixes

- **release:** Correct notes generator normalization and nested commit titles ([#27](https://github.com/ils15/open3dcalc/pull/27))
- **release:** Scope notes per tag range with root commit and hardened URLs ([#28](https://github.com/ils15/open3dcalc/pull/28))
- **layout:** Responsive calculator columns for complete mode ([#30](https://github.com/ils15/open3dcalc/pull/30))
- **changelog:** Localize version cards and polish header controls ([#33](https://github.com/ils15/open3dcalc/pull/33))
- **layout:** Results sidebar only with space, portal dropdowns, ultrawide shell ([#34](https://github.com/ils15/open3dcalc/pull/34))
- **gcode:** Não ignora gcode sem TIME header e suporta Prusa/Orca ([#32](https://github.com/ils15/open3dcalc/pull/32), [#51](https://github.com/ils15/open3dcalc/pull/51))

### 🏡 Chore

- **ci:** Pre-commit — gitleaks + guardião .env + AI Bifrost ([9afa29b](https://github.com/ils15/open3dcalc/commit/9afa29b))
- **ci:** Security phase 2 — deepwork CI/CD, pre-commit and scan ([fe56338](https://github.com/ils15/open3dcalc/commit/fe56338))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))

## Unreleased

### 🐛 Bug Fixes

- **gcode:** não ignora gcode sem TIME header e suporta formato Prusa/Orca (closes #32) — remove gate silencioso `if(printTimeMinutes>0)` em `StlPreview.tsx:242`, parser `d/h/m/s` (`1h 23m 45s`/`2d 5h`/`45m 30s`) em `gcodeParser.ts`, `geometry: BufferGeometry | null`, `setGeometry(null)` no branch GCODE, drop zone permanece visível (`!modelInfo?.geometry`), botão 🗑️ `stl.clear` para GCODE, 13 testes novos (7 parser + 6 StlPreview), 893/893 passing, lint/typecheck clean, Themis PASS_WITH_NOTES resolvido

## v1.9.2

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.9.1...v1.9.2)

### 🚀 Enhancements

- **ci:** Add AI code review workflow via Bifrost LLM Gateway ([8287e51](https://github.com/ils15/open3dcalc/commit/8287e51))
- **ci:** Switch AI review to alibaba/open-code-review, fix release artifacts ([#11](https://github.com/ils15/open3dcalc/pull/11))
- CI/CD otimizado — self-hosted runner, husky-only, AI commit review, i18n ([#12](https://github.com/ils15/open3dcalc/pull/12))
- Auto-deduct filament + date filters (Issue #16) ([#17](https://github.com/ils15/open3dcalc/pull/17), [#16](https://github.com/ils15/open3dcalc/issues/16))
- Phase 2+3 — STL & Dashboard optimization (dead code removal, calc integration) ([#20](https://github.com/ils15/open3dcalc/pull/20))

### 🩹 Fixes

- **changelog:** Sort versions by semver + add v1.9.1 entry ([ffc68bb](https://github.com/ils15/open3dcalc/commit/ffc68bb))
- Safety Sprint — security & quality hardening ([#19](https://github.com/ils15/open3dcalc/pull/19))
- **release:** Remove [skip ci] from release commit ([#21](https://github.com/ils15/open3dcalc/pull/21))
- **release:** Push tag only, use release branch + PR for version bump ([#22](https://github.com/ils15/open3dcalc/pull/22))
- **release:** Padronizar pipeline protegido e idempotente ([#23](https://github.com/ils15/open3dcalc/pull/23))

### 🏡 Chore

- Translate missing pt-BR keys, remove stale web/ and desktop/ copies ([cc5b0e9](https://github.com/ils15/open3dcalc/commit/cc5b0e9))

### 🤖 CI

- Remove themis review, add opencode github integration ([#13](https://github.com/ils15/open3dcalc/pull/13))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))

## v1.9.0

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.8.0...v1.9.0)

### 🚀 Enhancements

- **ui:** Usability improvements — tooltips, quick mode labels, tutorial overhaul ([72720a4](https://github.com/ils15/open3dcalc/commit/72720a4))
- **ui:** Accessibility and i18n fixes ([1e30bc0](https://github.com/ils15/open3dcalc/commit/1e30bc0))
- **ui:** Quick Start, Empty States, Scroll, Keyboard Shortcuts ([80c2f29](https://github.com/ils15/open3dcalc/commit/80c2f29))

### 🩹 Fixes

- **release:** Use bash array for artifact upload ([a719447](https://github.com/ils15/open3dcalc/commit/a719447))
- **ui:** Resolve 5 audit bugs — tutorial navigation, H1, touch targets, export ([5b032ca](https://github.com/ils15/open3dcalc/commit/5b032ca))
- **ui:** Tutorial spotlight positioning + remaining touch targets ([5d6b8ae](https://github.com/ils15/open3dcalc/commit/5d6b8ae))
- **ui:** Remaining touch targets in SectionNav + MobileBottomBar ([87e1cd9](https://github.com/ils15/open3dcalc/commit/87e1cd9))
- **ui:** Min-h-[44px] in SectionNav buttons ([d875147](https://github.com/ils15/open3dcalc/commit/d875147))
- Lint error in useKeyboardShortcuts + enforce CI/CD gate in AGENTS.md ([60a72b1](https://github.com/ils15/open3dcalc/commit/60a72b1))
- Type error document.querySelector().click() → cast to HTMLElement ([61ebfab](https://github.com/ils15/open3dcalc/commit/61ebfab))

### 📖 Documentation

- Add RELEASE.md with step-by-step release process ([01d42fb](https://github.com/ils15/open3dcalc/commit/01d42fb))

### 🏡 Chore

- **release:** V1.8.1 [skip ci] ([079945e](https://github.com/ils15/open3dcalc/commit/079945e))
- **release:** V1.8.2 [skip ci] ([7e1508d](https://github.com/ils15/open3dcalc/commit/7e1508d))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))

## v1.8.2

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.8.0...v1.8.2)

### 🩹 Fixes

- **release:** Use bash array for artifact upload ([a719447](https://github.com/ils15/open3dcalc/commit/a719447))

### 🏡 Chore

- **release:** V1.8.1 [skip ci] ([079945e](https://github.com/ils15/open3dcalc/commit/079945e))

### ❤️ Contributors

- Ils15 ([@ils15](https://github.com/ils15))

## v1.8.1

[compare changes](https://github.com/ils15/open3dcalc/compare/v1.8.0...v1.8.1)

## v1.8.0 — Bifrost UI Redesign (2026-06-29)

### 🎨 UI/UX

- Redesign Bifrost: superfícies planas, sem glassmorphism
- Tema claro/escuro no web
- Badges retangulares (6px), border-radius reduzido (14px)
- Sistema de CSS variables unificado

### 🔧 Técnico

- Codebase unificada em monorepo (`src/shared/` + `src/platform/`)
- Git migrado para raiz (história preservada)
- `web/` e `desktop/` mantidos para referência histórica

### ✅ Testes

- 417 testes, 36/36 arquivos passando
- Cobertura >80%

---

Para histórico completo anterior à v1.8.0, veja as [releases no GitHub](https://github.com/ils15/open3dcalc/releases).
