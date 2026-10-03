# Contributing to Open3DCalc

> Thank you for considering contributing! 🎉 This guide describes the complete workflow for contributing to the project.

## 📋 Table of Contents

- [Contribution Workflow](#contribution-workflow)
- [Before You Start](#before-you-start)
- [Step by Step](#step-by-step)
  1. [Fork + Clone](#1-fork--clone)
  2. [Create Your Branch](#2-create-your-branch)
  3. [Commit (Conventional Commits)](#3-commit-conventional-commits)
  4. [Tests & Lint](#4-tests--lint)
  5. [Open the Pull Request](#5-open-the-pull-request)
  6. [Code Review](#6-code-review)
  7. [Merge](#7-merge)
- [Branch Policy](#branch-policy)
- [Protection Rules (main)](#protection-rules-main)
- [Pull Request Checklist](#pull-request-checklist)
- [Code Review — What We Evaluate](#code-review--what-we-evaluate)
- [Project Structure](#project-structure)
- [Reporting Bugs](#reporting-bugs)
- [Questions](#questions)

---

## Contribution Workflow

Every change to Open3DCalc follows this flow:

```
Fork → Branch → Commit → Push + PR → Code Review → Merge
```

⏱ **Goal:** PR reviewed and merged within 48 business hours.

---

## Before You Start

1. Read the [README](README.md) to understand the current state
2. Check the [open issues](https://github.com/ils15/open3dcalc/issues) — is someone already working on it?
3. **For large features**, open an issue first for discussion before coding
4. Make sure there is no [duplicate PR](https://github.com/ils15/open3dcalc/pulls)

---

## Step by Step

### 1. Fork + Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/your-username/open3dcalc.git
cd open3dcalc
git remote add upstream https://github.com/ils15/open3dcalc.git
git fetch upstream
```

### 2. Create Your Branch

Each feature/fix = **one branch + one Pull Request**.

| Prefixo     | When to Use   | Example                         |
| ----------- | ------------- | ------------------------------- |
| `feature/`  | New feature   | `feature/comparativo-historico` |
| `fix/`      | Bug fix       | `fix/auto-save-loop`            |
| `docs/`     | Documentation | `docs/contributing-guide`       |
| `refactor/` | Refactoring   | `refactor/storebridge`          |
| `test/`     | Tests         | `test/calculator-coverage`      |
| `chore/`    | Config/infra  | `chore/update-deps`             |

```bash
# Create the branch from the updated main
git checkout main
git pull upstream main
git checkout -b feature/my-feature
```

### 3. Commit (Conventional Commits)

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description in imperative>

[optional body — explain the WHY, not the what]
```

**Allowed types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

**Common scopes in the monorepo:**

- React components: `(calculator)`, `(catalog)`, `(dashboard)`
- Stores: `(stores)`, `(calculatorStore)`
- Infra: `(electron)`, `(db)`, `(pwa)`, `(ci)`
- Docs: `(readme)`, `(contributing)`

**Examples:**

- `feat(history): add side-by-side comparison of records`
- `fix(inventory): fix weight deduction with negative values`
- `docs(readme): update local installation section`
- `refactor(store): extract bridge logic to hook`
- `test(calculator): add coverage for resin calculation`
- `chore(electron): update electron-builder to v26`

### 4. Tests & Lint

Before committing, **mandatorily run**:

```bash
npm run lint          # ESLint — zero errors
npm run typecheck     # TypeScript — zero errors
npm run test:run     # Vitest — all green
npm run build:all    # Production build — success
```

> 💡 **Tip:** If you installed Husky hooks (recommended), this runs automatically on commit.

> **Note for Electron main process changes:** also run `npm run typecheck:electron` to check main process types.

> **Note on the pre-push hook:** `lint`, `typecheck` and `build:all` are enforced at zero errors, but the test step runs in baseline mode — while `main` carries inherited red, the hook blocks only _new_ test regressions (a failing file not listed in `scripts/push-gate-baseline.json`, or a failing count above it). Green CI is still required to merge; see [BRANCH-POLICY.md](BRANCH-POLICY.md#6-local-pre-push-gate-is-did-not-get-worse-ci-is-the-authority).

### 5. Open the Pull Request

1. Push your branch:
   ```bash
   git push origin feature/my-feature
   ```
2. Open the PR on GitHub — the template will guide you
3. **Every PR must:**
   - Reference the related issue (`Closes #12`)
   - Describe what was done and **why**
   - Include screenshots if changing the UI (before/after)
   - Confirm that tests/lint/build pass
   - List breaking changes if any

### 6. Code Review

- Minimum of **1 approval** from a maintainer
- Constructive discussions — focus on the code, not the person
- Resolve all conversations before merge
- **Documentation** PRs can be merged with 0 approvals after 24h

### 7. Merge

- We use **Squash & Merge** — all commits on the branch become a single commit on `main`
- The squash message must follow Conventional Commits
- The branch is deleted automatically after merge
- Stop using the local branch after merge: `git checkout main && git pull upstream main && git branch -d feature/my-feature`

---

## Branch Policy

| Branch      | Protected | Direct push | PR required | Approvals |
| ----------- | --------- | ----------- | ----------- | --------- |
| `main`      | ✅        | ❌          | ✅          | ≥ 1       |
| `feature/*` | ❌        | ✅          | N/A         | N/A       |
| `fix/*`     | ❌        | ✅          | N/A         | N/A       |

### Protection Rules (main)

- ❌ **No direct push** to main under any circumstances
- ✅ **PR required** with at least 1 approval
- ✅ **CI required** — lint, typecheck, test and build must pass
- ✅ **Branch up-to-date** with main before merge (avoid conflicts)
- ✅ **Squash merge only** — linear history

---

## Pull Request Checklist

- [ ] Unit tests were written/updated for the change
- [ ] `npm run lint` — no errors
- [ ] `npm run typecheck` — no errors
- [ ] `npm run test:run` — all passing
- [ ] `npm run build:all` or `npm run build:web`/`npm run build:desktop` as applicable
- [ ] Coverage ≥ 80% (for calculation logic)
- [ ] i18n updated: pt-BR + en-US
- [ ] Documentation updated (README if applicable)
- [ ] Screenshots attached (if UI change)
- [ ] CHANGELOG.md updated if it's a relevant change
- [ ] For Electron changes: `npm run typecheck:electron` passed

---

## Code Review — What We Evaluate

| Criterion         | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| **Functionality** | Does it solve the proposed problem? Does it cover edge cases? |
| **Clean Code**    | Clear names, no duplication, no `any`, small functions        |
| **Tests**         | Covers main flow + edge cases + error?                        |
| **Performance**   | Avoids unnecessary re-renders? Lazy loading ok?               |
| **i18n**          | Every visible string goes through `t()` from i18next?         |
| **Accessibility** | ARIA labels, contrast, keyboard navigation?                   |
| **Security**      | No script injection, no sensitive data exposed?               |

---

## Project Structure

```
open3dcalc/
├── src/
│   ├── shared/           # Code shared between web and desktop
│   │   ├── components/   # React components (Calculator, Catalog, Dashboard, UI)
│   │   ├── stores/       # Zustand stores (calculator, catalog, customer, history, etc)
│   │   ├── lib/          # Calculation logic, parsers, export (PDF, CSV)
│   │   ├── hooks/        # Custom React hooks (useCurrency, useTheme)
│   │   ├── types/        # TypeScript types
│   │   ├── i18n/         # Translations pt-BR / en-US
│   │   └── test/         # Test setup
│   └── platform/
│       ├── desktop/      # Electron-specific code (IPC, SQLite persistence)
│       └── web/          # PWA-specific code (service worker, manifest)
├── db/                   # Database schema (Drizzle ORM + SQLite migrations)
├── electron/             # Electron main process (TypeScript)
├── web/                  # Legacy code (git history preserved)
├── desktop/              # Legacy desktop code (git history preserved)
├── vite.base.config.ts   # Base Vite config (shared)
├── vite.web.config.ts    # Vite config for web
├── vite.desktop.config.ts# Vite config for desktop
└── index.web.html        # Web entry point
```

### Where to put your code

| Type of code                            | Target directory             |
| --------------------------------------- | ---------------------------- |
| React component used in web and desktop | `src/shared/components/`     |
| Zustand store                           | `src/shared/stores/`         |
| Calculation / parser logic              | `src/shared/lib/`            |
| React hook                              | `src/shared/hooks/`          |
| Type/i18n/test utilities                | `src/shared/types/i18n/test` |
| Electron-only code                      | `src/platform/desktop/`      |
| PWA-only code                           | `src/platform/web/`          |
| Electron main process                   | `electron/`                  |
| Database migration                      | `db/`                        |

### Available Scripts (root)

| Command                      | Description                                |
| ---------------------------- | ------------------------------------------ |
| `npm run dev:web`            | Vite development server (web)              |
| `npm run dev:desktop`        | Electron development + hot-reload          |
| `npm run build:web`          | Production web build                       |
| `npm run build:desktop`      | Production desktop build (Vite)            |
| `npm run build:all`          | Web + desktop build                        |
| `npm run build:electron`     | Compile Electron main process (TypeScript) |
| `npm run test`               | Vitest tests (watch mode)                  |
| `npm run test:run`           | Vitest tests (run mode)                    |
| `npm run typecheck`          | TypeScript type checking (`tsc --noEmit`)  |
| `npm run typecheck:electron` | TypeScript check for Electron main process |
| `npm run lint`               | ESLint across the entire project           |
| `npm run db:generate`        | Generate Drizzle ORM migrations            |
| `npm run db:migrate`         | Run SQLite migrations                      |

---

## Reporting Bugs

Open an issue using the **Bug Report** template with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment (browser, OS, app version)

---

## Questions?

- Open a [Discussion](https://github.com/ils15/open3dcalc/discussions) for general questions
- Issues are for bugs and specific features

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful — contributions are welcome regardless of experience level.
