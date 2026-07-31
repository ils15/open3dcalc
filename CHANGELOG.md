# Changelog

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
