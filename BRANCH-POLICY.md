# 🌿 Open3DCalc — Branch & PR Policy

> **Date:** July 2026
> **Goal:** Ensure full traceability of new features through branches + Pull Requests.

## 📋 Rules

### 1. Every new feature → branch + PR

No significant change goes directly to `main`. Every new feature, improvement, or structural fix must:

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/<feature-name>
   ```
2. Develop with commits following [Conventional Commits](https://www.conventionalcommits.org/)
3. Open a Pull Request to `main`
4. Go through review (minimum 1 approval)
5. CI/CD must pass (lint, typecheck, tests, build)

### 2. Branch naming

| Type       | Prefix     | Example                       |
| ---------- | ---------- | ----------------------------- |
| Feature    | `feat/`    | `feat/dark-mode-pdf-export`   |
| Fix        | `fix/`     | `fix/currency-conversion-bug` |
| Infra/Docs | `chore/`   | `chore/update-docker-compose` |
| Release    | `release/` | `release/v1.9.0`              |

### 3. Post-merge cleanup

Merged branches are deleted automatically by GitHub ("Delete branch" option in the PR) and locally:

```bash
git branch -d <branch>
git push origin --delete <branch>
```

### 4. Exceptional deepwork

For complex tasks (multi-turn, multi-agent), the flow continues via `/deepwork`, but the **final result always generates a PR** for merge into `main`.

### 5. Current branches

Last sweep: **2026-09-11** — 25 local and 23 `origin` stale branches, 4 stale fork
remotes, 3 stale worktrees, and 1 stale lint-staged stash were removed after verifying
their content was fully contained in `main` (via merged PRs or content checks).
Branches with **open PRs are never deleted** (D1.1 S1 + dependabot bumps).

| Branch                                     | Status                    | Action                                             |
| ------------------------------------------ | ------------------------- | -------------------------------------------------- |
| `main`                                     | ✅ Active                 | Development default branch                         |
| `feat/d1-s1-manifest-loader`               | 🔄 Open PR #107           | D1.1 S1 — SPEC-01 manifest loader                  |
| `dependabot/*` (12)                        | 🔄 Open PRs #53, #90–#101 | Dependency bumps pending review                    |
| `feature/fase2-complete`                   | ✅ Deleted                | Already implemented in main (v1.8 Bifrost)         |
| `feature/fase2-historico-unificado`        | ✅ Deleted                | Contained in fase2-complete (also already in main) |
| `feat/*`, `fix/*`, `chore/*` (pre-2026-09) | ✅ Deleted                | All squash-merged via PRs #29, #51–#106            |

---

_This policy replaces the previous flow where multiple obsolete branches polluted the repository._
